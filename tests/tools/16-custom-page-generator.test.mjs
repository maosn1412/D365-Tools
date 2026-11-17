/**
 * 16 - Custom Page Template Generator（纯前端工具，源码契约测试）
 * 验证 Power Fx 模板：List（ClearCollect/Filter/Search）、
 * Form（Patch/Back）、Dashboard（Set/CountRows）三类页面关键公式。
 */
import { createSuite, assertIncludes, isMain } from '../lib/harness.mjs'
import { readToolSource } from '../lib/source.mjs'

export const suite = createSuite('16 - Custom Page Generator (source contract)')
const { test } = suite

const src = await readToolSource('CustomPageGenerator.tsx')

test('list page uses ClearCollect + Filter/Search pattern', () => {
  assertIncludes(src, 'ClearCollect(', 'ClearCollect formula')
  assertIncludes(src, 'Filter(colRecords, Search(name, varSearchText))', 'search filter formula')
  assertIncludes(src, '// Gallery Items property', 'gallery items annotation')
})

test('record count label interpolates CountRows', () => {
  assertIncludes(src, '$"{CountRows(colFilteredRecords)} records found"', 'count label formula')
})

test('form page uses Patch + Back navigation', () => {
  assertIncludes(src, 'Patch(', 'Patch formula')
  assertIncludes(src, 'Back();', 'Back navigation')
})

test('dashboard page computes KPI counters with Set/CountRows', () => {
  assertIncludes(src, 'Set(varTotalRecords, CountRows(${entityName}s))', 'total records KPI')
  assertIncludes(src, 'Set(varActiveRecords, CountRows(Filter(${entityName}s, statecode = 0)))', 'active KPI')
  assertIncludes(src, 'Set(varInactiveRecords, CountRows(Filter(${entityName}s, statecode = 1)))', 'inactive KPI')
})

test('connection-aware entity dropdown is wired', () => {
  assertIncludes(src, 'useMetadataEntities', 'entity dropdown hook')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
