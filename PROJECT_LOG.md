# D365 CRM Tools - Project Log

## Project Overview

D365 CRM 开发工具网站，为 D365 CRM 开发人员提供快捷开发工具。

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **State Management**: Zustand
- **Backend**: Node.js + Express + TypeScript
- **D365 Auth**: @azure/identity (ClientSecretCredential + UsernamePasswordCredential)
- **Package Manager**: pnpm workspace

### Project Structure
- `client/` - React frontend (port 3000)
- `server/` - Express backend (port 3001)

## 10 Tools Implemented

### Pure Frontend Tools (7)
1. **Connection String Builder** - Generate D365 connection strings (Client Secret / Certificate / Office365 / OAuth) in C#/PowerShell/PAC CLI format
2. **Power Automate Expression Tester** - Test Power Automate expressions with real-time evaluation (String, DateTime, Logic, Conversion)
3. **FetchXML Builder** - Visual FetchXML query builder with conditions, orders, link entities
4. **OData URL Builder** - Construct D365 Web API OData v4 URLs with query parameters
5. **Plugin Code Generator** - Generate C# Plugin boilerplate (IPlugin interface)
6. **PCF Component Scaffolding Generator** - Generate PCF component files (manifest.xml, index.ts, React component, CSS)
7. **Custom Page Template Generator** - Generate Custom Page configuration and Power Fx formulas

### Connection-Required Tools (3)
8. **Entity Metadata Viewer** - Browse entities and field metadata
9. **Solution Manager** - View installed solutions and components
10. **Data Query Tool** - Query entity records with OData parameters

### Connection Mechanism
- Connection dialog with two auth modes: Client ID + Secret, Username + Password
- ConnectionGuard component wraps connection-required tools
- Backend proxies all Dataverse API calls to avoid CORS
- Connection status shown in sidebar

## Session Log

### 2026-09-18 - Initial Implementation
- Created project from scratch
- Set up pnpm workspace with client/server
- Implemented all 10 tools
- All TypeScript compilation passes
- Both frontend and backend running successfully
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### 2026-09-18 - Testing Session
- Tested all 10 tools against D365 China cloud environment (yourorg.crm.dynamics.com)
- Created TEST_PLAN.md with 55 test cases across all tools
- Created TEST_RESULTS.md with detailed results

**Test Results**: 10/10 tools fully functional
- 7/7 frontend tools: ALL PASS
- 3/3 connection tools: ALL PASS

**Bugs Found & Fixed**:
1. PCF Generator Index.ts tab not working (Radix Tabs conditional rendering issue) - FIXED
2. Username+Password tab missing Tenant ID field - FIXED
3. Connection state lost on page refresh - FIXED (sessionStorage)
4. China cloud auth failure (wrong Azure AD endpoint) - FIXED (AzureChinaCloud authority)
5. Metadata Viewer EntityDefinitions fetch failure on China cloud - FIXED (axios + removed unsupported $top/$orderby + retry logic)

**Key Technical Decisions**:
- China cloud (crm5.dynamics.com) requires `AzureAuthorityHosts.AZURE_CHINA` for auth
- Tenant ID must be full domain (e.g., `yourtenant.onmicrosoft.com`), not short name
- Connection state persisted via sessionStorage to survive page refreshes

### 2026-09-18 - Bug Fix: Metadata Viewer China Cloud Compatibility
- **Root Cause Analysis**:
  - Node.js native `fetch()` (undici) has SSL/TLS issues with China cloud → replaced with `axios`
  - `EntityDefinitions` endpoint on China cloud does NOT support `$top` or `$orderby` query parameters (returns 400 error `0x80060888`)
  - `AttributeMetadata` `$select` cannot include subtype-specific properties (`MaxLength`, `MinValue`, `MaxValue`)
  - Intermittent `ECONNRESET` on large metadata responses
- **Fixes Applied**:
  - Added `axios` dependency to server
  - Replaced all `fetch()` calls with `axios.get()` in `dataverseService.ts`
  - Removed `$top`/`$orderby` from metadata queries; moved sorting/limiting server-side
  - Removed invalid fields from Attributes `$select`
  - Added retry logic (max 2 retries with exponential backoff) for network errors
  - Increased timeout from 30s to 60s
