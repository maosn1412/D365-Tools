/**
 * 10 - 用户权限全景（/api/dataverse/security/users*）
 * 对应前端工具：User Access Analyzer
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, apiPost, apiDelete, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('10 - User Access Analyzer')
const { test } = suite

test('GET /users returns user list', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/users?top=5')
  assertStatus(res, 200)
  const list = res.body?.value
  assert(Array.isArray(list) && list.length > 0, 'users list should be non-empty')
  assert(typeof list[0].systemuserid === 'string', 'user should have systemuserid')
  assert(typeof list[0].fullname === 'string', 'user should have fullname')
})

test('GET /users?search= filters by name', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/users?search=a&top=10')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value), 'search should return an array')
})

test('GET /users/:id/profile aggregates roles and teams', { requiresConnection: true }, async () => {
  const users = await apiGet('/api/dataverse/security/users?top=1')
  assertStatus(users, 200)
  const userId = users.body?.value?.[0]?.systemuserid
  assert(userId, 'need at least one user in the environment')

  const res = await apiGet(`/api/dataverse/security/users/${userId}/profile`)
  assertStatus(res, 200)
  const { user, directRoles, teams } = res.body ?? {}
  assert(user && user.systemuserid === userId, 'profile should echo the queried user id')
  assert(typeof user.fullname === 'string', 'profile user should have fullname')
  assert(Array.isArray(directRoles), 'directRoles should be an array')
  assert(Array.isArray(teams), 'teams should be an array')
  for (const role of directRoles ?? []) {
    assert(typeof role.roleId === 'string' && typeof role.name === 'string', 'role should have roleId and name')
  }
  for (const team of teams ?? []) {
    assert(typeof team.teamId === 'string' && typeof team.name === 'string', 'team should have teamId and name')
    assert(Array.isArray(team.roles), 'team should embed roles array')
  }
})

test('GET /users/:id/profile rejects invalid id', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/security/users/not-a-guid/profile')
  assertStatus(res, 400)
})

test('assign then remove role roundtrip restores state', { requiresConnection: true }, async () => {
  // 选一个真实用户（跳过 '#' 开头的系统/应用账户）+ 一个其尚未直接拥有的角色。
  // /users 按 fullname 升序，'#' 账户会占满 top 窗口，故用通用数据端点过滤选夹具用户。
  const users = await apiGet('/api/dataverse/data/systemusers?' + new URLSearchParams({
    $select: 'systemuserid,fullname',
    $filter: "isdisabled eq false and not startswith(fullname,'#')",
    $top: '5',
  }).toString())
  const user = (users.body?.value ?? [])[0]
  assert(user, 'need a non-system user')
  const userId = user.systemuserid

  const profileBefore = await apiGet(`/api/dataverse/security/users/${userId}/profile`)
  assertStatus(profileBefore, 200)
  const ownedNames = new Set((profileBefore.body?.directRoles ?? []).map(r => r.name))

  const roles = await apiGet('/api/dataverse/security/roles')
  assertStatus(roles, 200)
  const candidate = (roles.body?.value ?? []).find(r => !ownedNames.has(r.name))
  assert(candidate, 'need a role the user does not already have directly')

  const assign = await apiPost(`/api/dataverse/security/users/${userId}/roles`, { roleId: candidate.roleid })
  if (assign.status === 500 && String(assign.body?.error ?? '').includes('0x80040265')) {
    // 组织策略（Compliance Country 必填）会拒绝一切 API 角色变更，
    // 属于环境限制而非接口缺陷，跳过往返断言。
    console.log('  [note] org policy blocks role assignment (0x80040265 Compliance Country), roundtrip skipped')
    return
  }
  assertStatus(assign, 200)

  const profileAfterAssign = await apiGet(`/api/dataverse/security/users/${userId}/profile`)
  const namesAfterAssign = new Set((profileAfterAssign.body?.directRoles ?? []).map(r => r.name))
  assert(namesAfterAssign.has(candidate.name), 'role should appear in directRoles after assign')

  const remove = await apiDelete(`/api/dataverse/security/users/${userId}/roles/${candidate.roleid}`)
  assertStatus(remove, 200)

  const profileAfterRemove = await apiGet(`/api/dataverse/security/users/${userId}/profile`)
  const namesAfterRemove = new Set((profileAfterRemove.body?.directRoles ?? []).map(r => r.name))
  assert(!namesAfterRemove.has(candidate.name), 'role should disappear from directRoles after remove')
})

test('POST /users/:id/roles validates roleId', { requiresConnection: true }, async () => {
  const res = await apiPost('/api/dataverse/security/users/not-a-guid/roles', { roleId: 'also-not-a-guid' })
  assertStatus(res, 400)
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
