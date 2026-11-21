/**
 * 22 - API retry policy and blocked classification
 *
 * Locks the test-only retry policy:
 *   1. Only upstream network signatures are retryable; business errors are not
 *   2. GET/HEAD/OPTIONS and explicitly idempotent POST may retry
 *   3. api.mjs marks exhausted transient failures as blocked
 *   4. harness keeps blocked as a subset of failed and exposes productFailed
 */
import { createSuite, assert, assertEqual, assertIncludes, isMain } from '../lib/harness.mjs'
import { readProjectFile } from '../lib/source.mjs'
import { isRetryableRequest, matchTransientSignature } from '../lib/retryPolicy.mjs'

export const suite = createSuite('22 - API Retry Policy')
const { test } = suite

test('transient signatures cover TLS/gateway but not business errors', () => {
  const transient = [
    [500, { error: 'Client network socket disconnected before secure TLS connection was established' }],
    [500, { error: 'Dataverse API error: 502 - upstream connect failed: connection timed out' }],
    [500, { error: 'ECONNRESET' }],
    [500, { error: 'timeout of 60000ms exceeded' }],
    [500, 'aborted'],
    [502, ''],
    [503, 'Service Unavailable'],
    [0, { error: 'fetch failed' }],
  ]
  for (const [status, body] of transient) {
    assert(matchTransientSignature(status, body), `should be transient: ${status} ${JSON.stringify(body)}`)
  }

  const business = [
    [400, { error: 'fetchXml is required' }],
    [401, { error: 'Not connected' }],
    [404, { error: 'Does Not Exist' }],
    [409, { error: 'Target directory already exists' }],
    [500, { error: 'Dataverse API error: 0x80040265 - Compliance Country required' }],
  ]
  for (const [status, body] of business) {
    assertEqual(matchTransientSignature(status, body), null, `should not be transient: ${status}`)
  }
})

test('only GET/HEAD/OPTIONS and explicit idempotent POST are retryable', () => {
  assert(isRetryableRequest('GET'))
  assert(isRetryableRequest('HEAD'))
  assert(isRetryableRequest('OPTIONS'))
  assert(!isRetryableRequest('POST'))
  assert(isRetryableRequest('POST', { idempotent: true }))
  assert(!isRetryableRequest('DELETE', { idempotent: true }))
  assert(!isRetryableRequest('PATCH', { idempotent: true }))
})

test('api.mjs wires the retry policy and marks exhausted transients as blocked', async () => {
  const api = await readProjectFile('tests/lib/api.mjs')
  const runAll = await readProjectFile('tests/run-all.mjs')
  assertIncludes(api, 'matchTransientSignature', 'api should use the retry policy')
  assertIncludes(api, 'isRetryableRequest', 'api should respect method idempotency')
  assertIncludes(api, 'error.blocked = true', 'exhausted transient should be marked blocked')
  assert(!api.includes('isTransientFailure'), 'legacy retry matcher should be removed')
  assertIncludes(runAll, 'environment blocked', 'runner should report environment blocked')
  assertIncludes(runAll, 'product failures', 'runner should report product failures separately')
})

test('harness counts blocked as a subset of failed', async () => {
  const probe = createSuite('22 probe - blocked classification')
  probe.test('blocked sample', () => {
    const error = new Error('upstream TLS disconnected')
    error.blocked = true
    throw error
  })
  const result = await probe.run({})
  assertEqual(result.failed, 1, 'blocked case must remain non-green')
  assertEqual(result.blocked, 1, 'blocked count should be one')
  assertEqual(result.productFailed, 0, 'blocked should not be a product failure')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run({})
  process.exitCode = failed > 0 ? 1 : 0
}
