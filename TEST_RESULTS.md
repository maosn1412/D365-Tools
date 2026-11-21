# D365 CRM Tools 测试结果

> 测试日期：2026-11-20 21:54 ～ 23:40；修复复验：2026-11-21 12:00 ～ 14:30
> 测试版本：元数据缓存改造（提交 `6d09183`），修复 BUG-2026-006 / RISK-MC-02 / TI-2026-001
> 测试环境：`<沙箱A>`，凭据仅保存在本地被 git 忽略的测试配置中
> 测试依据：`TEST_PLAN.md` v3.2，重点覆盖 MC-01～MC-28、12 页元数据缓存矩阵及既有自动化套件
> 当前结论：**BUG-2026-006、RISK-MC-02、TI-2026-001、BUG-2026-007 均已修复验证**；全量原始 13 项失败中的有效产品失败已归零，其余为上游环境阻塞，尚未在稳定网络下重跑全量

---

## 1. 执行摘要

| 项目 | 结果 | 结论 |
|-|-|-|
| `pnpm build` | 退出码 0 | 通过 |
| 全量自动化 `node tests/run-all.mjs` | **169 passed / 25 failed / 0 skipped** | 未通过 |
| 源码契约 `tools/10-21` | **105/105 通过** | 通过 |
| API 自动化 00-18 | 64/89 通过，25 失败 | 受上游 TLS/502 阻塞，未取得全绿 |
| 浏览器 12 页暖缓存 | 12/12 页实体请求 `X-Cache: HIT`，无连接拦截或页面错误 | 通过 |
| 全局刷新 | spinner、禁用、DELETE、刷新时间、后续 GET 均出现 | 部分通过 |
| 刷新异常恢复 | 双击只发一次 DELETE；失败后提示错误并可再次刷新成功 | 通过 |
| 元数据缓存 API | MISS→HIT、limit 切片、字段缓存、清空后 MISS 均通过 | 通过 |
| 新发现问题 | BUG-2026-006（P2）、TI-2026-001（P2，测试基建） | 均已在修复轮关闭，见 1.1 |

### 1.1 修复复验摘要（2026-11-21）

| 项目 | 结果 | 结论 |
|-|-|-|
| `pnpm build` | 退出码 0 | 通过 |
| 静态基线 | 32 套件 / 200 用例（API 89 + tools 111） | 新增 tools/22，tools/21 增至 10 例 |
| tools/21 | 10/10 | 通过；新增迟到响应与 link-entity epoch 契约 |
| tools/22 | 4/4 | 通过；瞬时签名、幂等重试、blocked 分类 |
| tools/10-22 | **111/111** | 通过 |
| API 18 | **5/5** | 通过 |
| MC-07 浏览器 | 标题 contact、表格 contact_late_guard、spinner=0 | 通过 |
| MC-22 浏览器 | 刷新前/后各一次 contact attributes 请求；刷新后显示 contact_after_refresh | 通过 |
| 全量自动化 | **187 passed / 13 failed / 0 skipped** | 原报告 product 4 / env-blocked 9 |
| timeout 签名补充后隔离复跑 | 09、12 转为 env-blocked；剩余产品失败仅 06 optionset | 06 已于后续修复，见 4.3 |
| 06-optionset 修复复验 | 4/4；account 抽查只返回完整 57 字段或明确 500；空字段返回 503 + Retry | 通过，0 次 200 空结果 |

全量 194 项中的 25 项失败均伴随 Dataverse 上游访问异常，典型错误为：

- `Client network socket disconnected before secure TLS connection was established`
- `502 upstream connect failed: connection timed out`

同一套件隔离复跑会出现不同结果，05、07 等套件可恢复全绿，因此未将这些环境性失败直接登记为产品回归。

---

## 2. 自动化测试结果

### 2.1 全量失败分布

