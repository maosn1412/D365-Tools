import { DataverseService } from './dataverseService.js'

/**
 * 元数据缓存（实体列表 / 实体字段列表）
 *
 * 背景：/EntityDefinitions 单次返回环境全部实体定义（MB 级），各页面切换时反复全量拉取
 * 是主要性能瓶颈。这里在服务端做 TTL + LRU + 并发去重，同一环境的元数据在一次 TTL 内
 * 只向 Dataverse 取一次；并发的相同请求共享同一个 in-flight Promise。
 *
 * 一致性：缓存按环境 URL 作用域隔离，连接/断开时由连接路由显式 clearMetadataCache()。
 */

export type MetadataRow = Record<string, unknown>

export interface CacheResult<T> {
  value: T
  cached: boolean
}

export interface MetadataCacheStats {
  hits: number
  misses: number
  entities: { cached: boolean; ageMs: number | null; count: number }
  attributes: { cachedEntities: number; entries: string[] }
}

interface CacheEntry<T> {
  value: T
  fetchedAt: number
  scope: string
}

/** 元数据变更不频繁，10 分钟内复用同一份结果（可用前端"刷新元数据"按钮强制清空） */
const TTL_MS = 10 * 60 * 1000
/** 单次会话最多缓存的实体字段集数量，超出按 LRU 淘汰 */
const MAX_ATTRIBUTE_ENTITIES = 60

const ENTITY_SELECT = 'LogicalName,DisplayName,ObjectTypeCode,PrimaryIdAttribute,PrimaryNameAttribute,EntitySetName'
const ATTRIBUTE_SELECT = 'LogicalName,DisplayName,AttributeType,RequiredLevel'

let entitiesEntry: CacheEntry<MetadataRow[]> | null = null
const attributeEntries = new Map<string, CacheEntry<MetadataRow[]>>()
let entitiesInFlight: { scope: string; promise: Promise<MetadataRow[]> } | null = null
const attributesInFlight = new Map<string, Promise<MetadataRow[]>>()
let hits = 0
let misses = 0

function currentScope(): string {
  return DataverseService.getInstance().getEnvironmentUrl()
}

function isFresh(entry: CacheEntry<unknown>): boolean {
  return entry.scope === currentScope() && Date.now() - entry.fetchedAt < TTL_MS
}

function sortByLogicalName(rows: MetadataRow[]): MetadataRow[] {
  return rows.sort((a, b) => String(a.LogicalName).localeCompare(String(b.LogicalName)))
}

/** 清空全部缓存（连接/断开、手动刷新时调用） */
export function clearMetadataCache(): void {
  entitiesEntry = null
  attributeEntries.clear()
  entitiesInFlight = null
  attributesInFlight.clear()
  hits = 0
  misses = 0
}

export function getMetadataCacheStats(): MetadataCacheStats {
  return {
    hits,
    misses,
    entities: {
      cached: entitiesEntry !== null && isFresh(entitiesEntry),
      ageMs: entitiesEntry ? Date.now() - entitiesEntry.fetchedAt : null,
      count: entitiesEntry?.value.length ?? 0,
    },
    attributes: {
      cachedEntities: attributeEntries.size,
      entries: Array.from(attributeEntries.keys()).map(key => key.split('|')[1] ?? key),
    },
  }
}

/** 全量实体定义（已按 LogicalName 排序），命中缓存时不再请求 Dataverse */
export async function loadEntities(): Promise<CacheResult<MetadataRow[]>> {
  if (entitiesEntry && isFresh(entitiesEntry)) {
    hits += 1
    return { value: entitiesEntry.value, cached: true }
  }

  const scope = currentScope()
  if (entitiesInFlight && entitiesInFlight.scope === scope) {
    hits += 1
    return { value: await entitiesInFlight.promise, cached: true }
  }

  misses += 1
  const promise = (async () => {
    const dataverse = DataverseService.getInstance()
    const result = (await dataverse.getWithQuery('/EntityDefinitions', {
      $select: ENTITY_SELECT,
    })) as { value?: MetadataRow[] }
    const rows = sortByLogicalName([...(result.value ?? [])])
    entitiesEntry = { value: rows, fetchedAt: Date.now(), scope }
    return rows
  })()

  entitiesInFlight = { scope, promise }
  try {
    return { value: await promise, cached: false }
  } finally {
    if (entitiesInFlight?.promise === promise) {
      entitiesInFlight = null
    }
  }
}

/** 单个实体的字段元数据（已按 LogicalName 排序） */
export async function loadAttributes(entityName: string): Promise<CacheResult<MetadataRow[]>> {
  const scope = currentScope()
  const key = `${scope}|${entityName.toLowerCase()}`

  const entry = attributeEntries.get(key)
  if (entry && isFresh(entry)) {
    hits += 1
    // 命中即刷新 LRU 位置
    attributeEntries.delete(key)
    attributeEntries.set(key, entry)
    return { value: entry.value, cached: true }
  }

  const pending = attributesInFlight.get(key)
  if (pending) {
    hits += 1
    return { value: await pending, cached: true }
  }

  misses += 1
  const promise = (async () => {
    const dataverse = DataverseService.getInstance()
    const result = (await dataverse.getWithQuery(
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes`,
      { $select: ATTRIBUTE_SELECT }
    )) as { value?: MetadataRow[] }
    const rows = sortByLogicalName([...(result.value ?? [])])
    attributeEntries.delete(key)
    attributeEntries.set(key, { value: rows, fetchedAt: Date.now(), scope })
    while (attributeEntries.size > MAX_ATTRIBUTE_ENTITIES) {
      const oldest = attributeEntries.keys().next()
      if (oldest.done) break
      attributeEntries.delete(oldest.value)
    }
    return rows
  })()

  attributesInFlight.set(key, promise)
  try {
    return { value: await promise, cached: false }
  } finally {
    attributesInFlight.delete(key)
  }
}

/**
 * 解析实体的 EntitySetName。
 * 命中实体列表缓存时零额外请求；未命中才退化为单实体查询（比全量列表便宜得多）。
 */
export async function resolveEntitySetName(logicalName: string): Promise<string | null> {
  if (entitiesEntry && entitiesEntry.scope === currentScope()) {
    const target = logicalName.toLowerCase()
    const row = entitiesEntry.value.find(e => String(e.LogicalName).toLowerCase() === target)
    if (row) {
      return typeof row.EntitySetName === 'string' ? row.EntitySetName : null
    }
  }

  const dataverse = DataverseService.getInstance()
  const meta = (await dataverse.getWithQuery(`/EntityDefinitions(LogicalName='${logicalName}')`, {
    $select: 'EntitySetName',
  })) as { EntitySetName?: string }
  return meta.EntitySetName ?? null
}
