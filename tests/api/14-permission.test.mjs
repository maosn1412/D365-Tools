/**
 * 14 - Permission Diagnostic API
 */
import { createSuite, assert, assertEqual, assertStatus, isMain } from '../lib/harness.mjs'
import { apiPost } from '../lib/api.mjs'

export const suite = createSuite('14 - Permission Diagnostic')
const { test } = suite

test('POST /api/dataverse/permission/diagnose without userId returns 400', async () => {
  const res = await apiPost('/api/dataverse/permission/diagnose', { entityName: 'account' })
  assertStatus(res, 400, 'missing userId should return 400')
}, { requiresConnection: true })

test('POST /api/dataverse/permission/diagnose without entityName returns 400', async () => {
  const res = await apiPost('/api/dataverse/permission/diagnose', { userId: '00000000-0000-0000-0000-000000000000' })
  assertStatus(res, 400, 'missing entityName should return 400')
}, { requiresConnection: true })

test('POST /api/dataverse/permission/diagnose returns diagnosis structure', async () => {
  // First get a real user from the environment
  const { apiGet } = await import('../lib/api.mjs')
  const usersRes = await apiGet('/api/dataverse/security/users?search=admin&top=1')
  const users = usersRes.body?.value
  if (!users || users.length === 0) return // skip if no users

  const userId = users[0].systemuserid
  const res = await apiPost('/api/dataverse/permission/diagnose', { userId, entityName: 'account' })
  assertStatus(res, 200, 'diagnose should succeed')
  assert(res.body.user, 'response should include user info')
  assert(Array.isArray(res.body.directRoles), 'response should include directRoles array')
  assert(Array.isArray(res.body.teamRoles), 'response should include teamRoles array')
  assert(typeof res.body.effectivePrivileges === 'object', 'response should include effectivePrivileges')
  assert(typeof res.body.verdict === 'string', 'response should include verdict')
  assert(['Granted', 'Denied'].includes(res.body.verdict), 'verdict should be Granted or Denied')
}, { requiresConnection: true, requiresCredentials: true })

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
