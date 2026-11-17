/**
 * 02 - 元数据服务（/api/dataverse/metadata）
 * 对应前端工具：Entity Metadata Viewer、各页面的实体/字段下拉框数据源
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('02 - Metadata')
const { test } = suite

test('GET /entities returns sorted entity list with key fields', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/metadata/entities')
  assertStatus(res, 200)
  const list = res.body?.value
  assert(Array.isArray(list) && list.length > 0, 'entities list should be a non-empty array')
  const first = list[0]
  assert(typeof first.LogicalName === 'string', 'entity should have LogicalName')
  assert(typeof first.EntitySetName === 'string', 'entity should have EntitySetName')
  // 服务端排序验证
  const names = list.map(e => e.LogicalName)
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  assert(JSON.stringify(names) === JSON.stringify(sorted), 'entities should be sorted by LogicalName')
})

test('GET /entities?limit=5 respects the limit', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/metadata/entities?limit=5')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value), 'value should be an array')
  assert(res.body.value.length <= 5, `limit=5 should return at most 5 entities, got ${res.body.value.length}`)
})

test('GET /entities/account/attributes returns attribute metadata', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/metadata/entities/account/attributes')
  assertStatus(res, 200)
  const attrs = res.body?.value
  assert(Array.isArray(attrs) && attrs.length > 0, 'attributes should be a non-empty array')
  const names = attrs.map(a => a.LogicalName)
  assert(names.includes('name'), 'account should have a "name" attribute')
  assert(names.includes('accountid'), 'account should have an "accountid" attribute')
  assert(typeof attrs[0].AttributeType === 'string', 'attribute should have AttributeType')
})

test('GET /entities/:unknown/attributes returns server error for invalid entity', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/metadata/entities/new_nonexistent_xyz/attributes')
  assert(res.status === 500 || res.status === 404, `invalid entity should fail with 4xx/5xx, got ${res.status}`)
  assert(typeof res.body?.error === 'string', 'error body should contain a message')
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
