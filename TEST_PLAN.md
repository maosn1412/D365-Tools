# D365 CRM Tools - 测试计划

> 版本：v3.2 | 更新日期：2026-11-21
> 覆盖范围：全部 26 个工具（10 个纯前端 + 16 个需连接环境）、15 个后端路由模块 + 健康检查、通用基础设施（含已保存环境/一键重连、元数据双层缓存与全局刷新）
> 自动化静态清单：`node tests/run-all.mjs`（32 个套件 / 200 用例：API 00-18 共 19 套件、89 用例，源码契约 tools/10-22 共 13 套件、111 用例）。数量来自源码注册统计，不是本轮执行结果。
> 版本补充：2026-11-21 修复 MetadataViewer 迟到响应竞态、FetchXmlBuilder link-entity 刷新失效与测试基建的 TLS/502 重试/阻塞分类；`tools/21` 增至 10 例，新增 `tools/22` 4 例。
> 本文档为测试计划，用例执行状态默认 \*\*未执行\*\*；2026-11-18、2026-11-20 与 2026-11-21 的结果均在第 9 章按时间记录，历史通过不代表未执行用例已通过。

\---

## 1\. 测试概述

### 1.1 目的

对 D365 CRM Tools 的全部功能模块进行系统性验证，确保：

* 每个工具的核心功能按预期工作，每个模块都有可逐步执行、逐步判定的用例
* 需要连接环境的工具在真实 D365 沙箱中数据正确，写操作可确认、可恢复
* 纯前端工具的代码生成/解析/求值逻辑输出正确
* 新增模块（Plugin Project Scaffolder、已保存环境列表 + 一键重连）行为与存储安全符合设计
* 元数据双层缓存的命中、过期、清空、环境隔离和错误恢复正确；全局刷新不会造成跨环境或跨实体旧数据覆盖
* 缓存优化不得改变 FetchXML 显式实体集、错误契约及既有业务查询结果
* 全局 UI 规范（图标、PageHeader、状态组件、侧边栏分组）一致
* 已知历史缺陷（China 云认证、FetchXML 分页 cookie、null 字段列丢失、脚手架路径安全等）不复发

### 1.2 v3.1 → v3.2 变更摘要

|变更|说明|
|-|-|
|修复 BUG-2026-006|MetadataViewer 的实体/字段请求增加独立序号，迟到响应不再覆盖当前 UI|
|修复 link-entity 刷新|FetchXmlBuilder 的 link 字段缓存订阅 metadataEpoch，刷新时清空并丢弃旧响应|
|修复 TI-2026-001|测试请求层区分 TLS/502/超时，按方法幂等性重试，写操作不自动重试；报告中分离环境阻塞|
|自动化基线|32 套件 / 200 用例（API 89 + tools 111）；tools/21 增至 10 例，新增 tools/22 4 例|

### 1.2.1 v3.0 → v3.1 变更摘要

|变更|说明|
|-|-|
|新增 MC 模块|元数据缓存、全局刷新与跨模块回归（MC-01～MC-28），集中覆盖 L1/L2 缓存、连接生命周期、刷新和 FetchXML 回退|
|新增 12 页覆盖矩阵|9 个共享 hook 页面 + DataQuery/FetchXmlBuilder/MetadataViewer，验证暖缓存复用和 epoch 重取|
|自动化基线修正|静态清单更新为 31 套件 / 194 用例（API 89 + tools 105），补入 API 18 与 tools 21|
|历史结果校正|无凭据时 API 18 的 5 项应为 skipped；不得把 tools 21 的 8 项离线通过合并表述为“13 项通过”|
|待验证风险|服务端迟到响应、link-entity 字段 epoch、MetadataViewer 旧响应覆盖 UI、刷新部分失败，均先验证不预设结论|

### 1.2.2 v2.0 → v3.0 变更摘要

|变更|说明|
|-|-|
|新增 SCF 模块|Plugin Project Scaffolder（第 26 个工具，本地生成插件解决方案，无需 D365 连接但需后端写文件）|
|新增 SC 模块|已保存环境列表 + 一键重连（localStorage `d365\_saved\_connections`，上限 10 条 LRU，三动作：整行直连 / 复制预填 / 删除本机记录）|
|NF-06 重写|旧结论"凭据不写入 localStorage"已过时；新模型下凭据可存 localStorage，但不得进入渲染 DOM、可访问属性、日志，且需提示浏览器 profile 同步漫游风险|
|自动化映射更新|API 套件扩展到 00-17（新增 17-scaffold），源码契约扩展到 tools/10-20（新增 19-plugin-scaffolder、20-saved-connections）|
|回归清单扩充|REG-01\~15 保留，新增 REG-16\~25（脚手架与已保存环境相关历史缺陷）|
|附录分组修正|按当前 AppLayout 实际分组（Code Generators 7 / Query \& Data 4 / Environment 8 / Security 7）重写映射|
|已知问题登记|05-environment flake、tests/api/14-16 的 requiresConnection 参数位置问题写入执行注意事项|

### 1.3 测试环境

|项目|值|
|-|-|
|前端|http://localhost:3000（Vite dev server）|
|后端|http://localhost:3001（Express）|
|目标环境|D365 沙箱（禁止生产环境），文档统一写作 `<环境URL>`|
|浏览器|Chrome / Edge 最新版|
|启动方式|仓库根目录 `pnpm dev`（并行启动 client + server）|
|构建门禁|`pnpm build`（内部 `tsc -b` 真实类型检查 + vite build）|
|本地构建工具（仅 SCF-09）|nuget.exe、MSBuild（VS2019/2022+）、vstest|
|操作系统|Windows（Plugin Scaffolder 要求 win32 绝对路径）|

### 1.4 测试类型

* **自动化**：`tests/` 下 API 集成测试（00-18）+ 源码契约测试（10-21），运行 `node tests/run-all.mjs`，退出码 0 = 无失败
* **手动 / 浏览器 E2E**：本文档第 2、3、4 章，UI 交互、缓存与刷新时序、视觉回归、跨页面状态流转
* **非功能**：第 6 章（性能、韧性、安全）
* **回归**：第 7 章历史缺陷锁定清单，每次发布前必查
* **探索性测试**：边界输入、异常路径、网络故障恢复，发现新缺陷后回补为编号用例

### 1.5 通用前置条件

1. 仓库根目录执行 `pnpm install`，Node.js 18+、pnpm 可用。
2. `pnpm dev` 启动后，前端 3000、后端 3001 均可访问；`GET http://localhost:3001/api/health` 返回 `{ "status": "ok" }`。
3. 连接类工具先通过侧边栏连接状态卡（或页面内 `Connect Environment` 按钮）打开 ConnectionDialog 建立连接，支持 Client ID + Secret 与 Username + Password 两种模式。
4. 连接状态（`d365\_connection`，仅 `{connected, environmentUrl}`）保存在 **sessionStorage**，刷新页面保持、关闭标签页失效；已保存环境列表保存在 **localStorage**（`d365\_saved\_connections`），两者不要混淆。
5. 后端在进程内存中持有 Dataverse 令牌并代理全部 Dataverse 请求（避免 CORS）；重启后端后必须重新连接。
6. 自动化测试凭据：复制 `tests/config.example.mjs` 为 `tests/config.local.mjs`（已 gitignore）并填写：

|配置项|用途|备注|
|-|-|-|
|`baseUrl`|后端地址|默认 `http://localhost:3001`|
|`credentials`|clientSecret 认证的环境 URL / Tenant / ClientId / ClientSecret|真实凭据只写本文件，禁止写入公开文档|
|`scaffoldTestRoot`|17-scaffold 套件输出根目录（实际写入其 `\_\_apitest\_\_` 子目录）|未配置时落系统临时目录；不得指向仓库、盘符根或系统目录|
|`identityBlocklist`|脚手架生成结果中禁止出现的历史模板标识|只写本地文件，禁止提交|

7. 写操作用例需准备专用测试数据并记录基线：测试用户原始角色集合、测试记录原始共享列表、测试 Web Resource 原始内容与发布状态、SCF 目标根目录初始文件清单。

### 1.6 用例规范与脱敏要求

* 编号：`模块缩写-两位序号`；优先级 P0（核心/安全）> P1（主功能）> P2（次要/异常）> P3（体验）。
* 每个用例为"步骤 | 操作 | 预期结果"表格，一步一预期；模块头部统一标注自动化映射与公共前置。
* 只读模块统一不写"写后恢复"；写操作用例单独给出恢复步骤。
* 全文使用占位符：`<环境URL>`、`<租户ID>`、`<ClientId>`、`<ClientSecret>`、`<测试用户>`、`<测试记录>`、`<测试目录>`。
* 测试证据（截图、日志、响应摘要）必须脱敏；禁止把真实凭据、真实环境域名、本机个人目录写进本文档或公开仓库。
* 涉及 localStorage 的断言在浏览器 DevTools → Application → Local Storage 中检查 `d365\_saved\_connections`；检查完敏感值后及时清理测试数据。
* 缓存用例（MC）必须记录冷/暖/过期/失败状态、请求次数、`X-Cache` 和缓存统计；缓存命中不得只凭页面“看起来正常”判定。
* 2026-11-20 的 build、临时桩脚本和无凭据全量结果只写入历史小节；本轮新增 MC 用例及真实环境验收未执行时统一写“未执行”，历史通过不得回填。

\---

## 2\. 通用基础设施与全局 UI

### 2.1 连接机制（INFRA）

> 自动化映射：`tests/api/00-health`（2 用例）、`tests/api/01-connection`（7 用例）、`tests/tools/20-saved-connections`（挂载点契约）。
> 公共前置：`pnpm dev` 已启动；除 INFRA-01 外均需打开前端页面。

#### INFRA-01 开发环境启动与健康检查（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|仓库根目录执行 `pnpm dev`|client、server 两个子包并行启动，无编译报错|
|2|浏览器访问 `http://localhost:3000`|页面打开，自动重定向到 `/tools/connection-string-builder`|
|3|访问 `http://localhost:3001/api/health`|返回 200，body 为 `{ "status": "ok" }`|
|4|访问 `http://localhost:3001/api/not-exist`|返回 404，不返回 500 堆栈页面|

#### INFRA-02 Client ID + Secret 模式连接（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|点击侧边栏连接状态卡（显示 `Not connected` / `Connect`）|弹出 `Connect to D365 Environment` 对话框，默认在 `Client ID + Secret` 页签|
|2|依次填写 Environment URL=`<环境URL>`、Tenant ID=`<租户ID>`、Client ID=`<ClientId>`、Client Secret=`<ClientSecret>`|四个输入框可编辑；Client Secret 框为 `type=password`，输入被掩码|
|3|留空任一必填字段点击 `Connect`|不发起请求，footer 显示 `Please fill in all fields`|
|4|补全后点击 `Connect`|按钮变为 `Connecting...` 并禁用；成功后弹窗关闭，状态卡变绿显示 `Connected` 与环境 URL|

#### INFRA-03 Username + Password 模式连接（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|打开连接对话框，切到 `Username + Password` 页签|显示 Environment URL / Tenant ID / Client ID / Username / Password 五个字段（Tenant ID 字段存在，回归 REG-02）|
|2|填写 `<环境URL>`、Tenant ID 完整域名或 GUID、`<ClientId>`、`<测试用户>`、密码|Password 框为 `type=password`|
|3|点击 `Connect`|连接成功，状态卡变绿；失败则 footer 显示后端具体错误且弹窗不关闭|
|4|若环境未开启"允许公共客户端流"导致 AADSTS7000218|错误原文展示；判定为环境配置限制而非产品缺陷，记录后改用 Client Secret 验证|

#### INFRA-04 错误凭据与错误提示（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在 Client Secret 页签填写正确 URL/Tenant/ClientId，但 Client Secret 故意填错，点击 `Connect`|弹窗保持打开，footer 红色显示后端返回的 AAD 具体错误（如 invalid\_client 类），不崩溃、不白屏|
|2|检查侧边栏状态卡|仍为 `Not connected`|
|3|打开 DevTools 检查 localStorage `d365\_saved\_connections`|不存在该键或无新增记录（失败不写历史，关联 SC-07）|
|4|将 Tenant ID 改为短名（非完整域名/GUID）重试|显示明确错误信息，便于定位租户格式问题|

#### INFRA-05 刷新保持、断开与 ConnectionGuard 拦截（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|连接成功后按 F5 刷新页面|状态卡仍 `Connected`（sessionStorage 恢复，回归 REG-03），连接类工具无需重连|
|2|直接访问 `/tools/metadata-viewer`|工具正常渲染，不显示连接拦截页|
|3|点击状态卡右侧 `Disconnect` 图标按钮|调用 `POST /api/connection/disconnect`，状态卡恢复 `Not connected`|
|4|再次访问 `/tools/metadata-viewer`|ConnectionGuard 整页替换：离线图标 + `Environment Connection Required` 标题 + `Connect Environment` 按钮，不发起业务数据请求|
|5|点击 `Connect Environment` 并完成连接|弹窗关闭后原工具渲染，Guard 不保留此前页面输入|

#### INFRA-06 中国云环境 authority 切换（P1，无中国云环境时记"不适用"并注明）

|步骤|操作|预期结果|
|-|-|-|
|1|使用 `\*.dynamics.cn` 的 `<环境URL>` 按 INFRA-02 连接|服务端 authorityHost 切到 Azure China，认证成功（回归 REG-04：不存在 AZURE\_CHINA 常量，且仅对 `\*.dynamics.cn` 启用）|
|2|使用公有云 `<环境URL>` 连接|走默认公有云 authority，不被误判为中国云|
|3|在 Metadata Viewer 加载实体列表|不出现 `$top/$orderby` 导致的 400（0x80060888），列表正常返回（回归 REG-05）|

#### INFRA-07 ConnectionDialog 三个挂载点行为一致（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|从侧边栏状态卡打开弹窗并连接|成功回调后状态卡更新，弹窗关闭|
|2|断开连接，进入任一连接类工具，从 ConnectionGuard 的 `Connect Environment` 打开弹窗并连接|Guard 解锁渲染原工具|
|3|进入 FetchXML Builder（纯前端页），点击头部 `Connect Environment` 打开弹窗并连接|页头出现已连接标识，Entity Name 变为元数据下拉，`Fetch Data` 变为可用|
|4|三处分别重开弹窗|均显示相同的 Saved environments 列表与两个认证页签（props 契约 open/onOpenChange/onConnected 不变）|

#### INFRA-08 后端不可用与异常反馈（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|停止后端（Ctrl+C），在前端尝试连接|弹窗显示网络错误信息，不无限 `Connecting...`、不伪成功|
|2|恢复后端，进入 Environment Dashboard 后再次停止后端并刷新页面|info 区显示 ErrorState 而非白屏；stats 失败静默降级为 `-`|
|3|恢复后端并重新连接|页面可恢复正常，无需重启前端|

### 2.2 已保存环境与一键重连（SC）

> 自动化映射：`tests/tools/20-saved-connections`（12 用例，含源码级安全扫描）；行为细节以 `client/src/lib/savedConnections.ts` 与 `ConnectionDialog.tsx` 为准。
> 公共前置：后端可用；准备两套可用凭据（Client Secret、Username+Password 各一）。除特别说明外，每例开始前在 DevTools 中清空 `d365\_saved\_connections` 并断开连接。
> 存储模型：身份键 id = `归一化URL(trim+小写+去尾斜杠)|authType`；保存的 `environmentUrl` 只做 trim、保留原始大小写与尾斜杠；上限 10 条按 `lastUsedAt` 倒序 LRU；同环境两种认证各占一条。

#### SC-01 两种手动连接成功后自动保存（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|用 Client Secret 完成一次成功连接|localStorage 出现 `d365\_saved\_connections`，含 1 条记录：`authType=clientSecret`、`label` 为纯主机名、`lastUsedAt` 为当前时间戳|
|2|检查该记录字段|含 environmentUrl/tenantId/clientId/clientSecret；不含 username/password 有效值|
|3|断开后用 Username+Password 完成一次成功连接|列表新增第 2 条 `authType=usernamePassword` 记录，含 username/password，不含 clientSecret 有效值|
|4|重新打开连接弹窗|标题下显示 `SAVED ENVIRONMENTS (2)`，按 lastUsedAt 倒序排列|

