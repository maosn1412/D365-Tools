/**
 * 17 - Plugin Project Scaffolder API
 * 前置条件：后端运行于 http://localhost:3001（本套件不需要 D365 连接）
 * 测试输出目录：D:\Code\个人项目\初始化项目测试\__apitest__（导入时 + 进程退出时自动清理）
 */
import { createSuite, assert, assertEqual, assertIncludes, assertStatus, isMain } from '../lib/harness.mjs'
import { apiPost } from '../lib/api.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const suite = createSuite('17 - Plugin Project Scaffolder')
const { test } = suite

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TEMPLATE_DIR = path.join(PROJECT_ROOT, 'server', 'templates', 'plugin-framework')
const TEST_ROOT = 'D:\\Code\\个人项目\\初始化项目测试\\__apitest__'
const NS = 'Zztest'
const PUB = 'zzt'
const SOLUTION_ROOT = path.join(TEST_ROOT, `${NS}.CRM.D365`)
const ENDPOINT = '/api/scaffold/plugin-project'

function clean() {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
}
clean()
process.on('exit', clean)

const post = (body) => apiPost(ENDPOINT, body)
const validBody = () => ({ namespacePrefix: NS, publisherPrefix: PUB, targetDir: TEST_ROOT })

// ---------- 参数校验（400） ----------

test('rejects invalid namespacePrefix values', async () => {
  for (const bad of ['1ABC', 'AB C', 'AB.C', '']) {
    const res = await post({ ...validBody(), namespacePrefix: bad })
    assertStatus(res, 400, `namespacePrefix=${JSON.stringify(bad)} should be 400`)
    assertIncludes(res.body?.error ?? '', 'namespacePrefix', 'error should mention namespacePrefix')
  }
})

test('rejects invalid publisherPrefix values', async () => {
  for (const bad of ['ABC', '1abc', 'abcdefghij', 'abc_', 'msdyn']) {
    const res = await post({ ...validBody(), publisherPrefix: bad })
    assertStatus(res, 400, `publisherPrefix=${JSON.stringify(bad)} should be 400`)
    assertIncludes(res.body?.error ?? '', 'publisherPrefix', 'error should mention publisherPrefix')
  }
})

test('rejects relative targetDir', async () => {
  const res = await post({ ...validBody(), targetDir: 'test\\out' })
  assertStatus(res, 400, 'relative targetDir should be 400')
})

test('rejects targetDir with path traversal', async () => {
  const res = await post({ ...validBody(), targetDir: 'D:\\Code\\个人项目\\初始化项目测试\\..\\escape' })
  assertStatus(res, 400, 'traversal targetDir should be 400')
})

test('rejects targetDir under system directories', async () => {
  const res = await post({ ...validBody(), targetDir: 'C:\\Windows\\scaffold-test' })
  assertStatus(res, 400, 'system dir targetDir should be 400')
})

// ---------- 成功生成 ----------

let generated = null

