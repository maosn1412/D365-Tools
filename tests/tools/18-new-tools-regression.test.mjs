/**
 * 18 - New Tools & Full Regression (source contract)
 *
 * 双重职责：
 *   B1. 5 个新工具的源码契约（存在性 + 关键模式验证）
 *   B2. 4 个被修改文件的全面回归测试（锁定所有历史结构不被破坏）
 */
import { createSuite, assert, assertIncludes, isMain } from '../lib/harness.mjs'
import { readProjectFile } from '../lib/source.mjs'

export const suite = createSuite('18 - New Tools & Full Regression (source contract)')
const { test } = suite

// --- Read all relevant source files ---
const app = await readProjectFile('client/src/App.tsx')
const serverIndex = await readProjectFile('server/src/index.ts')
const layout = await readProjectFile('client/src/components/layout/AppLayout.tsx')
const api = await readProjectFile('client/src/services/api.ts')
const connStrAnalyzer = await readProjectFile('client/src/pages/tools/ConnectionStringAnalyzer.tsx')
const azureAdChecker = await readProjectFile('client/src/pages/tools/AzureAdConfigChecker.tsx')
const buHierarchy = await readProjectFile('client/src/pages/tools/BusinessUnitHierarchy.tsx')
const auditViewer = await readProjectFile('client/src/pages/tools/AuditLogViewer.tsx')
const permDiagnostic = await readProjectFile('client/src/pages/tools/PermissionDiagnostic.tsx')
const dataQuery = await readProjectFile('client/src/pages/tools/DataQuery.tsx')
const sharingAuditor = await readProjectFile('client/src/pages/tools/RecordSharingAuditor.tsx')
const searchSelect = await readProjectFile('client/src/components/ui/search-select.tsx')

// =====================================================================
// B1. 新工具源码契约
// =====================================================================

test('ConnectionStringAnalyzer exports component and parses connection strings', () => {
  assertIncludes(connStrAnalyzer, 'export function ConnectionStringAnalyzer', 'component export')
  assertIncludes(connStrAnalyzer, 'parseConnectionString', 'parser function')
  assertIncludes(connStrAnalyzer, 'detectAuthMethod', 'auth detection')
  assertIncludes(connStrAnalyzer, 'detectCloud', 'cloud detection')
  assertIncludes(connStrAnalyzer, 'validateParams', 'validation logic')
})

test('AzureAdConfigChecker exports component and calls openid-configuration', () => {
  assertIncludes(azureAdChecker, 'export function AzureAdConfigChecker', 'component export')
  assertIncludes(azureAdChecker, 'openid-configuration', 'openid endpoint')
  assertIncludes(azureAdChecker, 'login.microsoftonline.com', 'public cloud endpoint')
  assertIncludes(azureAdChecker, 'login.partner.microsoftonline.cn', 'china cloud endpoint')
})

test('BusinessUnitHierarchy exports component with ConnectionGuard', () => {
  assertIncludes(buHierarchy, 'export function BusinessUnitHierarchy', 'component export')
  assertIncludes(buHierarchy, 'ConnectionGuard', 'connection guard wrapper')
  assertIncludes(buHierarchy, 'buildTree', 'tree building logic')
  assertIncludes(buHierarchy, 'fetchBusinessUnitTree', 'API call')
})

test('AuditLogViewer exports component with action type mapping', () => {
  assertIncludes(auditViewer, 'export function AuditLogViewer', 'component export')
  assertIncludes(auditViewer, 'ConnectionGuard', 'connection guard wrapper')
  assertIncludes(auditViewer, 'fetchAuditLogs', 'API call')
  assertIncludes(auditViewer, 'fetchAuditActions', 'action types fetch')
})

test('PermissionDiagnostic exports component with aggregate logic', () => {
  assertIncludes(permDiagnostic, 'export function PermissionDiagnostic', 'component export')
  assertIncludes(permDiagnostic, 'ConnectionGuard', 'connection guard wrapper')
  assertIncludes(permDiagnostic, 'diagnosePermission', 'API call')
  assertIncludes(permDiagnostic, 'effectivePrivileges', 'privilege matrix display')
  assertIncludes(permDiagnostic, 'fieldSecurity', 'field security card')
})

// =====================================================================
// B2. 既有功能回归测试
// =====================================================================

// --- App.tsx 回归 ---