| 套件 | 通过 / 失败 | 主要现象 |
|-|-|-|
| 18 - Metadata Cache | 4 / 1 | 部分请求被上游 TLS 阻断，未取得稳定 HIT |
| 03 - Solutions | 1 / 2 | `solutions` 上游 TLS 断开 |
| 04 - Data Query | 3 / 3 | accounts/contact 查询或 EntityDefinitions 回退被阻断 |
| 05 - Environment | 1 / 1 | `/stats` 的 entities 计数未取得有效结果 |
| 06 - Option Sets | 3 / 1 | GlobalOptionSetDefinitions 上游 TLS 断开 |
| 07 - Business Rules | 2 / 2 | `workflows` 上游 TLS 断开 |
| 08 - Web Resources | 3 / 1 | webresourceset 列表上游 TLS 断开 |
| 09 - Security Roles | 1 / 3 | `roles` 上游 TLS 断开 |
| 10 - User Access | 3 / 3 | teams/users/角色回环被 502 或 TLS 阻断 |
| 11 - Record Access | 3 / 3 | WhoAmI、systemusers、共享回环被阻断 |
| 12 - Role Compare | 2 / 3 | roles、compare 被 502 或 TLS 阻断 |
| 13 - Field Security | 4 / 1 | fieldsecurityprofiles 上游 TLS 断开 |
| 14 - Permission Diagnostic | 2 / 1 | roles/teams 上游 TLS 断开 |

失败集中在“需要真实访问 Dataverse 的 API 套件”。源码契约 105 项全部通过，说明本轮缓存接入、页面引用和路由契约没有静态破坏。

### 2.2 隔离复跑

| 范围 | 复跑结果 | 判定 |
|-|-|-|
| 05-environment | 2/2 通过 | 环境抖动，非稳定产品回归 |
| 07-businessrule | 4/4 通过 | 环境抖动，非稳定产品回归 |
| 06-optionset | 3/4；此前失败项恢复 | account 选项集路径恢复，剩余 GlobalOptionSet 仍被 TLS 阻断 |
| 03、08、13、14 | 各剩 1 项失败 | 均伴随上游 TLS/502 |
| 04、09、10、11、12 | 多项持续失败 | 上游访问未稳定，不能判定产品通过或失败 |
| API 18 缓存套件 | 多次单跑为 1/5、3/5、4/5 | 套件本身受环境阻断，不能作为稳定回归结果 |

### 2.3 缓存核心行为手工验证

在单次成功响应下，使用带重试的请求核对：

| 场景 | 结果 |
|-|-|
| DELETE `/metadata/cache` | 200，`cleared=true` |
| 首次实体列表请求 | 200，`X-Cache: MISS`，total=2809 |
| 再次相同实体请求 | 200，`X-Cache: HIT` |
| `limit=10` 后请求 `limit=300` | HIT，返回 300 条，total 不变，LogicalName 排序正确 |
| account 字段首次/再次 | MISS → HIT，均 462 个字段 |
| 缓存统计 | hits=3、misses=2、entities.cached=true、字段缓存实体数=1 |
| 清空后再次请求 | 200，`X-Cache: MISS`；前两次重试遇 500，第三次成功 |
| 断开连接后请求元数据 | 401 |
| 重连后首次/再次请求 | MISS → HIT |

结论：核心缓存读写、统计、limit 切片、断开清理和重连失效符合预期；TTL、LRU、并发和迟到响应仍未完成行为级验证。

---

## 3. 浏览器验收结果

### 3.1 12 页暖缓存

以下页面均加载成功，无 ConnectionGuard 或页面级错误，实体请求均为 `X-Cache: HIT`：

1. BusinessRuleInspector
2. CustomPageGenerator
3. FieldSecurityViewer
4. OptionSetViewer
5. ODataUrlBuilder
6. PluginGenerator
7. RecordSharingAuditor
8. RecordAccessChecker
9. SecurityRoleViewer
10. DataQuery
11. FetchXmlBuilder
12. MetadataViewer

