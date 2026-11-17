/**
 * 01 - 连接管理（/api/connection）
 * 覆盖：状态查询、参数校验、未连接保护（401）、真实连接、断开后重连。
 * 注意：本套件会改变 server 的连接状态，结束时保证恢复为"已连接"（有凭据时），
 * 以便后续套件复用连接。
 */
import { createSuite, assert, assertEqual, assertIncludes, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, apiPost, connect, disconnect, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('01 - Connection')
const { test } = suite

test('GET /status returns a well-formed response', async () => {
  const res = await apiGet('/api/connection/status')
  assertStatus(res, 200)
  assert(typeof res.body?.connected === 'boolean', 'status body should contain connected:boolean')
})

test('POST /connect without required fields returns 400', async () => {
  const res = await apiPost('/api/connection/connect', {})
  assertStatus(res, 400)
  assertIncludes(res.body?.error ?? '', 'environmentUrl', 'error should mention missing fields')
})

test('POST /connect with invalid authType returns 400', async () => {
  const res = await apiPost('/api/connection/connect', {
    authType: 'not-a-real-auth-type',
    environmentUrl: 'https://example.crm.dynamics.com',
  })
  assertStatus(res, 400)
  assertIncludes(res.body?.error ?? '', 'authType', 'error should mention invalid authType')
})

test('POST /connect clientSecret without credentials returns 400', async () => {
  const res = await apiPost('/api/connection/connect', {
    authType: 'clientSecret',
    environmentUrl: 'https://example.crm.dynamics.com',
  })
  assertStatus(res, 400)
  assertIncludes(res.body?.error ?? '', 'clientSecret', 'error should list required credential fields')
})

test('dataverse routes reject requests while disconnected (401)', async () => {
  await disconnect()
  const res = await apiGet('/api/dataverse/metadata/entities')
  assertStatus(res, 401, 'requireConnection middleware should reject with 401')
  assertIncludes(res.body?.error ?? '', 'Not connected', '401 body should explain the cause')
})

test('POST /connect with valid credentials succeeds', { requiresCredentials: true }, async () => {
  const res = await connect()
  assertStatus(res, 200, 'connect with test credentials should succeed')
  assert(res.body?.success === true, 'connect body should be { success: true }')
  assertEqual(res.body?.environmentUrl, (await import('../lib/api.mjs')).config.credentials.environmentUrl)

  const status = await apiGet('/api/connection/status')
  assert(status.body?.connected === true, 'status should report connected after connect')
})

// 收尾：确保套件结束后 server 处于已连接状态（有凭据时），供后续套件复用
test('restore connection for subsequent suites', { requiresCredentials: true }, async () => {
  const ok = await ensureConnected()
  assert(ok, 'failed to restore connection')
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
