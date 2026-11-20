# D365 CRM Tools

面向 Dynamics 365 / Dataverse 开发者的本地 Web 工具集，包含 26 个开发者工具：代码脚手架、查询构造、环境元数据浏览和安全权限分析。

前端为 React SPA，后端是一个轻量 Express 服务，负责代持 Dataverse 访问令牌并转发 Web API 请求。凭据由你在界面上手动输入，运行时只保存在后端进程内存中，重启即失效；你连接过的环境（含凭据）由前端保存在本机浏览器 localStorage，用于一键重连，可随时逐条移除。

实体/字段元数据在各工具页之间共享一份缓存（前端内存 + 服务端 10 分钟 TTL），切换模块不会重复拉取实体列表；连接卡片上的刷新按钮会清空两层缓存并从环境重新读取，新建实体或字段后点它即可立即生效。

## 功能

### Code Generators（离线，无需连接环境）

|工具|说明|
|-|-|
|Plugin Generator|生成 D365 插件样板代码（`IPlugin` 实现）|
|PCF Generator|生成 PCF（PowerApps Component Framework）组件骨架文件|
|Custom Page Generator|生成自定义页面配置与 Power Fx 公式模板|
|Connection String Builder|按认证方式生成 D365 / Dataverse 连接字符串|
|Connection String Analyzer|粘贴连接字符串，解析结构、校验格式并提示常见配置问题|
|Azure AD Config Checker|校验 Azure AD 应用注册配置，检查项由浏览器直连公共端点完成|
|Plugin Scaffolder|初始化插件解决方案框架（共享框架项目 + 示例插件项目 + 单元测试项目）|

### Query \& Data

|工具|说明|
|-|-|
|FetchXML Builder|可视化拼装 FetchXML 查询|
|OData URL Builder|拼装 D365 Web API（OData v4）请求 URL 与查询选项|
|Data Query|查询并浏览已连接环境的实体记录（需连接）|
|Power Automate Expressions|实时测试和预览 Power Automate 表达式|

### Environment（均需连接环境）

|工具|说明|
|-|-|
|Dashboard|当前 Dataverse 环境概览|
|Metadata Viewer|浏览实体与字段元数据|
|Solution Manager|查看已安装解决方案及其组件|
|Option Set Viewer|查看全局/实体级选项集，可导出为 JSON、C# 枚举或 Power Fx 表|
|Web Resources|浏览、预览并发布 Web 资源|
|Business Rules|查看实体上的业务规则及其条件与动作|
|BU Hierarchy|可视化业务单元结构、用户、团队与角色分配|
|Audit Log Viewer|查询安全相关的审计日志事件|

### Security（均需连接环境）

|工具|说明|
|-|-|
|Security Roles|对比多个安全角色在某实体上的权限级别|
|User Access|查看用户的安全角色、团队归属与有效权限|
|Record Access|检查某用户对特定记录的实际权限（`RetrievePrincipalAccess`）|
|Sharing Auditor|查看记录共享给了谁，并可新增或撤销共享|
|Role Compare|并排比对两个安全角色的完整权限集|
|Field Security|查看字段安全配置文件、成员与受保护字段|
|Permission Diagnostic|诊断某个用户能否访问某实体/记录，汇总所有权限来源|

## 技术栈

* **前端**：React 18 + TypeScript 5.5 + Vite 5，Tailwind CSS 3 + Radix UI（shadcn 风格组件），zustand 状态管理，lucide-react 图标
* **后端**：Express 4 + TypeScript 5.5（开发期用 `tsx watch`），Axios + `@azure/identity` 获取令牌
* **包管理**：pnpm workspace（`client` / `server` 两个包，lockfile v9）

## 环境要求

* Node.js 18 及以上（测试脚本直接使用原生 `fetch`）
* pnpm（必须，脚本依赖 workspace `--filter`，npm/yarn 无法运行）
* 一个可访问的 D365 / Dataverse 环境（仅连接类功能需要）

## 快速开始

```bash
pnpm install
pnpm dev          # 同时启动前端与后端
```

* 前端：http://localhost:3000 （Vite 开发服务器，`/api` 代理到后端）
* 后端：http://localhost:3001 （Express，端口硬编码）