- **Result**: Metadata Viewer fully functional - 200 entities, 462 attributes loaded successfully

### 2026-09-21 - Organize Test Screenshots
- Created `test-screenshots/` folder in project root
- Moved all 29 test screenshot PNG files (test-*.png, tool*.png) from root directory into `test-screenshots/`
- Keeps project root clean and test artifacts organized in one place

### 2026-09-21 - Run Project & Pre-fill Connection Info
- Started dev servers: frontend http://localhost:3000, backend http://localhost:3001
- Pre-filled ConnectionDialog defaults with test environment info (env URL, tenant ID, client ID, client secret, username)
- Verified connection via backend API: `POST /api/connection/connect` returned success=true
- Username/Password tab: password field left blank (not stored in repo docs)

### 2026-09-21 - FetchXML Builder: Connection-Aware Enhancements
**Features added**:
1. "Fetch Data" button - executes the built FetchXML against the connected environment and shows a results table (record count + data grid)
2. When connected, Entity Name becomes a searchable dropdown populated from environment entities (with type-to-filter); plus a "Connect Environment" button + connected badge in the header
3. When connected, all attribute inputs become searchable dropdowns reading entity field metadata (Select Fields = multi-select checkbox, Condition attribute, Order attribute, Link Entity name, Link From = linked entity attributes, Link To = current entity attributes)

**Backend**:
- `GET /api/dataverse/metadata/entities` now selects `EntitySetName` and accepts `?limit=` (default 200, max 5000)
- New `POST /api/dataverse/data/fetchxml` (body: `{ fetchXml, entitySetName? }`) executing via `GET /{entitySet}?fetchXml=`; falls back to resolving EntitySetName from the fetch root entity via EntityDefinitions

**Frontend**:
- New `client/src/components/ui/search-select.tsx` (SearchSelect + MultiSearchSelect, no new dependencies)
- `api.ts`: added `fetchMetadataEntities`, `fetchEntityAttributes`, `executeFetchXml`
- `FetchXmlBuilder.tsx`: works standalone (plain inputs) when not connected; connection-aware dropdowns when connected

**IMPORTANT CORRECTION to 2026-09-18 note "China cloud requires AzureAuthorityHosts.AZURE_CHINA"**:
- `AZURE_CHINA` was never a valid constant in @azure/identity v4 (correct: `AzureChina`), so runtime was always `authorityHost: undefined` = public-cloud default authority - that is why auth actually worked
- Verified by test script: default authority -> token OK + WhoAmI 200 OK; `AzureChina` authority -> AADSTS90002 (tenant not found in China cloud); this tenant is a public-cloud tenant
- Fix: `getAuthorityOptions` now only uses `AzureChina` for genuine `*.dynamics.cn` environments; also fixed pre-existing server tsc errors (Router type annotations in 4 route files), server + client `tsc` now pass cleanly

**Verification**:
- Both tsc checks pass; backend API tests: entities limit works, fetchxml endpoint returns data (both with entitySetName and fallback path)
- Browser E2E (via browser agent): connect with prefilled dialog -> entity dropdown filter "contact" -> multi-select fields -> condition attribute search -> Fetch Data returned 4697 records with results table
- Known env issue: intermittent ECONNRESET on large queries (existing retry logic; manual retry succeeds)

### 2026-09-21 - Bug Fix: Query Results missing selected field columns
- **Symptom**: selected "fullname" field was not shown as a column in Query Results (only contactid/createdon)
- **Root cause**: Dataverse omits null attributes from responses, and column list was derived from the FIRST record's keys only; the first record had null fullname, so the whole column was dropped
- **Fix**: columns now = selected fields in Select Fields order (always visible even if null in all records, cells show "-"), then union of extra record keys (e.g., primary id) from first 50 records; also added "Query returned 0 records." empty state
- **Verified**: real API probe confirmed fullname populated in records 2-5 (record 1 null); browser retest with top=5 shows columns `# / fullname / createdon / contactid` with real values (Robert Mitchell, Donald Allen, ...), 1 null row shows "-"

