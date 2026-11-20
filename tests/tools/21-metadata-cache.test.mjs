/**
 * 21 - Metadata Cache (source contract)
 *
 * 锁定"切模块不再重复拉取全量实体"的实现契约：
 *   1. 前端有模块级缓存（TTL / in-flight 去重 / LRU / 迟到响应丢弃），页面的元数据请求统一走它
 *   2. 连接环境变化时清空缓存，避免把旧环境的实体列表渲染到新环境
 *   3. 全局"刷新元数据"按钮同时清空服务端与前端缓存并递增 epoch 触发重取
 *   4. 服务端 /EntityDefinitions 结果 TTL 缓存 + X-Cache 头 + 手动清空接口
 */
import { createSuite, assert, assertIncludes, isMain } from '../lib/harness.mjs'
import { readProjectFile } from '../lib/source.mjs'

export const suite = createSuite('21 - Metadata Cache (source contract)')
const { test } = suite

const clientCache = await readProjectFile('client/src/lib/metadataCache.ts')
const refreshStore = await readProjectFile('client/src/stores/metadataRefreshStore.ts')
const connStore = await readProjectFile('client/src/stores/connectionStore.ts')
const hooks = await readProjectFile('client/src/hooks/useMetadata.ts')
const api = await readProjectFile('client/src/services/api.ts')
const layout = await readProjectFile('client/src/components/layout/AppLayout.tsx')
const dataQuery = await readProjectFile('client/src/pages/tools/DataQuery.tsx')
const fetchXml = await readProjectFile('client/src/pages/tools/FetchXmlBuilder.tsx')
const metadataViewer = await readProjectFile('client/src/pages/tools/MetadataViewer.tsx')

const serverCache = await readProjectFile('server/src/services/metadataCache.ts')
const metadataRoute = await readProjectFile('server/src/routes/metadata.ts')
const dataRoute = await readProjectFile('server/src/routes/data.ts')
const connRoute = await readProjectFile('server/src/routes/connection.ts')
const dvService = await readProjectFile('server/src/services/dataverseService.ts')
const runner = await readProjectFile('tests/run-all.mjs')

test('client cache exposes scope/clear/read/load for entities and attributes', () => {
  assertIncludes(clientCache, 'export function setMetadataCacheScope', 'scope setter')
  assertIncludes(clientCache, 'export function clearClientMetadataCache', 'cache reset')
  assertIncludes(clientCache, 'export function readCachedEntities', 'sync read for instant render')
  assertIncludes(clientCache, 'export function readCachedAttributes', 'sync attribute read')
  assertIncludes(clientCache, 'export async function loadEntityMetadata', 'cached entities loader')
  assertIncludes(clientCache, 'export async function loadEntityAttributeMetadata', 'cached attribute loader')
})

test('client cache has TTL, in-flight dedupe, LRU cap and stale-response guard', () => {
  assertIncludes(clientCache, 'const TTL_MS', 'ttl constant')
  assertIncludes(clientCache, 'const MAX_ATTRIBUTE_ENTITIES', 'attribute LRU cap')
  assertIncludes(clientCache, 'inFlight.get(', 'in-flight dedupe lookup')
  assertIncludes(clientCache, 'inFlight.set(', 'in-flight registration')
  assertIncludes(clientCache, 'generation += 1', 'generation bump on clear')
  assertIncludes(clientCache, 'gen === generation', 'late responses must be dropped after a clear')
  assertIncludes(clientCache, 'attributeEntries.delete(oldest.value)', 'LRU eviction')
})

test('metadata hooks read cache first and refetch on epoch change', () => {
  assertIncludes(hooks, "from '@/lib/metadataCache'", 'hooks use the shared cache')
  assertIncludes(hooks, 'readCachedEntities()', 'entities render from cache first')
  assertIncludes(hooks, 'readCachedAttributes(entityName)', 'attributes render from cache first')
  assertIncludes(hooks, "useMetadataRefreshStore(s => s.epoch)", 'epoch subscription')
  assertIncludes(hooks, '[connected, environmentUrl, epoch]', 'entities effect depends on epoch + environment')
  assertIncludes(hooks, '[connected, environmentUrl, entityName, epoch]', 'attributes effect depends on epoch + entity')
  assert(!hooks.includes('fetchMetadataEntities'), 'hooks must not call the uncached API directly')
  assert(!hooks.includes('fetchEntityAttributes'), 'hooks must not call the uncached attribute API directly')
})

