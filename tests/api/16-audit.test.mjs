/**
 * 16 - Audit Log API
 */
import { createSuite, assert, assertEqual, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet } from '../lib/api.mjs'

export const suite = createSuite('16 - Audit Log')
const { test } = suite

test('GET /api/dataverse/audit/actions returns action list', async () => {
  const res = await apiGet('/api/dataverse/audit/actions')
  assertStatus(res, 200, 'actions endpoint should return 200')
  assert(Array.isArray(res.body.actions), 'response should include actions array')
  if (res.body.actions.length > 0) {
    const first = res.body.actions[0]
    assert(typeof first.code === 'number', 'action should have code')
    assert(typeof first.name === 'string', 'action should have name')
  }
}, { requiresConnection: true })

test('GET /api/dataverse/audit/logs returns logs array', async () => {
  const res = await apiGet('/api/dataverse/audit/logs?top=10')
  assertStatus(res, 200, 'logs endpoint should return 200')
  assert(Array.isArray(res.body.logs), 'response should include logs array')
  assert(typeof res.body.total === 'number', 'response should include total count')
}, { requiresConnection: true })

test('GET /api/dataverse/audit/logs with eventTypes filter', async () => {
  const res = await apiGet('/api/dataverse/audit/logs?eventTypes=30,31&top=5')
  assertStatus(res, 200, 'filtered logs should return 200')
  assert(Array.isArray(res.body.logs), 'response should include logs array')
  // All returned logs should be role assignment (30) or role removal (31)
  for (const log of res.body.logs) {
    assert([30, 31].includes(log.action), `log action ${log.action} should be 30 or 31`)
  }
}, { requiresConnection: true })

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
