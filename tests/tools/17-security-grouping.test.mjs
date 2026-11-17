/**
 * 17 - Security 分组与既有功能回归（源码契约测试）
 * 背景：权限安全五工具改造触及了既有代码——
 *   1. AppLayout 侧边栏：Security Roles 从 Environment 组迁入新 Security 组
 *   2. App.tsx 路由表：新增 5 条路由，既有 15 条不得丢失
 *   3. api.ts：新增安全相关 API 函数（纯追加）
 *   4. dataverseService.requestWithRetry：mid-body ECONNRESET 纳入重试
 *      （不再以 !error.response 为前提，修复 "200 - aborted" 假象）
 *   5. environment /info：响应新增 WhoAmI userId 字段
 * 本套件将上述结构固化为契约，防止后续重构静默回归。
 */
import { createSuite, assert, assertIncludes, isMain } from '../lib/harness.mjs'
import { readProjectFile } from '../lib/source.mjs'

export const suite = createSuite('17 - Security Grouping & Regression (source contract)')
const { test } = suite

const layout = await readProjectFile('client/src/components/layout/AppLayout.tsx')
const app = await readProjectFile('client/src/App.tsx')
const api = await readProjectFile('client/src/services/api.ts')
const dataverseService = await readProjectFile('server/src/services/dataverseService.ts')
const environmentRoute = await readProjectFile('server/src/routes/environment.ts')

// 既有 15 个工具的导航路径（security-role-viewer 迁入 Security 组但仍须存在）
const LEGACY_PATHS = [
  '/tools/plugin-generator',
  '/tools/pcf-generator',
  '/tools/custom-page-generator',
  '/tools/connection-string-builder',
  '/tools/fetchxml-builder',
  '/tools/odata-url-builder',
  '/tools/data-query',
  '/tools/power-automate-expressions',
  '/tools/environment-dashboard',
  '/tools/metadata-viewer',
  '/tools/solution-manager',
  '/tools/option-set-viewer',
  '/tools/web-resource-manager',
  '/tools/business-rule-inspector',
  '/tools/security-role-viewer',
]

const NEW_PATHS = [
  '/tools/user-access-analyzer',
  '/tools/record-access-checker',
  '/tools/record-sharing-auditor',
  '/tools/security-role-compare',
  '/tools/field-security-viewer',
  '/tools/permission-diagnostic',
  '/tools/business-unit-hierarchy',
  '/tools/audit-log-viewer',
  '/tools/connection-string-analyzer',
  '/tools/azure-ad-config-checker',
]

test('sidebar has a Security group with all six security tools', () => {
  assertIncludes(layout, "label: 'Security'", 'Security group label')
  const securityBlock = layout.slice(layout.indexOf("label: 'Security'"))
  const entries = [
    ['Security Roles', '/tools/security-role-viewer'],
    ['User Access', '/tools/user-access-analyzer'],
    ['Record Access', '/tools/record-access-checker'],
    ['Sharing Auditor', '/tools/record-sharing-auditor'],
    ['Role Compare', '/tools/security-role-compare'],
    ['Field Security', '/tools/field-security-viewer'],
  ]
  for (const [name, path] of entries) {
    assert(securityBlock.includes(`name: '${name}'`) && securityBlock.includes(`path: '${path}'`),
      `Security group should contain ${name} -> ${path}`)
  }
})

test('Security Roles was moved OUT of the Environment group', () => {
  const envStart = layout.indexOf("label: 'Environment'")
  const secStart = layout.indexOf("label: 'Security'")
  assert(envStart !== -1 && secStart !== -1 && envStart < secStart, 'Environment group should precede Security group')
  const envBlock = layout.slice(envStart, secStart)
  assert(!envBlock.includes('security-role-viewer'), 'Environment group must not contain security-role-viewer anymore')
})

test('all 15 legacy nav entries are preserved', () => {
  for (const path of LEGACY_PATHS) {
    assertIncludes(layout, `path: '${path}'`, `legacy nav path ${path}`)
  }
})

test('App.tsx registers 5 new routes and keeps legacy routes', () => {
  // App.tsx 使用相对路由（嵌套在 path="/" 的 AppLayout 下），无前导斜杠
  for (const path of NEW_PATHS) {
    assertIncludes(app, `path="${path.slice(1)}"`, `new route ${path}`)
  }
  for (const path of LEGACY_PATHS) {
    assertIncludes(app, `path="${path.slice(1)}"`, `legacy route ${path}`)
  }
})

test('api.ts exposes the security API surface (purely additive)', () => {
  const fns = [
    'searchUsers', 'searchTeams', 'fetchUserProfile', 'assignUserRole', 'removeUserRole',
    'checkRecordAccess', 'searchRecords', 'fetchSharedPrincipals', 'shareRecord', 'revokeRecordAccess',
    'compareRoles', 'addRolePrivileges',
    'fetchFieldSecurityProfiles', 'fetchProfilePermissions', 'fetchProfileMembers',
    'assignProfileMember', 'removeProfileMember', 'fetchSecuredFields',
  ]
  for (const fn of fns) {
    assertIncludes(api, `export function ${fn}(`, `api function ${fn}`)
  }
})

test('requestWithRetry retries mid-body ECONNRESET (regression lock)', () => {
  assertIncludes(dataverseService, 'requestWithRetry', 'retry helper')
  assertIncludes(dataverseService, 'ECONNRESET', 'ECONNRESET handling')
  // 修复点：响应头到达后 body 读取中断时 error.response 存在，
  // 重试判定不得再以 !error.response 为前提（否则重现 "200 - aborted" 假象）。
  // 只检查 isNetworkError 赋值语句本身（注释中允许出现该字样）。
  const stmtStart = dataverseService.indexOf('const isNetworkError')
  assert(stmtStart !== -1, 'isNetworkError statement should exist')
  const stmt = dataverseService.slice(stmtStart, dataverseService.indexOf('\n', stmtStart) + 200)
  assert(!stmt.includes('!error.response'), 'retry decision must not require !error.response')
})

test('environment /info exposes the WhoAmI userId', () => {
  assertIncludes(environmentRoute, 'userId', 'userId in /info response')
  assertIncludes(environmentRoute, 'WhoAmI', 'WhoAmI call')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
