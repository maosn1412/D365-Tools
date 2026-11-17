/**
 * 19 - Plugin Project Scaffolder (source contract)
 * 锁定新工具的前端页面契约 + 注册点 + 后端路由关键实现，防止静默回归。
 */
import { createSuite, assertIncludes, isMain } from '../lib/harness.mjs'
import { readProjectFile, readToolSource } from '../lib/source.mjs'

export const suite = createSuite('19 - Plugin Project Scaffolder (source contract)')
const { test } = suite

const page = await readToolSource('PluginProjectScaffolder.tsx')
const app = await readProjectFile('client/src/App.tsx')
const layout = await readProjectFile('client/src/components/layout/AppLayout.tsx')
const api = await readProjectFile('client/src/services/api.ts')
const icons = await readProjectFile('client/src/components/ui/icons.tsx')
const serverIndex = await readProjectFile('server/src/index.ts')
const route = await readProjectFile('server/src/routes/scaffold.ts')

test('page exports component and uses PageHeader', () => {
  assertIncludes(page, 'export function PluginProjectScaffolder', 'component export')
  assertIncludes(page, '<PageHeader', 'PageHeader usage')
  assertIncludes(page, 'Plugin Project Scaffolder', 'page title')
})

test('page mirrors server-side validation rules', () => {
  assertIncludes(page, '/^[A-Za-z][A-Za-z0-9]{0,19}$/', 'namespace prefix regex')
  assertIncludes(page, '/^[a-z][a-z0-9_]{0,7}$/', 'publisher prefix regex')
  assertIncludes(page, "'msdyn'", 'publisher blocklist')
})

test('page defaults target dir to the scaffold test root', () => {
  assertIncludes(page, 'D:\\\\Code\\\\个人项目\\\\初始化项目测试', 'default targetDir')
})

test('page calls scaffoldPluginProject and renders result', () => {
  assertIncludes(page, 'scaffoldPluginProject', 'API call')
  assertIncludes(page, 'nuget restore', 'next-step hint')
})

test('api.ts exposes scaffold contract', () => {
  assertIncludes(api, 'export interface ScaffoldPluginProjectRequest', 'request interface')
  assertIncludes(api, 'export interface ScaffoldPluginProjectResponse', 'response interface')
  assertIncludes(api, 'export function scaffoldPluginProject(', 'API function')
  assertIncludes(api, "'/scaffold/plugin-project'", 'endpoint path')
})

test('icons.tsx exports IconScaffold', () => {
  assertIncludes(icons, 'export const IconScaffold = createIcon', 'IconScaffold export')
})

test('App.tsx registers the scaffolder route', () => {
  assertIncludes(app, "import { PluginProjectScaffolder } from '@/pages/tools/PluginProjectScaffolder'", 'page import')
  assertIncludes(app, 'path="tools/plugin-project-scaffolder"', 'route registration')
})

test('AppLayout.tsx adds nav entry to Code Generators group', () => {
  const start = layout.indexOf("label: 'Code Generators'")
  const block = layout.slice(start, layout.indexOf(']', start) + 1)
  assertIncludes(block, 'plugin-project-scaffolder', 'nav path in Code Generators group')
  assertIncludes(block, 'Plugin Scaffolder', 'nav name')
  assertIncludes(layout, 'IconScaffold', 'icon import')
})

test('server mounts /api/scaffold without Dataverse connection requirement', () => {
  assertIncludes(serverIndex, "import { scaffoldRouter } from './routes/scaffold.js'", 'router import')
  assertIncludes(serverIndex, "app.use('/api/scaffold', scaffoldRouter)", 'router mount')
})

test('scaffold route validates inputs and uses fs/template pipeline', () => {
  assertIncludes(route, "post('/plugin-project'", 'endpoint')
  assertIncludes(route, '/^[A-Za-z][A-Za-z0-9]{0,19}$/', 'namespace regex')
  assertIncludes(route, '/^[a-z][a-z0-9_]{0,7}$/', 'publisher regex')
  assertIncludes(route, "'node:fs'", 'fs import')
  assertIncludes(route, 'randomUUID', 'GUID generation')
  assertIncludes(route, '__NS__', 'filename token')
  assertIncludes(route, '{{NamespacePrefix}}', 'content token')
  assertIncludes(route, '409', 'idempotency guard')
  assertIncludes(route, 'templates/plugin-framework', 'template dir')
})

test('scaffold route guards against dangerous target dirs', () => {
  assertIncludes(route, "c:\\\\windows", 'system dir blocklist')
  assertIncludes(route, "isSameOrInside", 'path containment check')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
