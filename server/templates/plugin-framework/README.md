# {{NamespacePrefix}} CRM D365 插件解决方案

由 D365 CRM Tools 脚手架生成。

## 项目结构

- `Crm.Plugins.Share` — 共享框架项目（Shared Project，源码级共享，不产出 DLL）：
  - `Common/PluginBase.cs` — 插件基类 `PluginBase` / `PluginContext`（含 CurrentEntity、PreImage/PostImage、SystemUserService/CurrentUserService、Trace 等）
  - `Common/PluginMessage.cs` — 步骤注册特性（`MessageCreate`/`MessageUpdate`/`MessageDelete`/`MessageRetrieveMultiple`/`MessageCustom`）
  - `Common/Extensions/` — Entity/OrganizationService/String/DateTime/Json 等扩展方法（批量 ExecuteMultiple、事务 ExecuteTransaction 等）
  - `Domain/EnvironmentVariableValue/EnvironmentService.cs` — 读取 Dataverse 环境变量
  - `Domain/UserSetting/UserSettingQueryService.cs` — 用户语言查询
- `{{NamespacePrefix}}.Plugins.Sample` — 示例插件项目（net462，强签名 key.snk），目录约定 `Domain/{实体}/Plugin.cs`
- `{{NamespacePrefix}}.Plugins.UnitTest` — MSTest + Moq 单元测试项目

## 快速开始

1. 还原 NuGet 包（解决方案根目录执行）：

   ```
   nuget restore {{NamespacePrefix}}.CRM.D365.sln
   ```

   或在 Visual Studio 中右键解决方案 →「还原 NuGet 程序包」。

2. 使用 Visual Studio 2019/2022（需安装 .NET Framework 4.6.2 开发包）打开 `{{NamespacePrefix}}.CRM.D365.sln` 并生成。

3. 新增业务插件项目：复制 `{{NamespacePrefix}}.Plugins.Sample` 目录 → 重命名项目和命名空间 → 在 csproj 中更换 `ProjectGuid` 为新 GUID → 把新 csproj 加入解决方案（项目间通过 `<Import Project="..\Crm.Plugins.Share\Crm.Plugins.Share.projitems" Label="Shared" />` 共享框架源码）。

4. 示例实体约定：示例插件使用实体 `{{PublisherPrefix}}_sample`、字段 `{{PublisherPrefix}}_name`（发布者前缀 `{{PublisherPrefix}}`），实际开发时替换为你的业务实体。

## 注册插件

使用 Plugin Registration Tool（如 `Microsoft.CrmSdk.XrmTooling.PluginRegistrationTool` NuGet 包自带工具）注册程序集，按插件类上的 `MessageCreate`/`MessageUpdate` 等特性标注的实体、阶段、模式登记步骤。
