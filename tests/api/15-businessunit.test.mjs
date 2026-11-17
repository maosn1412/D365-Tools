/**
 * 15 - Business Unit Hierarchy API
 */
import { createSuite, assert, assertEqual, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet } from '../lib/api.mjs'

export const suite = createSuite('15 - Business Unit Hierarchy')
const { test } = suite

test('GET /api/dataverse/businessunit/tree returns units array', async () => {
  const res = await apiGet('/api/dataverse/businessunit/tree')
  assertStatus(res, 200, 'tree endpoint should return 200')
  assert(Array.isArray(res.body.units), 'response should include units array')
  if (res.body.units.length > 0) {
    const first = res.body.units[0]
    assert(typeof first.id === 'string', 'unit should have id')
    assert(typeof first.name === 'string', 'unit should have name')
    assert('parentId' in first, 'unit should have parentId field')
  }
}, { requiresConnection: true })

test('GET /api/dataverse/businessunit/:id/details returns BU details', async () => {
  // First get a BU id from tree
  const treeRes = await apiGet('/api/dataverse/businessunit/tree')
  if (!treeRes.body.units || treeRes.body.units.length === 0) return

  const buId = treeRes.body.units[0].id
  const res = await apiGet(`/api/dataverse/businessunit/${buId}/details`)
  assertStatus(res, 200, 'details endpoint should return 200')
  assert(res.body.id, 'response should include id')
  assert(res.body.name, 'response should include name')
  assert(typeof res.body.stats === 'object', 'response should include stats')
  assert(typeof res.body.stats.userCount === 'number', 'stats should include userCount')
  assert(typeof res.body.stats.teamCount === 'number', 'stats should include teamCount')
  assert(Array.isArray(res.body.users), 'response should include users array')
  assert(Array.isArray(res.body.teams), 'response should include teams array')
}, { requiresConnection: true })

test('GET /api/dataverse/businessunit/:id/details with invalid GUID returns 400', async () => {
  const res = await apiGet('/api/dataverse/businessunit/not-a-guid/details')
  assertStatus(res, 400, 'invalid GUID should return 400')
}, { requiresConnection: true })

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