const LEGACY_ROUTES = [
  'tools/connection-string-builder',
  'tools/power-automate-expressions',
  'tools/fetchxml-builder',
  'tools/odata-url-builder',
  'tools/plugin-generator',
  'tools/pcf-generator',
  'tools/custom-page-generator',
  'tools/metadata-viewer',
  'tools/solution-manager',
  'tools/data-query',
  'tools/environment-dashboard',
  'tools/option-set-viewer',
  'tools/business-rule-inspector',
  'tools/web-resource-manager',
  'tools/security-role-viewer',
  'tools/user-access-analyzer',
  'tools/record-access-checker',
  'tools/record-sharing-auditor',
  'tools/security-role-compare',
  'tools/field-security-viewer',
]

const NEW_ROUTES = [
  'tools/permission-diagnostic',
  'tools/business-unit-hierarchy',
  'tools/audit-log-viewer',
  'tools/connection-string-analyzer',
  'tools/azure-ad-config-checker',
  'tools/plugin-project-scaffolder',
]

test('App.tsx: all 20 legacy routes preserved', () => {
  for (const route of LEGACY_ROUTES) {
    assertIncludes(app, `path="${route}"`, `legacy route ${route}`)
  }
})

test('App.tsx: all 6 new routes registered', () => {
  for (const route of NEW_ROUTES) {
    assertIncludes(app, `path="${route}"`, `new route ${route}`)
  }
})

test('App.tsx: total 26 tool routes + 1 index + 1 catch-all = 28 Route tags', () => {
  const routeCount = (app.match(/<Route /g) || []).length
  assert(routeCount >= 28, `expected at least 28 Route tags, got ${routeCount}`)
})

// --- server/index.ts 回归 ---

const LEGACY_ROUTERS = [
  'connectionRouter',
  'metadataRouter',
  'solutionRouter',
  'dataRouter',
  'environmentRouter',
  'optionsetRouter',
  'businessruleRouter',
  'webresourceRouter',
  'securityRouter',
  'recordaccessRouter',
  'fieldsecurityRouter',
]

const NEW_ROUTERS = [
  'permissionRouter',
  'businessunitRouter',
  'auditRouter',
  'scaffoldRouter',
]

test('server/index.ts: all 11 legacy router imports preserved', () => {
  for (const router of LEGACY_ROUTERS) {
    assertIncludes(serverIndex, router, `legacy router ${router}`)
  }
})

test('server/index.ts: all 4 new router imports registered', () => {
  for (const router of NEW_ROUTERS) {
    assertIncludes(serverIndex, router, `new router ${router}`)
  }
})

