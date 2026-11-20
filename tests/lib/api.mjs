/**
 * API 测试辅助：配置加载、HTTP 请求封装、连接管理。
 * 连接状态保存在 server 进程内存中，01-connection 套件连接成功后，
 * 同一次运行中的后续套件无需重复连接。
 */

let localConfig = null
try {
  localConfig = (await import('../config.local.mjs')).config
} catch {
  // config.local.mjs 不存在：仅运行无需凭据的用例
}

export const config = {
  baseUrl: 'http://localhost:3001',
  credentials: null,
  ...localConfig,
}

/** 是否配置了可用凭据 */
export const hasCredentials = !!config.credentials?.clientSecret

/** 该测试环境对大查询偶发 ECONNRESET/aborted（已知环境问题，PROJECT_LOG 有记录）。
 *  测试基建层对此类抖动做一次轻量重试，避免间歇性网络问题造成误报。 */
function isTransientFailure(result) {
  if (result.status !== 500) return false
  const message = typeof result.body?.error === 'string' ? result.body.error : ''
  return (
    message.includes('ECONNRESET') ||
    message.includes('aborted') ||
    message.includes('ETIMEDOUT') ||
    // MSAL 在获取 AAD token 时遇到网络抖动会返回 network_error
    message.includes('network_error')
  )
}

async function rawRequest(method, path, body) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed, headers: res.headers }
}

async function request(method, path, body) {
  let result = await rawRequest(method, path, body)
  for (let attempt = 0; attempt < 2 && isTransientFailure(result); attempt++) {
    console.log(`  [api] transient failure on ${method} ${path}, retrying (${attempt + 1}/2)...`)
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    result = await rawRequest(method, path, body)
  }
  return result
}

export const apiGet = (path) => request('GET', path)
export const apiPost = (path, body) => request('POST', path, body)
export const apiDelete = (path) => request('DELETE', path)

/** 查询 server 当前连接状态 */
export async function getConnectionStatus() {
  const { status, body } = await apiGet('/api/connection/status')
  return status === 200 && body?.connected === true
}

/** 使用配置的凭据连接测试环境 */
export async function connect() {
  if (!hasCredentials) throw new Error('No credentials configured (tests/config.local.mjs missing)')
  return apiPost('/api/connection/connect', config.credentials)
}

/** 断开连接（用于未连接保护用例） */
export async function disconnect() {
  return apiPost('/api/connection/disconnect', {})
}

/** 确保已连接：已连接则直接返回 true；未连接且有凭据则尝试连接 */
export async function ensureConnected() {
  if (await getConnectionStatus()) return true
  if (!hasCredentials) return false
  const { status, body } = await connect()
  if (status === 200 && body?.success) return true
  console.error(`  [api] connect failed: ${status} ${JSON.stringify(body)?.slice(0, 200)}`)
  return false
}
