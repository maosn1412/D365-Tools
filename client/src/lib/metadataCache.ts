import {
  fetchMetadataEntities,
  fetchEntityAttributes,
  type EntityMetadataItem,
  type AttributeMetadataItem,
} from '@/services/api'

/**
 * 元数据前端缓存（实体列表 / 实体字段列表）
 *
 * 各工具页在切换模块时都会重新挂载，原先每次挂载都重新向环境全量拉取实体定义，
 * 这是"切一个模块卡一下"的直接原因。这里做模块级缓存：TTL 内直接命中、并发请求合并、
 * 字段列表按实体 LRU 限制条目数。
 *
 * 作用域：连接的服务环境变化时由 connectionStore 调用 setMetadataCacheScope 清空，
 * 避免把上一个环境的实体列表渲染到新环境。全局"刷新元数据"通过 clearClientMetadataCache
 * 失效后，各 hook 依赖的 epoch 变化触发重新拉取。
 */

const TTL_MS = 10 * 60 * 1000
/** 最多缓存的实体字段集数量，超出按 LRU 淘汰 */
const MAX_ATTRIBUTE_ENTITIES = 60

interface CacheEntry<T> {
  value: T
  fetchedAt: number
}

export interface CachedValue<T> {
  value: T
  stale: boolean
}

let scope = ''
// 每次清空自增，迟到的响应不得写回缓存
let generation = 0
let entitiesEntry: CacheEntry<EntityMetadataItem[]> | null = null
const attributeEntries = new Map<string, CacheEntry<AttributeMetadataItem[]>>()
const inFlight = new Map<string, Promise<unknown>>()

function isFresh(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.fetchedAt < TTL_MS
}

function attributeCacheKey(entityName: string): string {
  return `attributes|${entityName.trim().toLowerCase()}`
}

function toCached<T>(entry: CacheEntry<T> | undefined | null): CachedValue<T> | null {
  if (!entry) return null
  return { value: entry.value, stale: !isFresh(entry) }
}

/** 连接环境变化时切换缓存作用域（环境变了必须丢弃旧环境的元数据） */
export function setMetadataCacheScope(next: string): void {
  if (next === scope) return
  scope = next
  clearClientMetadataCache()
}

/** 清空全部缓存（切换环境、手动刷新时调用） */
export function clearClientMetadataCache(): void {
  generation += 1
  entitiesEntry = null
  attributeEntries.clear()
  inFlight.clear()
}

/** 只读缓存（可能已过期），用于切换页面时先渲染、再决定是否刷新 */
export function readCachedEntities(): CachedValue<EntityMetadataItem[]> | null {
  return toCached(entitiesEntry)
}

export function readCachedAttributes(entityName: string): CachedValue<AttributeMetadataItem[]> | null {
  return toCached(attributeEntries.get(attributeCacheKey(entityName)))
}

/**
 * 取实体列表：TTL 内直接命中缓存（不发请求），过期或缺失才请求。
 * 相同 key 的并发调用共享同一个 Promise。
 */
export async function loadEntityMetadata(): Promise<EntityMetadataItem[]> {
  if (entitiesEntry && isFresh(entitiesEntry)) {
    return entitiesEntry.value
  }

  const pending = inFlight.get('entities')
  if (pending) return pending as Promise<EntityMetadataItem[]>

  const gen = generation
  const promise = fetchMetadataEntities()
    .then(list => {
      if (gen === generation) {
        entitiesEntry = { value: list, fetchedAt: Date.now() }
      }
      return list
    })
    .finally(() => {
      if (inFlight.get('entities') === promise) inFlight.delete('entities')
    })

  inFlight.set('entities', promise)
  return promise
}

/** 取实体字段元数据：按实体缓存 + LRU 淘汰 */
export async function loadEntityAttributeMetadata(entityName: string): Promise<AttributeMetadataItem[]> {
  const key = attributeCacheKey(entityName)
  const entry = attributeEntries.get(key)
  if (entry && isFresh(entry)) {
    // 命中即刷新 LRU 位置
    attributeEntries.delete(key)
    attributeEntries.set(key, entry)
    return entry.value
  }

  const pending = inFlight.get(key)
  if (pending) return pending as Promise<AttributeMetadataItem[]>

  const gen = generation
  const promise = fetchEntityAttributes(entityName.trim())
    .then(list => {
      if (gen === generation) {
        attributeEntries.delete(key)
        attributeEntries.set(key, { value: list, fetchedAt: Date.now() })
        while (attributeEntries.size > MAX_ATTRIBUTE_ENTITIES) {
          const oldest = attributeEntries.keys().next()
          if (oldest.done) break
          attributeEntries.delete(oldest.value)
        }
      }
      return list
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key)
    })

  inFlight.set(key, promise)
  return promise
}
