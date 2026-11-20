/**
 * 12 - FetchXML Builder（纯前端工具，源码契约测试）
 * 验证 FetchXML 生成结构：fetch/entity/condition/order/link-entity 及
 * null 操作符无 value、top/distinct 属性等关键规则。
 */
import { createSuite, assertIncludes, isMain } from '../lib/harness.mjs'
import { readToolSource } from '../lib/source.mjs'

export const suite = createSuite('12 - FetchXML Builder (source contract)')
const { test } = suite

const src = await readToolSource('FetchXmlBuilder.tsx')

test('generates the fetch/entity skeleton', () => {
  assertIncludes(src, '<fetch${attrs.length ? \' \' + attrs.join(\' \') : \'\'}>', 'fetch tag with optional attrs')
  assertIncludes(src, '<entity name="${entityName}">', 'entity tag')
  assertIncludes(src, '</entity>\\n</fetch>', 'closing tags')
})

test('condition generation handles value-less operators', () => {
  assertIncludes(src,
    'return `    <condition attribute="${c.attribute}" operator="${c.operator}" />`',
    'null/not-null condition without value attribute')
  assertIncludes(src,
    'return `    <condition attribute="${c.attribute}" operator="${c.operator}" value="${c.value}" />`',
    'standard condition with value attribute')
  assertIncludes(src, "cond.operator !== 'null' && cond.operator !== 'not-null'",
    'UI hides value input for null operators')
})

test('order generation supports descending flag', () => {
  assertIncludes(src,
    '.map(o => `  <order attribute="${o.attribute}" descending="${o.descending}" />`)',
    'order element with descending attribute')
})

test('link-entity generation includes join keys and optional alias', () => {
  assertIncludes(src, '<link-entity name="${l.name}" from="${l.from}" to="${l.to}" link-type="${l.linkType}"',
    'link-entity core attributes')
  assertIncludes(src, "${l.alias ? ` alias=\"${l.alias}\"` : ''}", 'optional alias attribute')
})

test('connection-aware: fetch data + entity/attribute dropdowns', () => {
  assertIncludes(src, 'executeFetchXml', 'Fetch Data goes through the executeFetchXml API helper')
  // 元数据数据源统一走前端缓存（21 号套件锁定缓存实现本身）
  assertIncludes(src, 'loadEntityMetadata', 'entity dropdown data source (cached)')
  assertIncludes(src, 'loadEntityAttributeMetadata', 'attribute dropdown data source (cached)')
  assertIncludes(src, 'MultiSearchSelect', 'multi-select for select fields')
})

test('result columns union avoids losing null columns', () => {
  // 已知回归点：列 = 所选字段优先 + 记录键并集（首行 null 不能丢列）
  assertIncludes(src, "!k.startsWith('@') && !k.startsWith('_') && !seen.has(k)",
    'record-key union filter (skips @odata/_lookup internal keys, dedupes)')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
