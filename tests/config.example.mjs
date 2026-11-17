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
}