test('server/index.ts: all 15 app.use() mounts present', () => {
  const useCount = (serverIndex.match(/app\.use\(/g) || []).length
  assert(useCount >= 15, `expected at least 15 app.use() calls, got ${useCount}`)
})

test('server/index.ts: health check endpoint preserved', () => {
  assertIncludes(serverIndex, '/api/health', 'health check endpoint')
})

// --- AppLayout.tsx 回归 ---

test('AppLayout.tsx: all 4 group labels preserved', () => {
  assertIncludes(layout, "label: 'Code Generators'", 'Code Generators group')
  assertIncludes(layout, "label: 'Query & Data'", 'Query & Data group')
  assertIncludes(layout, "label: 'Environment'", 'Environment group')
  assertIncludes(layout, "label: 'Security'", 'Security group')
})

test('AppLayout.tsx: Security group still has all 6 original security tools', () => {
  const secStart = layout.indexOf("label: 'Security'")
  const secBlock = layout.slice(secStart, layout.indexOf(']', secStart) + 1)
  const securityTools = [
    'security-role-viewer',
    'user-access-analyzer',
    'record-access-checker',
    'record-sharing-auditor',
    'security-role-compare',
    'field-security-viewer',
  ]
  for (const tool of securityTools) {
    assertIncludes(secBlock, tool, `Security group should contain ${tool}`)
  }
})

test('AppLayout.tsx: Permission Diagnostic added to Security group', () => {
  const secStart = layout.indexOf("label: 'Security'")
  const secBlock = layout.slice(secStart, layout.indexOf(']', secStart) + 1)
  assertIncludes(secBlock, 'permission-diagnostic', 'Permission Diagnostic in Security group')
})

test('AppLayout.tsx: all 20 legacy nav paths preserved', () => {
  for (const route of LEGACY_ROUTES) {
    assertIncludes(layout, `path: '/${route}'`, `legacy nav path ${route}`)
  }
})

test('AppLayout.tsx: 5 new nav entries added', () => {
  assertIncludes(layout, 'connection-string-analyzer', 'Connection String Analyzer nav')
  assertIncludes(layout, 'azure-ad-config-checker', 'Azure AD Config Checker nav')
  assertIncludes(layout, 'business-unit-hierarchy', 'BU Hierarchy nav')
  assertIncludes(layout, 'audit-log-viewer', 'Audit Log Viewer nav')
  assertIncludes(layout, 'permission-diagnostic', 'Permission Diagnostic nav')
})

test('AppLayout.tsx: Plugin Scaffolder nav added to Code Generators group', () => {
  const start = layout.indexOf("label: 'Code Generators'")
  const block = layout.slice(start, layout.indexOf(']', start) + 1)
  assertIncludes(block, 'plugin-project-scaffolder', 'Plugin Scaffolder nav in Code Generators group')
})

// --- api.ts 回归 ---

const LEGACY_API_FUNCTIONS = [
  'searchUsers', 'searchTeams', 'fetchUserProfile', 'assignUserRole', 'removeUserRole',
  'checkRecordAccess', 'searchRecords', 'fetchSharedPrincipals', 'shareRecord', 'revokeRecordAccess',
  'compareRoles', 'addRolePrivileges',
  'fetchFieldSecurityProfiles', 'fetchProfilePermissions', 'fetchProfileMembers',
  'assignProfileMember', 'removeProfileMember', 'fetchSecuredFields',
]

const LEGACY_NON_SECURITY_API = [
  'fetchMetadataEntities', 'fetchEntityAttributes', 'executeFetchXml',
  'fetchEnvironmentInfo', 'connectToDataverse', 'disconnectFromDataverse',
]

const NEW_API_FUNCTIONS = [
  'fetchBusinessUnitTree', 'fetchBusinessUnitDetails',
  'fetchAuditActions', 'fetchAuditLogs',
  'diagnosePermission', 'scaffoldPluginProject',
]

test('api.ts: all 18 legacy security API functions preserved', () => {
  for (const fn of LEGACY_API_FUNCTIONS) {
    assertIncludes(api, `export function ${fn}(`, `legacy API function ${fn}`)
  }
})

test('api.ts: all legacy non-security API functions preserved', () => {
  for (const fn of LEGACY_NON_SECURITY_API) {
    assert(api.includes(`function ${fn}(`), `legacy non-security API function ${fn}`)
  }
})

test('api.ts: all 6 new API functions added', () => {
  for (const fn of NEW_API_FUNCTIONS) {
    assertIncludes(api, `export function ${fn}(`, `new API function ${fn}`)
  }
})

test('api.ts: new type interfaces exported', () => {
  assertIncludes(api, 'export interface BUItem', 'BUItem interface')
  assertIncludes(api, 'export interface BUDetails', 'BUDetails interface')
  assertIncludes(api, 'export interface AuditLog', 'AuditLog interface')
  assertIncludes(api, 'export interface AuditAction', 'AuditAction interface')
  assertIncludes(api, 'export interface PermissionDiagnosis', 'PermissionDiagnosis interface')
})

test('DataQuery requires metadata EntitySetName and never falls back to LogicalName', () => {
  assertIncludes(dataQuery, 'if (entitiesLoading || entitiesError || !entitySetName) return', 'query metadata guard')
  assert(!dataQuery.includes('target?.EntitySetName || entityName.trim()'), 'LogicalName fallback must stay removed')
  assertIncludes(dataQuery, 'disabled={loading || entitiesLoading || !!entitiesError', 'query button disabled guard')
  assertIncludes(dataQuery, '{entitiesLoading && (', 'metadata loading state')
  assertIncludes(dataQuery, 'Loading entity metadata...', 'metadata loading text')
})

test('AsyncSearchSelect exposes failures, retry, and stale-request guards', () => {
  assertIncludes(searchSelect, 'const [retryKey, setRetryKey] = useState(0)', 'retry state')
  assertIncludes(searchSelect, "setError(e instanceof Error ? e.message : 'Search failed')", 'error feedback')
  assertIncludes(searchSelect, '}, [open, search, retryKey])', 'retry effect dependency')
  assertIncludes(searchSelect, 'onClick={() => setRetryKey(key => key + 1)}', 'retry action')
  assertIncludes(searchSelect, '.finally(() => { if (!cancelled) setLoading(false) })', 'stale loading guard')
})

test('RecordSharingAuditor surfaces entity metadata failures', () => {
  assertIncludes(sharingAuditor, 'error: entitiesError', 'metadata error from hook')
  assertIncludes(sharingAuditor, '{entitiesError && <ErrorState message={entitiesError} />}', 'metadata error display')
  assertIncludes(sharingAuditor, 'disabled={!selectedEntity || entitiesLoading || !!entitiesError}', 'record search metadata guard')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
