/**
 * 测试请求层的重试策略。
 *
 * 只把明确的上游网络故障视为可重试；业务 4xx/5xx 不重试。
 * 写操作默认不重试，只读 POST 需由调用方显式声明幂等。
 */

export const RETRYABLE_METHODS = ['GET', 'HEAD', 'OPTIONS']
export const GATEWAY_STATUSES = [502, 503, 504]
export const TRANSIENT_SIGNATURES = [
  'econnreset',
  'etimedout',
  'econnrefused',
  'epipe',
  'eai_again',
  'enotfound',
  'socket hang up',
  'socket disconnected',
  'secure tls connection',
  'upstream connect failed',
  'connection timed out',
  'timeout of ',
  'network_error',
  'aborted',
  'fetch failed',
]

/** 将 string / { error } / { message } 统一为小写文本 */
export function bodyText(body) {
  if (typeof body === 'string') return body.toLowerCase()
  if (!body || typeof body !== 'object') return ''
  const parts = [body.error, body.message].filter(value => typeof value === 'string')
  return parts.join(' ').toLowerCase()
}

/** 返回命中的瞬时网络签名；未命中返回 null */
export function matchTransientSignature(status, body) {
  const text = bodyText(body)
  if (status === 0) {
    return TRANSIENT_SIGNATURES.find(signature => text.includes(signature)) ?? 'network failure'
  }
  if (GATEWAY_STATUSES.includes(status)) {
    return `gateway ${status}`
  }
  if (status !== 500) return null
  return TRANSIENT_SIGNATURES.find(signature => text.includes(signature)) ?? null
}

/** 仅幂等请求可重试：GET/HEAD/OPTIONS，或显式声明的只读 POST */
export function isRetryableRequest(method, { idempotent = false } = {}) {
  if (RETRYABLE_METHODS.includes(method)) return true
  return method === 'POST' && idempotent === true
}
