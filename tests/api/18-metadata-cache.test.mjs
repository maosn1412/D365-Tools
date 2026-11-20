/**
 * 18 - 元数据缓存（/api/dataverse/metadata 的 TTL 缓存与并发去重）
 *
 * 关注三件事：
 *   1. 同一份实体定义在 TTL 内只向上游取一次（第二次 X-Cache: HIT）
 *   2. 不同 limit 复用同一份全量结果（只付一次全量代价）
 *   3. 手动清空后重新回源（X-Cache: MISS），字段列表同样按实体缓存
 */
import { createSuite, assert, assertEqual, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, apiDelete, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('18 - Metadata Cache')
const { test } = suite

const CACHE_PATH = '/api/dataverse/metadata/cache'
const ENTITIES_PATH = '/api/dataverse/metadata/entities'

async function clearCache() {
  const res = await apiDelete(CACHE_PATH)
  assertStatus(res, 200, 'cache clear should succeed')
  assert(res.body?.cleared === true, 'cache clear should report cleared=true')
}

test('DELETE /cache clears the server-side cache and resets counters', { requiresConnection: true }, async () => {
  await clearCache()
  const stats = await apiGet(CACHE_PATH)
  assertStatus(stats, 200)
  assertEqual(stats.body?.hits, 0, 'hits should reset after clear')
  assertEqual(stats.body?.misses, 0, 'misses should reset after clear')
  assertEqual(stats.body?.entities?.cached, false, 'entities should no longer be cached')
})

test('second identical entities request is served from cache', { requiresConnection: true }, async () => {
  await clearCache()

  const first = await apiGet(`${ENTITIES_PATH}?limit=20`)
  assertStatus(first, 200)
  assertEqual(first.headers.get('x-cache'), 'MISS', 'first request should hit the environment')

  const second = await apiGet(`${ENTITIES_PATH}?limit=20`)
  assertStatus(second, 200)
  assertEqual(second.headers.get('x-cache'), 'HIT', 'second request should be served from cache')

  assert(Array.isArray(first.body?.value), 'value should be an array')
  assert(typeof first.body?.total === 'number', 'response should expose the total entity count')
  assert(first.body.total >= first.body.value.length, 'total should cover the returned slice')
})

test('different limit values reuse the same full entity fetch', { requiresConnection: true }, async () => {
  await clearCache()

  const small = await apiGet(`${ENTITIES_PATH}?limit=5`)
  assertEqual(small.headers.get('x-cache'), 'MISS', 'first call warms the cache')
  assertEqual(small.body.value.length, 5, 'limit=5 should return five rows')

  const large = await apiGet(`${ENTITIES_PATH}?limit=300`)
  assertEqual(large.headers.get('x-cache'), 'HIT', 'larger limit must not refetch the full list')
  assertEqual(large.body.value.length, Math.min(300, large.body.total), 'limit=300 should slice the cached list')

  const names = large.body.value.map(e => e.LogicalName)
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  assertEqual(JSON.stringify(names), JSON.stringify(sorted), 'cached list must stay sorted')
})

test('attribute metadata is cached per entity', { requiresConnection: true }, async () => {
  await clearCache()
  const path = '/api/dataverse/metadata/entities/account/attributes'

  const first = await apiGet(path)
  assertStatus(first, 200)
  assertEqual(first.headers.get('x-cache'), 'MISS', 'first attribute request should hit the environment')

  const second = await apiGet(path)
  assertStatus(second, 200)
  assertEqual(second.headers.get('x-cache'), 'HIT', 'second attribute request should be cached')
  assertEqual(second.body.value.length, first.body.value.length, 'cached attributes should match the first response')

  const stats = await apiGet(CACHE_PATH)
  assert(stats.body.attributes.cachedEntities >= 1, 'stats should report the cached attribute set')
})

test('clearing the cache forces a fresh fetch again', { requiresConnection: true }, async () => {
  await clearCache()
  await apiGet(`${ENTITIES_PATH}?limit=10`)
  const warm = await apiGet(`${ENTITIES_PATH}?limit=10`)
  assertEqual(warm.headers.get('x-cache'), 'HIT', 'warm cache should hit')

  await clearCache()
  const cold = await apiGet(`${ENTITIES_PATH}?limit=10`)
  assertEqual(cold.headers.get('x-cache'), 'MISS', 'after clearing the next request must refetch')
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
