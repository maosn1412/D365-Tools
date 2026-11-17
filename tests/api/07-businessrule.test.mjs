/**
 * 07 - 业务规则（/api/dataverse/businessrules）
 * 对应前端工具：Business Rule Inspector
 * 注意：测试环境可能没有业务规则，details 用例在无规则时自动跳过。
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('07 - Business Rules')
const { test } = suite

test('GET /?entityName=account returns a rule list', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/businessrules?entityName=account')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value), 'value should be an array (possibly empty)')
  if (res.body.value.length > 0) {
    const rule = res.body.value[0]
    assert(typeof rule.workflowid === 'string', 'rule should have workflowid')
    assert(typeof rule.statecode === 'number', 'rule should have numeric statecode')
  }
})

test('GET / without entityName returns all business rules', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/businessrules')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value), 'value should be an array')
})

test('GET /:id/details returns parsed conditions/actions/raw', { requiresConnection: true }, async () => {
  const list = await apiGet('/api/dataverse/businessrules')
  assertStatus(list, 200)
  if (list.body.value.length === 0) {
    console.log('    (no business rules in environment - detail check skipped)')
    return
  }
  const rule = list.body.value[0]
  const res = await apiGet(`/api/dataverse/businessrules/${rule.workflowid}/details`)
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.conditions), 'details should contain conditions array')
  assert(Array.isArray(res.body?.actions), 'details should contain actions array')
  assert('raw' in res.body, 'details should expose the raw parsed definition')
})

test('GET /:id/details with unknown id returns server error', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/businessrules/00000000-0000-0000-0000-000000000000/details')
  assert(res.status === 500 || res.status === 404, `unknown workflow should fail, got ${res.status}`)
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