#### SC-02 身份键归一化且原值保留（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|以 `<环境URL>`（带尾斜杠，如 `https://.../`）用 Client Secret 连接成功|保存 1 条；记录 `environmentUrl` 保留尾斜杠原样，`id` 为去尾斜杠、小写形式 + `\|clientSecret`|
|2|断开后改用不带尾斜杠、大小写不同的同一 URL 再次连接成功|不新增记录，仍 1 条；`lastUsedAt` 前移；本次保存的 environmentUrl 为本次输入原值|
|3|用 Username+Password 连接同一环境|新增第 2 条（`...|

#### SC-03 整行一键直连（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开连接并模拟服务重启后重开弹窗（或新开标签页）|显示 Saved environments 列表；手动表单各字段为空|
|2|点击其中一行的主体区域（非图标）|该行出现 spinner，其他行禁用；零输入直接使用保存凭据发起连接|
|3|等待完成|弹窗关闭，状态卡 `Connected`；该条 `lastUsedAt` 更新并排到最前|
|4|进入 Data Query 执行一次简单查询|后端已持有令牌，查询正常返回（证明重连真实有效）|

#### SC-04 复制图标预填到对应页签（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|弹窗中点击一条 clientSecret 记录的复制图标（title=`Fill into the form below`）|受控 Tabs 自动切到 `Client ID + Secret`，四个字段被填入；不自动发起连接|
|2|检查 Client Secret 输入框|值为已保存密钥且 `type=password` 掩码显示|
|3|点击一条 usernamePassword 记录的复制图标|切到 `Username + Password` 页签，五个字段填入，不串到另一页签|
|4|检查 localStorage|记录数量与内容不变（prefill 不是连接，不刷新 lastUsedAt）|

#### SC-05 删除单条本机记录（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在已连接状态下打开弹窗，点击某条记录垃圾桶图标（title=`Forget this environment...`）|该条立即从列表消失，其余记录保留|
|2|检查 localStorage|对应 id 记录被移除；剩余记录不变|
|3|检查当前连接|状态卡仍 `Connected`，连接类工具可继续查询（删除只清本机记录，不断开连接）|
|4|删除最后一条记录|`d365\_saved\_connections` 键被 removeItem 移除，而不是写入 `"\[]"`；列表区块整体隐藏|

#### SC-06 连接失败不写历史（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|清空存储后，用手动表单填错误密码/密钥连接|footer 显示 AAD 具体错误、弹窗不关；`d365\_saved\_connections` 仍不存在|
|2|先用正确凭据保存 1 条，再将该环境密钥轮换（或改错后端可用性）后点击整行直连|直连失败，footer 报错；该条记录保留且 lastUsedAt 不更新|
|3|通过复制图标 prefill → 修正密钥 → 手动 Connect 成功|同一 id 记录被新凭据覆盖，数量仍为 1，lastUsedAt 前移|

#### SC-07 每次打开弹窗重读列表并清错（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|打开弹窗使其显示列表，关闭弹窗|无异常|
|2|在 DevTools 中手工向 `d365\_saved\_connections` 注入 1 条合法记录（或删除 1 条）|存储被外部修改|
|3|重新打开弹窗|列表反映最新存储内容（open 时重新 `listSavedConnections()`，不用常驻旧 state）|
|4|先制造一次连接失败看到 footer 报错，关闭再打开弹窗|旧报错被清空，connectingId 复位，无残留 spinner|

#### SC-08 损坏记录逐条容错（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在 DevTools 将 `d365\_saved\_connections` 写成非法 JSON（如 `{broken`）后打开弹窗|弹窗正常打开，不崩溃；按空列表处理|
|2|改写为裸对象 `{}` 或含纯空格 environmentUrl、未知 authType、多余键的混合数组，并保留 1 条完全合法记录|非法项被逐条丢弃，合法项正常显示|
|3|用合法记录完成一次一键直连|连接成功；重写存储时坏记录与多余键被清除|

#### SC-09 十条上限与 LRU 淘汰（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|通过连续成功连接（或 DevTools 注入后重读）构造 10 条不同 id 记录|列表显示 10 条，按 lastUsedAt 倒序|
|2|再成功保存第 11 条不同环境|总数仍 10；最久未使用的一条被淘汰，其余保留|
|3|点击一条较旧记录完成一键直连，再保存第 11 条|刚复用的记录 lastUsedAt 前移、不再被淘汰；淘汰的是新的最久未用项|

#### SC-10 列表脱敏与秘密泄露检查（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|打开含两种认证记录的弹窗，查看每行第二行文本|clientSecret 行显示 ClientId 前 8 位；password 行显示 username；后接固定掩码 `••••••••` 与 `used <日期>`|
|2|DevTools 检查列表 DOM（含 title、aria-label、data-\*）|不出现完整 clientSecret/password 明文；图标 title 仅为功能说明|
|3|查看 Console 与 Network 面板前端日志|不打印保存的密钥；密钥仅出现在连接请求 body 中（HTTPS 提交给本机后端）|
|4|阅读列表下方说明文字|明确提示凭据仅保存在本浏览器，服务重启后后端不保留|

#### SC-11 存储异常静默与连接状态隔离（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|用 DevTools 模拟 localStorage 写入失败（如隐私模式/配额占满）后完成一次成功连接|连接仍成功、无报错弹窗；仅历史未保存|
|2|检查 sessionStorage `d365\_connection`|仍只有 `{connected, environmentUrl}`，不含任何凭据字段|
|3|检查连接状态存储位置|连接状态未迁移到 localStorage；已保存环境模块不读写 sessionStorage|

#### SC-12 长列表滚动与受控 Tabs 交互（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|构造 8\~10 条记录使列表超出可视高度|列表容器（`max-h-44 overflow-y-auto`）可滚动到底，无内容被裁切、无滚不动（回归 REG-24 ScrollArea 高度问题）|
|2|用真实鼠标点击两个认证页签来回切换|页签与表单内容同步（受控 Tabs）；prefill 后页签定位正确|
|3|连续快速点击两行直连|仅第一行进入连接，其余禁用，不并发重复连接|

### 2.3 全局布局与 UI 规范（UI）

> 自动化映射：`tests/tools/17-security-grouping`、`tests/tools/18-new-tools-regression`（导航/路由/分组回归锁）。

#### UI-01 侧边栏分组与条目完整性（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|查看侧边栏分组|依次是 Code Generators（7）、Query \& Data（4）、Environment（8）、Security（7），合计 26 个入口|
|2|核对 Code Generators 组|Plugin Generator / PCF Generator / Custom Page Generator / Connection String Builder / Connection String Analyzer / Azure AD Config Checker / Plugin Scaffolder|
|3|核对 Query \& Data 组|FetchXML Builder / OData URL Builder / Data Query / Power Automate Expressions|
|4|核对 Environment 与 Security 组|Environment：Dashboard、Metadata Viewer、Solution Manager、Option Set Viewer、Web Resources、Business Rules、BU Hierarchy、Audit Log Viewer；Security：Security Roles、User Access、Record Access、Sharing Auditor、Role Compare、Field Security、Permission Diagnostic（Security Roles 不在 Environment 组）|

#### UI-02 导航、激活态与连接提示（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|逐个点击侧边栏条目|路由跳转正确，当前项显示 3px 强调指示条高亮|
|2|未连接时观察需连接条目|右侧琥珀色圆点（title=`Requires connection`），仅提示不阻止进入|
|3|浏览器直接输入 `/tools/security-role-viewer` 并刷新|页面正常加载，侧边栏激活态一致；未知路由显示 `Page not found`|
|4|未连接时观察主窗口右下角|有浮动 `Connect Environment` 按钮，点击可打开连接弹窗|

#### UI-03 PageHeader 与图标一致性（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|遍历 26 个页面头部|均为渐变标题 + 图标 + 描述 + 底部分隔线，风格统一|
|2|检查各图标渲染|全部来自本地 `icons.tsx`，无空白/错位/ lucide-react 残留|
|3|检查 Plugin Scaffolder 等新增页面|新图标（脚手架等）显示正常，不变形|

#### UI-04 加载 / 空 / 错误状态组件（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|进入 Dashboard、Metadata Viewer、Solution Manager 等页|加载中分别显示骨架屏或 LoadingState，无白屏闪烁|
|2|制造空结果（如搜索无匹配、无共享记录）|显示对应 EmptyState/空文案，而非报错|
|3|停止后端触发接口失败|ErrorState 显示真实错误信息，恢复后可重试|

#### UI-05 表格与卡片样式（P3）

|步骤|操作|预期结果|
|-|-|-|
|1|查看 Data Query、Metadata Viewer 等结果表|斑马纹行、表头样式统一，长表可横向滚动|
|2|查看卡片与 hover|rounded-xl 圆角、hover:shadow-md 生效|

#### UI-06 长字段名防重叠（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Data Query 选择 contact，字段多选选择 `createdon (Created On)` 等长标签字段|SearchSelect/MultiSearchSelect 触发器文本截断不溢出|
|2|观察 `$order by`、`$top` 等相邻控件|下拉框与输入框不重叠、不遮挡点击（min-w-0 生效，回归 REG-11），控件间距正常|

#### UI-07 弹窗与可访问性（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|打开连接弹窗后按 Esc、点击遮罩|弹窗可关闭，焦点回到触发元素|
|2|仅用 Tab/Enter 操作表单与列表行按钮|可完成输入、切换页签、触发直连/复制/删除|
|3|检查图标按钮 title|复制/删除/当前身份等均有可访问名称，且名称不含秘密|

#### UI-08 复制输出完整性（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|在 CSB、PLG、PCF、CPG、PAE、OSV 等页使用 Copy|按钮短暂显示 `Copied!`，剪贴板内容与页面输出完全一致，无截断、无混入说明文字|

#### UI-09 写操作确认与防重复（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|逐个检查写操作入口|有 ConfirmDialog 的入口（角色移除、共享撤销、成员移除、Copy missing A→B）：取消后零变更，确认后仅执行一次|
|2|检查当前无 ConfirmDialog 的入口（Web Resource Publish、Assign Role、Share Record、Assign Member）|按现状可一键执行，属已知行为；测试时必须先记录基线并控制点击次数，结果以服务端重读为准|
|3|写操作进行中重复点击提交按钮|按钮禁用或请求去重，不产生重复写入|

\---

### 2.4 元数据缓存、全局刷新与跨模块回归（MC）

> 自动化映射：`tests/api/18-metadata-cache`（5 用例，需连接）、`tests/tools/21-metadata-cache`（10 用例，源码契约）、`tests/api/02-metadata`、`tests/api/04-data`、`tests/tools/12-fetchxml-builder`。
> 公共前置：后端 3001 与前端 3000 已启动；已连接 `<环境A>`，需要跨环境的用例另备 `<环境B>`；每例开始前记录当前是冷缓存、暖缓存还是失败状态。
> 观察证据：浏览器 Network 请求次数与顺序、响应 `X-Cache`、`GET /api/dataverse/metadata/cache` 统计、页面可见数据与错误状态。证据和截图必须脱敏。
> 当前状态：以下 28 个手工用例均为 **未执行**；历史自动化结果不得回填为通过。

#### 2.4.1 业务规则与待验证风险

|规则 ID|规则|
|-|-|
|BR-MC-01|L1、L2 元数据 TTL 均为 10 分钟；前端过期后先显示旧值并后台重验，服务端过期后下一请求重新回源|
|BR-MC-02|同作用域、同 key 的并发请求合并；实体列表与字段集分别去重|
|BR-MC-03|字段集最多缓存 60 个实体；命中会刷新 LRU 位置，失败请求不得成为有效缓存|
|BR-MC-04|环境 URL 是隔离边界；连接、断开、重连或换环境后不得复用旧环境元数据|
|BR-MC-05|清空后下一请求应为 MISS；清空前启动的迟到响应不得恢复旧缓存|
|BR-MC-06|服务端实体全量只回源一次，不同 limit 只做切片，返回排序与 total 稳定|
|BR-MC-07|全局刷新同时清两层缓存并递增 epoch；服务端清理失败属于部分失败，必须显示错误|
|BR-MC-08|FetchXML 显式传入 EntitySetName 时不回退解析；未传时才使用实体缓存或单实体回退|
|BR-MC-09|缓存只覆盖实体/字段元数据，不得替代 DataQuery 记录结果或 FetchXML 业务数据|

|风险 ID|待验证风险|关联用例|
|-|-|-|
|RISK-MC-01|服务端清空后，清理前启动的迟到响应可能重新写回缓存|MC-14|
|RISK-MC-02|FetchXmlBuilder 已展开的 link-entity 字段可能不响应刷新 epoch|MC-22|
|RISK-MC-03|旧响应可能不写缓存但仍覆盖当前 UI，两项需分别断言|MC-07|
|RISK-MC-04|DELETE 失败时前端继续清缓存并递增 epoch，但服务端可能未清|MC-20|
|RISK-MC-05|TTL、LRU、真实并发、跨环境和失败注入缺少持久行为自动化|MC-02～MC-20|

#### 2.4.2 L1 前端缓存（MC-01～MC-07）

#### MC-01 暖缓存跨页面复用与 12 页冒烟（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|调用 `DELETE /api/dataverse/metadata/cache` 后进入 Metadata Viewer，记录实体请求和 `X-Cache: MISS`|
|2|在 TTL 内依次进入 12 页矩阵中的页面，再返回已访问页面|相同实体 key 不重复请求；下拉内容可用；页面无白屏|
|3|检查只读核心交互与业务结果|各页数据、字段和筛选正常；不触发角色、共享或发布写操作|

#### MC-02 TTL 边界与 SWR 后台重验（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|使用可控时钟将前端缓存置为 9:59 和 10:00 两个状态|未到期不发新请求；到期后先展示旧值，仅发起一次后台重验|
|2|让后台重验延迟返回并操作下拉|旧选项在重验期间仍可用，不白屏、不重复请求|
|3|重验成功后再次进入页面|展示新数据；无法控制时钟时记“阻塞”，不得以常量存在代替行为通过|

#### MC-03 同 key 并发合并（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|冷缓存下在多个标签页或组件同时请求同一实体列表|前端只产生一次等价请求；所有调用收到一致结果|
|2|同时请求不同实体字段|不同 key 不互相合并，各自结果正确|
|3|注入一次失败并发请求后重试|失败后 in-flight 释放；重试可重新回源，不停留在永久等待|

#### MC-04 字段集 LRU 60 与命中刷新（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|依次加载 59、60、61 个不同实体字段集|缓存实体数上限为 60；第 61 个只淘汰最久未使用项|
|2|再次命中较早但刚访问过的字段集，再加载新字段集|刚命中项不被淘汰；缓存总数仍不超过 60|
|3|检查字段读取 key 的大小写与首尾空格变体|同一实体变体共享缓存，不出现永久 miss|

#### MC-05 前端失败不缓存与恢复（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|对实体或字段接口注入 500/断网，进入使用元数据的页面|错误可见、无永久 spinner；失败响应不写为有效缓存|
|2|恢复接口后重试或全局刷新|重新请求并成功展示，不永久复用失败结果|

#### MC-06 清空后的 generation 防迟到写回（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|延迟请求 A，随后清空前端缓存并发起请求 B|B 正常返回并写入新 generation|
|2|释放 A 的迟到响应，再次读取缓存|A 不得写回缓存；读取结果仍为 B|
|3|连续执行两次清空|generation 递增，前一轮所有迟到响应均被丢弃|

#### MC-07 旧响应不得覆盖当前 UI（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|在 Metadata Viewer 延迟 `<实体A>` 字段响应，立即切换到 `<实体B>`|B 先返回后，标题、字段表和 loading 均属于 B；A 的迟到响应不覆盖 UI|
|2|快速切换环境或触发刷新 epoch，重复上述步骤|旧实体、旧环境、旧 epoch 的响应均不得覆盖当前视图|
|3|将“缓存未写回”和“UI 未覆盖”分别记录证据|两项结论独立判定，不以其中一项代替另一项|

#### 2.4.3 L2 服务端缓存（MC-08～MC-15）

#### MC-08 HIT/MISS、统计与未连接保护（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|DELETE 缓存后首次请求实体列表|200，`X-Cache: MISS`；再次相同请求为 `HIT`，数据等价|
|2|请求同一实体字段两次并读取 `GET /metadata/cache`|字段集首次 MISS、再次 HIT；hits/misses 与操作次数吻合|
|3|断开连接后调用缓存与元数据接口|返回 401，不泄露缓存内容或内部错误|

#### MC-09 服务端 TTL 到期（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|缓存实体列表后在 10 分钟内重复请求|返回 HIT|
|2|越过 TTL 后再次请求|返回 MISS 并重新回源；后续请求恢复 HIT|
|3|记录时间边界证据|无法控制服务端时间时记“阻塞”，不得仅靠等待或推测判定通过|

#### MC-10 服务端并发去重（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|冷缓存下并发发起 10 个相同的实体列表请求|上游只回源一次；10 个响应均为 200 且 body 等价|
|2|并发请求同一实体字段集|字段上游只回源一次；统计不重复累计为多次真实回源|
|3|并发请求不同环境或不同 key|不得错误合并，结果分别正确|

#### MC-11 服务端字段 LRU 与命中刷新（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|请求 60 个不同实体的字段集，再请求第 61 个|缓存实体数保持 60；淘汰最久未用项|
|2|命中较早字段集后新增一个实体字段集|刚命中项保留，新的最久未用项被淘汰|
|3|读取缓存统计的字段 key 列表|不包含已淘汰项，无重复 key|

#### MC-12 服务端失败不缓存与恢复（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|请求未知实体字段或注入上游失败|返回真实错误；统计不把失败计为有效缓存|
|2|恢复上游后再次请求|返回 MISS 并成功获取；不永久返回失败|

#### MC-13 清空接口与统计归零（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|预热实体和字段缓存后调用 `DELETE /metadata/cache`|200，`{ cleared: true }`|
|2|读取缓存统计|hits/misses 为 0，entities.cached=false，字段缓存为空|
|3|再次请求元数据|`X-Cache: MISS`，证明已重新回源|

#### MC-14 服务端清空期间迟到响应（P0，待验证风险）

|步骤|操作|预期结果|
|-|-|-|
|1|延迟清空前启动的上游响应，执行 DELETE 后发起新请求取得新值|新请求返回新值并为 MISS|
|2|释放旧响应，再次请求元数据并读取统计|旧值不得重新填充缓存或制造旧数据 HIT；若出现则登记缺陷|
|3|记录请求时序与旧/新值证据|该项标记为待验证风险，执行前不得预设通过|

#### MC-15 不同 limit 复用全量缓存（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|冷缓存请求 `limit=5`，再请求 `limit=300`|第二次为 HIT；小列表是大列表前缀；两次 total 相同|
|2|核对列表排序|按 LogicalName 稳定排序，切片不改变顺序|
|3|测试默认 200、上限 5000、0、负数和非数值|默认/上限按契约生效；非法值返回明确 400 或既定边界行为；不得触发无界查询|

#### 2.4.4 环境、连接与全局刷新（MC-16～MC-22）

#### MC-16 环境 A/B 隔离（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|在 `<环境A>` 预热实体与字段缓存，切换到 `<环境B>`|B 不显示 A 的实体/字段；缓存统计不残留 A 的条目|
|2|在 B 加载一组不同实体后切回 A|A 只使用其当前作用域数据，不串 B 数据|
|3|第二环境不可用时|记录“阻塞（缺少第二沙箱）”，不得记通过|

#### MC-17 连接、断开与重连清理（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|暖缓存后断开连接|两层缓存失效，页面不继续展示旧环境元数据|
|2|同环境重连并首次请求元数据|返回 MISS 并重新获取；不恢复断连前缓存|
|3|用旧令牌或错误凭据重连失败|保留原连接状态，不破坏会话；失败不写入旧缓存|

#### MC-18 全局刷新成功路径（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在已连接卡片点击刷新|按钮禁用并显示 spinner；只发出一次 DELETE|
|2|清理完成后的元数据请求|前端缓存和 epoch 已更新；当前挂载页重取，服务端首次请求为 MISS|
|3|成功后检查状态卡|错误消失，显示刷新时间；既有表单输入不被无故清空|

#### MC-19 刷新双击与重复触发（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|延迟 DELETE 响应，快速双击刷新按钮|只执行一个刷新周期，只发一次 DELETE、epoch 只增 1|
|2|等待完成|spinner 正常结束，按钮恢复，不出现永久禁用|

#### MC-20 服务端 DELETE 失败的部分刷新（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|注入 DELETE 500 或网络错误后点击刷新|前端仍清缓存并递增 epoch，活动页尝试重取；红色错误可见|
|2|检查按钮与时间|按钮恢复；错误优先显示，不显示“完全成功”；服务端缓存可能仍为 HIT|
|3|恢复服务后再次刷新|错误清除，显示成功时间；不得把部分失败记录为双层刷新成功|

#### MC-21 12 页刷新与首次进入覆盖（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|按下方矩阵逐页执行：进入页面记录初始请求，点击全局刷新|当前挂载页面响应 epoch 并重新获取对应元数据|
|2|切换到未挂载页面再进入|使用刷新后的数据，不展示刷新前旧缓存|
|3|每页单独执行并记录 Network、页面结果和状态|不使用前一页预热干扰后一页判断；12 页均有独立记录|

|页面|接入方式|元数据|暖缓存复用|刷新重取|首次进入无旧值|页面特有断言|状态|证据|
|-|-|-|-|-|-|-|-|-|
|BusinessRuleInspector|useMetadata|实体|通过|通过（代表页）|未验证|规则列表可用|部分通过|`metadata/entities` HIT；点击刷新后发出新 GET|
|CustomPageGenerator|useMetadata|实体|通过|未逐页执行|未验证|模板与实体下拉可用|部分通过|`metadata/entities` HIT；无 Guard/错误|
|FieldSecurityViewer|useMetadata|实体|通过|未逐页执行|未验证|Profile 列表加载较慢|部分通过|实体 HIT；profiles 200，页面仍显示 Loading|
|OptionSetViewer|useMetadata|实体|通过|未逐页执行|未验证|实体选项集列表可用|部分通过|无实体请求（直接读暖缓存），无 Guard/错误|
|ODataUrlBuilder|useMetadata|实体|通过|未逐页执行|未验证|实体切换 URL 正常|部分通过|`metadata/entities` HIT；无错误|
|PluginGenerator|useMetadata|实体|通过|未逐页执行|未验证|插件模板与实体下拉可用|部分通过|`metadata/entities` HIT；无错误|
|RecordSharingAuditor|useMetadata|实体|通过|未逐页执行|未验证|元数据失败保护不回归|部分通过|`metadata/entities` HIT；无 Guard/错误|
|RecordAccessChecker|useMetadata|实体|通过|未逐页执行|未验证|记录搜索可用|部分通过|`metadata/entities` HIT；无 Guard/错误|
|SecurityRoleViewer|useMetadata|实体|通过|未逐页执行|未验证|角色矩阵不回归|部分通过|`metadata/entities` HIT；角色接口受环境阻塞未加载|
|DataQuery|独立 fetcher|实体 + 字段|通过|未逐页执行|未验证|元数据未就绪不查询|部分通过|`metadata/entities` HIT；未执行查询守卫异常注入|
|FetchXmlBuilder|独立 fetcher|实体 + 字段|通过|未逐页执行|未验证|显式/回退实体集正常；link-entity 刷新通过 MC-22|部分通过|实体 HIT；回退 contact 200；MC-22 刷新后字段重新请求|
|MetadataViewer|独立 fetcher|实体 + 字段|通过|通过（代表页）|未验证|实体搜索、字段切换、大响应恢复|通过（修复后）|实体 HIT；MC-07 迟到 account 响应不再覆盖 contact|

#### MC-22 已展开 link-entity 字段随刷新失效（P1，待验证风险）

|步骤|操作|预期结果|
|-|-|-|
|1|在 FetchXML Builder 建立 link-entity 并展开 From 字段，形成字段缓存|主实体 To 字段和链接实体 From 字段均可用|
|2|点击全局刷新，不改变已展开条件|已展开 link-entity 字段应重新获取或按明确设计失效，不得无提示保留旧值|
|3|快速切换实体后查看字段|旧实体字段不得混入新实体；若保留旧值则登记为风险缺陷|

#### 2.4.5 FetchXML 与既有功能回归（MC-23～MC-28）

#### MC-23 显式 EntitySetName 路径（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|请求体显式传 `entitySetName`，分别测试冷、暖缓存|直接使用显式实体集，不调用回退解析；查询结果一致|
|2|检查请求 URL 与响应结构|不因缓存改造改变路径、状态码或结果结构|

#### MC-24 未传 EntitySetName 且冷缓存（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|DELETE 缓存后提交含根实体的 FetchXML，不传 entitySetName|保留单实体元数据回退并解析出正确实体集|
|2|核对查询结果|成功返回，不使用 LogicalName 单数路径，不返回 404|

#### MC-25 未传 EntitySetName 且暖缓存（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|先预热实体列表，再执行与 MC-24 相同查询|复用缓存，外部结果与显式实体集路径等价|
|2|观察网络与服务端日志|无重复的全量实体请求；无法取得服务端调用次数时仅记录“行为未验证”|

#### MC-26 FetchXML 错误契约（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|提交缺少 fetchXml 的请求|返回 400，错误明确|
|2|提交无法识别根实体或未知实体的 FetchXML|分别保持既有 400/404/500 契约，不伪成功|
|3|上游查询失败|透传真实错误，清空旧结果，不写入错误缓存|

#### MC-27 DataQuery 元数据错误与查询守卫（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开或注入元数据失败后进入 Data Query|显示独立错误与 `Loading entity metadata...`；查询按钮禁用|
|2|Network 检查|元数据未就绪时不发出任何 `/api/dataverse/data/*` 请求|
|3|恢复元数据后查询 account/contact|分别使用 `accounts`/`contacts`，字段、排序、结果列正常，无单数回退|

#### MC-28 China 云兼容与业务结果隔离（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|在中国云 `<环境URL>` 加载实体元数据|EntityDefinitions 上游请求不带 `$top`/`$orderby`，不出现 400 0x80060888|
|2|无中国云环境时|记“不适用”并注明，不以公有云结果代替|
|3|连续查询同一业务实体两次|DataQuery/FetchXML 记录结果不被元数据缓存替代；记录变化可被重新查询观察|

\---

## 3\. 纯前端工具（10 个）

> 除 Plugin Scaffolder 需后端写本地文件外，其余工具均无需连接 D365；连接后部分页面提供元数据下拉增强。
> 本章工具均无 D365 写操作；SCF 的本地文件写后恢复在各用例中单独注明。

### 3.1 Connection String Builder（CSB，连接字符串生成器）

> 自动化映射：`tests/tools/10-connection-string-builder`（5 用例）。
> 页面要点：Authentication Type = Client Secret / Certificate / Office 365 (Username/Password) / OAuth；Output Format = C# / PowerShell / PAC CLI；输入即实时生成，无 Generate 按钮。

#### CSB-01 Client Secret 模式三种格式生成（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|打开 `/tools/connection-string-builder`，Authentication Type 选 `Client Secret`|显示 Server URL、Client ID、Client Secret、Tenant ID 输入框，默认 Output Format=C#|
|2|填写 Server URL=`<环境URL>`、Client ID=`<ClientId>`、Client Secret=`<ClientSecret>`、Tenant ID=`<租户ID>`|Generated Output 实时更新；C# 输出含 `ServiceClient` 与 `AuthType=ClientSecret;Url=...;ClientId=...;ClientSecret=...`|
|3|Output Format 切到 PowerShell|输出含 `Connect-DataverseService`，参数与输入一致|
|4|切到 PAC CLI|输出含 applicationId/clientSecret 参数，语法正确|

#### CSB-02 Certificate / Office365 / OAuth 模式字段与输出（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|切换 Authentication Type=Certificate|字段变为 Certificate Thumbprint/Tenant ID 等；输出含 Thumbprint 参数|
|2|切换 Office 365 (Username/Password)，输入用户名密码|输出含 Username/Password；密码仅出现在生成结果中，不额外打印日志|
|3|切换 OAuth，填写 Redirect URI|输出含 RedirectUri 参数|
|4|在四种认证间来回切换|字段随认证正确切换，输出无上一认证的残留参数|

#### CSB-03 空输入与连续编辑（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|清空全部输入|Raw Connection String 显示 `(empty)`，不生成误导性完整字符串|
|2|只填 Server URL|输出仅含已有参数，不伪造缺失凭据|
|3|修改 URL 后再次查看输出|旧值被替换，无双份 Url 参数|

#### CSB-04 特殊字符与复制（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|在密钥/密码中输入含 `;` `=` 空格的特殊值|输出按现有规则处理，不错误截断后续参数|
|2|点击 `Copy`|显示 `Copied!`（约 2 秒），剪贴板与 Generated Output 完全一致|

### 3.2 Connection String Analyzer（CSA，连接字符串分析器）

> 无独立自动化套件（手工覆盖）。页面要点：多行文本框 + `Analyze`（非空可用）+ `Clear`；结果为 Parsed Parameters / Authentication Method / Target Cloud Environment / Issues \& Suggestions。

#### CSA-01 合法连接字符串解析（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|粘贴 `Url=<环境URL>;ClientId=<ClientId>;ClientSecret=<ClientSecret>;TenantId=<租户ID>`，点击 `Analyze`|Parsed Parameters 正确拆分各键值；Authentication Method=ClientSecret|
|2|查看 Target Cloud Environment|按 URL 域名识别 Public/China/GCC/GCC High；本例与 `<环境URL>` 实际云一致|
|3|查看密钥类参数显示|ClientSecret/Password 以掩码显示，不明文完整展示|
|4|无配置问题时|显示 `No issues detected...` / `All checks passed`|

#### CSA-02 China 云 authority 不匹配识别（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|粘贴 `\*.dynamics.cn` URL 但 Authority 指向公有云的连接字符串，点击 `Analyze`|Issues 中出现 authority 不匹配的 ERROR/WARNING 及 Fix 建议|
|2|改为匹配的 China authority 重新 Analyze|该问题消失，不残留旧分析|

#### CSA-03 缺失参数与格式错误（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|输入缺少 ClientSecret 的 ClientSecret 认证字符串|Issues 列出缺失必需参数|
|2|输入缺少分号/等号的乱码文本|给出格式错误提示；缺 `=` 的段显示 `Missing value`|
|3|TenantId 填短名|提示需完整域名或 GUID|
|4|非 HTTPS 的 Url|出现 HTTPS 相关警告|

#### CSA-04 空输入、清空与连续分析（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|输入为空时查看 `Analyze`|按钮禁用，不报错|
|2|输入纯空格后点击 Analyze|按空输入处理，不崩溃|
|3|分析后修改文本框内容但不点 Analyze|旧分析结果被撤销/标记过期，不展示与新输入不符的结论|
|4|点击 `Clear`|输入与全部分析卡片清空|

### 3.3 Azure AD Config Checker（AAD，Azure AD 配置检查）

> 无独立自动化套件（手工覆盖）。浏览器直连 Microsoft 公共端点，不经过本项目后端；Tenant ID 未填时 `Run Checks` 不可用。

#### AAD-01 公有云合法租户检查（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|打开 `/tools/azure-ad-config-checker`，Tenant ID 填 `<租户ID>`（完整域名或 GUID），保持 China Cloud 复选框关闭|Run Checks 变为可用|
|2|点击 `Run Checks`|按钮显示 `Checking...`；请求 `login.microsoftonline.com` 的 openid-configuration|
|3|等待完成|Tenant Information 卡片显示租户端点信息；Configuration Checks 各状态（通过/失败/UNCERTAIN/SKIPPED）与实际情况一致|
|4|未填 Client ID 时|App 相关检查为 SKIPPED，不误报失败|

#### AAD-02 中国云端点切换（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|勾选 `China Cloud (21Vianet)` 后 Run Checks|请求切换到 `login.partner.microsoftonline.cn` 的 openid-configuration|
|2|取消勾选再次运行|回到公有云端点，旧结果不混杂|

#### AAD-03 不存在的租户与网络失败（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Tenant ID 填不存在的域名/GUID 后运行|明确提示租户不存在/无法访问，不白屏|
|2|断网后运行|错误转换为检查项 detail 或 ErrorState，可恢复重试|

#### AAD-04 Client Secret 校验与安全（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|填 Tenant/ClientId 及错误的 Client Secret（可选密码框）后运行|token 请求失败被识别；错误 secret 可反向证明 App 存在，状态与 detail 描述准确|
|2|检查请求去向|凭据仅发送到 Microsoft token endpoint，不发送到本项目 server|
|3|检查页面与控制台|Client Secret 不以明文渲染或打印|

#### AAD-05 指南与建议展示（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|查看 Application User Setup Guide 卡片|D365 Application User 配置步骤完整|
|2|查看 Security Recommendations 卡片|建议内容完整展示，无截断|

### 3.4 Power Automate Expression Tester（PAE，表达式测试器）

> 自动化映射：`tests/tools/11-power-automate-expressions`（6 用例）。
> 页面要点：Category = All/String/DateTime/Logic/Conversion；参数随表达式变化；实时求值；`Copy Expression` 复制语法而非结果。

#### PAE-01 String 函数求值（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|Category 选 String，表达式选 concat|参数默认 `String 1=Hello`、`String 2= World`；Evaluated Result=`Hello World`|
|2|修改 String 2 为 `!`|结果实时变为 `Hello!`；Expression Syntax 同步更新且参数以单引号包裹|
|3|依次切换 toUpper/toLower/substring/replace/indexOf/length/trim 并输入样例|各结果与函数语义一致（如 toUpper('abc')=ABC，length('abc')=3）|

#### PAE-02 DateTime 函数求值（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|选 utcNow|结果为当前 UTC 时间，格式正确|
|2|选 addDays，输入基准日期与天数 3|结果日期增加 3 天|
|3|选 formatDateTime，输入日期与格式串|按格式输出；非法日期显示 `Invalid date`，不白屏|

#### PAE-03 Logic 与 Conversion 函数（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Logic 分类依次测试 if/coalesce/equals|if 按条件返回两分支之一；coalesce 跳过空值；equals 返回布尔|
|2|Conversion 测试 json/string/int/float|json 合法输入被解析；int/float 转换正确|
|3|测试 base64/decodeBase64 互逆|编码后再解码得到原文|
|4|json 输入非法文本|结果显示 `Invalid JSON` 或 `Error` 文本，不崩溃|

#### PAE-04 分类过滤与表达式集合完整（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|切换 Category=All|列出全部表达式|
|2|分别切到 String/DateTime/Logic/Conversion|各分类表达式与集合一致：String 8 个、DateTime 3 个、Logic 3 个、Conversion 6 个|

#### PAE-05 复制与自定义表达式（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|点击 `Copy Expression`|剪贴板为 Expression Syntax 文本，而非求值结果|
|2|在 Custom Expression 输入嵌套 concat 示例|仅编辑文本，明确提示 no evaluation，不伪造求值结果|

### 3.5 FetchXML Builder（FXB，FetchXML 构建器）

> 自动化映射：`tests/tools/12-fetchxml-builder`（6 用例）、API `tests/api/04-data`（FetchXML 执行）。
> 已知当前行为：切换主实体不重置已选字段/条件/排序；`Import XML` 目前只清空文本并关闭导入区，不解析回构建器（按现状验证并记录）。

#### FXB-01 未连接手工构建基础查询（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|未连接打开 `/tools/fetchxml-builder`|Entity Name 默认 account 且为文本框；`Fetch Data` 禁用；头部有 `Connect Environment`|
|2|Entity Name 输入 contact，Top 输入 5|实时 XML 根节点为 `<fetch top="5">`，entity name=contact|
|3|Select Fields 输入 fullname,emailaddress1|XML 出现对应两个 attribute 节点|
|4|勾选 Distinct / Aggregate|XML 根节点属性同步变化|

#### FXB-02 条件构建与 null 运算符（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|点击 Conditions 的 `Add`，属性填 statecode、Operator 选 `Equals (eq)`、值填 0|condition 节点 attribute/operator/value 正确|
|2|Operator 改选 `Null (null)`|Value 输入框隐藏，condition 不带 value 属性|
|3|值中输入含 `\&` `<` `"` 的文本|XML 正确转义，不破坏结构|
|4|删除该条件|XML 中对应 condition 移除|

#### FXB-03 排序与链接实体（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|添加 Order：属性 createdon、Direction=Descending|生成 `<order attribute="createdon" descending="true" />`|
|2|添加 Link Entity：Entity=account、From=primarycontactid、To=contactid、Link Type=Outer|link-entity 节点 from/to/link-type 正确|
|3|删除 Link|XML 中 link-entity 移除，无残留|

#### FXB-04 连接后元数据下拉（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|点击 `Connect Environment` 完成连接|Entity Name 变为可搜索下拉，输入 contact 可过滤选中|
|2|查看 Select Fields / Condition 属性 / Order 属性|均变为字段元数据下拉（Select Fields 为多选）|
|3|添加 Link Entity|Link Entity 为实体下拉；Link From 选项来自被链接实体字段，Link To 来自主实体字段|
|4|切换主实体|字段/条件/排序按当前实现保留；若引用了新实体不存在的字段，执行时由后端报错提示（记录实际表现）|

#### FXB-05 Fetch Data 执行与结果列（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|构建 contact 查询：Select Fields 选 fullname,createdon，Top=5，点击 `Fetch Data`|调 `POST /api/dataverse/data/fetchxml`；结果显示记录数与数据网格|
|2|检查列头|选中字段列始终存在且按选择顺序在前，即使首条记录 fullname 为 null 也不丢列；null 单元格显示 `-`（回归 REG-06）|
|3|检查额外列|主键等额外返回字段追加在选中字段之后|
|4|构造 0 结果查询（如不可能满足的条件）|显示 `Query returned 0 records.` 空状态而非报错|

#### FXB-06 实体集名称回退解析（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|选择一个非常用实体构建查询并 Fetch Data|后端能由根实体解析 EntitySetName 并返回数据；解析失败时显示真实错误|
|2|制造非法 FetchXML（通过手工输入非法字段）执行|显示 Dataverse 返回的具体错误，不伪成功|

#### FXB-07 XML 复制与导入区现状（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|点击 `Copy`|剪贴板与实时 XML 完全一致|
|2|点击 `Import XML` 展开导入区，粘贴一段 XML 并执行 Import|按当前实现仅清空文本并关闭导入区，不解析回构建器；记录该已知行为，不作为构建器数据丢失缺陷|

#### FXB-08 元数据加载失败恢复（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|连接后模拟元数据接口失败（断网或停后端）|元数据错误区显示 `Reconnect` 提示|
|2|恢复后重连|下拉恢复可用，构建区内容不丢失|

### 3.6 OData URL Builder（OUB，OData URL 构建器）

> 自动化映射：`tests/tools/13-odata-url-builder`（8 用例）。
> 页面要点：Operation = GET(List)/GET(Single Record)/POST/PATCH/DELETE/Function；Function = WhoAmI/RetrieveTotalRecordCount/GetTimeZoneCodeByLocalizedName/CalculateRollupField；只生成不执行。

#### OUB-01 基础 URL 与连接感知（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|未连接打开页面|Base URL 为占位 `https://yourorg.crm.dynamics.com`，Entity Set Name 默认 accounts，各字段为文本输入|
|2|连接环境后返回页面|Base URL 自动替换为 `<环境URL>` + `/api/data/v9.2/`；实体/字段变为元数据下拉，实体选项使用 EntitySetName|
|3|Operation 保持 GET (List)|Request Preview 显示 GET Badge 与完整 URL|

#### OUB-02 查询参数拼接（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|$select 选择 fullname,emailaddress1|URL 含 `$select=fullname,emailaddress1`|
|2|$orderby 选 createdon + Desc|URL 含 `$orderby=createdon desc`|
|3|$top 填 3，勾选 Include $count=true，$expand 填 primarycontactid|三参数正确拼接，顺序与分隔符正确|

#### OUB-03 过滤器类型与函数式过滤（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Add Filter：字段 fullname、运算符 eq、值 `O'Brien`|字符串值带单引号并按规则转义|
|2|添加数值过滤（如 address1\_latitude gt 10）|数字不加引号；多条件用 and 连接|
|3|运算符分别选 contains/startswith/endswith|生成函数式过滤 `contains(fullname,'...')` 等|

#### OUB-04 单记录与写操作形态 URL（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Operation 切到 GET (Single Record)|出现 Record ID 输入；填入 GUID 后 URL 变为 `accounts(<guid>)`|
|2|切到 POST (Create) / PATCH (Update)|Request Body 编辑区出现，默认 `{}`；PATCH 同时需 Record ID|
|3|切到 DELETE|仅需 Record ID；预览仅生成方法与 URL，不实际执行、无 ConfirmDialog|

#### OUB-05 Function 路径（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Operation 切到 Function，依次选 WhoAmI / RetrieveTotalRecordCount|URL 生成对应函数路径|
|2|选 GetTimeZoneCodeByLocalizedName / CalculateRollupField 并填参数|函数参数按格式拼入 URL|

#### OUB-06 实体切换重置与复制（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|配置好 select/orderby/filters 后切换实体|select、排序、所有 filters 被清空；expand/top/count 保留|
|2|点击 `Copy URL`|仅复制 URL，与预览一致，可在浏览器/Postman 直接使用|

### 3.7 Plugin Code Generator（PLG，插件代码生成器）

> 自动化映射：`tests/tools/14-plugin-generator`（6 用例）。
> 默认值：Class Name=AccountPlugin、Namespace=MyCompany.Plugins、Target Entity=account；Message=Create/Update/Delete/SetState/Associate/Disassociate；Stage=PreValidation(10)/PreOperation(20)/PostOperation(40)。

#### PLG-01 基础模板与命名替换（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|打开页面保持默认|生成 IPlugin 实现：Execute 方法、IServiceProvider、tracing/service 获取、异常包装齐全|
|2|Class Name 改为 ContactPlugin、Namespace 改为 Contoso.Plugins、Target Entity 改 contact|类名/命名空间/实体全部替换，注册注释含程序集与类名，无旧值残留|

#### PLG-02 消息与 Target 形态（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|Message 选 Create / Update|代码使用 `Entity` Target 并强转|
|2|Message 选 Delete|使用 `EntityReference` Target|
|3|选 SetState / Associate / Disassociate|模板与消息匹配，无不适用的 Target 强转|

#### PLG-03 阶段与 Image（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Stage 选 PostOperation + Create/Update|注册注释含 Stage 40，代码包含 PostImage 处理|
|2|Stage 选 PreOperation + Update|包含 PreImage；阶段号 20 正确|
|3|Stage 选 PreValidation|阶段号 10 正确，无不适用 Image|

#### PLG-04 选项开关（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|关闭 Include Tracing/Logging|代码移除 tracing 相关行|
|2|关闭 Include Error Handling|移除 try/catch 包装|
|3|关闭 Include Service Context using|service context 创建方式随之变化，代码结构仍完整|

#### PLG-05 连接下拉与复制（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|连接环境后查看 Target Entity|变为实体元数据搜索下拉；未连接时为文本框|
|2|点击 `Copy` 并粘贴到 IDE|代码完整、结构可编译（命名空间/引用齐全）|

### 3.8 PCF Component Scaffolding Generator（PCF，PCF 脚手架生成器）

> 自动化映射：`tests/tools/15-pcf-generator`（4 用例）。
> 默认值：Component Name=MyCustomControl、Publisher Prefix=dev；Component Type=Field Control (Standard)/Dataset Control；Use React wrapper 默认开启。

#### PCF-01 Field 类型四文件生成与 Tab 切换（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|打开页面保持默认|Full Control Name 实时显示 `dev\_MyCustomControl`；存在 Manifest.xml / Index.ts / Component.tsx / CSS 四个页签|
|2|逐一点击四个页签|每个页签内容正确显示且可来回切换（回归 REG-01 Radix Tabs 条件渲染缺陷）|
|3|查看 Manifest.xml|`control-type="Standard"`，name/namespace/description 与输入一致|
|4|查看 Index.ts|init/updateView/getOutputs/destroy 四个生命周期方法齐全|

#### PCF-02 Dataset 类型与 React 开关（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Component Type 切到 Dataset Control|Manifest 变为 `control-type="DataSet"`，模板含 dataset 相关结构|
|2|关闭 Use React wrapper|Component.tsx 页签消失；Index.ts 改为 StandardControl 模板|
|3|重新开启 React|Component.tsx 页签恢复，内容无旧类型残留|

#### PCF-03 命名修改一致性（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Component Name 改 MyGrid、Publisher Prefix 改 abc、Description 改自定义文本|Full Control Name=`abc\_MyGrid`；Manifest/Index/Component 中命名与引用一致|

#### PCF-04 属性与复制（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|在 Manifest 中检查 property 节点|默认属性定义完整，类型与 usage 正确|
|2|每个页签分别点击 `Copy`|各文件内容独立完整复制，显示 `Copied!`，不串文件|

### 3.9 Custom Page Template Generator（CPG，自定义页面模板生成器）

> 自动化映射：`tests/tools/16-custom-page-generator`（5 用例）。
> 默认值：Page Name=MyCustomPage、Publisher Prefix=dev、Target Entity=account；Page Type=List/Form/Dashboard Page。
> 已知当前行为：Custom Component Name 仅保存输入，不参与模板生成（按现状验证）。

#### CPG-01 三种页面类型模板（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|保持 List Page|Power Fx 生成列表场景公式（含 CountRows 等），Config XML 与 List 匹配|
|2|切到 Form Page|公式变为表单场景（Navigate/Patch 等）；Config XML 增加 `RecordId` 参数|
|3|切到 Dashboard Page|生成仪表盘模板；三类型公式互不混杂|

#### CPG-02 导航与组件引用开关（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|保持 Include Navigation Config 开启|存在 Navigation 页签|
|2|关闭该开关|Navigation 页签移除|
|3|开启 Include Custom Component Reference 并输入 `dev\_MyPCFComponent`|输入被保存显示；模板是否引用以当前实现为准（当前不参与生成，记录实际表现）|

#### CPG-03 连接感知与复制（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|未连接时 Target Entity 为文本框，输入 contact|Full Page Name 与公式中实体引用同步更新|
|2|连接后 Target Entity 变为元数据搜索下拉，选择真实实体|公式引用真实实体逻辑名|
|3|各页签分别 Copy|内容完整可用，无截断|

### 3.10 Plugin Project Scaffolder（SCF，插件项目脚手架）

> 自动化映射：`tests/api/17-scaffold`（12 用例）、`tests/tools/19-plugin-scaffolder`（11 用例）。
> 公共前置：后端运行；准备独立测试根目录 `<测试目录>`（win32 绝对路径，非仓库/非盘符根/非系统目录）。页面输入：项目命名空间前缀、发布者前缀、目标目录；按钮 `生成项目框架`。
> 生成结构：`<测试目录>\\{NS}.CRM.D365\\` 下 `{NS}.CRM.D365.sln` + `Crm.Plugins.Share`（共享项目）+ `{NS}.Plugins.Sample` + `{NS}.Plugins.UnitTest`（MSTest）。
> 每例结束删除本次生成的解决方案目录；服务端校验规则：NS `^\[A-Za-z]\[A-Za-z0-9]{0,19}$`；publisher `^\[a-z]\[a-z0-9\_]{0,7}$` 且不以 `\_` 结尾，黑名单 msdyn/microsoft/mscrm。

#### SCF-01 合法输入生成完整解决方案（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|打开 `/tools/plugin-project-scaffolder`，填 NS=`Zztest`、publisher=`zzt`、目标目录=`<测试目录>`|无字段级报错|
|2|点击 `生成项目框架`|按钮变 `正在生成…` 并禁用；完成后显示"生成成功"结果卡|
|3|检查结果卡|根目录以 `Zztest.CRM.D365` 结尾；解决方案文件为 `Zztest.CRM.D365.sln`；项目列表 3 个（Crm.Plugins.Share / Zztest.Plugins.Sample / Zztest.Plugins.UnitTest）各带 GUID；生成文件清单可滚动查看|
|4|在文件系统核对|`.sln`、README、Share 的 .shproj/.projitems/Common/PluginBase.cs、Sample 的 .csproj/key.snk/packages.config/Domain/Sample/Plugin.cs、UnitTest 的 .csproj/SamplePluginTests.cs 均存在|
|5|检查示例代码|Plugin.cs 含 `zzt\_sample` 实体与 `Zztest.Plugins.Sample.Domain.Sample` 命名空间；PluginBase.cs 无 DNS 探测调试残留|
|6|写后恢复|删除 `<测试目录>\\Zztest.CRM.D365`|

#### SCF-02 命名空间前缀校验（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|分别输入 `1ABC`、`AB C`、`AB.C`、空值后点击生成|前端字段下显示"需以字母开头，仅含字母和数字，最长 20 位"，不发起请求|
|2|输入 21 位字母|同样被拦截|
|3|用 API 直接 POST 上述非法值（绕过前端）|服务端返回 400 且 error 提及 namespacePrefix；目标目录无新文件|
|4|输入合法边界值（1 位字母、20 位字母数字）|校验通过可生成；完成后删除生成物|

#### SCF-03 发布者前缀校验与黑名单（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|分别输入 `ABC`、`1abc`、`abcdefghij`（9 位）、`abc\_`|前端提示小写/长度/下划线规则，不发起请求|
|2|分别输入 `msdyn`、`microsoft`、`mscrm`|提示保留前缀；API 直发同样 400|
|3|输入合法 `abc\_1`|校验通过；生成后删除|

#### SCF-04 目标目录路径安全校验（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|目标目录填相对路径 `test\\out`|前端提示必须绝对路径；API 直发返回 400|
|2|填 `C:\\scratch\\..\\escape`（含 `..`）|400"不允许包含 .. 路径穿越"，无目录被创建|
|3|填 `C:\\` 或 `D:\\`|400"不允许是磁盘根目录"|
|4|填 `C:\\Windows\\scaffold-test`、`C:\\Program Files\\x`|400"不允许位于系统目录"|
|5|填本工具仓库内路径|400"不允许位于本工具项目目录内"，仓库无新增文件|
|6|通过 API 在 targetDir 中注入 NUL 字符|400"包含非法字符"，不出现 500 崩溃、无文件写入（回归 REG-16）|

#### SCF-05 非空目标 409 幂等与兄弟前缀共存（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|用 NS=Zztest 成功生成一次，记录关键文件内容哈希|生成成功|
|2|保持相同输入再次点击生成|返回 409，错误提示"已存在且非空"；首次产物内容哈希不变|
|3|保持同一测试根目录，改用 NS=Yytest/ publisher=yyt 生成|200 成功，生成兄弟目录 `Yytest.CRM.D365`；原 Zztest 解决方案不受影响|
|4|写后恢复|删除两个解决方案目录|

#### SCF-06 占位符清理与内容替换（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|生成一套解决方案后，递归扫描全部文本文件（排除 .snk）|不含 `{{`、`}}`、`\_\_NS\_\_` 残留；不含模板蓝本历史标识（对照本地 identityBlocklist）|
|2|检查 Sample .csproj|`<RootNamespace>` 与 `<AssemblyName>` 均为 `{NS}.Plugins.Sample`|
|3|检查 .sln|含三个项目名且与 NS 一致|
|4|写后恢复|删除生成目录|

#### SCF-07 GUID 四角一致与 SNK 字节一致（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|对比 .sln 中 Sample/UnitTest/Share 项目 GUID 与各 .csproj `<ProjectGuid>`、.shproj `<ProjectGuid>`、.projitems `<SharedGUID>`|忽略大小写与花括号后完全一致（回归 REG-18）|
|2|检查 UnitTest .csproj 的 ProjectReference `<Project>` GUID|指向 Sample 项目 GUID|
|3|检查三个项目 GUID|两两不同|
|4|对比生成的 key.snk 与模板 key.snk|字节完全一致且非空（二进制未被 token 替换破坏）|
|5|写后恢复|删除生成目录|

#### SCF-08 结果卡与提示信息（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|成功生成后查看结果卡黄色提示区|显示下一步 `nuget restore {NS}.CRM.D365.sln` 与 VS 打开提示，NS 与实际输入一致|
|2|制造一次失败（如 409）|错误以红色提示块展示，不显示成功卡|
|3|修正后重新生成|旧错误清除，结果卡刷新|

#### SCF-09 真实还原、编译与单元测试（P1，环境缺工具时记"阻塞"）

|步骤|操作|预期结果|
|-|-|-|
|1|生成解决方案后，在解决方案根目录执行 `nuget restore {NS}.CRM.D365.sln`|全部 NuGet 包还原成功，无版本冲突|
|2|用 MSBuild 编译解决方案（VS2019/2022+，参数用 `-p:` 形式）|编译成功 0 error；Share 共享项目代码被 Sample/UnitTest 正确引用|
|3|用 vstest 运行 UnitTest 项目测试|MSTest 用例全部通过（基线为 2/2）|
|4|写后恢复|删除生成目录及 packages/bin/obj 等全部产物|

#### SCF-10 无需 D365 连接与凭据隔离（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在未连接任何环境（甚至停掉 D365 网络）状态下执行 SCF-01|生成成功，证明不依赖 Dataverse|
|2|检查生成 UnitTest 的 app.config|只保留绑定重定向，不含任何真实 client secret/环境 URL|
|3|检查 localStorage 与后端连接状态|生成操作不写入已保存环境、不改变连接状态|

\---

## 4\. 连接类工具（16 个）

> 公共前置：已按 INFRA-02/03 建立连接；使用专用沙箱与测试数据。
> 每个模块第一例验证 ConnectionGuard（未连接时整页显示 `Environment Connection Required`，不发起业务请求）；后续用例默认已连接。
> 写操作统一流程：记录基线 →（有 ConfirmDialog 时先取消验证零变更）→ 确认执行一次 → 重读验证 → 逆向恢复 → 再验证与基线一致。

### 4.1 Entity Metadata Viewer（EMV，实体元数据查看器）

> 自动化映射：`tests/api/02-metadata`（4 用例）。

#### EMV-01 未连接拦截与实体列表加载（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开后访问 `/tools/metadata-viewer`|ConnectionGuard 拦截，不请求实体列表|
|2|连接后进入页面|显示 `Loading entities...`，随后左侧出现实体列表（逻辑名/显示名/ObjectTypeCode）|
|3|观察列表加载结果|无 `$top/$orderby` 导致的 400（0x80060888）；大列表完整（回归 REG-05）|

#### EMV-02 实体搜索与选择（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|在 `Search entities...` 输入 contact|列表过滤为匹配实体|
|2|点击 contact|显示 `Loading attributes...`，右侧出现字段表（Logical Name/Display Name/Type/Required）与属性数、Primary Key、Name|
|3|改选 account|右侧切换为 account 字段，不残留 contact 数据|

#### EMV-03 字段类型与必填标识（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|查看 Type 列|数字类型正确映射为 Boolean/DateTime/Lookup/Picklist 等|
|2|查看 Required 列|ApplicationRequired 与 Recommended 使用不同颜色标识|
|3|查看字符串/数值字段详情|MaxLength/MinValue 等子类型属性正常展示，无 `$select` 非法字段 400|

#### EMV-04 字段搜索与切换残留（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|在 `Search attributes...` 输入 name|字段表按名称过滤|
|2|不清空搜索词直接切换实体|按当前实现旧搜索词继续过滤新实体字段（已知行为）；清空后显示完整字段|

#### EMV-05 大响应中断与重试（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|加载大元数据期间模拟网络瞬断（ECONNRESET）|服务端自动重试（最多 2 次指数退避）后成功，或顶部显示真实错误可手动重试|
|2|恢复后重新选择实体|页面恢复，不白屏|

### 4.2 Solution Manager（SOL，解决方案管理器）

> 自动化映射：`tests/api/03-solution`（3 用例）。

#### SOL-01 未连接拦截与解决方案列表（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后进入|`Loading solutions...` 后左侧显示解决方案列表，含版本、发布者、Managed/Unmanaged 徽章|

#### SOL-02 搜索过滤（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在 `Search solutions...` 输入 friendlyname 关键字|列表按 friendlyname/uniquename 过滤|
|2|清空搜索|恢复完整列表；无匹配时列表为空但不报错|

#### SOL-03 组件统计与类型映射（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|点击一个含多类组件的解决方案|右侧显示详情（Unique Name/Version/Publisher/Managed/Installed/Updated On）与 `Loading components...`|
|2|查看 Component Summary|按数值 componenttype 分组、按数量降序；类型名来自实时 optionset 元数据（20=Role、90=Plugin Assembly 等，回归 REG-07）|
|3|检查同名不同类型码（如 371/372 Connector）|分别计数不合并；未知类型显示 `Type n`|

#### SOL-04 空组件与失败提示（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|选择无组件的解决方案|显示 `No components found`|
|2|制造组件接口失败|显示后端真实错误信息，而非通用 `Failed to fetch`|

### 4.3 Data Query Tool（DQT，数据查询工具）

> 自动化映射：`tests/api/04-data`（6 用例）。
> 默认值：Entity=account、$top=25；切换实体清空 $select 与排序（含方向），但保留 $filter 与旧结果（当前行为）。

#### DQT-01 未连接拦截与基础查询（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问 `/tools/data-query`|ConnectionGuard 拦截|
|2|连接后 Entity 选 contact，$select 选 fullname,createdon，$top 改 3，点击 `Query`|返回 3 条记录；表格显示已加载数|
|3|检查列头|选中字段列优先且全保留，null 显示 `-`；主键等额外字段追加在后（回归 REG-06）|

#### DQT-02 排序与过滤（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|$order by 选 createdon、方向 Desc|请求含 `$orderby=createdon desc`，结果按创建时间倒序|
|2|$filter 输入 `statecode eq 0` 后 Query|仅返回启用记录|
|3|输入非法 $filter|顶部红色错误条显示 Dataverse 具体错误，不伪成功|

#### DQT-03 实体切换重置（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|配置 contact 的字段与排序后切换 account|$select、排序字段与方向被重置，防止跨实体残留|
|2|观察 $filter 与旧结果|按当前实现保留；重新 Query 后才刷新为 account 数据|

#### DQT-04 长标签布局与 Load More（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|选择多个长标签字段（如 createdon (Created On)）|下拉不与 $top 输入框重叠，可正常点击（回归 REG-11）|
|2|$top 设小值执行有后续页的查询|出现 `Load More`；点击后追加记录且已加载数增加|

#### DQT-05 空结果与只读检查（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|构造无匹配过滤执行|显示空结果提示，无旧数据残留|
|2|查询前后对比业务数据|无新增/修改（工具只读）|

### 4.4 Environment Dashboard（EDB，环境仪表盘）

> 自动化映射：`tests/api/05-environment`（2 用例，已知 flake 见第 8 章）。

#### EDB-01 未连接拦截与卡片加载（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后进入|Organization / Current User / Environment Statistics / Connection 四卡分别显示骨架屏后填充|
|3|检查内容|组织含 Language Code（不含非法 urlname，回归 REG-10）；当前用户来自 WhoAmI；统计含 Entities/Solutions/Web Resources/System Users；Connection 卡显示环境 URL|

#### EDB-02 userId 暴露（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|查看 `/api/dataverse/environment/info` 响应（DevTools Network）|含 WhoAmI `userId`，供权限工具"当前身份"使用|

#### EDB-03 部分子查询失败降级（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|模拟 stats 中单项统计失败|对应数值显示 `-`，组织/用户卡片不受影响（Promise.allSettled 降级）|
|2|模拟 info 整体失败|info 区 ErrorState，页面不白屏|

#### EDB-04 version 偶发为空识别（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|多次刷新页面观察 Version|正常显示版本号|
|2|若偶发 version 为空且伴随瞬断日志|刷新恢复；与 05-environment flake 一致，单独复验，不直接判为回归（见 8.4）|

### 4.5 Option Set Viewer（OSV，选项集查看器）

> 自动化映射：`tests/api/06-optionset`（4 用例）。

#### OSV-01 未连接拦截与全局列表（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 Global 页签|显示全局选项集列表与 Loading；`Search option sets...` 输入关键字本地过滤|

#### OSV-02 选项详情与颜色（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|点击一个全局选项集|显示 Value/Label/Color 表格、Custom 徽章与选项数|
|2|查看颜色列|同时显示色块与色值；无选项时显示 No options|

#### OSV-03 三种格式复制（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|点击 `JSON`|剪贴板为合法 JSON，选项完整|
|2|点击 `C# Enum`|枚举名清理非法字符、数字开头被处理，可编译|
|3|点击 `Power Fx`|table 语法正确，双引号被转义|

#### OSV-04 实体选项集与 Global/Local 徽章（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|切到 Entity 页签，选择 account|显示 Picklist/MultiSelectPicklist 字段手风琴，含 Multi-Select 与 Global/Local 徽章、选项数|
|2|展开字段|选项表正确；Local 与 Global 标识与元数据一致|
|3|切换实体|旧字段与展开状态清空后重新加载|

### 4.6 Business Rule Inspector（BRI，业务规则检查器）

> 自动化映射：`tests/api/07-businessrule`（4 用例）。

#### BRI-01 未连接拦截与规则列表（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 Entity 下拉选择 account|自动查询，显示该实体业务规则（名称/描述/修改时间/Active/Inactive）；仅 category=2、type=1 的 Business Rule|

#### BRI-02 详情条件与动作解析（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|展开一条规则|`Loading rule details...` 后双栏显示 Conditions（字段+运算符）与 Actions|
|2|展开 `Raw definition (JSON)`|可查看 clientdata 原始 JSON|

#### BRI-03 无法解析回退（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|展开结构复杂/无法提取的规则|提示无法提取结构化内容，仍可查看 Raw JSON，不报错|

#### BRI-04 切换与空状态（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|改选无业务规则的实体|显示 `No business rules`，与未选择实体的 `Select an entity` 状态区分|
|2|快速切换多个实体|规则列表、错误与展开集合被清空重查，不串实体|

### 4.7 Web Resource Manager（WRM，Web 资源管理器）

> 自动化映射：`tests/api/08-webresource`（4 用例，含真实 Publish）。
> 写操作：Publish 当前无 ConfirmDialog（已知行为）；测试只用专用测试 Web Resource，先记录内容与修改时间基线。

#### WRM-01 未连接拦截与列表筛选（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后进入|显示 8 行骨架后出列表（Name/Display Name/Type/Modified）与 `Showing x of y`；列表响应不含 base64 content|
|3|搜索名称/显示名/描述关键字，类型过滤分别选 JavaScript/PNG 等|过滤正确；类型选项含 HTML/CSS/JavaScript/XML/PNG/JPG/GIF/XAP/XSL/ICO/SVG/RESX|
|4|点击 `Refresh`|列表重新加载|

#### WRM-02 按需内容与预览（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|展开一个 JavaScript 资源行|仅此时请求该资源 content；`Loading content...` 后显示 UTF-8 解码代码 `<pre>`|
|2|展开 PNG 图片资源|显示图片预览|
|3|展开其他二进制类型|显示 `No preview available...`|
|4|展开另一行|一次只展开一行，新行内容重新加载|

#### WRM-03 代码复制（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|在代码详情点击 `Copy`|剪贴板与解码后源码一致，无 base64 串|

#### WRM-04 Publish 与写后验证（P1，写操作）

|步骤|操作|预期结果|
|-|-|-|
|1|选择专用测试 Web Resource，记录 Modified 时间与内容基线|基线已保存|
|2|点击 `Publish` 一次|调 `POST .../publish`（PublishXml），按钮短暂显示 `Published`；无 ConfirmDialog 属当前已知行为|
|3|重新展开/刷新该资源|发布状态与 Modified 信息更新；内容未被修改|
|4|连续快速点击 Publish|不产生不可控重复发布或错误状态|
|5|写后恢复|内容保持原值（Publish 不改内容）；如测试中含改动则恢复原内容并再次 Publish 至基线|

#### WRM-05 失败与空状态（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|模拟 Publish 失败|ErrorState 显示真实错误，不显示 Published|
|2|搜索无匹配|区分"环境无资源"与"过滤无匹配"两种空状态|

### 4.8 Security Role Viewer（SRV，安全角色权限矩阵）

> 自动化映射：`tests/api/09-security`（4 用例）。

#### SRV-01 未连接拦截与矩阵加载（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 Entity 下拉选择 account|`Loading privilege matrix...` 后显示角色 × 8 操作（Create/Read/Write/Delete/Append/AppendTo/Assign/Share）矩阵|

#### SRV-02 角色合并与完整性（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|检查角色行|同名多 BU 角色按名称合并，无大量重复行；总数与 `/roles` 去重结果一致（回归 REG-09）|
|2|搜索 System Administrator|存在且矩阵完整，不被分页截断（FetchXML paging cookie 正确处理，无 0x80040201，回归 REG-08）|

#### SRV-03 深度徽章与图例（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|查看单元格徽章|Org / P:C BU / BU / User / None 五色徽章与 title 全称正确，附图例|
|2|抽查 System Administrator|account 全 8 项为 Org|
|3|抽查 System Customizer|深度符合预期（如 Read 为 User），权限严格按 prv{Action}{Entity} 后缀匹配，不串实体|

#### SRV-04 角色过滤与切换（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在 `Filter roles...` 输入关键字|仅本地过滤当前矩阵，显示"过滤后/总数"，不重新请求|
|2|过滤无匹配|显示 `No roles found`|
|3|切换实体|旧矩阵清空并重新加载|

### 4.9 User Access Analyzer（UAA，用户访问分析）

> 自动化映射：`tests/api/10-user-access`（6 用例，含分配/撤销回环）。
> 写操作：Assign Role 当前无 ConfirmDialog；Remove 有 ConfirmDialog。环境策略 0x80040265（Compliance Country required）可能拒绝一切 API 角色分配，属环境限制。

#### UAA-01 用户搜索与档案（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后在 `Search users by name or email...` 输入关键字|AsyncSearchSelect 300ms 防抖服务器搜索，结果正确|
|3|选择 `<测试用户>`|自动加载 profile：状态、Access Mode、Email、Domain Account、BU；页签 Direct Roles / Teams / Effective Roles|

#### UAA-02 团队与有效角色（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|查看 Teams 页签|团队类型显示 Owner/Access/AAD Security Group/AAD Office Group|
|2|查看 Effective Roles|直接与团队角色按名称合并，Source Badge 为 Direct 或 Team: {team name}；同名多来源均列出|

#### UAA-03 分配角色并恢复（P0，写操作回环）

|步骤|操作|预期结果|
|-|-|-|
|1|记录 `<测试用户>` 当前 Direct Roles 快照|基线已保存|
|2|打开 `Assign Role`，角色列表不含已直接分配的同名角色|候选过滤正确|
|3|选择一个测试角色并 `Assign`|无 ConfirmDialog（已知行为）；成功后 profile 刷新，新角色出现|
|4|若返回 0x80040265|记录为环境限制，跳过写回环，不判产品缺陷|
|5|点击该角色垃圾桶，ConfirmDialog 先点取消|角色仍在，零变更|
|6|再次点击并确认 `Remove`|角色被移除；Direct Roles 与基线一致|

#### UAA-04 切换用户与失败处理（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|切换另一用户|加载新 profile，旧 actionError 清空，不串角色|
|2|模拟分配失败|显示真实错误，本地列表不伪增角色，可安全重试|

### 4.10 Record Access Checker（RAC，记录访问检查）

> 自动化映射：`tests/api/11-record-access`（check/record-search 部分）。

#### RAC-01 未连接拦截与权限检查（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 Entity 选 account；Record 异步搜索选择 `<测试记录>`；User 搜索选择 `<测试用户>`|未选实体时 Record 禁用并提示 `Select an entity first`|
|3|点击 `Check Access`|调 `POST /api/dataverse/recordaccess/check`，显示 8 项权限卡（Read/Write/Append/AppendTo/Create/Delete/Share/Assign）Granted/Denied 与 `n / 8 granted`|

#### RAC-02 computed 回退提示（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在函数目录无 RetrievePrincipalAccess 的环境执行检查|显示 computed 来源说明条；权限由直接+团队角色与 POA 共享计算，深度对照记录 owner/BU 链|
|2|对比已知有/无权限用户|判定与沙箱实际一致|

#### RAC-03 当前身份与状态重置（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|点击 User 旁当前身份图标（title=`Use the user of the current connection`）|User 填为 /info 的 WhoAmI 用户|
|2|切换实体|Record 与旧 rights 清空，User 保留|
|3|更换 Record 或 User|旧 rights 清空，不展示过期结论|

#### RAC-04 记录不存在（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|对已被删除/无权限记录执行检查|ErrorState 显示明确错误，不伪报 Granted|

### 4.11 Record Sharing Auditor（RSA，共享审计）

> 自动化映射：`tests/api/11-record-access`（shared/share/revoke 回环）。
> 写操作：Share/Edit 当前无 ConfirmDialog；Revoke 有 ConfirmDialog。新增共享走 GrantAccess，编辑已有走 ModifyAccess。

#### RSA-01 未连接拦截与共享列表（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 Entity 选 account、Record 搜索选择 `<测试记录>`|自动查询共享：Shared Principals 表格（Principal/Type/Rights）正确解析 PrincipalAccesses（回归 REG-13 别名键编码问题）|
|3|选择无共享记录|显示 `Not shared` 而非错误|

#### RSA-02 新增共享（P0，写操作）

|步骤|操作|预期结果|
|-|-|-|
|1|记录当前共享列表基线|基线已保存|
|2|点击 `Share Record`，选 User/Team 并搜索选择测试主体，勾选 Read+Write（默认仅 Read）|至少一项权限且选择主体后 Share 可用|
|3|点击 `Share`|调 `/share`（GrantAccess）；列表自动刷新出现该主体及权限|
|4|用 RAC 对该主体复核|对应权限变为 Granted|

#### RSA-03 修改已有共享（P1，写操作）

|步骤|操作|预期结果|
|-|-|-|
|1|对该主体行点击 `Edit`|打开 `Edit Shared Access`，当前权限回显|
|2|去掉 Write 仅留 Read，点击 `Save`|走 ModifyAccess；列表权限更新，不重复新增主体行|

#### RSA-04 撤销共享并恢复基线（P0，写操作）

|步骤|操作|预期结果|
|-|-|-|
|1|点击该主体垃圾桶，ConfirmDialog 先取消|共享仍在|
|2|再次点击并确认 `Revoke`|RevokeAccess 删除该主体全部共享权限；列表恢复基线|
|3|RAC 复核|由共享带来的权限消失；POA 查询使用 objectid/principalid 普通 Guid 属性（回归 REG-12）|

#### RSA-05 切换与失败（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|切换实体|Record、principals、actionError 清空|
|2|模拟共享写失败|显示真实错误，不伪成功，列表与服务端一致|

### 4.12 Security Role Compare（SRC，角色对比）

> 自动化映射：`tests/api/12-role-compare`（5 用例）。

#### SRC-01 未连接拦截与两角色对比（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 Role A 选 System Administrator、Role B 选 System Customizer|两角色齐全后自动对比，显示 Only in A / Only in B / Depth Different / Identical 四统计卡|
|3|查看差异表与页签|Differences/All/Only A/Only B/Depth Diff/Same 过滤正确；A/B 深度徽章与状态 Badge 正确|

#### SRC-02 相同角色与切换（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|A、B 选同一角色|无伪差异，Identical 覆盖全部权限|
|2|修改任一角色|旧结果清空并自动重比|

#### SRC-03 深度差异高亮（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|切到 Depth Diff 页签|仅显示同权限不同深度项，差异明显标识|

#### SRC-04 Copy missing A → B（P1，写操作，需可写沙箱）

|步骤|操作|预期结果|
|-|-|-|
|1|记录 Role B 权限基线|基线已保存|
|2|点击 `Copy missing A → B (n)`，ConfirmDialog 先取消|B 权限零变更|
|3|再次打开并确认|调 AddPrivilegesRole，以 A 的深度增量添加缺失权限，不删除 B 已有权限|
|4|重新对比|Only in A 减少；B 原有权限仍在|
|5|写后恢复|用沙箱手段恢复 Role B 至基线（或改用专用可复制测试角色执行本例）|

### 4.13 Field Security Viewer（FSV，字段安全查看器）

> 自动化映射：`tests/api/13-field-security`（5 用例）。
> 写操作：Assign Member 当前无 ConfirmDialog；Remove 有 ConfirmDialog。

#### FSV-01 未连接拦截与 Profile 列表（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 Profiles 页签|显示全部字段安全 Profile；`Filter profiles...` 可过滤|

#### FSV-02 权限与成员详情（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|选择一个 Profile|并行加载 permissions/members；权限按实体分组显示 Field/Read/Update/Create，选项为实时 Picklist 标签|
|2|查看 Members|用户与团队关联均列出；无数据分别显示 No field permissions / No members|

#### FSV-03 受保护字段（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Secured Fields 页签选择 account|显示 IsSecured=true 字段（Logical Name/Display Name/Type）|
|2|切换实体|旧结果清空重载；无受保护字段显示 No secured fields|

#### FSV-04 成员增删回环（P1，写操作）

|步骤|操作|预期结果|
|-|-|-|
|1|记录 Profile 成员基线|基线已保存|
|2|`Assign Member` 选 User/Team 搜索并 Assign（User/Team 切换会清空当前选择）|无 ConfirmDialog（已知行为）；成功后成员刷新出现|
|3|点击该成员垃圾桶，ConfirmDialog 先取消|成员仍在|
|4|再次确认 `Remove`|成员移除，列表与基线一致|

### 4.14 Permission Diagnostic（PMD，权限诊断）

> 自动化映射：`tests/api/14-permission`（3 用例）。
> 注意：Entity Name 为普通文本框（需手输逻辑名），User 与 Entity 必填。

#### PMD-01 未连接拦截与实体级诊断（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后 User 搜索选择 `<测试用户>`，Entity Name 输入 account，Record ID 留空，点击 `Diagnose Permissions`|显示 `Analyzing permissions across all sources...` 后输出 Granted/Denied 判定卡及 Direct Roles / Team Roles / Effective Privileges / Field Security 卡片|
|3|检查权限矩阵|Create/Read/Write/Delete/AppendTo/Append/Assign/Share 深度（None/User/BU/P:C BU/Org）与 verdictSources 说明正确|

#### PMD-02 记录级诊断（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|填入 `<测试记录>` 的 Record ID 再次诊断|增加 Record Sharing (POA) 卡片；深度按记录 owner/BU 链评估|
|2|换用无权限测试身份|判定 Denied 且缺失原因明确，不伪报 Granted|

#### PMD-03 输入校验与状态重置（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|User 或 Entity 留空点击诊断|不执行，提示必填|
|2|Entity 输入不存在逻辑名|错误红卡显示真实错误|
|3|更换用户/实体/记录重新诊断|旧结果清空，不串身份|
|4|选择禁用用户|显示 `User Disabled` 提示|

### 4.15 Business Unit Hierarchy（BUH，BU 层级）

> 自动化映射：`tests/api/15-businessunit`（3 用例）。

#### BUH-01 未连接拦截与树加载（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后进入|`Loading business unit hierarchy...` 后左侧显示 BU 树；自动选中第一个根 BU；深度小于 2 节点默认展开|

#### BUH-02 节点详情（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|选择一个 BU 节点|右侧 `Loading details...` 后显示 BU 详情、Users/Teams/Roles 统计与成员列表|
|2|查看团队类型|显示 Owner/Access 或 `Type n`|
|3|选择无成员 BU|分别显示 No users / No teams / No roles|

#### BUH-03 树交互与边界（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|点击节点展开箭头|只展开/收起，不触发节点选择；不重复节点、不丢层级|
|2|切换根 BU 与深层 BU|详情同步更新，不串数据|
|3|模拟详情接口失败|显示 `Select a business unit...` 或错误提示，可重选恢复|

### 4.16 Audit Log Viewer（ALV，审计日志查看器）

> 自动化映射：`tests/api/16-audit`（3 用例）。
> 默认 Start Date=7 天前、End Date=今天（结束日期补 23:59:59）；查询固定 top=200，按最新优先。

#### ALV-01 未连接拦截与默认查询（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|断开访问页面|ConnectionGuard 拦截|
|2|连接后进入|自动加载 Event Types 动作集合；点击 `Query Logs` 显示 `Loading audit logs...` 后出事件卡片（动作彩色 Badge、时间、实体类型、User/Object GUID 前 8 位）|
|3|检查数据查询方式|后端使用 FetchXML 查询 audit（OData 不支持时的既定方案，回归 REG-14）|

#### ALV-02 事件类型多选（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|多选角色分配/撤销、共享/撤销共享等事件类型后查询|仅返回所选类型|
|2|点击 `Clear all` 后查询|清空类型过滤，恢复全量安全事件|

#### ALV-03 日期与实体筛选（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|缩小日期范围为今天|仅今天事件；结束日期包含当天 23:59:59 边界|
|2|Entity 输入 account|仅 account 相关审计|
|3|组合无匹配条件|显示 `No audit logs found for the selected filters.`|

#### ALV-04 异常与数据保护（P2）

|步骤|操作|预期结果|
|-|-|-|
|1|制造接口失败|显示真实错误消息，可重试|
|2|测试前后检查审计数据|只读查询不删除/修改审计记录|

\---

## 5\. 后端 API 与自动化测试映射

### 5.1 运行方式

```bash
# 前置：pnpm dev 已启动（至少后端 3001）；已配置 tests/config.local.mjs
node tests/run-all.mjs        # 全量：按 runner 注册顺序执行 API 与 tools 套件
node tests/api/05-environment.test.mjs   # 单独重跑某一套件（示例）
node tests/tools/21-metadata-cache.test.mjs
```

* 退出码：0 = 无失败（允许 skip）；1 = 至少 1 个用例失败。
* 请求层对 ECONNRESET/aborted/ETIMEDOUT/network\_error 类 500 最多额外重试 2 次（1.5s/3s 退避）。
* `01-connection` 会主动断开并重连，runner 在其后重新 `ensureConnected()`；API 18 在 runner 中排在 02-metadata 后、03-solution 前。
* 源码契约套件（tools/10-22）全部离线可跑：不需要后端、前端、D365 或凭据。
* API 套件中 `00-health`、`17-scaffold` 不需要 D365；`01-connection` 前 5 例不需要凭据；其余依赖 `requiresConnection`/`requiresCredentials` 自动 skip（14-16 例外，见 5.4）。API 18 的 5 项均要求有效连接。

### 5.2 API 集成套件（19 个，89 用例）

|套件|用例数|路由模块|覆盖点|对应手工模块|
|-|-:|-|-|-|
|00-health|2|/api/health|存活、未知路由 404|INFRA-01|
|01-connection|8|/api/connection|connect/status/disconnect、参数校验、未连接 401、真实连接、旧令牌回归|INFRA、SC|
|02-metadata|4|/api/dataverse/metadata|entities（limit）、attributes、非法实体|EMV|
|03-solution|3|/api/dataverse/solutions|列表、组件（\_solutionid\_value）、不存在 GUID|SOL|
|04-data|6|/api/dataverse/data|OData、FetchXML 校验与 EntitySetName 回退|DQT、FXB|
|05-environment|2|/api/dataverse/environment|/info（组织/用户/版本）、/stats|EDB（已知 flake）|
|06-optionset|4|/api/dataverse/optionsets|global 列表/详情、entity 选项集、非法实体|OSV|
|07-businessrule|4|/api/dataverse/businessrules|列表、clientdata 解析、非法 ID|BRI|
|08-webresource|4|/api/dataverse/webresources|列表无 content、按需 content、真实 Publish、非法 ID|WRM|
|09-security|4|/api/dataverse/security|/roles 去重、8 操作矩阵、参数校验|SRV|
|10-user-access|6|security /users /teams|搜索、profile、角色分配/撤销回环（0x80040265 跳过）|UAA|
|11-record-access|6|/api/dataverse/recordaccess|record-search、check（computed 回退）、Share→Revoke 回环|RAC、RSA|
|12-role-compare|5|security /compare 等|role-privileges、compare 分类、add-privileges 校验|SRC|
|13-field-security|5|/api/dataverse/fieldsecurity|profiles/permissions/members/secured-fields|FSV|
|14-permission|3|/api/dataverse/permission|diagnose 校验与真实诊断（见 5.4 已知问题）|PMD|
|15-businessunit|3|/api/dataverse/businessunit|/tree、/:id/details、非法 GUID（见 5.4）|BUH|
|16-audit|3|/api/dataverse/audit|/actions、/logs、eventTypes 过滤（见 5.4）|ALV|
|17-scaffold|12|/api/scaffold|5 组 400 校验、生成清单、token/GUID/SNK、409、兄弟前缀|SCF（离线+本地写入）|
|18-metadata-cache|5|/api/dataverse/metadata/cache|统计清零、HIT/MISS、不同 limit 复用、字段缓存、清空回源|MC|

### 5.3 源码契约套件（13 个，111 用例）

|套件|用例数|覆盖点|对应手工模块|
|-|-:|-|-|
|tools/10-connection-string-builder|5|四种认证、C#/PowerShell/PAC CLI 模板|CSB|
|tools/11-power-automate-expressions|6|表达式库、求值、UTC、模板数量|PAE|
|tools/12-fetchxml-builder|6|XML 骨架、null 运算符、link-entity、null 列保留|FXB|
|tools/13-odata-url-builder|8|v9.2 URL、六类操作、过滤/排序、实体切换重置|OUB|
|tools/14-plugin-generator|6|IPlugin 模板、阶段、Target、Image、实体下拉|PLG|
|tools/15-pcf-generator|6|manifest、生命周期、React wrapper、响应式与 SVG 契约|PCF|
|tools/16-custom-page-generator|5|三类页面 Power Fx、CountRows、连接下拉|CPG|
|tools/17-security-grouping|7|Security 分组、旧导航/路由/API 保留、重试谓词、userId|UI-01、INFRA|
|tools/18-new-tools-regression|25|组件存在性、26 路由、后端挂载、导航、api.ts 接口、错误守卫|全部|
|tools/19-plugin-scaffolder|11|脚手架页面/校验/模板管线契约|SCF|
|tools/20-saved-connections|12|存储结构、LRU、容错、弹窗动作、成功才写历史、密钥不渲染|SC、NF-06|
|tools/21-metadata-cache|10|前端缓存、hook/页面接入、连接作用域、全局刷新、迟到响应守卫、link-entity epoch、FetchXML 回退与 runner 注册|MC|
|tools/22-retry-policy|4|瞬时网络签名、方法幂等性、blocked 分类与 runner 汇总|AUTO-API|

注意：**CSA、AAD 无独立源码契约套件**，其验证完全依赖手工用例，不得标记为"已由自动化覆盖"。

### 5.4 自动化已知问题与 flake

|项|现象|处置|
|-|-|-|
|05-environment flake|`/info` 的 version 偶发为空，伴随沙箱 ECONNRESET；Promise.allSettled 子查询降级所致|单独重跑 `node tests/api/05-environment.test.mjs` 复验；单跑通过记"已知 flake，复验通过"；持续失败才按缺陷排查|
|tests/api/14、15、16 标记位置问题|`requiresConnection` 被写成 `test(name, fn, options)` 第三参数，harness 只认第二参数；无凭据时这 9 个用例不 skip 而失败（401/状态不符）|已知测试代码问题，本轮不修复；无凭据运行时不要把这 9 个失败误判为工具回归；完整发布验证必须在有效凭据下取得全量通过|
|0x80040265 环境策略|部分沙箱拒绝一切 API 角色分配|自动化回环检测后 skip；手工记"环境限制"，不判产品缺陷|

### 5.5 元数据缓存覆盖边界与待验证风险

现有自动化只证明以下范围，不能外推为全部缓存行为：

|套件|已覆盖|未覆盖|
|-|-|-|
|`tests/api/18-metadata-cache`|统计清零、相同请求 HIT、不同 limit 复用、字段按实体缓存、清空后 MISS|TTL 到期、LRU 60/61、真实并发、跨环境、失败注入、清空期间迟到响应|
|`tests/tools/21-metadata-cache`|缓存导出与常量、hook/三页面接入、作用域清理、刷新流程、MetadataViewer 迟到响应守卫、link-entity epoch、服务端头与路由、runner 注册|真实缓存行为、浏览器网络时序|
|`tests/api/04-data`|显式实体集、根实体解析、未知实体错误|暖缓存时是否零额外元数据回源（需服务端桩或日志）|
|`tests/tools/12-fetchxml-builder`|FetchXML 源码契约与缓存 loader 引用|link-entity 字段运行时刷新（已由 MC-22 浏览器验证）|
|`tests/tools/22-retry-policy`|瞬时签名、方法幂等性、blocked 分类|真实上游故障下的完整重试时序|

未来候选自动化（当前未实现、未执行，不计入 200）：前端可控时钟与 Promise 桩、服务端 Dataverse 桩、缓存 API 边界、浏览器 E2E 时序。RISK-MC-01/05 仍需专项验证，不得提前写 Fixed/Verified；RISK-MC-02/03 的修复状态见 9.4。

\---

## 6\. 非功能测试（NF）

#### NF-01 生产构建与真实类型检查（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|根目录执行 `pnpm build`|client、server 构建成功；`tsc -b` 含 noUnusedLocals/noUnusedParameters 的真实检查通过|
|2|不得只用 `pnpm --filter client exec tsc --noEmit` 代替|该命令走只有 references 的根 tsconfig，是空检查假通过，不能作为通过依据|

#### NF-02 大结果集性能（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|加载全量角色矩阵（数百角色）与实体元数据（可用 limit 至 5000）|常规沙箱网络下 < 10s 可接受，页面不卡死|
|2|Web Resource 大列表|列表不加载 base64 content，响应保持轻量；展开才加载单行内容|

#### NF-03 网络瞬断与慢网络（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|制造 ECONNRESET/aborted/ETIMEDOUT|服务端自动重试（最多 2 次指数退避），含响应体中途 socket reset|
|2|限速网络下遍历主要页面|骨架屏/LoadingState 正常，无白屏闪烁、无无限加载|

#### NF-04 并发与降级（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|Dashboard 并行 info/stats|互不阻塞；单项失败仅本地降级，不拖垮整页|

#### NF-05 前端输出与日志安全（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|检查 Console、错误堆栈、title/aria-label|不输出 clientSecret/password；错误提示不含完整凭据|
|2|检查 URL 与查询串|凭据不出现在浏览器地址栏或 GET 查询参数中|

#### NF-06 已保存环境的新存储安全模型（P0，替代 v2 旧结论）

|步骤|操作|预期结果|
|-|-|-|
|1|检查 localStorage `d365\_saved\_connections`|凭据可存在此（设计如此），物理上在浏览器 profile 而非仓库目录；sessionStorage `d365\_connection` 仍只含 connected/environmentUrl|
|2|检查渲染 DOM/可访问属性/日志|秘密不明文出现；列表只显示 label/authType/账号或 ClientId 前 8 位 + 固定掩码|
|3|清空列表|键被 removeItem；写入失败静默不影响连接|
|4|评估浏览器 profile 同步|文档与提示中明确：profile 同步可能把 localStorage 漫游到其他设备，共享设备上应使用垃圾桶清除|

#### NF-07 服务端输入校验（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|对写操作接口提交非法 GUID、越界 AccessMask|被 400 拒绝，白名单生效|
|2|检查 `@odata.id`|始终由服务端基于当前连接环境 URL 构建，前端传入伪造值不被采用|

#### NF-08 输出转义与注入（P1）

|步骤|操作|预期结果|
|-|-|-|
|1|在 FetchXML/OData/代码生成输入中注入 XML 特殊字符、引号、`<script>`|正确转义或作为文本处理，不执行脚本、不破坏生成结构|

#### NF-09 本地脚手架写入安全（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|执行 SCF-04/05 的攻击面输入|路径穿越、NUL、系统目录、仓库内、非空覆盖均被拦截，无越界写入|
|2|扫描生成物|无 token 残留、无历史标识、app.config 无真实密钥|

#### NF-10 文档与证据脱敏（P0）

|步骤|操作|预期结果|
|-|-|-|
|1|检查本文档、截图、日志、config 示例|无真实凭据、真实环境域名、本机个人目录；备份目录中含明文密钥的旧材料不得复制回公开文件|

\---

## 7\. 回归测试清单（历史缺陷锁定）

每次发布前必查；REG-01\~15 沿用 v2.0，REG-16\~25 为既有新增，REG-26 为元数据缓存回归。

|编号|历史缺陷|验证方式（对应用例）|
|-|-|-|
|REG-01|PCF Generator Tab 切换失效（Radix Tabs 条件渲染）|PCF-01|
|REG-02|Username+Password 缺 Tenant ID 字段|INFRA-03|
|REG-03|刷新后连接状态丢失|INFRA-05|
|REG-04|China 云 authority（AZURE\_CHINA 常量不存在，且仅 \*.dynamics.cn 切换）|INFRA-06|
|REG-05|China 云 EntityDefinitions 不支持 $top/$orderby|EMV-01|
|REG-06|查询结果 null 字段列丢失|FXB-05 / DQT-01|
|REG-07|Solution 组件类型映射错位 + lookup 过滤须用 \_solutionid\_value|SOL-03|
|REG-08|FetchXML 分页 cookie 双重编码 + XML 转义|SRV-02|
|REG-09|角色按 BU 重复 + top=500 截断|SRV-02|
|REG-10|Environment Dashboard urlname 非法属性导致 organization=null|EDB-01|
|REG-11|Flex 布局下拉框与输入框重叠（min-w-0）|UI-06 / DQT-04|
|REG-12|POA 无 \_objectid\_value lookup，须用 objectid/principalid|RSA-04|
|REG-13|RetrieveSharedPrincipalsAndAccess 别名键 axios 编码、PrincipalAccesses 解析|RSA-01|
|REG-14|Audit 实体 OData 不支持，改用 FetchXML|ALV-01|
|REG-15|AsyncSearchSelect 必须从 search-select 导入|`pnpm build` + tools/17、18|
|REG-16|Scaffold NUL 字符检查失效导致所有 targetDir 一律 400（或绕过）|SCF-04 / api/17|
|REG-17|Scaffold 生成物 token（`{{ }}`/`\_\_NS\_\_`）或历史标识残留|SCF-06 / api/17|
|REG-18|Scaffold sln/csproj/shproj/projitems GUID 不一致|SCF-07 / api/17|
|REG-19|连接弹窗常驻挂载导致列表陈旧，必须 open 时重读并清错|SC-07|
|REG-20|纯空格 environmentUrl 生成垃圾记录；字段须 trim|SC-08 / SC-01|
|REG-21|连接失败也写历史/伪造成功时间|SC-06 / INFRA-04|
|REG-22|URL 归一化改写原值，影响 .dynamics.cn authority 判定|SC-02|
|REG-23|clientSecret/password 进入 JSX/title/aria-label/日志|SC-10 / NF-05 / NF-06|
|REG-24|Radix ScrollArea 高度裁切（改 overflow-y-auto）与受控 Tabs prefill 错页签|SC-12 / SC-04|
|REG-25|损坏存储未逐条容错、LRU 失效、删除记录误断当前连接|SC-05 / SC-08 / SC-09|
|REG-26|切换模块重复拉取全量实体列表，页面重新挂载不命中缓存|MC-01 / api/18 / tools/21|

\---

## 8\. 测试执行策略

### 8.1 执行顺序

1. **环境准备**：`pnpm install` → `pnpm dev` → 配置 `tests/config.local.mjs` → 准备沙箱测试数据并记录全部写操作基线。
2. **构建门禁**：`pnpm build` 通过（NF-01）。
3. **自动化冒烟**：`node tests/run-all.mjs`，保存完整日志与退出码；失败先按 5.4 分类（产品回归/测试数据/环境/flake/harness 已知问题），未恢复基线前不开始相同数据的手工写操作。
4. **基础设施手工**：INFRA → UI → SC。
5. **纯前端手工**：CSB/CSA/AAD/PAE/FXB/OUB/PLG/PCF/CPG，再 SCF（先校验失败分支，后生成/编译/单测，最后清理生成物）。
6. **连接类只读**：EDB/EMV/SOL/OSV/BRI/SRV/DQT/RAC/PMD/BUH/ALV/FSV 只读部分。
7. **写操作最后**：WRM Publish → UAA 角色回环 → RSA 共享回环 → SRC/FSV 写项；每个工具完成立即恢复，不积压。
8. **非功能与回归**：第 6、7 章；结束复查所有基线与 SCF 生成物清理。

### 8.2 通过标准

* `pnpm build` 成功；`node tests/run-all.mjs` 退出码 0（有效凭据下）。
* 26 个工具全部有用例执行记录，无未说明的遗漏模块；NF、REG 全部适用项已执行。
* 自动化失败均已分类；flake 有单跑复验记录；14-16 已知 harness 问题未被误报为产品回归。
* P0/P1 缺陷为 0；P2 已修复或有明确批准的处置结论；P3 完整记录。
* 所有真实写操作恢复基线；SCF 本地生成物全部清理；证据与文档无敏感信息。

### 8.3 缺陷分级

|级别|定义|示例|
|-|-|-|
|P0|数据破坏、越权、秘密泄露、危险路径写入、覆盖既有文件、核心应用不可用|凭据明文渲染、脚手架写入系统目录、共享误删他人权限|
|P1|核心模块功能失败、写后无法恢复、主要连接机制不可用、生成解决方案不可编译|矩阵截断、一键重连失效、Publish 报错|
|P2|单项功能错误、异常处理错误、状态串用、有变通方案|切换实体残留旧结果、错误提示泛化|
|P3|文案、轻微布局、非阻断性可访问性或体验问题|徽章颜色、截断样式|

### 8.4 flake 与阻塞处理

* 05-environment 失败：保留日志 → 单跑复验 → 通过则标记"已知 flake，复验通过"；持续失败或伴随其他字段异常按正式缺陷处理。
* SCF-09 所需 nuget/MSBuild/vstest 不可用：记"阻塞"并注明环境原因，不得记"通过"或"不适用"。
* 中国云环境不可用：INFRA-06 记"不适用"并注明，其余用例不因此跳过。
* 不得通过删除失败用例、修改预期或隐瞒日志获得"通过"。

\---

## 9\. 附录

### 9.1 工具 × 分组 × 路由 × 后端依赖 × 用例映射

|分组|工具|前端路由|连接要求|后端依赖|用例编号|
|-|-|-|-|-|-|
|Code Generators|Plugin Generator|/tools/plugin-generator|可选（元数据下拉）|metadata（可选）|PLG-01\~05|
|Code Generators|PCF Generator|/tools/pcf-generator|无|无|PCF-01\~04|
|Code Generators|Custom Page Generator|/tools/custom-page-generator|可选|metadata（可选）|CPG-01\~03|
|Code Generators|Connection String Builder|/tools/connection-string-builder|无|无|CSB-01\~04|
|Code Generators|Connection String Analyzer|/tools/connection-string-analyzer|无|无（纯前端解析）|CSA-01\~04|
|Code Generators|Azure AD Config Checker|/tools/azure-ad-config-checker|无|无（浏览器直连 Microsoft 端点）|AAD-01\~05|
|Code Generators|Plugin Scaffolder|/tools/plugin-project-scaffolder|无|/api/scaffold（本地文件写入）|SCF-01\~10|
|Query \& Data|FetchXML Builder|/tools/fetchxml-builder|可选（执行需连接）|metadata / data|FXB-01\~08|
|Query \& Data|OData URL Builder|/tools/odata-url-builder|可选|metadata（可选）|OUB-01\~06|
|Query \& Data|Data Query|/tools/data-query|必须|metadata / data|DQT-01\~05|
|Query \& Data|Power Automate Expressions|/tools/power-automate-expressions|无|无|PAE-01\~05|
|Environment|Dashboard|/tools/environment-dashboard|必须|environment|EDB-01\~04|
|Environment|Metadata Viewer|/tools/metadata-viewer|必须|metadata|EMV-01\~05|
|Environment|Solution Manager|/tools/solution-manager|必须|solutions|SOL-01\~04|
|Environment|Option Set Viewer|/tools/option-set-viewer|必须|optionsets|OSV-01\~04|
|Environment|Web Resources|/tools/web-resource-manager|必须|webresources（含 Publish 写）|WRM-01\~05|
|Environment|Business Rules|/tools/business-rule-inspector|必须|businessrules|BRI-01\~04|
|Environment|BU Hierarchy|/tools/business-unit-hierarchy|必须|businessunit|BUH-01\~03|
|Environment|Audit Log Viewer|/tools/audit-log-viewer|必须|audit|ALV-01\~04|
|Security|Security Roles|/tools/security-role-viewer|必须|security|SRV-01\~04|
|Security|User Access|/tools/user-access-analyzer|必须|security（含角色写）|UAA-01\~04|
|Security|Record Access|/tools/record-access-checker|必须|recordaccess / environment|RAC-01\~04|
|Security|Sharing Auditor|/tools/record-sharing-auditor|必须|recordaccess（含共享写）|RSA-01\~05|
|Security|Role Compare|/tools/security-role-compare|必须|security（含 add-privileges 写）|SRC-01\~04|
|Security|Field Security|/tools/field-security-viewer|必须|fieldsecurity（含成员写）|FSV-01\~04|
|Security|Permission Diagnostic|/tools/permission-diagnostic|必须|permission / security|PMD-01\~03|

基础设施用例：INFRA-01\~08、SC-01\~12、UI-01\~09、MC-01\~28；非功能 NF-01\~10；回归 REG-01\~26。

### 9.2 历史执行摘要（2026-11-18）

> 本轮执行真实沙箱自动化、生产构建、浏览器核心路径与 SCF 本地编译。以下是模块组级结果，\*\*不等于 149 个手工用例已逐项全部完成\*\*；未逐项执行的异常注入、视觉细节和备用数据场景仍按各用例的"未执行"状态处理。

|范围|实际结果|结论/限制|
|-|-|-|
|`pnpm build`|退出码 0，真实 `tsc -b` 与 Vite 构建通过|通过|
|`node tests/run-all.mjs`|29 个套件，**175 passed / 0 failed / 0 skipped**（API 83 + 源码契约 92）|通过；含角色、共享、Web Resource 等写操作及逆向恢复|
|INFRA / SC / UI|首页重定向、4 组 26 入口、未连接拦截、Client Secret 连接、刷新状态、保存/重连/prefill/删除、损坏存储容错、10 条 LRU、存储异常静默均实际验证|核心路径通过；错误凭据在旧令牌未过期时暴露 BUG-2026-001；Username/Password 本轮未重新执行成功连接|
|10 个纯前端工具|连接串生成/解析、AAD 检查、表达式求值、FetchXML/OData、Plugin/PCF/Custom Page、Scaffolder 核心路径均执行|PCF 页签与 SVG 问题见 BUG-2026-002、BUG-2026-005|
|SCF-09 本地解决方案|UI 生成 3 项目/43 文件；重复生成拒绝覆盖；NuGet 还原 26 包；MSBuild 成功；vstest **2/2 通过**|通过；生成目录、packages/bin/obj 已清理|
|EMV / SOL / DQT / EDB / OSV|实体与 462 个 account 属性、解决方案组件、contact 查询 3 条、仪表盘四卡、全局选项集详情均返回|通过；DQT 首次在元数据未就绪时查询暴露 BUG-2026-003，后续正确请求 `contacts`|
|BRI / ALV|account 无业务规则、默认审计查询无日志，均显示对应空状态且无白屏|空数据路径通过；规则详情/非空审计卡片未获得沙箱数据|
|WRM|5000 条列表、名称/类型筛选、JavaScript 按需源码预览与 Copy/Publish 控件正常|只读 UI 通过；未对非专用资源 Publish，真实发布回环由 API 自动化覆盖|
|SRV|前两次 `roles` 请求 `ECONNRESET`，第三次返回 335 行；System Administrator 过滤后 8 个 Org 徽章|flake 复验通过|
|UAA / RAC / FSV / PMD / BUH|用户档案与三类角色页签、记录 8 项权限、字段安全 Profile 详情、权限诊断四来源、BU 树与统计均返回|核心只读路径通过；写回环由 API 自动化覆盖|
|SRC|首次权限对比请求瞬断，第二次返回 Only A/Only B/Depth Different/Identical 四统计卡|flake 复验通过|
|RSA|元数据和记录搜索多次返回 500；页面仅显示 `No matches`，共享列表浏览器流程未完成|**环境阻断 + BUG-2026-004**；共享/修改/撤销 API 自动化已通过，待环境稳定后只重跑 RSA-01\~05|
|清理|后端 disconnect 返回 200；`d365\_saved\_connections` 与 `d365\_connection` 已删除；SCF 临时产物已删除|通过；自动化写操作按套件恢复基线|

### 9.2.1 历史缺陷修复复验（2026-11-18 第二轮）

> 本轮按修复计划实施 5 个缺陷修复，并完成自动化与真实浏览器复验。浏览器验收通过 Chrome DevTools Protocol 驱动\*\*真实鼠标事件\*\*并采集\*\*真实控制台日志\*\*，未引入任何测试依赖。

|缺陷|修复要点|复验证据|状态|
|-|-|-|-|
|BUG-2026-001 (P1)|两个连接方法改为局部 credential 直接 `getToken()`，取令牌成功后才一次性提交 credential / environmentUrl / accessToken / tokenExpiry|`01-connection` 新增回归用例通过；浏览器：有效连接 → 清掉标签页状态（后端仍持令牌）→ 保存环境回填 + 错误密钥 → 弹窗报 AADSTS7000215、弹窗不关闭、`d365\_saved\_connections` 未被新增或覆盖、`/status` 与原环境一致、`/metadata/entities` 仍 200；断开后同一错误密钥同样失败；有效密钥重连成功|Fixed / Verified|
|BUG-2026-004 (P2)|`AsyncSearchSelect` 增加 error / retryKey 状态与 loading→error→empty→options 渲染优先级；RSA 消费 `entitiesError`|注入 500：显示错误 + Retry（不显示 `No matches`）；Retry 恢复 20 条选项；真实空结果仍为 `No matches`；慢请求 1.8s 后返回不覆盖新结果；RSA 元数据失败上屏、记录搜索禁用并提示 `Entity metadata unavailable`；record-search 500 后 Retry 恢复 10 条记录|Fixed / Verified|
|BUG-2026-003 (P2)|只允许元数据 `EntitySetName`；入口守卫 + 按钮禁用；元数据错误独立状态；补充加载提示|元数据 pending / rejected 时 Query 禁用且**不发出** `/api/dataverse/data/\*` 请求（Network 计数 0）；account → `/data/accounts`、contact → `/data/contacts`，无单数回退；`$top=2` 只返回 2 行；无 nextLink 时 Load More 正确隐藏|Fixed / Verified|
|BUG-2026-002 (P2)|响应式单/双列 grid（`minmax(0,1fr)`）+ Generated Files Card `min-w-0`|1024 / 1280 / 1440 三档宽度下用真实鼠标依次点击 4 个页签：选中态与面板内容全部正确、页签互不重叠、无横向滚动；关闭 React wrapper 后 3 个页签可用，重新开启后 activeTab 不空白|Fixed / Verified|
|BUG-2026-005 (P3)|补齐 IconPlugin 末端 `c` 段缺失坐标（72 个数字 = 12 组 × 6）|契约测试校验全部 SVG 命令参数数量；浏览器：页面 35 个 `path` 的 `getTotalLength()` 均 > 0（侧栏 IconPlugin 7140），控制台无 `<path> Expected number`|Fixed / Verified|

自动化与构建：

* `pnpm build` 退出码 0（真实 `tsc -b` + Vite 构建）。
* `node tests/run-all.mjs` → **180 passed / 1 failed / 0 skipped**（新增 6 个用例：01 连接回归 1 个、15 PCF 契约 2 个、18 DataQuery / AsyncSearchSelect / RSA 契约 3 个）。唯一失败为 `09 - Security Roles` 的角色列表请求超时；单独重跑 `node tests/api/09-security.test.mjs` → **4/4 通过**，判定为已知环境间歇性 ECONNRESET flake，非代码回归。
* RSA-01\~05 浏览器回环补完：选 account 实体与记录 → 共享列表（0 条）→ 新增共享（Read）→ 编辑为 Read+Write → 撤销并恢复基线（0 条）。
* 共享组件冒烟：UAA（20 条）、RAC（20 条 + 输入过滤）成功；PMD 在环境 500 时正确显示错误而非 `No matches`；FSV 成员搜索位于"选中配置文件后打开的对话框"内，本轮未执行；RSA 团队搜索受环境冷查询时延（实测单次可达 20–60 秒）影响未单独跑通，但 `/security/teams` 接口实测 200 / 5 条。

未纳入本轮修复的既有行为（仅记录，未改动）：

* PCF 页在 activeTab 停留在 `Component.tsx` 时关闭 React wrapper，面板会短暂空白，点任一页签即恢复；属既有受控 activeTab 行为，本轮按要求未改动该逻辑。
* `$top` 小于 5000 时环境不返回 `@odata.nextLink`，因此该路径下 Load More 不出现；非本次改动引入。

### 9.2.2 元数据缓存改造历史验证（2026-11-20）

> 以下为改造提交时的历史记录，**不是本轮 MC 手工用例的执行结果**。

|范围|历史结果|限制|
|-|-|-|
|`pnpm build`|通过|只证明构建与类型检查|
|缓存桩脚本|前端 16 条、服务端 16 条通过；包含清空后迟到写回、并发只回源一次|临时桩脚本，不是持久自动化套件|
|`node tests/run-all.mjs`（无凭据）|126 passed / 7 failed / 61 skipped|7 个失败来自 API 14-16 既有 `requiresConnection` 参数位置问题|
|API 18|5 个用例均要求有效连接|无凭据时应 skipped，不能与 tools 21 的 8 条离线通过合并为“13 条通过”|
|真实环境全量 + 浏览器刷新|未完成|本轮重新执行，结果见 9.2.3|

### 9.2.3 本轮执行摘要（2026-11-20 元数据缓存专项）

> 执行环境为 `<沙箱A>`；只使用本地被 git 忽略的 `tests/config.local.mjs` 凭据。本轮按用户要求只记录问题，未修改源码或测试代码。

|范围|实际结果|结论/限制|
|-|-|-|
|`pnpm build`|退出码 0；`tsc -b` + Vite 构建通过|通过；仅有 chunk >500 kB 警告|
|`node tests/run-all.mjs`|**169 passed / 25 failed / 0 skipped**（194 总数）|25 项均伴随 Dataverse 上游 TLS 断开或 502；未取得全绿结论|
|源码契约 tools/10-21|**105/105 通过**|离线契约通过，不代表真实缓存时序已全部验证|
|API 03-14 隔离复跑|部分恢复：05、07 全绿；06 仅剩 1 项网络失败；03/08 各 1 项；04/09/10/11/12/13/14 仍受上游阻断|同一用例多次结果不同，判定为环境抖动，不将 25 项失败直接登记为产品缺陷|
|API 18 缓存套件|多次单跑分别为 1/5、3/5、4/5；带重试的手工验证通过 MISS→HIT、limit 切片、字段 MISS→HIT、清空后 MISS|套件本身受上游阻断，未取得稳定 5/5；核心缓存行为在成功响应时符合预期|
|浏览器 12 页暖缓存|12 页均无 ConnectionGuard/页面错误；实体请求均为 `X-Cache: HIT`|暖缓存复用通过；未逐页执行刷新和业务专属完整路径|
|全局刷新成功|按钮出现；点击后 disabled + spinner；DELETE 200；显示 `Metadata refreshed <time>`；MetadataViewer 与 BusinessRuleInspector 均观察到后续实体 GET|部分通过；后续 GET 因上游慢请求长期 pending，服务端新数据未确认|
|刷新双击/失败|双击只发出 1 个 DELETE；注入 DELETE 失败后按钮恢复、显示 `Failed to fetch`；再次刷新可清除错误并显示时间|通过（前端行为）；服务端缓存是否残留受失败注入限制，未验证|
|MetadataViewer 竞态|延迟 account 字段、先返回 contact 后返回 account；标题保持 `Attributes: contact`，表格却显示 `account_synthetic_attribute`|**失败，已登记 BUG-2026-006**|
|未完成项|TTL 10 分钟边界、前端/服务端 LRU 60、真实并发、环境 A/B、迟到响应、link-entity epoch、DataQuery 守卫全路径、China 云|记“阻塞/未执行”，不得以源码契约替代|

测试基建观察：测试请求层只重试包含 `ECONNRESET`/`aborted`/`ETIMEDOUT`/`network_error` 的 500，本轮大量 `Client network socket disconnected before secure TLS connection was established` 与 `502 upstream connect failed` 未被自动重试，导致同一套件重复运行结果波动。该项登记为测试基建问题，不修改测试代码。

### 9.2.4 修复后复验摘要（2026-11-21）

|范围|结果|结论|
|-|-|-|
|`pnpm build`|退出码 0|通过|
|tools/21|10/10|通过；新增迟到响应守卫与 link-entity epoch 契约|
|tools/22|4/4|通过；瞬时签名、幂等重试、blocked 分类有效|
|tools/10-22|111/111|通过|
|API 18|5/5|通过|
|MC-07 浏览器|标题 `Attributes: contact`，表格为 `contact_late_guard`，spinner=0|通过|
|MC-22 浏览器|刷新前/后各发出一次 contact attributes 请求，刷新后 From 选项为 `contact_after_refresh`|通过|
|全量 `node tests/run-all.mjs`|**187 passed / 13 failed / 0 skipped**|未全绿；报告初始为 product 4 / env-blocked 9|
|补充 timeout 签名后隔离复跑|09、12 全部转为 env-blocked；剩余 product failure 仅 06 的 optionset 空结果|产品失败收敛为 1 项新登记问题|
|06-optionset|已知 account 有时返回 200 空字段；重连后直接请求可返回 57 个 picklist（含 industrycode）|登记 BUG-2026-007，未在本轮修改服务端|

结论：BUG-2026-006、RISK-MC-02、TI-2026-001 的修复通过各自门禁；全量仍受上游环境阻塞，且新发现 option set 空结果问题，不能记全绿。

### 9.2.5 BUG-2026-007 修复复验（2026-11-21）

|范围|结果|结论|
|-|-|-|
|`pnpm build`|退出码 0|通过|
|06-optionset|4/4|通过|
|account 连续抽查|2 次完整 57 字段（含 industrycode）；2 次明确 500；0 次 200 空/缺字段|通过|
|已知实体空字段|返回 503 + `retryable: true`；不再返回 200 空数组|通过|
|OptionSetViewer Retry|第一次 503 显示错误和 Retry；点击后第二次请求成功显示 industrycode|通过|
|unknown entity|200 空列表|既有契约保持|
|错误处理|已知实体任一 cast 为网络/5xx 时返回 500；仅明确的 cast 不支持才允许部分结果|通过|

结论：BUG-2026-007 已关闭；原先全量中的 1 项产品失败不再复现。剩余失败均为上游环境阻塞，需稳定网络后重跑全量确认。

### 9.3 本轮用例执行记录

|用例编号|执行日期|执行人|环境（脱敏）|结果（通过/失败/阻塞/不适用/flake复验通过）|缺陷编号|备注|
|-|-|-|-|-|-|-|
|BUILD|2026-11-20|WorkBuddy|沙箱 A|通过|-|`pnpm build` 退出码 0|
|AUTO-TOOLS|2026-11-20|WorkBuddy|离线|通过|-|tools/10-21 共 105/105|
|AUTO-API|2026-11-20|WorkBuddy|沙箱 A|部分通过|-|全量 API 64/89；25 项失败均为上游 TLS/502，隔离复跑不完全稳定|
|MC-01|2026-11-20|WorkBuddy|沙箱 A|通过|-|12 页暖缓存 HIT，无 Guard/错误|
|MC-02|2026-11-20|WorkBuddy|沙箱 A|阻塞|-|缺少可控时钟，未验证 10 分钟边界与 SWR|
|MC-03|2026-11-20|WorkBuddy|沙箱 A|阻塞|-|上游不稳定，真实并发结果不可判定；仅源码契约通过|
|MC-04|2026-11-20|WorkBuddy|沙箱 A|阻塞|-|未执行 60/61 实体 LRU 实测|
|MC-05|2026-11-20|WorkBuddy|沙箱 A|未执行|-|未注入实体/字段 GET 失败恢复|
|MC-06|2026-11-20|WorkBuddy|沙箱 A|阻塞|-|缺少可控迟到响应注入|
|MC-07|2026-11-20|WorkBuddy|沙箱 A|**失败**|BUG-2026-006|MetadataViewer 旧字段覆盖新实体 UI|
|MC-08|2026-11-20|WorkBuddy|沙箱 A|通过|-|手工 MISS→HIT、统计与 401 契约；套件单跑受环境阻断|
|MC-09|2026-11-20|WorkBuddy|沙箱 A|未执行|-|未等待/模拟 10 分钟服务端 TTL|
|MC-10|2026-11-20|WorkBuddy|沙箱 A|未执行|-|未取得稳定并发响应|
|MC-11|2026-11-20|WorkBuddy|沙箱 A|未执行|-|未执行服务端 60/61 LRU|
|MC-12|2026-11-20|WorkBuddy|沙箱 A|未执行|-|未注入上游失败后恢复|
|MC-13|2026-11-20|WorkBuddy|沙箱 A|通过|-|DELETE 返回 cleared=true，统计清零，下一请求 MISS|
|MC-14|2026-11-20|WorkBuddy|沙箱 A|未执行|-|RISK-MC-01 仍未验证|
|MC-15|2026-11-20|WorkBuddy|沙箱 A|通过|-|limit=10/300 共享缓存、total=2809、排序正确|
|MC-16|2026-11-20|WorkBuddy|沙箱 A|阻塞|-|未提供第二沙箱，无法验证环境隔离|
|MC-17|2026-11-20|WorkBuddy|沙箱 A|通过|-|暖缓存→断开 401→重连首请求 MISS→再次 HIT|
|MC-18|2026-11-20|WorkBuddy|沙箱 A|部分通过|-|spinner、DELETE、时间、后续 GET 已见；上游 pending 未确认新数据|
|MC-19|2026-11-20|WorkBuddy|沙箱 A|通过|-|延迟 DELETE 下双击仅 1 次请求|
|MC-20|2026-11-20|WorkBuddy|沙箱 A|通过|-|失败后显示错误、按钮恢复；再次刷新成功|
|MC-21|2026-11-20|WorkBuddy|沙箱 A|部分通过|-|12 页暖缓存通过；仅代表页执行刷新，未逐页验证|
|MC-22|2026-11-20|WorkBuddy|沙箱 A|阻塞|-|未完成 link-entity 展开与刷新时序，RISK-MC-02 保留|
|MC-23|2026-11-20|WorkBuddy|沙箱 A|部分通过|-|自动化显式 entitySetName 曾通过；手工复验 accounts 连续 502|
|MC-24|2026-11-20|WorkBuddy|沙箱 A|通过|-|未传 entitySetName 的 contact 回退返回 200|
|MC-25|2026-11-20|WorkBuddy|沙箱 A|部分通过|-|回退行为可用；未证明暖缓存零额外回源|
|MC-26|2026-11-20|WorkBuddy|沙箱 A|部分通过|-|缺 fetchXml=400；未知实体被上游 TLS 阻断|
|MC-27|2026-11-20|WorkBuddy|沙箱 A|未执行|-|未执行 DataQuery 异常注入与 Network 计数|
|MC-28|2026-11-20|WorkBuddy|沙箱 A|不适用|-|当前为公有云域名，无中国云环境；业务结果隔离未完整执行|

### 9.4 本轮缺陷记录

|缺陷编号|级别|关联用例|现象与复现|预期/实际|状态|
|-|-|-|-|-|-|
|BUG-2026-001|P1|INFRA-04 / SC-07|后端已有未过期令牌时，用相同环境的新错误 Client Secret 连接；`ensureToken()` 复用旧缓存，连接被误判成功且写入历史。断开后重试同一错误密钥则正确返回 AADSTS7000215|预期每次新连接都验证新凭据；实际未调用新 credential 取令牌|**Fixed / Verified**（见 9.2.1）|
|BUG-2026-002|P2|PCF-04 / REG-01|Generated Files 区域高度被压缩，Manifest/Index/Component/CSS 页签互相遮挡，真实指针点击报 covered；键盘 Enter 可切换|预期页签均可鼠标点击；实际指针目标被覆盖|**Fixed / Verified**（见 9.2.1）|
|BUG-2026-003|P2|DQT-01 / NF-03|元数据尚未加载或加载失败时 Query 仍可用，`EntitySetName` 查找失败回退为 LogicalName，默认请求单数 `account` 并返回 404；元数据就绪后使用 `contacts` 成功|预期查询等待元数据或禁用并提示；实际可发出无效实体集请求|**Fixed / Verified**（见 9.2.1）|
|BUG-2026-004|P2|RSA-01 / RSA-05 / NF-03|元数据 GET 或 record-search POST 返回 500 时，页面/异步下拉只显示 `No matches`，没有错误提示；Network 可确认真实 500|预期展示可重试的真实错误；实际表现为无匹配空状态|**Fixed / Verified**（见 9.2.1）|
|BUG-2026-005|P3|PCF-04 / UI-05|PCF 页面控制台出现 SVG `<path>` 数字格式错误（`Expected number`），生成结果仍可显示|预期无 SVG 控制台错误；实际有畸形 path 数据|**Fixed / Verified**（见 9.2.1）|
|BUG-2026-006|P2|MC-07 / EMV-04|MetadataViewer 先点击 account 并延迟字段响应，再点击 contact；contact 先返回、account 后返回。最终标题为 `Attributes: contact`，表格却显示 `account_synthetic_attribute`。代码中 `loadAttributes` 无请求序号/cancelled 守卫，迟到响应直接 `setAttributes`|预期字段区始终属于当前选中实体；实际旧实体字段覆盖新实体|**Fixed / Verified**（2026-11-21，tools/21 10/10 + MC-07 浏览器）|
|TI-2026-001|P2（测试基建）|AUTO-API|全量 25 项失败中大量错误为 `Client network socket disconnected before secure TLS connection was established` / `502 upstream connect failed`；`tests/lib/api.mjs` 的瞬时错误重试仅匹配 ECONNRESET/aborted/ETIMEDOUT/network_error|预期瞬时上游故障被统一重试或明确标记环境阻塞；实际直接计为用例失败，重复运行结果波动|**Fixed / Verified**（2026-11-21，tools/22 4/4；环境阻塞与产品失败已分列）|
|BUG-2026-007|P2|06-optionset / MC-08|已知实体 account 的 `/optionsets/entity/account` 偶发返回 200 空数组；同一环境重连后直接请求可返回 57 个 picklist（含 industrycode）。路由对两路 cast 查询都 `.catch(() => [])`，上游失败被静默吞掉|预期已知实体失败时返回错误或可重试信号；实际伪装成"无选项集字段"|**Fixed / Verified**（2026-11-21，06 套件 4/4；空字段返回 503 + Retry，浏览器重试成功）|

### 9.5 历史写操作基线与清理检查表（2026-11-18）

|项|基线内容|恢复验证|状态|
|-|-|-|-|
|测试用户角色|原始 Direct Roles 列表|API 分配/撤销回环通过，列表恢复|通过（自动化）|
|测试记录共享|原始 Shared Principals 列表|API Grant/Modify/Revoke 回环通过，列表恢复|通过（自动化）|
|测试 Web Resource|原始内容与 Modified 时间|API Publish 后内容未变|通过（自动化）|
|Role B 权限（SRC-04）|原始权限集合|API 增量添加后按基线恢复|通过（自动化）|
|Field Security 成员|原始成员列表|API 增删回环后一致|通过（自动化）|
|SCF 生成物|测试根目录初始文件清单|生成目录及 packages/bin/obj 已删除|通过|
|浏览器测试数据|localStorage/sessionStorage 测试记录|两个测试键均已删除，后端已断开|通过|

### 9.6 修复执行结果与剩余计划

> 2026-11-21：第 1～3 项与 BUG-2026-007 已完成并通过 build、tools/21、tools/22、API 18、06-optionset 及 MC-07/MC-22 复验；第 4～6 项仍待处理。

|顺序|问题|改动范围|建议方案|验证方式|
|-|-|-|-|-|
|1|已完成：BUG-2026-006 MetadataViewer 迟到字段响应覆盖当前实体|`client/src/pages/tools/MetadataViewer.tsx`|已增加两个独立请求序号，成功/失败/loading 均只允许最新请求更新|MC-07 已通过：标题 contact、表格 contact_late_guard、spinner=0|
|2|已完成：RISK-MC-02 FetchXmlBuilder link-entity 刷新失效|`client/src/pages/tools/FetchXmlBuilder.tsx`|已订阅 metadataEpoch，刷新时清空 linkAttrCache 并丢弃旧响应|MC-22 已通过：刷新后重新请求并显示 contact_after_refresh|
|3|已完成：TI-2026-001 TLS/502 误报与写操作重试风险|`tests/lib/retryPolicy.mjs`、`tests/lib/api.mjs`、`tests/lib/harness.mjs`、`tests/run-all.mjs`|已增加瞬时签名、幂等重试与 blocked 分类；写操作不自动重试|tools/22 4/4；全量报告分离 product failures 与 env-blocked|
|4|缓存高风险时序缺少自动化|`tests/tools/21-metadata-cache.test.mjs` 或新增受控桩测试|用可控时钟和 Promise 桩覆盖 TTL、SWR、LRU 60/61、并发去重、清空后迟到写回；不引入生产依赖|执行 MC-02～MC-06、MC-09～MC-12、MC-14，确认缓存内容与 UI 判定分离|
|5|跨环境与 China 云未验证|手工环境准备|提供第二沙箱与中国云环境后执行 MC-16、MC-28；当前不得标记通过|环境 A/B 无串数据；EntityDefinitions 不带 `$top/$orderby`|
|6|全量上游稳定性|测试环境/网络|在稳定网络窗口重跑 API 失败套件；如仍出现同类 TLS/502，转环境工单而非产品修复|API 03-14 与 API 18 连续两轮全绿，且无未分类失败|
|7|已完成：BUG-2026-007 known entity option set 空结果|`server/src/routes/optionset.ts`、`client/src/pages/tools/OptionSetViewer.tsx`|已知实体任一 cast 为网络/5xx 时返回 500；空字段返回 503；未知实体保持 200 空列表；前端提供 Retry|06-optionset 4/4；空字段 503 + Retry；浏览器重试后显示 industrycode|

发布前复验顺序：`pnpm build` → tools/21 → tools/22 → API 18 → MC-07 → MC-22 → 修复 BUG-2026-007 → 稳定环境全量。全量与真实写操作仍需用户明确授权。

