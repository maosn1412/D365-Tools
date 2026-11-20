/**
 * 全量测试运行器：按顺序执行所有套件并输出汇总报告。
 *
 * 前置条件：
 *   1. 后端已启动（pnpm dev 或 pnpm --filter server dev，端口 3001）
 *   2. tests/config.local.mjs 已配置测试环境凭据（缺失时仅运行无需凭据的用例）
 *
 * 用法：node tests/run-all.mjs
 */
import { hasCredentials, ensureConnected } from './lib/api.mjs'

import { suite as health } from './api/00-health.test.mjs'
import { suite as connection } from './api/01-connection.test.mjs'
import { suite as metadata } from './api/02-metadata.test.mjs'
import { suite as solution } from './api/03-solution.test.mjs'
import { suite as data } from './api/04-data.test.mjs'
import { suite as environment } from './api/05-environment.test.mjs'
import { suite as optionset } from './api/06-optionset.test.mjs'
import { suite as businessrule } from './api/07-businessrule.test.mjs'
import { suite as webresource } from './api/08-webresource.test.mjs'
import { suite as security } from './api/09-security.test.mjs'
import { suite as userAccess } from './api/10-user-access.test.mjs'
import { suite as recordAccess } from './api/11-record-access.test.mjs'
import { suite as roleCompare } from './api/12-role-compare.test.mjs'
import { suite as fieldSecurity } from './api/13-field-security.test.mjs'
import { suite as permission } from './api/14-permission.test.mjs'
import { suite as businessunit } from './api/15-businessunit.test.mjs'
import { suite as audit } from './api/16-audit.test.mjs'
import { suite as scaffold } from './api/17-scaffold.test.mjs'
import { suite as metadataCache } from './api/18-metadata-cache.test.mjs'

import { suite as connStrBuilder } from './tools/10-connection-string-builder.test.mjs'
import { suite as powerAutomate } from './tools/11-power-automate-expressions.test.mjs'
import { suite as fetchXmlBuilder } from './tools/12-fetchxml-builder.test.mjs'
import { suite as odataBuilder } from './tools/13-odata-url-builder.test.mjs'
import { suite as pluginGenerator } from './tools/14-plugin-generator.test.mjs'
import { suite as pcfGenerator } from './tools/15-pcf-generator.test.mjs'
import { suite as customPage } from './tools/16-custom-page-generator.test.mjs'
import { suite as securityGrouping } from './tools/17-security-grouping.test.mjs'
import { suite as newToolsRegression } from './tools/18-new-tools-regression.test.mjs'
import { suite as pluginScaffolder } from './tools/19-plugin-scaffolder.test.mjs'
import { suite as savedConnections } from './tools/20-saved-connections.test.mjs'
import { suite as metadataCacheContract } from './tools/21-metadata-cache.test.mjs'

console.log('D365 CRM Tools - Test Suite')
console.log(`Credentials: ${hasCredentials ? 'configured (full integration mode)' : 'NOT configured (protected-mode only)'}`)

// 连接状态保存在 server 进程内：01-connection 套件会建立并恢复连接。
// 这里预先尝试一次，让 00 之前的健康检查失败时尽早暴露。
const preConnected = await ensureConnected().catch(() => false)
const context = { connected: preConnected, hasCredentials }
console.log(`Connection: ${preConnected ? 'established' : 'not available (connected cases will be skipped)'}`)

const apiSuites = [health, connection, metadata, metadataCache, solution, data, environment, optionset, businessrule, webresource, security, userAccess, recordAccess, roleCompare, fieldSecurity, permission, businessunit, audit, scaffold]
const toolSuites = [connStrBuilder, powerAutomate, fetchXmlBuilder, odataBuilder, pluginGenerator, pcfGenerator, customPage, securityGrouping, newToolsRegression, pluginScaffolder, savedConnections, metadataCacheContract]

let totalPassed = 0
let totalFailed = 0
let totalSkipped = 0
const failedSuites = []

// 01-connection 运行后连接状态可能变化（它负责断开/重连验证），以其结果为最新状态
for (const suite of apiSuites) {
  const result = await suite.run(context)
  totalPassed += result.passed
  totalFailed += result.failed
  totalSkipped += result.skipped
  if (result.failed > 0) failedSuites.push(suite.name)
  if (suite === connection) {
    context.connected = await ensureConnected().catch(() => false)
  }
}

for (const suite of toolSuites) {
  const result = await suite.run(context)
  totalPassed += result.passed
  totalFailed += result.failed
  totalSkipped += result.skipped
  if (result.failed > 0) failedSuites.push(suite.name)
}

console.log('\n========================================')
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`)
if (failedSuites.length > 0) {
  console.log(`Failed suites: ${failedSuites.join(', ')}`)
}
console.log('========================================')

process.exitCode = totalFailed > 0 ? 1 : 0
