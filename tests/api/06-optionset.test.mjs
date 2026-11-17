/**
 * 06 - 选项集（/api/dataverse/optionsets）
 * 对应前端工具：Option Set Viewer
 */
import { createSuite, assert, assertStatus, isMain } from '../lib/harness.mjs'
import { apiGet, hasCredentials, ensureConnected } from '../lib/api.mjs'

export const suite = createSuite('06 - Option Sets')
const { test } = suite

test('GET /global returns sorted global option set list', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/optionsets/global')
  assertStatus(res, 200)
  const list = res.body?.value
  assert(Array.isArray(list), 'value should be an array')
  assert(list.length > 0, 'environment should have at least one global option set')
  assert(typeof list[0].Name === 'string', 'item should have Name')
  assert(typeof list[0].MetadataId === 'string', 'item should have MetadataId')
  const names = list.map(i => i.Name)
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  assert(JSON.stringify(names) === JSON.stringify(sorted), 'list should be sorted by Name')
})

test('GET /global/:metadataId returns full definition with Options', { requiresConnection: true }, async () => {
  const list = await apiGet('/api/dataverse/optionsets/global')
  assertStatus(list, 200)
  const target = list.body.value[0]
  const res = await apiGet(`/api/dataverse/optionsets/global/${target.MetadataId}`)
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.Options), 'detail should contain an Options array')
  if (res.body.Options.length > 0) {
    const opt = res.body.Options[0]
    assert(typeof opt.Value === 'number', 'option should have numeric Value')
    assert(opt.Label && typeof opt.Label === 'object', 'option should have a Label object')
  }
})

test('GET /entity/account returns picklist fields with MultiSelect flag', { requiresConnection: true }, async () => {
  const res = await apiGet('/api/dataverse/optionsets/entity/account')
  assertStatus(res, 200)
  const fields = res.body?.value
  assert(Array.isArray(fields) && fields.length > 0, 'account should have picklist fields')
  const names = fields.map(f => f.LogicalName)
  assert(names.includes('industrycode'), 'account should include the industrycode picklist')
  for (const f of fields) {
    assert(typeof f.MultiSelect === 'boolean', 'field should carry a boolean MultiSelect flag')
  }
  // 至少一个字段带选项（Global 或 Local）
  const withOptions = fields.filter(f => (f.GlobalOptionSet?.Options ?? f.OptionSet?.Options ?? []).length > 0)
  assert(withOptions.length > 0, 'at least one field should expose its options')
})

test('GET /entity/:unknown returns an empty list (cast-segment queries are fault-tolerant)', { requiresConnection: true }, async () => {
  // 设计行为：Picklist/MultiSelectPicklist 两个 cast 段查询各自容错（部分环境不支持
  // MultiSelectPicklist cast），实体不存在时两个查询都失败并降级为空，合并后为 200 空数组，
  // 与 03-solution 中“不存在 GUID → 200 空列表”的行为一致
  const res = await apiGet('/api/dataverse/optionsets/entity/new_nonexistent_xyz')
  assertStatus(res, 200)
  assert(Array.isArray(res.body?.value) && res.body.value.length === 0,
    'unknown entity should yield an empty field list')
})

if (isMain(import.meta.url)) {
  const connected = await ensureConnected().catch(() => false)
  const { failed } = await suite.run({ connected, hasCredentials })
  process.exitCode = failed > 0 ? 1 : 0
}
