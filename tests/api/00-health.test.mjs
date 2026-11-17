/**
 * 00 - 服务健康检查
 * 前置条件：后端运行于 http://localhost:3001
 */
import { createSuite, assert, assertEqual, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet } from '../lib/api.mjs'

export const suite = createSuite('00 - Health Check')
const { test } = suite

test('GET /api/health returns 200 with status ok', async () => {
  const res = await apiGet('/api/health')
  assertStatus(res, 200, 'health check failed - is the server running on port 3001?')
  assertEqual(res.body?.status, 'ok', 'health body should be { status: "ok" }')
})

test('unknown /api route returns 404', async () => {
  const res = await apiGet('/api/definitely-not-a-route')
  assertEqual(res.status, 404, 'unknown routes should return 404')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
