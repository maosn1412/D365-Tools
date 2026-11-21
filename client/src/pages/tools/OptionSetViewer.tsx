import { useEffect, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchSelect } from '@/components/ui/search-select'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import {
  IconOptionsList, IconSearch, IconCopy, IconCheck, IconChevronDown,
  IconChevronRight, IconWifi, IconInspect,
} from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'
import { cn } from '@/lib/utils'

// ---------- 类型定义 ----------

interface LocalizedLabel {
  Label?: string
}

interface DisplayNameHolder {
  UserLocalizedLabel?: LocalizedLabel
}

interface OptionItem {
  Value?: number
  Label?: DisplayNameHolder & { LocalizedLabels?: LocalizedLabel[] }
  Color?: string
}

interface GlobalOptionSetMeta {
  Name?: string
  MetadataId?: string
  DisplayName?: DisplayNameHolder
  IsCustomOptionSet?: boolean
}

interface GlobalOptionSetDetail extends GlobalOptionSetMeta {
  Options?: OptionItem[]
}

interface EntityOptionSetField {
  LogicalName: string
  DisplayName?: DisplayNameHolder
  MultiSelect: boolean
  OptionSet?: { Name?: string; Options?: OptionItem[] }
  GlobalOptionSet?: { Name?: string; Options?: OptionItem[] }
}

// ---------- 工具函数 ----------

function displayNameOf(holder?: DisplayNameHolder | null): string {
  return holder?.UserLocalizedLabel?.Label ?? ''
}

function optionLabel(option: OptionItem): string {
  return (
    option.Label?.UserLocalizedLabel?.Label ??
    option.Label?.LocalizedLabels?.[0]?.Label ??
    ''
  )
}

function getFieldOptions(field: EntityOptionSetField): OptionItem[] {
  return field.GlobalOptionSet?.Options ?? field.OptionSet?.Options ?? []
}

function toJsonExport(name: string, options: OptionItem[]): string {
  return JSON.stringify(
    {
      name,
      options: options.map(o => ({
        value: o.Value ?? null,
        label: optionLabel(o),
        ...(o.Color ? { color: o.Color } : {}),
      })),
    },
    null,
    2
  )
}

function toCSharpEnum(name: string, options: OptionItem[]): string {
  const enumName = (name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1')) || 'OptionSet'
  const lines = options.map(o => {
    let member = (optionLabel(o) || `Option_${o.Value}`).replace(/[^a-zA-Z0-9_]/g, '_')
    if (!member || /^\d/.test(member)) member = `_${member || 'Value'}`
    return `    ${member} = ${o.Value ?? 0},`
  })
  return `public enum ${enumName}\n{\n${lines.join('\n')}\n}`
}

function toPowerFx(name: string, options: OptionItem[]): string {
  const rows = options.map(
    o => `    { Value: ${o.Value ?? 0}, Label: "${optionLabel(o).replace(/"/g, '""')}" }`
  )
  return `// ${name}\nTable(\n${rows.join(',\n')}\n)`
}

// ---------- 共享小组件 ----------

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 2000)
  }
  return { copiedKey, copy }
}

