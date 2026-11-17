/**
 * 08 - Web 资源（/api/dataverse/webresources）
 * 对应前端工具：Web Resource Manager
 * 注意：publish 用例会对一个已存在的资源执行 PublishXml（幂等操作，等同于在
 * 经典界面点击一次 Publish，不改变资源内容）。
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, apiPost, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('08 - Web Resources')
const { test } = suite

test('GET / returns list without base64 content', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/webresources')
  assertStatus(res, 200)
  const list = res.body?.value
  assert(Array.isArray(list) && list.length > 0, 'web resource list should be non-empty')
  const first = list[0]
  assert(typeof first.webresourceid === 'string', 'item should have webresourceid')
  assert(typeof first.name === 'string', 'item should have name')
  assert(typeof first.webresourcetype === 'number', 'item should have numeric webresourcetype')
  assert(!('content' in first), 'list payload should exclude base64 content (loaded on demand)')
})

test('GET /:id returns detail including content', { requiresConnection: true }, async () => {
  const list = await apiGet('/api/dataverse/webresources')
  assertStatus(list, 200)
  const target = list.body.value[0]
  const res = await apiGet(`/api/dataverse/webresources/${target.webresourceid}`)
  assertStatus(res, 200)
  assert(typeof res.body?.content === 'string' && res.body.content.length > 0,
    'detail should include base64 content')
  // base64 特征：只含合法字符
  assert(/^[A-Za-z0-9+/=\r\n]+$/.test(res.body.content), 'content should be valid base64')
})

test('POST /:id/publish succeeds for an existing resource', { requiresConnection: true }, async () => {
  const list = await apiGet('/api/dataverse/webresources')
  assertStatus(list, 200)
  const target = list.body.value[0]
  const res = await apiPost(`/api/dataverse/webresources/${target.webresourceid}/publish`, {})
  assertStatus(res, 200, 'PublishXml should succeed for an existing web resource')
  assert(res.body?.success === true, 'publish body should be { success: true }')
})

test('GET /:id with unknown id returns server error', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/webresources/00000000-0000-0000-0000-000000000000')
  assert(res.status === 500 || res.status === 404, `unknown web resource should fail, got ${res.status}`)
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
