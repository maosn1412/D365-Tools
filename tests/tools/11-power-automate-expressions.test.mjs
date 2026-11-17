/**
 * 11 - Power Automate Expression Tester（纯前端工具，源码契约测试）
 * 验证表达式模板库完整性与核心 evaluate 实现。
 */
import { createSuite, assertIncludes, assert, isMain } from '../lib/harness.mjs'
import { readToolSource } from '../lib/source.mjs'

export const suite = createSuite('11 - Power Automate Expressions (source contract)')
const { test } = suite

const src = await readToolSource('PowerAutomateExpressions.tsx')

test('expression template library exists with required shape', () => {
  assertIncludes(src, 'const expressions: ExpressionTemplate[]', 'expressions array declaration')
  assertIncludes(src, 'evaluate: (args: string[]) => string', 'evaluate signature')
  assertIncludes(src, "category: string", 'category field')
})

test('String category expressions are present', () => {
  for (const name of ['concat', 'toUpper', 'toLower', 'substring', 'replace', 'indexOf', 'length', 'trim']) {
    assertIncludes(src, `name: '${name}'`, `expression "${name}" should exist`)
  }
})

test('DateTime category expressions are present', () => {
  for (const name of ['formatDateTime', 'utcNow']) {
    assertIncludes(src, `name: '${name}'`, `expression "${name}" should exist`)
  }
})

test('core evaluate implementations are correct', () => {
  assertIncludes(src, "evaluate: (args) => args.join('')", 'concat joins all args')
  assertIncludes(src, "args[0]?.toUpperCase() || ''", 'toUpper uses toUpperCase')
  assertIncludes(src, "args[0]?.toLowerCase() || ''", 'toLower uses toLowerCase')
  assertIncludes(src, 'str.substring(start, start + len)', 'substring uses start+length semantics')
  assertIncludes(src, ".split(args[1] || '').join(args[2] || '')", 'replace replaces all occurrences')
  assertIncludes(src, 'String((args[0] || \'\').length)', 'length returns string length')
  assertIncludes(src, "(args[0] || '').trim()", 'trim trims whitespace')
})

test('formatDateTime supports standard tokens in UTC', () => {
  for (const token of ["'yyyy'", "'MM'", "'dd'", "'HH'", "'mm'", "'ss'"]) {
    assertIncludes(src, `.replace(${token},`, `formatDateTime should handle ${token}`)
  }
  assertIncludes(src, 'getUTCFullYear()', 'formatDateTime should use UTC getters')
})

test('expression count covers a useful library (>= 15 templates)', () => {
  const count = (src.match(/name: '\w+', category:/g) ?? []).length
  assert(count >= 15, `expected at least 15 expression templates, found ${count}`)
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
