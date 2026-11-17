/**
 * 03 - 解决方案管理（/api/dataverse/solutions）
 * 对应前端工具：Solution Manager
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('03 - Solutions')
const { test } = suite

test('GET / returns solution list with publisher expansion', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/solutions')
  assertStatus(res, 200)
  const list = res.body?.value
  assert(Array.isArray(list) && list.length > 0, 'solutions list should be a non-empty array')
  const first = list[0]
  assert(typeof first.uniquename === 'string', 'solution should have uniquename')
  assert(typeof first.friendlyname === 'string', 'solution should have friendlyname')
  assert(typeof first.ismanaged === 'boolean', 'solution should have ismanaged')
  assert(first.publisherid && typeof first.publisherid.friendlyname === 'string',
    'solution should expand publisherid with friendlyname')
})

test('GET /:id/components returns components for a real solution', { requiresConnection: true }, async () => {
  const list = await apiGet('/api/dataverse/solutions')
  assertStatus(list, 200)
  // Default solution 一定包含组件
  const target = list.body.value.find(s => s.uniquename === 'Default') ?? list.body.value[0]
  const res = await apiGet(`/api/dataverse/solutions/${target.solutionid}/components`)
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value), 'components value should be an array')
  if (res.body.value.length > 0) {
    assert(typeof res.body.value[0].componenttype === 'number', 'component should have numeric componenttype')
  }
})

test('GET /:id/components with a non-existent GUID returns an empty list', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/solutions/00000000-0000-0000-0000-000000000000/components')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value) && res.body.value.length === 0,
    'non-existent solution should yield an empty component list')
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