test('tool pages route metadata through the cache instead of raw fetches', () => {
  for (const [name, src] of [['DataQuery', dataQuery], ['FetchXmlBuilder', fetchXml], ['MetadataViewer', metadataViewer]]) {
    assert(!src.includes('fetchMetadataEntities'), `${name} must not call fetchMetadataEntities directly`)
    assert(!src.includes('fetchEntityAttributes'), `${name} must not call fetchEntityAttributes directly`)
    assertIncludes(src, 'loadEntityMetadata', `${name} should load entities through the cache`)
    assertIncludes(src, 'useMetadataRefreshStore', `${name} should react to a global metadata refresh`)
  }
  assertIncludes(metadataViewer, 'loadEntityAttributeMetadata', 'MetadataViewer attributes go through the cache')
})

test('connection scope changes invalidate the client cache', () => {
  assertIncludes(connStore, 'setMetadataCacheScope(environmentUrl)', 'connect sets the scope')
  assertIncludes(connStore, 'setMetadataCacheScope(\'\')', 'disconnect clears the scope')
})

test('global refresh clears both layers and bumps epoch', () => {
  assertIncludes(refreshStore, 'clearServerMetadataCache', 'server cache clear')
  assertIncludes(refreshStore, 'clearClientMetadataCache', 'client cache clear')
  assertIncludes(refreshStore, 'epoch: state.epoch + 1', 'epoch bump triggers hooks')
  assertIncludes(refreshStore, 'if (get().refreshing) return', 'double-click guard')
  assertIncludes(api, "fetch(`${API_BASE}/dataverse/metadata/cache`, { method: 'DELETE' })", 'DELETE endpoint call')
  assertIncludes(layout, 'Refresh entity metadata from the environment', 'refresh button tooltip')
  assertIncludes(layout, 'disabled={refreshing}', 'button disabled while refreshing')
  assertIncludes(layout, 'IconRefresh', 'refresh icon')
})

test('server caches the full entity list once, with hit/miss reporting', () => {
  assertIncludes(serverCache, 'const TTL_MS', 'ttl constant')
  assertIncludes(serverCache, 'const MAX_ATTRIBUTE_ENTITIES', 'attribute LRU cap')
  assertIncludes(serverCache, 'entitiesInFlight', 'entity in-flight dedupe')
  assertIncludes(serverCache, 'attributesInFlight', 'attribute in-flight dedupe')
  assertIncludes(serverCache, 'export function clearMetadataCache', 'cache reset')
  assertIncludes(serverCache, 'export async function resolveEntitySetName', 'entity set resolution from cache')
  assertIncludes(serverCache, 'getEnvironmentUrl()', 'cache scoped by environment')
  assertIncludes(metadataRoute, "res.setHeader('X-Cache', cached ? 'HIT' : 'MISS')", 'cache header')
  assertIncludes(metadataRoute, 'loadEntities()', 'entities served from cache')
  assertIncludes(metadataRoute, 'loadAttributes(entityName)', 'attributes served from cache')
  assertIncludes(metadataRoute, "metadataRouter.delete('/cache'", 'manual clear endpoint')
  assert(!metadataRoute.includes("getWithQuery('/EntityDefinitions'"), 'route must not hit Dataverse directly')
  assertIncludes(dvService, 'getEnvironmentUrl()', 'environment scope getter')
})

test('connection lifecycle and FetchXML fallback use the cache', () => {
  assertIncludes(connRoute, 'clearMetadataCache()', 'connect/disconnect invalidate the cache')
  assertIncludes(dataRoute, 'resolveEntitySetName', 'FetchXML set-name resolution reuses the cache')
  assert(!dataRoute.includes("getWithQuery(`/EntityDefinitions(LogicalName='${logicalName}')`"), 'no duplicate metadata round trip')
  assertIncludes(runner, "from './api/18-metadata-cache.test.mjs'", 'api suite registered')
  assertIncludes(runner, "from './tools/21-metadata-cache.test.mjs'", 'source suite registered')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run({})
  process.exitCode = failed > 0 ? 1 : 0
}
