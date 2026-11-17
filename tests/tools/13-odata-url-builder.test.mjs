/**
 * 13 - OData URL Builder（纯前端工具，源码契约测试）
 * 验证 URL 拼接规则：api 版本路径、GUID 路径段、查询参数、orderby 方向、
 * 函数调用、连接感知（Base URL 自动填充 + EntitySetName 映射 + 切实体重置）。
 */
import { createSuite, assertIncludes, isMain } from '../lib/harness.mjs'
import { readToolSource } from '../lib/source.mjs'

export const suite = createSuite('13 - OData URL Builder (source contract)')
const { test } = suite

const src = await readToolSource('ODataUrlBuilder.tsx')

test('builds URLs against the v9.2 API base', () => {
  assertIncludes(src, "baseUrl.replace(/\\/$/, '')", 'trailing slash trimmed from base URL')
  assertIncludes(src, '/api/data/v9.2', 'v9.2 API path')
})

test('supports all six operation types', () => {
  assertIncludes(src, "'GET' | 'GET_SINGLE' | 'POST' | 'PATCH' | 'DELETE' | 'FUNCTION'", 'OperationType union')
})

test('single-record operations append (recordId) path segment', () => {
  assertIncludes(src, "path += `(${recordId})`", 'GUID path segment')
  assertIncludes(src, "operation === 'GET_SINGLE' || operation === 'PATCH' || operation === 'DELETE'",
    'operations requiring a record id')
})

test('query parameters are appended correctly', () => {
  assertIncludes(src, '`$select=${selectFields}`', '$select param')
  assertIncludes(src, '`$expand=${expandFields}`', '$expand param')
  assertIncludes(src, '`$top=${top}`', '$top param')
  assertIncludes(src, "params.push('$count=true')", '$count param gated by includeCount')
})

test('orderby combines field with optional desc direction', () => {
  assertIncludes(src, "orderField ? `${orderField}${orderDir === 'desc' ? ' desc' : ''}` : ''",
    'orderby field + direction rule')
})

test('WhoAmI-style functions resolve to their absolute paths', () => {
  assertIncludes(src, "{ name: 'WhoAmI', path: '/WhoAmI'", 'WhoAmI function mapping')
  assertIncludes(src, 'operation === \'FUNCTION\' && selectedFunction', 'function branch in URL builder')
})

test('connection-aware behavior is implemented', () => {
  assertIncludes(src, 'if (connected && environmentUrl) setBaseUrl(environmentUrl)',
    'Base URL auto-filled from the connection')
  assertIncludes(src, 'entities.find(e => (e.EntitySetName || e.LogicalName) === entityName)',
    'EntitySetName -> LogicalName mapping for attribute metadata')
})

test('changing entity resets field-related selections', () => {
  // 已知回归点：切实体必须清空字段选择，防止跨实体残留
  assertIncludes(src, 'setSelectFields(\'\')', 'reset select fields')
  assertIncludes(src, 'setOrderField(\'\')', 'reset order field')
  assertIncludes(src, 'setFilters([])', 'reset filters')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