### 2026-09-21 - Data Query Tool: Environment-Driven Dropdowns
**Changes** (DataQuery.tsx, which always has a connection via ConnectionGuard):
1. Entity Name: text input -> searchable dropdown populated from environment entities (value = logical name; query resolves EntitySetName for the OData URL)
2. $select (fields): text input -> multi-select dropdown of the selected entity's attributes; changing entity resets fields/order (prevents stale foreign-entity selections)
3. $orderby: renamed label to "$order by" (with space) and changed to field dropdown + Asc/Desc direction selector; builds `$orderby=field desc`
- Results columns now use the same selected-fields-first logic as FetchXML Builder (fixes the null-field column loss there too)
- **Bug found via browser test & fixed**: long field labels (e.g. "createdon (Created On)") overflowed the flex row and overlapped the $top input, blocking clicks - fixed by adding `min-w-0` to SearchSelect/MultiSearchSelect root & trigger labels plus `min-w-0` on flex-1 usages
- **Verified**: entity filter "contact" selects, multi-select fields, $order by createdon Desc + $top=3 -> 3 records, headers `# / fullname / createdon / contactid`, no overlap (16px gap, elementFromPoint checks pass)

### 2026-09-21 - Bug Fix: Solution Manager "Failed to fetch components"
- **Symptom**: clicking any solution showed "Failed to fetch components"
- **Root cause**: `solutionid` on solutioncomponent is a lookup (navigation) property; OData `$filter=solutionid eq {guid}` fails with 400 `0x80060888 "binary operator with incompatible types" (Microsoft.Dynamics.CRM.solution vs Edm.Guid)`. Lookup attributes must be filtered through the bound path `_solutionid_value`
- **Fix (server/src/routes/solution.ts)**: `$filter=_solutionid_value eq {solutionId}`, `$select` simplified to `objectid,componenttype`
- **Additional fixes (SolutionManager.tsx)**:
  1. Component type map replaced with the official solutioncomponent optionset, fetched live from the environment metadata (`EntityDefinitions(LogicalName='solutioncomponent')/Attributes(LogicalName='componenttype')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata`) - the old map was badly misaligned (e.g. 20=Role shown as "View", 90=Plugin Type shown as "Plugin Assembly", 29=Workflow shown as "Form")
  2. Components now grouped by numeric type code, so display names that repeat (e.g. 371/372 = Connector) count separately
  3. Fetch errors now surface the server-side error message instead of a generic "Failed to fetch" string
- **Verified**: API returns 160 components for "1.2-SGCRM_Init_ProcessAndRole"; browser E2E shows Component Summary with correct names/quantities (Role 77, Workflow 64, Entity 2, Environment Variable Definition 2, ...); both tsc checks pass

### 2026-09-22 - Global UI Modernization + 5 New Tools
**Part A - Infrastructure**:
1. Local icon library `client/src/components/ui/icons.tsx` (~33 icons): SVG paths scraped from iconfont.cn via browser agent, wrapped with a `createIcon` factory (viewBox 0 0 1024 1024, fill=currentColor); a few malformed scraped paths (chevron-down etc.) were hand-drawn; all lucide-react usages in pages/UI components replaced
2. Shared UI: `page-header.tsx` (gradient title + icon slot + actions + bottom border, adopted by all 15 pages), `state-display.tsx` (LoadingState/EmptyState/ErrorState), Card upgraded to rounded-xl + hover:shadow-md, zebra-striped tables
3. `AppLayout.tsx` rewritten: sidebar grouped into Code Generators / Query & Data / Environment, active item with 3px accent indicator bar, connection status as a colored card

**Part B - Existing pages**: entity/field inputs in ODataUrlBuilder ($select multi-select, $orderby field+direction, per-filter field dropdowns, auto Base URL), CustomPageGenerator, PluginGenerator converted to connection-aware dropdowns via new shared `client/src/hooks/useMetadata.ts` (useMetadataEntities/useEntityAttributes); all 10 existing pages adopted the new UI spec

