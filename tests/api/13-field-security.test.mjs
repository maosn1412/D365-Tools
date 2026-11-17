/**
 * 13 - 字段级安全（/api/dataverse/fieldsecurity）
 * 对应前端工具：Field Security Profile Viewer
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('13 - Field Security')
const { test } = suite

test('GET /profiles returns profile list', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/fieldsecurity/profiles')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value), 'profiles should return a value array')
})

test('profile permissions and members have expected shape', { requiresConnection: true }, async () => {
  const profiles = await apiGet('/api/dataverse/fieldsecurity/profiles')
  assertStatus(profiles, 200)
  const first = profiles.body?.value?.[0]
  if (!first) {
    // 环境没有字段安全 Profile：形状断言无对象可验，视为通过（列表接口已覆盖）
    return
  }

  const perms = await apiGet(`/api/dataverse/fieldsecurity/profiles/${first.fieldsecurityprofileid}/permissions`)
  assertStatus(perms, 200)
  assert(Array.isArray(perms.body?.permissions), 'permissions should be an array')
  for (const p of perms.body?.permissions ?? []) {
    assert(typeof p.attributeLogicalName === 'string' && typeof p.entityName === 'string',
      'permission should have attributeLogicalName + entityName')
    for (const key of ['canread', 'canupdate', 'cancreate']) {
      assert(typeof p[key]?.value === 'number' && typeof p[key]?.label === 'string',
        `${key} should be a {value,label} pair`)
    }
  }

  const members = await apiGet(`/api/dataverse/fieldsecurity/profiles/${first.fieldsecurityprofileid}/members`)
  assertStatus(members, 200)
  assert(Array.isArray(members.body?.members), 'members should be an array')
  for (const m of members.body?.members ?? []) {
    assert(['user', 'team'].includes(m.memberType), `memberType should be user|team, got ${m.memberType}`)
    assert(typeof m.memberId === 'string' && typeof m.name === 'string', 'member should have memberId + name')
  }
})

test('GET /profiles/:id/permissions rejects invalid id', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/fieldsecurity/profiles/not-a-guid/permissions')
  assertStatus(res, 400)
})

test('GET /secured-fields?entityName=account returns field list', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/fieldsecurity/secured-fields?entityName=account')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.fields), 'secured-fields should return a fields array')
  for (const f of res.body?.fields ?? []) {
    assert(typeof f.logicalName === 'string' && typeof f.attributeType === 'string',
      'field should have logicalName + attributeType')
  }
})

test('GET /secured-fields validates entityName', { requiresConnection: true }, async () => {
  const res = await apiGet("/api/dataverse/fieldsecurity/secured-fields?entityName=account';DROP")
  assertStatus(res, 400)
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
