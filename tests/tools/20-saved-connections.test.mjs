/**
 * 20 - Saved Environments / 一键重连 (source contract)
 *
 * 锁定三件事：
 *   1. 环境列表只落在浏览器 localStorage（不进仓库、不进后端磁盘）
 *   2. ConnectionDialog 的列表渲染 + 一键连接 + 打开时刷新 + 成功后自动记忆
 *   3. 密钥永不出现在渲染输出里，且受版本控制的文件中不存在真实租户标识
 */
import { createSuite, assert, assertIncludes, isMain } from '../lib/harness.mjs'
import { readProjectFile } from '../lib/source.mjs'

export const suite = createSuite('20 - Saved Environments (source contract)')
const { test } = suite

const lib = await readProjectFile('client/src/lib/savedConnections.ts')
const dialog = await readProjectFile('client/src/components/connection/ConnectionDialog.tsx')
const connStore = await readProjectFile('client/src/stores/connectionStore.ts')
const layout = await readProjectFile('client/src/components/layout/AppLayout.tsx')
const guard = await readProjectFile('client/src/components/connection/ConnectionGuard.tsx')
const fetchXml = await readProjectFile('client/src/pages/tools/FetchXmlBuilder.tsx')
const runner = await readProjectFile('tests/run-all.mjs')
const dvService = await readProjectFile('server/src/services/dataverseService.ts')

test('storage module defines the key, the record shape and the cap', () => {
  assertIncludes(lib, "export const SAVED_CONNECTIONS_KEY = 'd365_saved_connections'", 'storage key')
  assertIncludes(lib, 'export interface SavedConnection', 'record interface')
  assertIncludes(lib, 'export const MAX_SAVED_CONNECTIONS = 10', 'entry cap')
  assertIncludes(lib, 'export type SavedConnectionInput', 'input type')
})

test('saved list uses localStorage only; connection status stays in sessionStorage', () => {
  assertIncludes(lib, 'localStorage.getItem', 'localStorage read')
  assertIncludes(lib, 'localStorage.setItem', 'localStorage write')
  assertIncludes(lib, 'localStorage.removeItem', 'localStorage delete')
  assert(!lib.includes('sessionStorage'), 'storage module must not touch sessionStorage')
  assert(!connStore.includes('localStorage'), 'status store must not move to localStorage')
  assertIncludes(connStore, "sessionStorage.getItem('d365_connection'", 'status stays per-tab')
})

test('entry identity is normalized url + authType', () => {
  assertIncludes(lib, 'function normalizeUrl', 'url normalizer')
  assertIncludes(lib, '.toLowerCase()', 'case folded for identity')
  assertIncludes(lib, '/\\/+$/', 'trailing slashes stripped')
  assertIncludes(lib, '${authType}', 'id composed with authType')
})

test('cap evicts the least recently used entry', () => {
  assertIncludes(lib, 'lastUsedAt', 'timestamp tracked')
  assertIncludes(lib, '.sort((a, b) => b.lastUsedAt - a.lastUsedAt)', 'newest first')
  assertIncludes(lib, 'slice(0, MAX_SAVED_CONNECTIONS)', 'cap applied')
})

test('parsing is corruption-safe and never throws', () => {
  assertIncludes(lib, 'try {', 'guarded read')
  assertIncludes(lib, 'catch {', 'swallow parse failure')
  assertIncludes(lib, 'JSON.parse', 'json parse')
  assertIncludes(lib, 'Array.isArray', 'array guard')
  assertIncludes(lib, 'function sanitize', 'whitelist copy')
  assertIncludes(lib, 'Number.isFinite', 'numeric guard')
})

