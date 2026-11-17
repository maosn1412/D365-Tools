// 已连接环境的本地存储。凭据只保存在当前浏览器的 localStorage 中（不在仓库目录内，因此不会被提交到 git），
// 后端依旧只在进程内存里持有令牌，不写数据库、不写磁盘。

export type SavedAuthType = 'clientSecret' | 'usernamePassword'

export interface SavedConnection {
  id: string
  label: string
  authType: SavedAuthType
  environmentUrl: string
  tenantId?: string
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
  lastUsedAt: number
}

export type SavedConnectionInput = Omit<SavedConnection, 'id' | 'label' | 'lastUsedAt'>

export const SAVED_CONNECTIONS_KEY = 'd365_saved_connections'
export const MAX_SAVED_CONNECTIONS = 10

// 归一化只用于计算 id，绝不能改写存下来的 environmentUrl：
// 后端依据 .dynamics.cn 判定中国云 authority，改大小写或去斜杠都可能影响它。
function normalizeUrl(environmentUrl: string): string {
  return environmentUrl.trim().toLowerCase().replace(/\/+$/, '')
}

function idFor(authType: SavedAuthType, environmentUrl: string): string {
  return `${normalizeUrl(environmentUrl)}|${authType}`
}

function labelFor(environmentUrl: string): string {
  const host = environmentUrl.trim().replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').replace(/\/+$/, '')
  return host || environmentUrl.trim()
}

function cleanText(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || undefined
}

// 白名单逐字段拷贝：手工改过的、旧结构的、多余的键都会在下次写入时被清掉
function sanitize(entry: unknown): SavedConnection | null {
  if (!entry || typeof entry !== 'object') return null
  const raw = entry as Record<string, unknown>

  const authType: SavedAuthType | null =
    raw.authType === 'clientSecret' || raw.authType === 'usernamePassword' ? raw.authType : null
  const environmentUrl = cleanText(raw.environmentUrl)
  if (!authType || !environmentUrl) return null

  const label = cleanText(raw.label)

  return {
    id: cleanText(raw.id) ?? idFor(authType, environmentUrl),
    label: label ?? labelFor(environmentUrl),
    authType,
    environmentUrl,
    tenantId: cleanText(raw.tenantId),
    clientId: cleanText(raw.clientId),
    clientSecret: cleanText(raw.clientSecret),
    username: cleanText(raw.username),
    password: cleanText(raw.password),
    lastUsedAt: typeof raw.lastUsedAt === 'number' && Number.isFinite(raw.lastUsedAt) ? raw.lastUsedAt : 0,
  }
}

function byLastUsed(list: SavedConnection[]): SavedConnection[] {
  return [...list].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, MAX_SAVED_CONNECTIONS)
}

function readRaw(): SavedConnection[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_CONNECTIONS_KEY) ?? '')
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitize).filter((entry): entry is SavedConnection => entry !== null)
  } catch {
    return []
  }
}

function writeRaw(list: SavedConnection[]): void {
  try {
    if (list.length === 0) {
      localStorage.removeItem(SAVED_CONNECTIONS_KEY)
      return
    }
    localStorage.setItem(SAVED_CONNECTIONS_KEY, JSON.stringify(byLastUsed(list)))
  } catch {
    // 无痕模式或配额不足时静默：连接本身已成功，不该因为存不下来而报错
  }
}

export function listSavedConnections(): SavedConnection[] {
  return byLastUsed(readRaw())
}

// 同一环境 = 归一化 URL 相同且验证方式相同，因此一个环境最多两行（服务密钥 / 账号密码各一条）
export function saveSavedConnection(input: SavedConnectionInput): void {
  const environmentUrl = cleanText(input.environmentUrl)
  if (!environmentUrl) return

  const record: SavedConnection = {
    id: idFor(input.authType, environmentUrl),
    label: labelFor(environmentUrl),
    authType: input.authType,
    environmentUrl,
    tenantId: cleanText(input.tenantId),
    clientId: cleanText(input.clientId),
    clientSecret: cleanText(input.clientSecret),
    username: cleanText(input.username),
    password: cleanText(input.password),
    lastUsedAt: Date.now(),
  }
  writeRaw([record, ...readRaw().filter((entry) => entry.id !== record.id)])
}

export function removeSavedConnection(id: string): void {
  writeRaw(readRaw().filter((entry) => entry.id !== id))
}
