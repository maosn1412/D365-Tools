# D365 CRM Tools - 测试脚本集

本目录包含项目全部功能模块的可执行测试脚本，零第三方依赖（Node.js 18+ 原生 `fetch`）。

## 目录结构

```
tests/
├── config.example.mjs          # 测试配置模板
├── config.local.mjs            # 实际测试凭据（本地，请勿提交公共仓库）
├── run-all.mjs                 # 全量运行器（顺序执行所有套件并汇总）
├── lib/
│   ├── harness.mjs             # 极简测试框架（套件注册/断言/报告）
│   ├── api.mjs                 # API 请求与连接管理辅助
│   ├── retryPolicy.mjs         # 瞬时网络错误识别与幂等重试策略
│   └── source.mjs              # 前端源码读取辅助（契约测试）
├── api/                        # 后端 API 集成测试（需 server 运行）
│   ├── 00-health.test.mjs          # 服务健康检查
│   ├── 01-connection.test.mjs      # 连接管理 + 未连接保护（401）
│   ├── 02-metadata.test.mjs        # 元数据（实体/字段）→ Metadata Viewer
│   ├── 03-solution.test.mjs        # 解决方案与组件 → Solution Manager
│   ├── 04-data.test.mjs            # 数据查询 + FetchXML 执行 → Data Query / FetchXML Builder
│   ├── 05-environment.test.mjs     # 环境信息统计 → Environment Dashboard
│   ├── 06-optionset.test.mjs       # 选项集 → Option Set Viewer
│   ├── 07-businessrule.test.mjs    # 业务规则 → Business Rule Inspector
│   ├── 08-webresource.test.mjs     # Web 资源浏览/发布 → Web Resource Manager
│   ├── 09-security.test.mjs        # 安全角色权限矩阵 → Security Role Viewer
│   ├── 10-user-access.test.mjs     # 用户访问分析
│   ├── 11-record-access.test.mjs   # 记录访问与共享审计
│   ├── 12-role-compare.test.mjs    # 角色对比
│   ├── 13-field-security.test.mjs  # 字段安全
│   ├── 14-permission.test.mjs      # 权限诊断
│   ├── 15-businessunit.test.mjs    # BU 层级
│   ├── 16-audit.test.mjs           # 审计日志
│   ├── 17-scaffold.test.mjs        # 插件项目脚手架
│   └── 18-metadata-cache.test.mjs  # 服务端元数据缓存
└── tools/                      # 纯前端工具源码契约测试（无需 server）
    ├── 10-connection-string-builder.test.mjs
    ├── 11-power-automate-expressions.test.mjs
    ├── 12-fetchxml-builder.test.mjs
    ├── 13-odata-url-builder.test.mjs
    ├── 14-plugin-generator.test.mjs
    ├── 15-pcf-generator.test.mjs
    ├── 16-custom-page-generator.test.mjs
    ├── 17-security-grouping.test.mjs
    ├── 18-new-tools-regression.test.mjs
    ├── 19-plugin-scaffolder.test.mjs
    ├── 20-saved-connections.test.mjs
    ├── 21-metadata-cache.test.mjs
    └── 22-retry-policy.test.mjs
```

## 前置条件

| 测试范围 | 需要后端 (3001) | 需要凭据 | 需要前端 (3000) |
|---|---|---|---|
| `api/` 集成测试 | ✔ | 完整用例需要；无凭据时自动跳过连接用例，仅运行 400/401 保护用例 | ✘ |
| `tools/` 契约测试 | ✘ | ✘ | ✘ |

## 运行方式

```bash
# 全量运行（推荐）
node tests/run-all.mjs

# 单独运行某个套件
node tests/api/09-security.test.mjs
node tests/tools/13-odata-url-builder.test.mjs
```

退出码：全部通过（或跳过）为 `0`，任何用例失败或环境阻塞为 `1`，可直接接入 CI。全量汇总会额外显示 `product failures` 与 `environment blocked`；环境阻塞不算通过，也不计入产品失败。

## 两类测试的说明

### API 集成测试（tests/api/）
真实调用 `http://localhost:3001` 的后端接口，覆盖每个路由模块的：
- happy path（列表结构、字段完整性、排序规则）
- 参数校验（400）与资源不存在（404/500）
- 未连接保护（`requireConnection` 中间件返回 401）
- 已知历史 bug 的回归点（如 solutioncomponent 必须用 `_solutionid_value` 过滤）

连接凭据读取自 `config.local.mjs`（结构见 `config.example.mjs`）。连接状态保存在
server 进程内存中，`run-all.mjs` 内各套件共享一次连接。

重试约定：GET/HEAD/OPTIONS 遇到 TLS 断连、502/503/504、ECONNRESET 等网络签名时自动重试两次；
只读 POST 需在调用处显式传 `{ idempotent: true }`。写操作（连接、发布、角色/共享变更、脚手架、缓存清空）
不得自动重试。重试耗尽后用例标记为 `blocked`，harness 仍将其计入失败以保持非零退出，但单独显示
`env-blocked`，避免与产品断言失败混淆。

注意：`08-webresource` 的 publish 用例会对列表中第一个 Web 资源执行一次 PublishXml
（幂等操作，等同于在经典界面点一次 Publish，不修改内容）。

### 源码契约测试（tests/tools/）
纯前端工具（代码生成器）的生成逻辑内联在 React 组件中，无法被 Node 直接导入执行。
契约测试通过断言页面源码中的关键生成规则（模板片段、拼接格式、转义/重置逻辑）来防止
重构时的静默回归——例如"切换实体必须重置字段选择"、"null 操作符不生成 value 属性"
这类已知回归点均有对应用例。

如需对生成结果做 UI 级验证（点击、复制到剪贴板等），请配合根目录
`TEST_PLAN.md` 中的浏览器手工用例执行。

## 新增工具的测试约定

1. 新后端路由 → 在 `tests/api/` 新建 `NN-<name>.test.mjs`，导出 `suite`，并在 `run-all.mjs` 注册
2. 新纯前端工具 → 在 `tests/tools/` 新建对应契约测试，断言其生成模板的关键片段
3. 用例默认无需凭据；需要连接/凭据的用例分别标记 `{ requiresConnection: true }` /
   `{ requiresCredentials: true }`，环境不满足时自动跳过而非失败
