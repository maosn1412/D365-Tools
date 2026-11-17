/**
 * 测试配置模板。
 * 复制为 config.local.mjs 并填入真实测试环境凭据后，API 集成测试将执行完整连接用例；
 * 没有 config.local.mjs 时，API 测试只运行"未连接保护"等无需凭据的用例（其余自动跳过）。
 */
export const config = {
  /** 后端服务地址 */
  baseUrl: 'http://localhost:3001',
  /** Dataverse 测试环境凭据（clientSecret 认证） */
  credentials: {
    authType: 'clientSecret',
    environmentUrl: 'https://yourorg.crm5.dynamics.com',
    tenantId: 'your-tenant.onmicrosoft.com',
    clientId: '00000000-0000-0000-0000-000000000000',
    clientSecret: 'your-client-secret',
  },
  /** Plugin Scaffolder 测试的输出根目录；不配置时自动落到系统临时目录 */
  scaffoldTestRoot: 'C:\\your\\scratch\\root',
  /** Plugin Scaffolder 模板蓝本的历史标识，生成结果中出现即判为回归。
   *  这些词属于具体项目信息，只写在本地文件，不要提交到公开仓库。 */
  identityBlocklist: ['legacyvendor', 'legacy_prefix', 'XX.Plugins'],
}
