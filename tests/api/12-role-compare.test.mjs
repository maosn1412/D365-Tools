/**
 * 12 - 角色权限对比（/api/dataverse/security/role-privileges, /compare）
 * 对应前端工具：Security Role Compare
 * 注：AddPrivilegesRole 为不可逆增量合并（无法通过 API 移除权限），
 *     不在自动化套件中做写往返，仅验证参数校验。
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, apiPost, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('12 - Security Role Compare')
const { test } = suite

async function roleIds() {
  const roles = await apiGet('/api/dataverse/security/roles')
  assertStatus(roles, 200)
  const list = roles.body?.value ?? []
  const sysAdmin = list.find(r => r.name === 'System Administrator')
  const customizer = list.find(r => r.name === 'System Customizer')
  assert(sysAdmin && customizer, 'environment should have System Administrator and System Customizer roles')
  return { sysAdmin: sysAdmin.roleid, customizer: customizer.roleid }
}

test('GET /role-privileges returns full privilege list', { requiresConnection: true }, async () => {
  const { sysAdmin } = await roleIds()
  const res = await apiGet(`/api/dataverse/security/role-privileges?roleId=${sysAdmin}`)
  assertStatus(res, 200)
  const privileges = res.body?.privileges
  assert(Array.isArray(privileges) && privileges.length > 100,
    `System Administrator should have hundreds of privileges, got ${privileges?.length}`)
  const readAccount = privileges.find(p => p.name === 'prvReadAccount')
  assert(readAccount, 'privileges should include prvReadAccount')
  assert(readAccount.depth === 8, `System Administrator prvReadAccount depth should be 8 (Org), got ${readAccount.depth}`)
  assert(readAccount.privilegeId, 'privilege should expose privilegeId')
})

test('GET /role-privileges validates roleId', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/role-privileges?roleId=bad')
  assertStatus(res, 400)
})

test('GET /compare SysAdmin vs System Customizer', { requiresConnection: true }, async () => {
  const { sysAdmin, customizer } = await roleIds()
  const res = await apiGet(`/api/dataverse/security/compare?roleIdA=${sysAdmin}&roleIdB=${customizer}`)
  assertStatus(res, 200)
  const { privileges, summary } = res.body ?? {}
  assert(Array.isArray(privileges) && privileges.length > 0, 'compare should return privilege rows')
  assert(summary && typeof summary.onlyA === 'number' && typeof summary.onlyB === 'number'
    && typeof summary.depthDiff === 'number' && typeof summary.same === 'number',
    'summary should expose onlyA/onlyB/depthDiff/same counters')
  // System Administrator 拥有 System Customizer 不具备的权限（如 prvReadRole 之外的管理类权限）
  assert(summary.onlyA > 0, `System Administrator should have privileges System Customizer lacks, got ${summary.onlyA}`)
  assert(summary.onlyA + summary.onlyB + summary.depthDiff + summary.same === privileges.length,
    'summary counters should add up to the total row count')
  for (const p of privileges) {
    assert(['both', 'onlyA', 'onlyB', 'depthDiff'].includes(p.status), `unexpected status ${p.status}`)
    if (p.status === 'both') assert(p.depthA === p.depthB, `both rows must share depth: ${p.name}`)
    if (p.status === 'onlyA') assert(p.depthB === 0, `onlyA rows must have depthB 0: ${p.name}`)
    if (p.status === 'onlyB') assert(p.depthA === 0, `onlyB rows must have depthA 0: ${p.name}`)
  }
})

test('GET /compare validates role ids', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/compare?roleIdA=bad&roleIdB=bad')
  assertStatus(res, 400)
})

test('POST /roles/:id/add-privileges validates payload', { requiresConnection: true }, async () => {
  const { customizer } = await roleIds()
  const empty = await apiPost(`/api/dataverse/security/roles/${customizer}/add-privileges`, { privileges: [] })
  assertStatus(empty, 400)
  const invalid = await apiPost(`/api/dataverse/security/roles/${customizer}/add-privileges`, {
    privileges: [{ privilegeId: 'not-a-guid', depth: 1 }],
  })
  assertStatus(invalid, 400)
  const badDepth = await apiPost(`/api/dataverse/security/roles/${customizer}/add-privileges`, {
    privileges: [{ privilegeId: customizer, depth: 3 }],
  })
  assertStatus(badDepth, 400)
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
