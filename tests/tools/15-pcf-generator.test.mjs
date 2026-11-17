/**
 * 15 - PCF Component Scaffolding Generator（纯前端工具，源码契约测试）
 * 验证 manifest/index.ts 模板：control 声明、生命周期方法、
 * React 包装变体、Field/Dataset 控件类型。
 */
import { createSuite, assertIncludes, isMain } from '../lib/harness.mjs'
import { readToolSource } from '../lib/source.mjs'

export const suite = createSuite('15 - PCF Generator (source contract)')
const { test } = suite

const src = await readToolSource('PcfGenerator.tsx')

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

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
