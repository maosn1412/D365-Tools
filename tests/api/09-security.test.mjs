/**
 * 09 - 安全角色权限（/api/dataverse/security）
 * 对应前端工具：Security Role Privilege Viewer
 */
import { createSuite, assert, assertIncludes, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('09 - Security Roles')
const { test } = suite

test('GET /roles returns role list', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/roles')
  assertStatus(res, 200)
  const list = res.body?.value
  assert(Array.isArray(list) && list.length > 0, 'roles list should be non-empty')
  assert(typeof list[0].roleid === 'string', 'role should have roleid')
  assert(typeof list[0].name === 'string', 'role should have name')
})

test('GET /matrix without entityName returns 400', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/matrix')
  assertStatus(res, 400)
  assertIncludes(res.body?.error ?? '', 'entityName', 'error should mention entityName is required')
})

test('GET /matrix?entityName=account returns 8-action matrix', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/matrix?entityName=account')
  assertStatus(res, 200)
  const { actions, roles } = res.body ?? {}
  assert(Array.isArray(actions) && actions.length === 8, 'matrix should expose 8 actions')
  for (const expected of ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share']) {
    assert(actions.includes(expected), `actions should include ${expected}`)
  }
  assert(Array.isArray(roles) && roles.length > 0, 'matrix should contain roles')
  // System Administrator 对 account 应为全组织级权限（depth 8）
  const sysAdmin = roles.find(r => r.roleName === 'System Administrator')
  assert(sysAdmin, 'matrix should include the System Administrator role')
  assert(sysAdmin.privileges.Read === 8, `System Administrator Read depth should be 8 (Org), got ${sysAdmin.privileges.Read}`)
  assert(sysAdmin.privileges.Create === 8, 'System Administrator Create depth should be 8 (Org)')
  assert(sysAdmin.privileges.Delete === 8, 'System Administrator Delete depth should be 8 (Org)')
})

test('GET /matrix?entityName=unknown returns roles with empty privileges', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/matrix?entityName=new_nonexistent_xyz')
  assertStatus(res, 200)
  const roles = res.body?.roles ?? []
  assert(roles.length > 0, 'roles should still be listed')
  const withPrivileges = roles.filter(r => Object.keys(r.privileges).length > 0)
  assert(withPrivileges.length === 0,
    `no role should have privileges for a non-existent entity, got ${withPrivileges.length}`)
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