**Part C - 5 new tools** (all connection-gated, routes registered in App.tsx + server/index.ts):
1. Environment Dashboard (`/tools/environment-dashboard`): org/user/version/stats cards with skeletons; backend `environment.ts` (WhoAmI + Promise.allSettled, $count queries, EntityDefinitions counted server-side)
2. Option Set Viewer (`/tools/option-set-viewer`): Global tab (searchable list + Value/Label/Color table + copy as JSON / C# enum / Power Fx) and Entity tab (Picklist/MultiSelectPicklist cast-segment metadata query with $expand=OptionSet,GlobalOptionSet, Global vs Local badges)
3. Business Rule Inspector (`/tools/business-rule-inspector`): workflow query with `category eq 2 and type eq 1` (Business Rule definitions); clientdata JSON parsed server-side with a generic recursive extractor (field+operator => conditions, action-type pattern => actions) with raw-JSON fallback display
4. Web Resource Manager (`/tools/web-resource-manager`): type filter + name search, expandable rows with code `<pre>` preview / image preview, Publish button via PublishXml action; list endpoint intentionally excludes base64 content (loaded on demand per row) to keep payloads small; added `DataverseService.post()`
5. Security Role Privilege Viewer (`/tools/security-role-viewer`): single FetchXML (role -> roleprivileges -> privilege, aliased privilegedepthmask) builds the whole 8-action matrix in one query; strict suffix match on privilege names (prv{Action}{Entity}); depth badges None/User/BU/P:C BU/Org with legend

**Verification**: server + client `tsc --noEmit` both pass cleanly (fixed one TS error: spread of Record losing index signature in optionset.ts)

### 2026-09-22 - Automated Test Suite (tests/) + 2 Real Backend Bugs Found & Fixed
**Test infrastructure** (new `tests/` folder, zero-dependency Node .mjs, 80 cases total):
1. `tests/lib/harness.mjs`: minimal framework (createSuite/assert/assertIncludes/assertStatus, isMain, requiresConnection/requiresCredentials skip)
2. `tests/lib/api.mjs`: connection management + request wrapper with transient-failure retry (500 with ECONNRESET/aborted/ETIMEDOUT/MSAL network_error, 2 retries with backoff)
3. `tests/api/00-09`: API integration tests for all 9 route modules (health, connection, metadata, solutions, data, environment, optionsets, businessrules, webresources, security) against live localhost:3001 + sandbox
4. `tests/tools/10-16`: source-contract tests for the 7 pure-frontend generators (generation logic is inlined in React components, so tests assert key template/splicing patterns to prevent silent regressions, e.g. entity-switch reset, null-operator without value, result-column union)
5. `tests/run-all.mjs` + `tests/README.md`; credentials in `config.local.mjs` (gitignored template `config.example.mjs`); exit code 0/1 for CI

**Bug fix 1 - Environment Dashboard organization=null** (`server/src/routes/environment.ts`):
- **Root cause**: `$select` on organizations included `urlname`, which is NOT a valid organization property -> Dataverse 400 `0x80060888 "Could not find a property named 'urlname'"`, and Promise.allSettled silently degraded organization to null
- **Fix**: removed `urlname` from $select; frontend EnvironmentDashboard.tsx "URL Name" row replaced with "Language Code"

**Bug fix 2 - Security Role matrix truncated & duplicated** (`server/src/routes/security.ts`):
- **Symptoms**: 469 "roles" with hundreds of duplicate names; System Administrator missing from the matrix
- **Root cause**: (a) Dataverse creates one role copy per business unit under the same name with a different roleid - results must be merged by name; (b) the single outer-join FetchXML with `top="500"` counts JOINED rows (role x privilege pairs), so late-alphabet roles were silently truncated; (c) FetchXML Web API paging does NOT return `morerecords` - more pages are signaled by `@Microsoft.Dynamics.CRM.fetchxmlpagingcookie`, and the returned pagingcookie value is double-URL-encoded while the platform parses the `paging-cookie` attribute value directly as XML, so it must be fully decoded and XML-escaped (& -> &amp;, < -> &lt;, " -> &quot;) or the next page fails with `0x80040201 Malformed XML in the Paging Cookie`
- **Fix**: two paged queries via new `fetchAllRows` helper (paging-cookie loop, 50-page cap): phase 1 all role records merged by name; phase 2 roleprivilegescollection INNER JOIN privilege filtered by name (matching pairs only, no outer-join row explosion). `/roles` endpoint also dedupes by name now
- **Verified**: /roles returns 320 distinct roles incl. System Administrator; matrix shows SysAdmin all-8 (Org depth) and System Customizer all-1 (User depth) for account

**Flakiness hardening**: 05-environment test retries /info up to 3x when a sub-query degraded to null (endpoint is fault-tolerant by design; environment has intermittent ECONNRESET)

**Result**: `node tests/run-all.mjs` -> 80 passed, 0 failed, 0 skipped

### 2026-09-22 - Security Toolset: 5 New Permission Tools (20 tools total)
**Sidebar**: new "Security" group (Security Roles moved in from Environment) with User Access / Record Access / Sharing Auditor / Role Compare / Field Security. All writes behind ConfirmDialog; server validates GUID + AccessMask whitelist; `@odata.id` always built server-side from the connected environmentUrl.

**Shared infrastructure**:
- `DataverseService.delete()` + `buildEntityUrl()`; retry now also covers mid-body socket resets (ECONNRESET with error.response present -> previously surfaced as "Dataverse API error: 200 - aborted")
- `security.ts` exports `fetchAllRows` / `effectiveDepth`; new endpoints: `/users`, `/teams`, `/users/:id/profile` (user+BU, direct roles, teams with embedded team roles via FetchXML `operator="in"`), `POST/DELETE /users/:id/roles` ($ref association), `/role-privileges`, `/compare` (union with both/onlyA/onlyB/depthDiff), `POST /roles/:id/add-privileges` (AddPrivilegesRole, Depth enum Basic/Local/Deep/Global)
- New routers: `recordaccess.ts` (`/check`, `/record-search`, `/shared`, `/share` Grant|ModifyAccess, `/revoke` RevokeAccess), `fieldsecurity.ts` (profiles / permissions with live Picklist labels / members user+team associations / secured-fields)
- Frontend: 5 icons, `AsyncSearchSelect` (300ms debounced server search), `ConfirmDialog`, `environment /info` now exposes WhoAmI `userId`

**Environment-specific findings (crm5 / this PwC sandbox)**:
1. **RetrievePrincipalAccess does not exist** in the function catalog -> `/check` falls back to `computeEffectiveAccess` (role privileges direct+team, depth evaluated against record owner/BU ancestor chain, unioned with POA accessrightsmask bits); response carries `source: 'function'|'computed'` and the UI shows a notice
2. **RetrieveSharedPrincipalsAndAccess is an unbound GET Function**, and alias query keys (@t/@p) break under axios params encoding -> URLs are hand-assembled (`functionCallUrl`); response key is `PrincipalAccesses` (not PrincipalAccess) and Principal serializes as `{@odata.type, ownerid}` -> parser accepts all variants, ids normalized to lowercase
3. **principalobjectaccess has no `_objectid_value` lookup** - filter via plain Guid properties `objectid` / `principalid`
4. **Org policy 0x80040265 "Compliance Country is required"** rejects ALL API role assignment for every user (verified with a real user) - roundtrip test detects it and skips with a note (environment limitation, not an interface defect)

**Tests**: 4 new suites (10-user-access, 11-record-access incl. share->shared->revoke roundtrip, 12-role-compare SysAdmin vs System Customizer, 13-field-security) registered in run-all.mjs; `apiDelete` added to tests/lib/api.mjs

**Verification**: server + client tsc clean; `node tests/run-all.mjs` -> **102 passed, 0 failed**; browser E2E spot-check of all 5 tools passed (role compare: OnlyA=254/DepthDiff=151/Identical=18316; field security: 23 profiles, 6 secured account fields; access checker shows computed-source notice with 7/8 granted)

**Regression pass (same day)**: the change touched shared code (requestWithRetry retry predicate, security.ts exports, /info userId, AppLayout grouping, App.tsx routes). Added `tests/tools/17-security-grouping.test.mjs` (source-contract regression lock: Security group membership, Security Roles removed from Environment group, all 15 legacy nav entries + routes preserved, api.ts additive surface, retry predicate must not require !error.response, /info userId) and registered it in run-all.mjs. Full suite -> **109 passed, 0 failed**; browser regression spot-check of Security Role Viewer (320-role matrix, group migration highlighted), Environment Dashboard (cards + userId), Data Query (contact top=3), Solution Manager (200 solutions + component summary) - all normal, no regressions.

### 2026-09-22 - /better-harness Harness 实践评审
- 运行 better-harness 证据包（qoder / normal / 30 天窗口）：会话通道可用但 0 个合格会话；projectHarness 与 lead 通道因无任务片段不可用（可复现，诊断为会话源根不存在）。
- 按降级（session-limited）流程产出评审：findings 0 条（计数、资产缺失、不可用证据按质量门禁均为线索，不可提升）；维度分采用证据状态上限保守值（任务理解 50 / 可控执行 62 / 改动验证 64 / 可靠交付 42 / 经验沉淀 35）。
- 产物：`.qoder/better-harness/2026-09-22/135308-d365-crm-tools/` 下 findings.json、canvas.json、report.canvas.tsx；render --validate 通过（初次因诊断遗留 report.source.json 校验失败，删除后通过；locale 需 zh-CN 且维度标签须为固定中文文案）。

### 2026-09-22 - 试用 credits-inspector 插件做会话消耗分析
- 总结插件（qoder-credits-inspector v2.7.4）功能：仅 1 个 skill（credits-inspector），无 MCP / commands / agents；靠 Stop 钩子自动刷新 `.qoder-credits/` 报告，自带 CLI（bin/credits-inspector.cmd）与 BYOK usage 代理。
- 读取本工作区 `.qoder-credits/report.json` 分析最近一次会话（better-harness 评审会话）：source=ide-lite，Credits/token 真值不可用（显示「—」而非 0）；可用真值为计数类：24 次工具调用（Bash 11 / Read 7 / SearchReplace 3）、13 次文件读取、1 轮对话。
- 文件成本榜（selfTokens 估算）：agent-work-loop.md 13103、findings.json 5050（写+3 次回读）、PROJECT_LOG.md 3984/3 次读取、findings-review.md 2029。
- 引导用户在 Canvas 预览面板打开 `.qoder-credits/分析所选项目的 Harness 实践，并生成简洁__task-a39.canvas.tsx` 查看图形化报告。

### 2026-10-08 - 5 个权限/Azure 方向新工具（25 tools total）
**新增工具**:
1. **Connection String Analyzer** (`/tools/connection-string-analyzer`) -- 纯前端，解析连接字符串、验证格式、识别常见配置错误（China 云 authority、Tenant ID 格式、缺少必要参数等）
2. **Azure AD Config Checker** (`/tools/azure-ad-config-checker`) -- 纯前端，通过 openid-configuration 公开端点验证 Azure AD 应用注册配置，支持 Public/China 云切换，输出检查清单 + D365 Application User 配置指南
3. **Business Unit Hierarchy** (`/tools/business-unit-hierarchy`) -- 连接环境，树形展示 BU 组织层级，右侧详情面板显示用户/团队/角色统计
4. **Audit Log Viewer** (`/tools/audit-log-viewer`) -- 连接环境，查询安全相关审计事件（角色分配/撤销、共享/撤销共享、登录等），支持事件类型多选、日期范围、实体筛选
5. **Permission Diagnostic** (`/tools/permission-diagnostic`) -- 连接环境，输入用户+实体+可选记录，聚合所有权限来源（直接角色、团队角色、有效权限矩阵、POA 共享），给出 Granted/Denied 结论

**后端新增**:
- `server/src/routes/permission.ts` -- POST /api/dataverse/permission/diagnose（聚合 security.ts 的 fetchAllRows/effectiveDepth + POA 查询）
- `server/src/routes/businessunit.ts` -- GET /tree + GET /:id/details
- `server/src/routes/audit.ts` -- GET /actions + GET /logs（OData $filter 构建）
- `server/src/index.ts` -- 注册 3 个新路由

**前端新增**:
- 5 个页面组件 + 5 个新图标（IconStethoscope, IconOrgTree, IconAuditLog, IconCloudShield, IconAnalyze）
- `api.ts` 新增 5 个 API 函数 + 5 个类型接口
- `App.tsx` 新增 5 条路由
- `AppLayout.tsx` 侧边栏：Connection String Analyzer + Azure AD Config Checker 加入 Code Generators 组，BU Hierarchy + Audit Log Viewer 加入 Environment 组，Permission Diagnostic 加入 Security 组

**测试**:
- `tests/api/14-permission.test.mjs` -- Permission Diagnostic API（3 cases）
- `tests/api/15-businessunit.test.mjs` -- Business Unit API（3 cases）
- `tests/api/16-audit.test.mjs` -- Audit Log API（3 cases）
- `tests/tools/18-new-tools-regression.test.mjs` -- 21 个源码契约 + 回归测试（5 新工具存在性 + 4 个被修改文件的全面回归：App.tsx 25 路由、server/index.ts 14 路由注册、AppLayout.tsx 分组/导航、api.ts 函数接口）
- `tests/tools/17-security-grouping.test.mjs` -- NEW_PATHS 扩展为 10 个
- `tests/run-all.mjs` -- 注册 3 个新 API 测试 + 1 个新回归测试

**验证**: server + client `tsc --noEmit` 均通过；所有 source-contract 测试（10-18）全部通过

### 2026-10-19 - 编写全模块测试计划文档
- 应用户要求创建 `TEST_PLAN.md`（v2.0），覆盖全部 25 个工具（9 纯前端 + 16 连接类）、14 个后端路由模块、通用基础设施（连接机制 + 全局 UI 规范）
- 内容结构：通用基础设施（INFRA/UI）→ 纯前端工具 9 组（CSB/CSA/AAD/PAE/FXB/OUB/PLG/PCF/CPG）→ 连接类工具 16 组（EMV/SOL/DQT/EDB/OSV/BRI/WRM/SRV/UAA/RAC/RSA/SRC/FSV/PMD/BUH/ALV）→ 后端 API 自动化映射表（tests/api 00-16 + tests/tools 10-18）→ 非功能测试 → 15 条历史缺陷回归锁定清单 → 执行策略与缺陷分级 → 工具/路由/后端依赖映射附录
- 回归清单整合记忆中的关键陷阱：AZURE_CHINA 常量、FetchXML 分页 cookie 双重编码、null 字段列丢失、POA 无 _objectid_value、audit 改用 FetchXML、flex min-w-0、AsyncSearchSelect 导入路径等

### 2026-10-19 - 执行全量自动化测试
- 启动前后端 dev 服务（3000/3001），凭据复用 `tests/config.local.mjs`，运行 `node tests/run-all.mjs`
- **结果：139 用例，138 passed / 1 failed / 0 skipped**
- 唯一失败：05-Environment `GET /info returns organization, user and version`（version 为空）——与已知环境间歇性 ECONNRESET 导致 Promise.allSettled 子查询降级为 null 的 flake 一致（历史已加 3 次重试仍偶发），非代码回归；其余 16 个 API 套件 + 9 个源码契约套件全部通过
- 单独重跑 05 套件验证被权限分类器拦截，未执行；建议用户手动 `node tests/api/05-environment.test.mjs` 复验
- **复验结果**：用户授权后单独重跑 `node tests/api/05-environment.test.mjs` -> 2 passed, 0 failed（version 正常返回），确认该失败为环境间歇性 ECONNRESET 导致的 flake，非代码回归。全量套件实际通过率为 139/139

### 2026-10-22 - 新增工具：Plugin Project Scaffolder（26 tools total）
**功能**: 输入项目命名空间前缀（如 ABC）+ 发布者前缀（如 abc）+ 目标目录，一键生成完整 D365 Plugin 解决方案框架：`.sln` + `Crm.Plugins.Share` 共享框架项目（MSBuild Shared Project）+ `{NS}.Plugins.Sample` 示例插件 + `{NS}.Plugins.UnitTest` MSTest 项目。纯本地 fs 生成，无需连接 D365 环境（服务端首个 fs 型路由）。

**模板固化**: `server/templates/plugin-framework/`（42 个文件）——以 Hisense.CRM.D365.sln 为蓝本，依赖核查式剔除全部业务代码（ApiClient/SystemConfig/Notification/Task/MultiLanguageConfig/EmailSendHelper/DistanceHelper/业务 DTO 等），PluginBase.cs 剔除 `#if !DEBUG` 内 smooretech DNS 探测垃圾代码；命名空间从混乱的 PwC.*/YuTong.* 统一为 `Crm.Plugins.Share.*`；全部源文件 GB2312 → UTF-8 BOM；UnitTest 的 app.config **只保留绑定重定向，绝不复制真实 client secret**。Token 方案：`__NS__`（文件名）+ `{{NamespacePrefix}}/{{PublisherPrefix}}/{{GUID_*}}/{{guid_share}}`（内容），GUID 生成时 randomUUID 现场产生保证 sln/csproj/shproj/projitems 一致。

**后端**: `server/src/routes/scaffold.ts` — POST /api/scaffold/plugin-project；校验链：namespacePrefix `/^[A-Za-z][A-Za-z0-9]{0,19}$/`、publisherPrefix 小写规则 + msdyn/microsoft/mscrm 黑名单、targetDir 必须 win32 绝对路径、拒绝 `..`、拒绝盘符根/系统目录/仓库自身；已存在非空 → 409 幂等保护；生成后断言无 `{{`/`__NS__` token 残留。

**前端**: `client/src/pages/tools/PluginProjectScaffolder.tsx`（表单 + 客户端镜像校验 + 结果卡展示文件树/nuget restore 提示）+ IconScaffold（文件夹+加号，单路径反向缠绕镂空）+ Code Generators 组导航。

**踩坑**:
1. scaffold.ts 的 NUL 字符检查 `includes('')` 被工具链写成了空字符串字面量 `''`（任何字符串都 includes 空串）→ 所有 targetDir 一律 400。改用 `String.fromCharCode(0)` 绕开字面量转义丢失问题
2. Git Bash 会吞 heredoc/命令行中的反斜杠与 `/p:` 风格 MSBuild 参数 → 探测脚本改用 Write 工具落盘、MSBuild 用 `-p:` 语法
3. `pnpm --filter client exec tsc --noEmit` 用的是根 tsconfig.json（只有 references 无 files）→ **空检查假通过**；真实构建 `tsc -b` 暴露上一批工具遗留的 8 个错误（LoadingState/ErrorState/EmptyState props 不匹配：message→text/title、onRetry 不存在、Button 未使用），本次一并修复

**测试**: `tests/api/17-scaffold.test.mjs`（12 用例：5 组 400 校验 + happy path 文件清单 + 内容扫描禁 Hisense/PwC/token 残留 + GUID 四角一致性 + key.snk 字节一致 + 409 + 兄弟前缀共存）；`tests/tools/19-plugin-scaffolder.test.mjs`（11 用例源码契约）；18 套件扩展锁定新路由/导航/api（22 用例）

**验证**: 全量 `node tests/run-all.mjs` → **163 passed, 0 failed**；真实生成 ABC/abc → `D:\Code\个人项目\初始化项目测试\ABC.CRM.D365`，`nuget restore`（26 包）+ MSBuild（VS18 Community, vswhere 探测）**构建成功**，vstest 跑 MSTest **2/2 通过**；浏览器 E2E（XYZ/xyz 成功路径 + 结果卡）截图存档；`pnpm build` 生产构建通过。一次性模板制作脚本（scripts/）已清理。
