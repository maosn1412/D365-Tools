/**
 * 14 - Plugin Code Generator（纯前端工具，源码契约测试）
 * 验证 C# 插件模板：IPlugin 实现、Execute 签名、服务工厂获取、
 * Target 实体提取、管道阶段枚举映射、PostOperation 镜像逻辑。
 */
import { createSuite, assertIncludes, isMain } from '../lib/harness.mjs'
import { readToolSource } from '../lib/source.mjs'

export const suite = createSuite('14 - Plugin Generator (source contract)')
const { test } = suite

const src = await readToolSource('PluginGenerator.tsx')

test('generates an IPlugin implementation class', () => {
  assertIncludes(src, 'public class ${className} : IPlugin', 'class implements IPlugin')
  assertIncludes(src, 'public void Execute(IServiceProvider serviceProvider)', 'Execute signature')
})

test('pipeline stage mapping follows SDK enum values', () => {
  // PreValidation=10, PreOperation=20, PostOperation=40
  assertIncludes(src,
    "stage === 'PreValidation' ? '10' : stage === 'PreOperation' ? '20' : '40'",
    'stage enum values 10/20/40')
  assertIncludes(src, "'PreValidation' | 'PreOperation' | 'PostOperation'", 'PipelineStage union')
})

test('resolves standard services from the service provider', () => {
  assertIncludes(src,
    '(IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory))',
    'service factory resolution')
  assertIncludes(src,
    '(IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext))',
    'execution context resolution')
})

test('extracts and guards the Target entity', () => {
  assertIncludes(src, 'context.InputParameters["Target"] as Entity', 'Target extraction')
  assertIncludes(src, 'if (targetEntity == null)', 'null guard')
  assertIncludes(src, 'targetEntity.LogicalName', 'logical name read')
})

test('PostOperation Create/Update includes image handling', () => {
  assertIncludes(src,
    "stage === 'PostOperation' && (message === 'Create' || message === 'Update')",
    'post-image condition')
})

test('connection-aware entity dropdown is wired', () => {
  assertIncludes(src, 'useMetadataEntities', 'entity dropdown hook')
  assertIncludes(src, 'SearchSelect', 'SearchSelect usage')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
