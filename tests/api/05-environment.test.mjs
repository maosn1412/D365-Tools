/**
 * 05 - 环境信息（/api/dataverse/environment）
 * 对应前端工具：Environment Info Dashboard
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('05 - Environment')
const { test } = suite

test('GET /info returns organization, user and version', { requiresConnection: true }, async () => {
  // 端点本身是容错设计（Promise.allSettled，任一子查询失败返回 null），而测试环境
  // 偶发 ECONNRESET；子查询缺失时重试几次再断言。
  let body
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await apiGet('/api/dataverse/environment/info')
    assertStatus(res, 200)
    body = res.body ?? {}
    if (body.organization && body.user && body.version) break
    await new Promise(r => setTimeout(r, 2000))
  }
  const { organization, user, version } = body ?? {}
  assert(organization && typeof organization.name === 'string', 'organization should have a name')
  assert(typeof organization.organizationid === 'string', 'organization should have an id')
  assert(user && typeof user.fullname === 'string', 'user should have a fullname')
  assert(typeof version === 'string' && version.length > 0, 'version should be a non-empty string')
})

test('GET /stats returns the four counters', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/environment/stats')
  assertStatus(res, 200)
  for (const key of ['solutions', 'webResources', 'users', 'entities']) {
    assert(key in (res.body ?? {}), `stats should contain "${key}"`)
    const value = res.body[key]
    assert(value === null || typeof value === 'number', `"${key}" should be a number or null`)
  }
  assert(typeof res.body.entities === 'number' && res.body.entities > 0,
    'entities count should be a positive number')
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