test('dialog lists, one-click connects and removes saved environments', () => {
  assertIncludes(dialog, 'listSavedConnections()', 'list read')
  assertIncludes(dialog, 'removeSavedConnection(', 'single entry removal')
  assertIncludes(dialog, 'handleSavedConnect', 'one-click connect handler')
  assertIncludes(dialog, 'authType: entry.authType', 'connect payload built from storage')
  assertIncludes(dialog, 'connectingId', 'per-row loading state')
  assertIncludes(dialog, 'Saved environments', 'list heading')
  const calls = dialog.match(/connectToDataverse\(/g) ?? []
  assert(calls.length >= 3, `connectToDataverse used for each auth path plus saved rows, got ${calls.length}`)
})

test('list refreshes when the dialog opens and auto-saves after a manual connect', () => {
  assertIncludes(dialog, 'useEffect(', 'open-keyed effect')
  assertIncludes(dialog, '}, [open])', 'effect depends on open only')
  const handlers = dialog.slice(dialog.indexOf('handleClientSecretConnect'), dialog.indexOf('handleSavedConnect'))
  const saves = handlers.match(/saveSavedConnection\(/g) ?? []
  assert(saves.length >= 2, `both manual auth paths must save, got ${saves.length}`)
})

test('history is written only after a successful connect', () => {
  // 后端把"连上"定义为真的取到令牌，两条认证路径都必须先 ensureToken
  const tokens = dvService.match(/await this\.ensureToken\(\)/g) ?? []
  assert(tokens.length >= 2, `both connect paths must acquire a token before reporting success, got ${tokens.length}`)

  for (const fn of ['handleClientSecretConnect', 'handleUsernamePasswordConnect', 'handleSavedConnect']) {
    const start = dialog.indexOf(fn)
    assert(start !== -1, `${fn} present`)
    const body = dialog.slice(start, dialog.indexOf('\n  }', start))
    const awaited = body.indexOf('await connectToDataverse(')
    const saved = body.indexOf('saveSavedConnection(')
    const caught = body.indexOf('catch (e)')
    assert(awaited !== -1, `${fn} awaits the connect call`)
    assert(saved !== -1, `${fn} saves the environment`)
    assert(saved > awaited, `${fn} must save only after the awaited connect resolves`)
    assert(caught === -1 || saved < caught, `${fn} must not save on the failure path`)
  }
})

test('secrets are never rendered into the dialog output', () => {
  const render = dialog.slice(dialog.indexOf('  return ('))
  assert(!/entry\.clientSecret/.test(render), 'clientSecret must not appear in JSX')
  assert(!/entry\.password/.test(render), 'password must not appear in JSX')
  assertIncludes(render, '••••••••', 'masked credential placeholder')
  assertIncludes(dialog, 'Credentials are kept in this browser only', 'storage disclosure to the user')
  assertIncludes(dialog, 'Forget this environment', 'removal affordance labelled')
})

test('ConnectionDialog props contract unchanged for all three mount points', () => {
  assertIncludes(dialog, 'open: boolean', 'open prop')
  assertIncludes(dialog, 'onOpenChange: (open: boolean) => void', 'onOpenChange prop')
  assertIncludes(dialog, 'onConnected: (environmentUrl: string) => void', 'onConnected prop')
  for (const [name, src] of Object.entries({ layout, guard, fetchXml })) {
    assertIncludes(src, '<ConnectionDialog', `${name} still mounts the dialog`)
  }
})

test('no real tenant identifiers committed by this feature', () => {
  for (const [name, src] of Object.entries({ 'savedConnections.ts': lib, ConnectionDialog: dialog })) {
    const guids = src.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []
    assert(guids.length === 0, `${name} holds a GUID literal that could be a real tenant/client id`)
    const hosts = src.match(/https?:\/\/[a-z0-9.-]*\.(crm\d*\.dynamics\.com|dynamics\.cn)/gi) ?? []
    const suspicious = hosts.filter((h) => !/yourorg|contoso|example/i.test(h))
    assert(suspicious.length === 0, `${name} holds a non-placeholder environment URL: ${suspicious.join(', ')}`)
  }
})

test('test runner registers suite 20', () => {
  assertIncludes(runner, "'./tools/20-saved-connections.test.mjs'", 'import line')
  assertIncludes(runner, 'savedConnections', 'suite added to toolSuites')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