说明：
- FieldSecurityViewer 的 Profile 请求返回 200，但页面上仍可见 Loading 状态。
- SecurityRoleViewer 的角色矩阵受后端上游阻塞，未完成页面数据确认。
- 各页业务专属完整路径没有全部执行，本轮重点验证元数据缓存与刷新链路。

### 3.2 全局刷新

| 场景 | 观察结果 | 判定 |
|-|-|-|
| 点击刷新 | 按钮 disabled，spinner 出现，DELETE 返回 200 | 通过 |
| 成功状态 | 显示 `Metadata refreshed <time>` | 通过 |
| 刷新后重取 | MetadataViewer 与 BusinessRuleInspector 均观察到新的 `metadata/entities` GET | 部分通过；响应因上游慢请求长期 pending，未确认新数据 |
| 快速双击 | 仅发出 1 个 DELETE | 通过 |
| 注入 DELETE 失败 | 显示 `Failed to fetch`，按钮恢复，无永久 spinner | 通过 |
| 失败后再次刷新 | 错误清除，显示新的刷新时间 | 通过 |

### 3.3 12 页矩阵结论

| 页面 | 暖缓存 | 刷新重取 | 页面结果 |
|-|-|-|-|
| BusinessRuleInspector | 通过 | 代表页通过 | 规则列表可用 |
| CustomPageGenerator | 通过 | 未逐页执行 | 模板与实体下拉可用 |
| FieldSecurityViewer | 通过 | 未逐页执行 | Profile 加载较慢 |
| OptionSetViewer | 通过 | 未逐页执行 | 使用暖缓存，无实体请求 |
| ODataUrlBuilder | 通过 | 未逐页执行 | 无页面错误 |
| PluginGenerator | 通过 | 未逐页执行 | 无页面错误 |
| RecordSharingAuditor | 通过 | 未逐页执行 | 无页面错误 |
| RecordAccessChecker | 通过 | 未逐页执行 | 无页面错误 |
| SecurityRoleViewer | 通过 | 未逐页执行 | 角色数据受上游阻塞 |
| DataQuery | 通过 | 未逐页执行 | 未执行异常守卫注入 |
| FetchXmlBuilder | 通过 | 未逐页执行 | 回退查询 200，显式 accounts 遇 502 |
| MetadataViewer | 通过 | 代表页通过 | **发现切换竞态缺陷** |

---

## 4. 缺陷与风险

### 4.1 BUG-2026-006（P2，Fixed / Verified）

**模块：** MetadataViewer
**关联用例：** MC-07 / EMV-04

**复现步骤：**
1. 在 MetadataViewer 点击 account，延迟其字段接口响应。
2. 立即点击 contact，使 contact 字段先返回。
3. 再释放 account 的迟到响应。

**修复前实际结果：**
- 页面标题为 `Attributes: contact`
- 字段表显示 `account_synthetic_attribute`
- 当前实体与字段内容不一致

**修复方式：**
为 `loadEntities` / `loadAttributes` 增加独立请求序号；成功、失败和 loading 三个出口都只允许最新请求更新。

**修复后证据：**
tools/21 10/10；浏览器 MC-07 结果为标题 `Attributes: contact`、表格 `contact_late_guard`、spinner=0。

### 4.2 TI-2026-001（P2，测试基建，Fixed / Verified）

已新增 `tests/lib/retryPolicy.mjs` 并改造 `tests/lib/api.mjs`：

- 识别 TLS socket disconnected、502/503/504、timeout、ECONNRESET 等瞬时签名。
- GET/HEAD/OPTIONS 默认可重试；只读 POST 显式传 `{ idempotent: true }`。
- 写操作不自动重试，直接标记为环境阻塞。
- `run-all` 分开输出 `product failures` 与 `environment blocked`。

验证：tools/22 4/4；全量日志中 08 Publish 等写操作未出现自动重试，环境错误标记为 `⊘ blocked`。

### 4.3 BUG-2026-007（P2，Fixed / Verified）

**模块：** Option Set API
**关联用例：** 06-optionset / MC-08

