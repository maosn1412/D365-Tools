/**
 * 11 - 记录访问检查与共享审计（/api/dataverse/recordaccess）
 * 对应前端工具：Record Access Checker / Record Sharing Auditor
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, apiPost, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('11 - Record Access & Sharing')
const { test } = suite

/** 找一条 account 记录与当前连接用户 id */
async function fixtures() {
  const info = await apiGet('/api/dataverse/environment/info')
  assertStatus(info, 200)
  const userId = info.body?.userId
  assert(userId, 'environment info should expose the WhoAmI userId')

  const search = await apiPost('/api/dataverse/recordaccess/record-search', {
    entitySetName: 'accounts',
    primaryIdField: 'accountid',
    primaryNameField: 'name',
    searchText: '',
  })
  assertStatus(search, 200)
  const record = search.body?.records?.[0]
  assert(record?.id, 'need at least one account record')
  return { userId, record }
}

test('POST /record-search returns records', { requiresConnection: true }, async () => {
  const res = await apiPost('/api/dataverse/recordaccess/record-search', {
    entitySetName: 'accounts',
    primaryIdField: 'accountid',
    primaryNameField: 'name',
    searchText: '',
  })
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.records), 'record-search should return a records array')
})

test('POST /record-search validates input', { requiresConnection: true }, async () => {
  const res = await apiPost('/api/dataverse/recordaccess/record-search', {
    entitySetName: 'accounts; DROP',
    primaryIdField: 'accountid',
    primaryNameField: 'name',
    searchText: '',
  })
  assertStatus(res, 400)
})

test('POST /check resolves AccessRights for a record', { requiresConnection: true }, async () => {
  const { userId, record } = await fixtures()
  const res = await apiPost('/api/dataverse/recordaccess/check', {
    entitySetName: 'accounts',
    recordId: record.id,
    userId,
  })
  assertStatus(res, 200)
  const { rights, source } = res.body ?? {}
  assert(['function', 'computed'].includes(source), `source should be function|computed, got ${source}`)
  assert(Array.isArray(rights) && rights.length === 8, `rights should expose 8 entries, got ${rights?.length}`)
  for (const r of rights) {
    assert(typeof r.right === 'string' && typeof r.granted === 'boolean', 'right entry should have right + granted')
  }
  // 连接用户具备管理员权限，对任意 account 至少可读
  const read = rights.find(r => r.right === 'ReadAccess')
  assert(read?.granted === true, `connection user should have ReadAccess on accounts (source=${source})`)
})

test('POST /check validates input', { requiresConnection: true }, async () => {
  const res = await apiPost('/api/dataverse/recordaccess/check', {
    entitySetName: 'accounts',
    recordId: 'not-a-guid',
    userId: 'not-a-guid',
  })
  assertStatus(res, 400)
})

test('share -> shared list -> revoke roundtrip', { requiresConnection: true }, async () => {
  const { userId, record } = await fixtures()

  // 找一个非当前连接用户作为共享对象
  const users = await apiGet('/api/dataverse/security/users?top=20')
  assertStatus(users, 200)
  const other = (users.body?.value ?? []).find(u => u.systemuserid !== userId)
  assert(other, 'need a second user to share with')

  const share = await apiPost('/api/dataverse/recordaccess/share', {
    entitySetName: 'accounts',
    recordId: record.id,
    principalId: other.systemuserid,
    principalType: 'systemusers',
    rights: ['ReadAccess'],
    isExisting: false,
  })
  assertStatus(share, 200)

  const shared = await apiPost('/api/dataverse/recordaccess/shared', {
    entitySetName: 'accounts',
    recordId: record.id,
  })
  assertStatus(shared, 200)
  const principals = shared.body?.principals ?? []
  const entry = principals.find(p => p.principalId === other.systemuserid)
  assert(entry, 'shared list should include the granted user')
  assert(entry.principalType === 'systemusers', 'principal type should be systemusers')
  assert(entry.rights.includes('ReadAccess'), 'granted rights should include ReadAccess')
  assert(typeof entry.name === 'string' && entry.name.length > 0, 'principal name should be resolved')

  const revoke = await apiPost('/api/dataverse/recordaccess/revoke', {
    entitySetName: 'accounts',
    recordId: record.id,
    principalId: other.systemuserid,
    principalType: 'systemusers',
  })
  assertStatus(revoke, 200)

  const sharedAfter = await apiPost('/api/dataverse/recordaccess/shared', {
    entitySetName: 'accounts',
    recordId: record.id,
  })
  const stillThere = (sharedAfter.body?.principals ?? []).find(p => p.principalId === other.systemuserid)
  assert(!stillThere, 'shared list should no longer include the revoked user')
})

test('POST /share rejects unknown rights', { requiresConnection: true }, async () => {
  const { record } = await fixtures()
  const res = await apiPost('/api/dataverse/recordaccess/share', {
    entitySetName: 'accounts',
    recordId: record.id,
    principalId: record.id, // 仅为通过 GUID 校验，rights 校验应先命中
    principalType: 'systemusers',
    rights: ['FullAccess'],
    isExisting: false,
  })
  assertStatus(res, 400)
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