test('happy path: generates full solution skeleton', async () => {
  const res = await post(validBody())
  assertStatus(res, 200, 'scaffold should succeed')
  generated = res.body
  assertEqual(generated.success, true, 'success flag')
  assert(generated.rootDir.replace(/\//g, '\\').endsWith(`${NS}.CRM.D365`), `rootDir should end with ${NS}.CRM.D365, got ${generated.rootDir}`)
  const files = generated.files.map(f => f.replace(/\//g, '\\'))
  for (const expected of [
    `${NS}.CRM.D365.sln`,
    'README.md',
    'Crm.Plugins.Share\\Crm.Plugins.Share.shproj',
    'Crm.Plugins.Share\\Crm.Plugins.Share.projitems',
    'Crm.Plugins.Share\\Common\\PluginBase.cs',
    `${NS}.Plugins.Sample\\${NS}.Plugins.Sample.csproj`,
    `${NS}.Plugins.Sample\\key.snk`,
    `${NS}.Plugins.Sample\\packages.config`,
    `${NS}.Plugins.Sample\\Domain\\Sample\\Plugin.cs`,
    `${NS}.Plugins.UnitTest\\${NS}.Plugins.UnitTest.csproj`,
    `${NS}.Plugins.UnitTest\\SamplePluginTests.cs`,
  ]) {
    assert(files.includes(expected), `generated files should include ${expected}`)
  }
  assertEqual(generated.projects.length, 3, 'should generate 3 projects')
})

function* walkTextFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      yield* walkTextFiles(p)
    } else if (!e.name.toLowerCase().endsWith('.snk')) {
      yield p
    }
  }
}

test('generated content has no template tokens or business leftovers', () => {
  assert(generated, 'depends on happy path test')
  const forbidden = ['{{', '}}', '__NS__', 'smooretech', 'Hisense', 'PwC', 'YuTong', 'pwc_', 'AS.Plugins']
  for (const file of walkTextFiles(SOLUTION_ROOT)) {
    const content = fs.readFileSync(file, 'utf8')
    for (const token of forbidden) {
      assert(!content.includes(token), `${path.relative(SOLUTION_ROOT, file)} should not contain ${JSON.stringify(token)}`)
    }
  }
})

test('token substitution is correct in key files', () => {
  const csproj = fs.readFileSync(path.join(SOLUTION_ROOT, `${NS}.Plugins.Sample`, `${NS}.Plugins.Sample.csproj`), 'utf8')
  assertIncludes(csproj, `<RootNamespace>${NS}.Plugins.Sample</RootNamespace>`, 'RootNamespace')
  assertIncludes(csproj, `<AssemblyName>${NS}.Plugins.Sample</AssemblyName>`, 'AssemblyName')
  const sln = fs.readFileSync(path.join(SOLUTION_ROOT, `${NS}.CRM.D365.sln`), 'utf8')
  assertIncludes(sln, `"${NS}.Plugins.Sample"`, 'sln sample project name')
  assertIncludes(sln, `"${NS}.Plugins.UnitTest"`, 'sln unittest project name')
  assertIncludes(sln, '"Crm.Plugins.Share"', 'sln shared project name')
  const plugin = fs.readFileSync(path.join(SOLUTION_ROOT, `${NS}.Plugins.Sample`, 'Domain', 'Sample', 'Plugin.cs'), 'utf8')
  assertIncludes(plugin, `${PUB}_sample`, 'plugin entity name')
  assertIncludes(plugin, `namespace ${NS}.Plugins.Sample.Domain.Sample`, 'plugin namespace')
  const pluginBase = fs.readFileSync(path.join(SOLUTION_ROOT, 'Crm.Plugins.Share', 'Common', 'PluginBase.cs'), 'utf8')
  assert(!pluginBase.includes('GetHostByName'), 'PluginBase should not contain DNS probe junk')
})

test('GUIDs are consistent across sln/csproj/shproj/projitems', () => {
  const norm = (g) => g.replace(/[{}]/g, '').toLowerCase()
  const sln = fs.readFileSync(path.join(SOLUTION_ROOT, `${NS}.CRM.D365.sln`), 'utf8')
  const slnGuidFor = (projectFile) => {
    const m = sln.match(new RegExp(`"${projectFile.replace(/[.\\]/g, m => `\\${m}`)}",\\s*"(\\{[^}]+\\})"`))
    assert(m, `sln should contain project entry for ${projectFile}`)
    return m[1]
  }
  const sampleSlnGuid = slnGuidFor(`${NS}.Plugins.Sample\\${NS}.Plugins.Sample.csproj`)
  const testSlnGuid = slnGuidFor(`${NS}.Plugins.UnitTest\\${NS}.Plugins.UnitTest.csproj`)
  const shareSlnGuid = slnGuidFor('Crm.Plugins.Share\\Crm.Plugins.Share.shproj')

  const sampleCsproj = fs.readFileSync(path.join(SOLUTION_ROOT, `${NS}.Plugins.Sample`, `${NS}.Plugins.Sample.csproj`), 'utf8')
  const sampleCsprojGuid = sampleCsproj.match(/<ProjectGuid>(\{[^}]+\})<\/ProjectGuid>/)[1]
  assertEqual(norm(sampleCsprojGuid), norm(sampleSlnGuid), 'sample csproj ProjectGuid should match sln')

  const shproj = fs.readFileSync(path.join(SOLUTION_ROOT, 'Crm.Plugins.Share', 'Crm.Plugins.Share.shproj'), 'utf8')
  const projitems = fs.readFileSync(path.join(SOLUTION_ROOT, 'Crm.Plugins.Share', 'Crm.Plugins.Share.projitems'), 'utf8')
  const shprojGuid = shproj.match(/<ProjectGuid>([^<]+)<\/ProjectGuid>/)[1]
  const sharedGuid = projitems.match(/<SharedGUID>([^<]+)<\/SharedGUID>/)[1]
  assertEqual(norm(shprojGuid), norm(shareSlnGuid), 'shproj ProjectGuid should match sln')
  assertEqual(norm(sharedGuid), norm(shareSlnGuid), 'projitems SharedGUID should match sln')

  const testCsproj = fs.readFileSync(path.join(SOLUTION_ROOT, `${NS}.Plugins.UnitTest`, `${NS}.Plugins.UnitTest.csproj`), 'utf8')
  const testCsprojGuid = testCsproj.match(/<ProjectGuid>(\{[^}]+\})<\/ProjectGuid>/)[1]
  assertEqual(norm(testCsprojGuid), norm(testSlnGuid), 'unittest csproj ProjectGuid should match sln')
  const refGuid = testCsproj.match(/<Project>(\{[^}]+\})<\/Project>/)[1]
  assertEqual(norm(refGuid), norm(sampleSlnGuid), 'unittest ProjectReference should point at sample project')

  const distinct = new Set([norm(sampleSlnGuid), norm(testSlnGuid), norm(shareSlnGuid)])
  assertEqual(distinct.size, 3, 'project GUIDs should be distinct')
})

test('key.snk is byte-identical to template', () => {
  const generatedSnk = fs.readFileSync(path.join(SOLUTION_ROOT, `${NS}.Plugins.Sample`, 'key.snk'))
  const templateSnk = fs.readFileSync(path.join(TEMPLATE_DIR, '__NS__.Plugins.Sample', 'key.snk'))
  assert(generatedSnk.length > 0, 'generated key.snk should not be empty')
  assert(generatedSnk.equals(templateSnk), 'generated key.snk should be byte-identical to template')
})

test('re-running with same prefix returns 409 (no overwrite)', async () => {
  const res = await post(validBody())
  assertStatus(res, 409, 'duplicate scaffold should be 409')
  assertIncludes(res.body?.error ?? '', '已存在', 'error should mention existing directory')
})

test('different prefix in same root creates sibling solution', async () => {
  const res = await post({ namespacePrefix: 'Yytest', publisherPrefix: 'yyt', targetDir: TEST_ROOT })
  assertStatus(res, 200, 'sibling scaffold should succeed')
  assert(fs.existsSync(path.join(TEST_ROOT, 'Yytest.CRM.D365', 'Yytest.CRM.D365.sln')), 'sibling sln should exist')
  assert(fs.existsSync(path.join(SOLUTION_ROOT, `${NS}.CRM.D365.sln`)), 'original solution should be untouched')
})

if (isMain(import.meta.url)) {
  const { failed } = await suite.run()
  process.exitCode = failed > 0 ? 1 : 0
}