已知实体 account 的 `/optionsets/entity/account` 偶发返回 200 空数组；同一环境重连后直接请求可返回 57 个 picklist（包含 industrycode）。

**原因：** 路由对两路 cast 查询均 `.catch(() => [])`，上游失败被静默吞掉，和“真的没有选项集字段”无法区分。

**修复：**
- 已知实体任一路为网络/5xx 失败时返回 500，不再返回部分或空字段。
- 仅当错误明确表示 cast 不支持且另一路成功时，允许部分结果。
- 已知实体返回空字段时返回 503 + `retryable: true`，前端显示错误和 Retry 按钮。
- 未知实体仍保持 200 空列表契约。

**验证：** 06-optionset 4/4；连续抽查 account 仅出现完整 57 字段或明确 500；浏览器首次 503 显示 Retry，点击后第二次请求成功显示 `industrycode`。

### 4.4 待验证风险

| 风险 | 当前状态 |
|-|-|
| FetchXmlBuilder 已展开的 link-entity 字段不响应刷新 epoch | **已修复**；MC-22 刷新后重新请求并显示新字段 |
| 服务端清空后，旧请求迟到写回缓存 | 未执行可控延迟注入 |
| TTL/SWR 边界 | 未执行可控时钟验证 |
| 前端/服务端 LRU 60/61 | 未执行 |
| 环境 A/B 隔离 | 缺少第二沙箱 |
| China 云 EntityDefinitions | 当前环境不是中国云，不适用 |

---

## 5. 未执行与阻塞

| 项目 | 状态 | 原因 |
|-|-|-|
| MC-02 TTL/SWR | 阻塞 | 缺少可控时钟 |
| MC-03 真实并发 | 阻塞 | 上游不稳定，结果不可判定 |
| MC-04 LRU 60/61 | 未执行 | 未做大规模实体字段请求 |
| MC-05 失败不缓存 | 未执行 | 未注入实体/字段读取失败 |
| MC-06 generation 防迟到写回 | 阻塞 | 缺少可控 Promise/延迟注入 |
| MC-09 服务端 TTL | 未执行 | 未等待或模拟 10 分钟 |
| MC-10 服务端并发 | 未执行 | 上游请求不稳定 |
| MC-11 服务端 LRU | 未执行 | 未执行 61 个实体字段集测试 |
| MC-12 服务端失败不缓存 | 未执行 | 未注入上游失败 |
| MC-14 服务端迟到响应 | 未执行 | 缺少受控时序 |
| MC-16 环境 A/B | 阻塞 | 未提供第二沙箱 |
| MC-27 DataQuery 异常守卫 | 未执行 | 未执行 Network 计数与异常注入 |
| MC-28 China 云 | 不适用 | 当前环境不是中国云 |

MC-07 与 MC-22 已在修复轮转为通过，不再列入未执行项。

---

## 6. 结论与后续计划

**结论：**
- BUG-2026-006、RISK-MC-02、TI-2026-001、BUG-2026-007 已修复并通过各自门禁。
- 构建通过，源码契约 111/111 通过。
- 元数据双层缓存的核心命中、清空、limit 切片、字段缓存和连接生命周期符合预期。
- 全量原始结果 187/13；其中 06 产品失败已修复，06 套件现为 4/4，有效产品失败归零。
- 其余失败均为上游 TLS/502/timeout 阻塞；因未在稳定网络下重跑全量，不能宣称全绿。

**后续计划：**
1. 在稳定网络窗口重跑全量，确认剩余 12～13 项均标记为环境阻塞且无产品失败。
2. 补跑 TTL、LRU、并发、环境 A/B、China 云与迟到响应用例。
3. 如环境持续不稳定，推进沙箱网络/网关排查，而不是继续扩大自动重试。

本轮未修改源码或测试代码；测试环境已断开，前后端和测试浏览器已停止。详细用例与修复计划见 `TEST_PLAN.md` 第 2.4、9.2.3、9.3、9.4、9.6 节。
