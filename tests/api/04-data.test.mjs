/**
 * 04 - 数据查询（/api/dataverse/data）
 * 对应前端工具：Data Query Tool、FetchXML Builder 的 Fetch Data
 */
import { createSuite, assert, assertIncludes, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, apiPost, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('04 - Data Query')
const { test } = suite
const postFetchXml = (body) => apiPost('/api/dataverse/data/fetchxml', body, { idempotent: true })

test('GET /accounts with $top and $select returns shaped records', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/data/accounts?$top=3&$select=name')
  assertStatus(res, 200)
  const records = res.body?.value
  assert(Array.isArray(records), 'value should be an array')
  assert(records.length <= 3, `$top=3 should cap results, got ${records.length}`)
  if (records.length > 0) {
    assert('name' in records[0] || 'accountid' in records[0],
      'record should contain the selected field or primary key')
  }
})

test('GET /accounts with $filter only returns matching records', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/data/accounts?$top=5&$select=name,statecode&$filter=statecode eq 0')
  assertStatus(res, 200)
  const records = res.body?.value ?? []
  for (const r of records) {
    assert(r.statecode === 0, `filtered record should have statecode 0, got ${r.statecode}`)
  }
})

test('POST /fetchxml without fetchXml returns 400', { requiresConnection: true }, async () => {
  const res = await postFetchXml({})
  assertStatus(res, 400)
  assertIncludes(res.body?.error ?? '', 'fetchXml', 'error should mention fetchXml is required')
})

test('POST /fetchxml executes with explicit entitySetName', { requiresConnection: true }, async () => {
  const res = await postFetchXml({
    fetchXml: '<fetch top="1"><entity name="account"><attribute name="name" /></entity></fetch>',
    entitySetName: 'accounts',
  })
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value), 'fetchxml result should contain a value array')
})

test('POST /fetchxml resolves EntitySetName from the root entity', { requiresConnection: true }, async () => {
  const res = await postFetchXml({
    fetchXml: '<fetch top="1"><entity name="contact"><attribute name="fullname" /></entity></fetch>',
  })
  assertStatus(res, 200, 'fallback resolution via EntityDefinitions should succeed')
  assert(Array.isArray(res.body?.value), 'fetchxml result should contain a value array')
})

test('POST /fetchxml with unknown root entity surfaces a clear error', { requiresConnection: true }, async () => {
  // Dataverse 对不存在的实体元数据返回 404，dataverseService 包装后经 server 以 500 透出，
  // 错误消息中保留原始 "does not exist" 说明
  const res = await postFetchXml({
    fetchXml: '<fetch top="1"><entity name="new_nonexistent_xyz"><attribute name="name" /></entity></fetch>',
  })
  assert(res.status === 404 || res.status === 500, `unknown entity should fail, got ${res.status}`)
  assertIncludes(res.body?.error ?? '', 'does not exist', 'error should explain the entity does not exist')
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