function OptionsTable({ options }: { options: OptionItem[] }) {
  if (options.length === 0) {
    return <EmptyState title="No options" description="This option set has no options." />
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-24 px-3 py-2 text-left font-medium text-muted-foreground">Value</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Label</th>
              <th className="w-32 px-3 py-2 text-left font-medium text-muted-foreground">Color</th>
            </tr>
          </thead>
          <tbody>
            {options.map((o, i) => (
              <tr
                key={`${o.Value ?? 'x'}-${i}`}
                className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}
              >
                <td className="px-3 py-2 font-mono text-xs">{o.Value ?? '-'}</td>
                <td className="px-3 py-2">{optionLabel(o) || '-'}</td>
                <td className="px-3 py-2">
                  {o.Color ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
                      <span
                        className="h-3.5 w-3.5 rounded border"
                        style={{ backgroundColor: o.Color }}
                      />
                      {o.Color}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Global Option Sets 页签 ----------

function GlobalOptionSetsTab() {
  const [list, setList] = useState<GlobalOptionSetMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<GlobalOptionSetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const { copiedKey, copy } = useCopy()

  useEffect(() => {
    let cancelled = false
    fetch('/api/dataverse/optionsets/global')
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch global option sets')
        }
        return res.json()
      })
      .then((data: { value: GlobalOptionSetMeta[] }) => { if (!cancelled) setList(data.value || []) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    fetch(`/api/dataverse/optionsets/global/${selectedId}`)
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch option set detail')
        }
        return res.json()
      })
      .then((data: GlobalOptionSetDetail) => { if (!cancelled) setDetail(data) })
      .catch(() => { if (!cancelled) setDetail(null) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      item =>
        (item.Name ?? '').toLowerCase().includes(q) ||
        displayNameOf(item.DisplayName).toLowerCase().includes(q)
    )
  }, [list, search])

  const options = detail?.Options ?? []
  const detailName = detail?.Name ?? ''
  const exports: { key: string; label: string; text: () => string }[] = [
    { key: 'json', label: 'JSON', text: () => toJsonExport(detailName, options) },
    { key: 'csharp', label: 'C# Enum', text: () => toCSharpEnum(detailName, options) },
    { key: 'powerfx', label: 'Power Fx', text: () => toPowerFx(detailName, options) },
  ]

  return (
    <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-6">
      {/* 左侧：可搜索列表 */}
      <Card className="min-w-0 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Global Option Sets</CardTitle>
          <div className="relative mt-2">
            <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search option sets..."
              className="pl-8 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <LoadingState text="Loading option sets..." />
          ) : error ? (
            <ErrorState message={error} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No option sets" description="No global option sets match your search." />
          ) : (
            <div className="max-h-[560px] overflow-y-auto -mx-2 px-2 space-y-0.5">
              {filtered.map(item => {
                const active = item.MetadataId === selectedId
                return (
                  <button
                    key={item.MetadataId ?? item.Name}
                    onClick={() => setSelectedId(item.MetadataId ?? null)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left transition-colors min-w-0',
                      active ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                    )}
                  >
                    <p className="truncate text-sm font-medium">{item.Name}</p>
                    {displayNameOf(item.DisplayName) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {displayNameOf(item.DisplayName)}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 右侧：选项明细 + 导出 */}
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {detail?.Name ?? 'Option Details'}
              </CardTitle>
              {detail && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="secondary">{options.length} options</Badge>
                  {detail.IsCustomOptionSet && <Badge variant="outline">Custom</Badge>}
                </div>
              )}
            </div>
            {detail && options.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                {exports.map(exp => (
                  <Button
                    key={exp.key}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => copy(exp.key, exp.text())}
                  >
                    {copiedKey === exp.key ? (
                      <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <IconCopy className="h-3.5 w-3.5" />
                    )}
                    {exp.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedId ? (
            <EmptyState
              icon={<IconOptionsList className="h-6 w-6" />}
              title="Select an option set"
              description="Choose a global option set from the list to view its options."
            />
          ) : detailLoading ? (
            <LoadingState text="Loading options..." />
          ) : detail ? (
            <OptionsTable options={options} />
          ) : (
            <ErrorState message="Failed to load option set detail." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- Entity Option Sets 页签 ----------

function EntityOptionSetsTab() {
  const { options: entityOptions, loading: entitiesLoading } = useMetadataEntities()
  const [entityName, setEntityName] = useState('')
  const [fields, setFields] = useState<EntityOptionSetField[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setFields([])
    setError(null)
    setExpanded(new Set())
    if (!entityName) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/dataverse/optionsets/entity/${encodeURIComponent(entityName)}`)
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch entity option sets')
        }
        return res.json()
      })
      .then((data: { value: EntityOptionSetField[] }) => { if (!cancelled) setFields(data.value || []) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entityName, reloadKey])

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-md space-y-2">
            <Label>Entity</Label>
            <SearchSelect
              value={entityName}
              onChange={setEntityName}
              options={entityOptions}
              loading={entitiesLoading}
              placeholder="Select an entity..."
              triggerClassName="min-w-0"
            />
          </div>
        </CardContent>
      </Card>

      {!entityName ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconInspect className="h-6 w-6" />}
              title="Select an entity"
              description="Choose an entity to inspect its picklist and multi-select fields."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent>
            <LoadingState text="Loading option set fields..." />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <ErrorState message={error} />
            <Button variant="outline" size="sm" onClick={() => setReloadKey(key => key + 1)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : fields.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No option set fields"
              description={`Entity "${entityName}" has no picklist or multi-select fields.`}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Option Set Fields</CardTitle>
              <Badge variant="secondary">{fields.length} fields</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {fields.map(field => {
              const isOpen = expanded.has(field.LogicalName)
              const fieldOptions = getFieldOptions(field)
              const isGlobal = !!field.GlobalOptionSet
              return (
                <div key={field.LogicalName} className="rounded-lg border">
                  <button
                    onClick={() => toggle(field.LogicalName)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{field.LogicalName}</p>
                      {displayNameOf(field.DisplayName) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {displayNameOf(field.DisplayName)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {field.MultiSelect && <Badge variant="outline">Multi-Select</Badge>}
                      <Badge variant={isGlobal ? 'secondary' : 'outline'}>
                        {isGlobal ? 'Global' : 'Local'}
                      </Badge>
                      <Badge variant="secondary">{fieldOptions.length} options</Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t px-4 py-3">
                      {isGlobal && field.GlobalOptionSet?.Name && (
                        <p className="mb-2 text-xs text-muted-foreground">
                          Global option set:{' '}
                          <span className="font-mono">{field.GlobalOptionSet.Name}</span>
                        </p>
                      )}
                      <OptionsTable options={fieldOptions} />
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------- 页面 ----------

function OptionSetViewerContent() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconOptionsList className="h-5 w-5" />}
        title="Option Set Viewer"
        description="Inspect global and entity-level option sets, and export them as JSON, C# enums, or Power Fx tables."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />
      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Global Option Sets</TabsTrigger>
          <TabsTrigger value="entity">Entity Option Sets</TabsTrigger>
        </TabsList>
        <TabsContent value="global" className="mt-4">
          <GlobalOptionSetsTab />
        </TabsContent>
        <TabsContent value="entity" className="mt-4">
          <EntityOptionSetsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function OptionSetViewer() {
  return (
    <ConnectionGuard>
      <OptionSetViewerContent />
    </ConnectionGuard>
  )
}
