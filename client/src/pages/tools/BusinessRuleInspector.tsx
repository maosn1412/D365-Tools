import { useEffect, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { SearchSelect } from '@/components/ui/search-select'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import {
  IconRules, IconChevronDown, IconChevronRight, IconWifi, IconInspect,
} from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'

// ---------- 类型定义 ----------

interface BusinessRule {
  workflowid: string
  name?: string
  description?: string
  modifiedon?: string
  statecode?: number
  statuscode?: number
}

interface RuleCondition {
  entity: string | null
  field: string | null
  operator: string | null
  value: string | null
}

interface RuleAction {
  type: string | null
  field: string | null
  value: string | null
}

interface RuleDetails {
  conditions: RuleCondition[]
  actions: RuleAction[]
  raw: unknown
}

function formatDate(iso?: string): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

// ---------- 规则详情 ----------

function RuleDetailsPanel({ workflowId }: { workflowId: string }) {
  const [details, setDetails] = useState<RuleDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/dataverse/businessrules/${workflowId}/details`)
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch rule details')
        }
        return res.json()
      })
      .then((data: RuleDetails) => { if (!cancelled) setDetails(data) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workflowId])

  if (loading) return <LoadingState text="Loading rule details..." />
  if (error) return <ErrorState message={error} />
  if (!details) return null

  const hasStructured = details.conditions.length > 0 || details.actions.length > 0

  return (
    <div className="space-y-4">
      {hasStructured ? (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Conditions */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conditions ({details.conditions.length})
            </p>
            {details.conditions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conditions detected.</p>
            ) : (
              <div className="space-y-1.5">
                {details.conditions.map((c, i) => (
                  <div key={i} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-medium">{c.field ?? '-'}</span>
                      <Badge variant="outline" className="text-[10px]">{c.operator ?? '?'}</Badge>
                    </div>
                    {c.value && (
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={c.value}>
                        Value: {c.value}
                      </p>
                    )}
                    {c.entity && c.entity !== '' && (
                      <p className="text-xs text-muted-foreground">Entity: {c.entity}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions ({details.actions.length})
            </p>
            {details.actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions detected.</p>
            ) : (
              <div className="space-y-1.5">
                {details.actions.map((a, i) => (
                  <div key={i} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{a.type ?? 'Action'}</Badge>
                      {a.field && <span className="font-mono text-xs font-medium">{a.field}</span>}
                    </div>
                    {a.value && (
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={a.value}>
                        Value: {a.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No structured conditions or actions could be extracted from this rule definition.
        </p>
      )}

      {/* 原始 JSON 回退展示 */}
      {details.raw != null && (
        <div>
          <button
            onClick={() => setShowRaw(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showRaw ? (
              <IconChevronDown className="h-3.5 w-3.5" />
            ) : (
              <IconChevronRight className="h-3.5 w-3.5" />
            )}
            Raw definition (JSON)
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs font-mono">
              {JSON.stringify(details.raw, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- 页面内容 ----------

function BusinessRuleInspectorContent() {
  const { options: entityOptions, loading: entitiesLoading } = useMetadataEntities()
  const [entityName, setEntityName] = useState('')
  const [rules, setRules] = useState<BusinessRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setRules([])
    setError(null)
    setExpanded(new Set())
    if (!entityName) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/dataverse/businessrules?entityName=${encodeURIComponent(entityName)}`)
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch business rules')
        }
        return res.json()
      })
      .then((data: { value: BusinessRule[] }) => { if (!cancelled) setRules(data.value || []) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entityName])

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconRules className="h-5 w-5" />}
        title="Business Rule Inspector"
        description="Inspect business rules defined on an entity, including their conditions and actions."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

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
              description="Choose an entity to list its business rules."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent>
            <LoadingState text="Loading business rules..." />
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState message={error} />
      ) : rules.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconRules className="h-6 w-6" />}
              title="No business rules"
              description={`Entity "${entityName}" has no business rules.`}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Business Rules</CardTitle>
              <Badge variant="secondary">{rules.length} rules</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {rules.map(rule => {
              const isOpen = expanded.has(rule.workflowid)
              const active = rule.statecode === 1
              return (
                <div key={rule.workflowid} className="rounded-lg border">
                  <button
                    onClick={() => toggle(rule.workflowid)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{rule.name || '(unnamed rule)'}</p>
                      {rule.description && (
                        <p className="truncate text-xs text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {formatDate(rule.modifiedon)}
                      </span>
                      <Badge variant={active ? 'success' : 'secondary'}>
                        {active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t px-4 py-3">
                      <RuleDetailsPanel workflowId={rule.workflowid} />
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

export function BusinessRuleInspector() {
  return (
    <ConnectionGuard>
      <BusinessRuleInspectorContent />
    </ConnectionGuard>
  )
}