Windows 下也可以直接双击 `start\_service.bat`（在新窗口启动 `pnpm dev`，探测到 3000 端口就绪后自动打开浏览器），用 `stop\_service.bat` 结束占用 3000/3001 的进程。

其他脚本：

```bash
pnpm dev:client   # 只起前端
pnpm dev:server   # 只起后端
pnpm build        # 依次构建 client 和 server
```

## 连接 D365 环境

点击界面右上角的连接按钮，在弹窗中填写：

* **Environment URL**：如 `https://yourorg.crm.dynamics.com`；`.dynamics.cn` 结尾的地址会自动走 Azure China 认证端点
* **Tenant ID / Client ID**：Azure AD 应用注册信息
* **认证方式**：`clientSecret`（服务器端应用）或 `usernamePassword`（交互式用户）

后端用 `{environmentUrl}/.default` 作为令牌 scope，令牌与环境信息保存在进程内的单例中，不写数据库、不写磁盘、不写环境变量。断开连接或重启服务即清除。

### 一键重连已连接过的环境

连接成功后，该环境会被前端写入本浏览器的 `localStorage`（键 `d365\_saved\_connections`，最多 10 条，按最近使用淘汰）。再次打开连接弹窗时，列表出现在表单上方：

* 点一行即带着保存的凭据直接连接，无需再输入任何字段；列表只显示 URL、验证方式和账号/客户端 ID 前缀，密钥一律显示为掩码。
* 同一环境的 `clientSecret` 与 `usernamePassword` 各占一条，互不覆盖；重复连接同一条会更新其凭据与最近使用时间。
* 每行右侧：复制图标把该条填入下方表单（用于密钥轮换后就地修改），垃圾桶图标只删除本机记录，不影响当前连接。
* 记录存在浏览器 profile 里，不在仓库目录内，因此不会被 `git` 提交；后端依旧不落盘，重启服务或新开标签页后环境列表仍在。

## 测试

测试脚本零依赖，直接用 Node 运行，没有注册为根目录的 pnpm script：

```bash
node tests/run-all.mjs      # 跑全部
node tests/tools/12-fetchxml-builder.test.mjs   # 跑单个文件
```

分两类：

* **工具类单测**（`tests/tools/`）：纯前端逻辑，不需要任何凭据，直接跑。
* **API 集成测试**（`tests/api/`）：需要真实测试环境。先复制配置模板再填凭据：

```bash
  cp tests/config.example.mjs tests/config.local.mjs
  ```

  `tests/config.local.mjs` 已在 `.gitignore` 中，绝不会被提交。没有该文件时，API 测试只运行"未连接保护"一类无需凭据的用例，其余自动跳过。

## 项目结构

```
server/            Express 后端
  src/routes/        按 Dataverse 功能域拆分的 API 路由
  src/services/      连接与 Dataverse 调用封装
  src/middleware/    未连接时返回 401 的保护中间件
  templates/         代码脚手架模板
client/            React + Vite 前端
  src/pages/tools/   26 个工具页面
  src/components/    布局与 shadcn 风格 UI 组件
tests/             Node 原生测试（工具单测 + API 集成测试）
```

## API 一览

`GET /api/health`；`/api/connection`（连接、状态、断开）；`/api/dataverse/{metadata, solutions, data, environment, optionsets, businessrules, webresources, security, recordaccess, fieldsecurity, permission, businessunit, audit}`；`/api/scaffold/plugin-project`。未连接时受保护路由返回 401。

## 安全提示

* 后端 `cors()` 全开且监听所有网卡，**仅供本机开发使用**，不要把 3001 端口暴露到公网或不受信网络。
* Plugin Scaffolder 会按你传入的绝对路径在本地磁盘真实写入项目文件，运行前确认目标目录。
* 后端只在进程内存持有令牌，但前端会把已连接环境的凭据明文保存在本浏览器 `localStorage` 以支持一键重连。公用或共享机器请在连接弹窗中逐条移除，或使用无痕模式；浏览器配置同步也可能把该数据漫游到其他设备。
* 请在 Azure AD 中给应用注册授予最小权限，并使用专用测试环境。

## License

暂未附加开源许可证。

