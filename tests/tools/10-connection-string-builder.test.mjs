/**
 * 10 - Connection String Builder（纯前端工具，源码契约测试）
 * 验证连接串拼接规则与三种输出模板的关键片段未被意外修改。
 */
import { createSuite, assertIncludes, isMain } from '../lib/harness.mjs'
import { readToolSource } from '../lib/source.mjs'

export const suite = createSuite('10 - Connection String Builder (source contract)')
const { test } = suite

const src = await readToolSource('ConnectionStringBuilder.tsx')

test('supports four authentication types', () => {
  assertIncludes(src, "'clientSecret' | 'certificate' | 'office365' | 'oauth'", 'AuthType union')
})

test('connection string parts follow key=value; joined format', () => {
  assertIncludes(src, '`Url=${serverUrl}`', 'Url segment')
  assertIncludes(src, '`ClientId=${clientId}`', 'ClientId segment')
  assertIncludes(src, '`ClientSecret=${clientSecret}`', 'ClientSecret segment')
  assertIncludes(src, '`TenantId=${tenantId}`', 'TenantId segment')
  assertIncludes(src, '`Thumbprint=${certThumbprint}`', 'Thumbprint segment')
  assertIncludes(src, '`Username=${username}`', 'Username segment')
  assertIncludes(src, "parts.join(';')", 'segments joined by semicolons')
})

test('C# output template uses ServiceClient', () => {
  assertIncludes(src, 'var connectionString = "${connectionString}"', 'C# variable declaration')
  assertIncludes(src, 'new ServiceClient(connectionString)', 'ServiceClient usage')
})

test('PowerShell output template uses Connect-DataverseService', () => {
  assertIncludes(src, '$ConnectionString = "${connectionString}"', 'PowerShell variable')
  assertIncludes(src, 'Connect-DataverseService -ConnectionString $ConnectionString', 'PowerShell connect command')
})

test('PAC CLI template builds pac auth create command', () => {
  assertIncludes(src, 'pac auth create', 'pac auth create')
  assertIncludes(src, '--kind CDS', 'CDS kind')
  assertIncludes(src, '--applicationId "${clientId}"', 'applicationId flag')
  assertIncludes(src, '--clientSecret "${clientSecret}"', 'clientSecret flag for clientSecret auth')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
