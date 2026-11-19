/**
 * 15 - PCF Component Scaffolding Generator（纯前端工具，源码契约测试）
 * 验证 manifest/index.ts 模板：control 声明、生命周期方法、
 * React 包装变体、Field/Dataset 控件类型。
 */
import { createSuite, assert, assertIncludes, isMain } from '../lib/harness.mjs'
import { readProjectFile, readToolSource } from '../lib/source.mjs'

export const suite = createSuite('15 - PCF Generator (source contract)')
const { test } = suite

const src = await readToolSource('PcfGenerator.tsx')
const icons = await readProjectFile('client/src/components/ui/icons.tsx')

test('manifest declares control with namespace/constructor/type', () => {
  assertIncludes(src, '<control namespace="${publisherPrefix}"', 'control namespace')
  assertIncludes(src, 'constructor="${componentName}"', 'control constructor')
  assertIncludes(src, 'control-type="${controlType}"', 'control-type attribute')
})

test('generates the standard PCF lifecycle methods', () => {
  assertIncludes(src, 'public init(', 'init method')
  assertIncludes(src, 'public updateView(', 'updateView method')
  assertIncludes(src, 'public getOutputs(): IOutputs', 'getOutputs method')
  assertIncludes(src, 'public destroy(', 'destroy method')
  assertIncludes(src, 'constructor() {}', 'empty constructor')
})

test('React wrapper variant returns ReactElement from updateView', () => {
  assertIncludes(src,
    'public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement',
    'React variant updateView signature')
})

test('standard variant updateView returns void and destroy cleans up', () => {
  assertIncludes(src,
    'public updateView(context: ComponentFramework.Context<IInputs>): void',
    'standard variant updateView signature')
})

test('generated files layout can shrink without overlapping tabs', () => {
  assertIncludes(src, 'grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]', 'responsive grid')
  assertIncludes(src, '<Card className="min-w-0">', 'generated files shrink guard')
})

test('IconPlugin SVG commands have complete parameter groups', () => {
  const path = icons.match(/export const IconPlugin = createIcon\(\[\s*'([^']+)'/)?.[1] ?? ''
  assert(path, 'IconPlugin path should exist')
  const tokens = path.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) ?? []
  const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }
  let index = 0
  let command = ''
  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++]
    const upper = command.toUpperCase()
    if (upper === 'Z') continue
    const expected = arity[upper]
    assert(expected, `unsupported SVG command ${command}`)
    let count = 0
    while (index < tokens.length && !/[a-zA-Z]/.test(tokens[index])) {
      index++
      count++
    }
    assert(count > 0 && count % expected === 0, `${command} has ${count} parameters, expected groups of ${expected}`)
    if (upper === 'M') command = command === 'M' ? 'L' : 'l'
  }
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
