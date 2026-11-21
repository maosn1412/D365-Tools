/**
 * API 测试辅助：配置加载、HTTP 请求封装、连接管理。
 * 连接状态保存在 server 进程内存中，01-connection 套件连接成功后，
 * 同一次运行中的后续套件无需重复连接。
 */

import { isRetryableRequest, matchTransientSignature } from './retryPolicy.mjs'

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

/** 该测试环境对大查询偶发 TLS 断连/502/ECONNRESET；只有命中网络签名才重试。
 *  GET 默认可重试；只读 POST 需显式 idempotent；写操作绝不自动重试。 */
async function rawRequest(method, path, body) {
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { status: 0, body: { error: message }, headers: new Headers() }
  }
}

function blockedError(method, path, result, signature) {
  const error = new Error(
    `Environment blocked on ${method} ${path}: ${signature}\n    body: ${
      typeof result.body === 'string' ? result.body.slice(0, 300) : JSON.stringify(result.body)?.slice(0, 300)
    }`
  )
  error.blocked = true
  error.status = result.status
  error.signature = signature
  return error
}

async function request(method, path, body, options = {}) {
  const retryable = isRetryableRequest(method, options)
  let result = await rawRequest(method, path, body)
  let signature = matchTransientSignature(result.status, result.body)

  if (!retryable) {
    if (signature) throw blockedError(method, path, result, signature)
    return result
  }

  for (let attempt = 0; attempt < 2 && signature; attempt++) {
    console.log(`  [api] transient upstream failure on ${method} ${path}, retrying (${attempt + 1}/2)...`)
    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)))
    result = await rawRequest(method, path, body)
    signature = matchTransientSignature(result.status, result.body)
  }

  if (signature) throw blockedError(method, path, result, signature)
  return result
}

export const apiGet = (path) => request('GET', path)
export const apiPost = (path, body, options) => request('POST', path, body, options)
export const apiDelete = (path, options) => request('DELETE', path, undefined, options)

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
