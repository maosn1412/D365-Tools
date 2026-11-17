import { useEffect, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import { IconCompare, IconWifi, IconShield } from '@/components/ui/icons'
import { fetchSecurityRoles, compareRoles, addRolePrivileges, type RoleCompareResult, type ComparedPrivilege } from '@/services/api'
import { cn } from '@/lib/utils'

// ---------- 权限深度样式（与 SecurityRoleViewer 一致） ----------

interface DepthInfo {
  short: string
  full: string
  className: string
}

const DEPTH_MAP: Record<number, DepthInfo> = {
  8: { short: 'Org', full: 'Organization', className: 'bg-emerald-100 text-emerald-800' },
  4: { short: 'P:C BU', full: 'Parent: Child Business Unit', className: 'bg-violet-100 text-violet-800' },
  2: { short: 'BU', full: 'Business Unit', className: 'bg-sky-100 text-sky-800' },
  1: { short: 'User', full: 'User', className: 'bg-amber-100 text-amber-800' },
}

const NONE_DEPTH: DepthInfo = { short: '-', full: 'No privilege', className: 'bg-muted text-muted-foreground' }

function DepthBadge({ depth }: { depth: number }) {
  const info = DEPTH_MAP[depth] || NONE_DEPTH
  return (
    <span
      title={info.full}
      className={cn('inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold', info.className)}
    >
      {info.short}
    </span>
  )
}

// ---------- 分组 ----------

const ACTION_PATTERN = /^prv(Create|Read|Write|Delete|AppendTo|Append|Assign|Share)(.+)$/i

function groupOf(privilegeName: string): string {
  const match = ACTION_PATTERN.exec(privilegeName)
  return match ? match[2] : '(other)'
}

type FilterKey = 'all' | 'diff' | 'onlyA' | 'onlyB' | 'depthDiff' | 'both'

const STATUS_META: Record<ComparedPrivilege['status'], { label: string; className: string }> = {
  onlyA: { label: 'Only A', className: 'bg-sky-100 text-sky-800' },
  onlyB: { label: 'Only B', className: 'bg-orange-100 text-orange-800' },
  depthDiff: { label: 'Depth Diff', className: 'bg-violet-100 text-violet-800' },
  both: { label: 'Same', className: 'bg-muted text-muted-foreground' },
}

// ---------- 页面内容 ----------

function SecurityRoleCompareContent() {
  const [roleOptions, setRoleOptions] = useState<SearchSelectOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [rolesError, setRolesError] = useState<string | null>(null)

  const [roleIdA, setRoleIdA] = useState('')
  const [roleIdB, setRoleIdB] = useState('')
  const [result, setResult] = useState<RoleCompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('diff')

  const [syncOpen, setSyncOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchSecurityRoles()
      .then(roles => {
        if (!cancelled) setRoleOptions(roles.map(r => ({ value: r.roleId, label: r.name })))
      })
      .catch(e => { if (!cancelled) setRolesError(e instanceof Error ? e.message : 'Failed to load roles') })
      .finally(() => { if (!cancelled) setRolesLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setResult(null)
    setError(null)
    if (!roleIdA || !roleIdB) return
    let cancelled = false
    setLoading(true)
    compareRoles(roleIdA, roleIdB)
      .then(data => { if (!cancelled) setResult(data) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to compare roles') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [roleIdA, roleIdB, reloadKey])

  const roleNameA = roleOptions.find(o => o.value === roleIdA)?.label ?? 'Role A'
  const roleNameB = roleOptions.find(o => o.value === roleIdB)?.label ?? 'Role B'

  const filtered = useMemo(() => {
    if (!result) return []
    switch (filter) {
      case 'diff': return result.privileges.filter(p => p.status !== 'both')
      case 'onlyA': return result.privileges.filter(p => p.status === 'onlyA')
      case 'onlyB': return result.privileges.filter(p => p.status === 'onlyB')
      case 'depthDiff': return result.privileges.filter(p => p.status === 'depthDiff')
      case 'both': return result.privileges.filter(p => p.status === 'both')
      default: return result.privileges
    }
  }, [result, filter])

  const grouped = useMemo(() => {
    const groups = new Map<string, ComparedPrivilege[]>()
    for (const p of filtered) {
      const key = groupOf(p.name)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const onlyAPrivileges = useMemo(
    () => (result?.privileges ?? []).filter(p => p.status === 'onlyA'),
    [result]
  )

  const handleSync = async () => {
    if (!roleIdB || onlyAPrivileges.length === 0) return
    setSyncing(true)
    setActionError(null)
    try {
      await addRolePrivileges(
        roleIdB,
        onlyAPrivileges.map(p => ({ privilegeId: p.privilegeId, depth: p.depthA }))
      )
      setSyncOpen(false)
      setReloadKey(k => k + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to copy privileges')
      setSyncOpen(false)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconCompare className="h-5 w-5" />}
        title="Security Role Compare"
        description="Diff the full privilege sets of two security roles side by side."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label>Role A</Label>
              <SearchSelect
                value={roleIdA}
                onChange={setRoleIdA}
                options={roleOptions}
                loading={rolesLoading}
                placeholder="Select role A..."
                triggerClassName="min-w-0"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Role B</Label>
              <SearchSelect
                value={roleIdB}
                onChange={setRoleIdB}
                options={roleOptions}
                loading={rolesLoading}
                placeholder="Select role B..."
                triggerClassName="min-w-0"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Note: roles are de-duplicated by name (one copy per business unit); the compare uses the first copy of each name.
          </p>
        </CardContent>
      </Card>

      {rolesError && <ErrorState message={rolesError} />}
      {actionError && <ErrorState message={actionError} />}

      {!roleIdA || !roleIdB ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconCompare className="h-6 w-6" />}
              title="Select two roles"
              description="Choose Role A and Role B to compare their privilege sets."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent>
            <LoadingState text="Comparing privileges..." />
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState message={error} />
      ) : result ? (
        <>
          {/* 差异统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: `Only in A`, value: result.summary.onlyA, className: 'text-sky-700' },
              { label: `Only in B`, value: result.summary.onlyB, className: 'text-orange-700' },
              { label: 'Depth Different', value: result.summary.depthDiff, className: 'text-violet-700' },
              { label: 'Identical', value: result.summary.same, className: 'text-muted-foreground' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4">
                  <p className={cn('text-2xl font-bold', s.className)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Privilege Diff</CardTitle>
                <Badge variant="secondary">{filtered.length} / {result.privileges.length}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-8"
                  disabled={onlyAPrivileges.length === 0}
                  title={onlyAPrivileges.length === 0 ? 'No privileges exclusive to A' : `Add ${onlyAPrivileges.length} privileges to B`}
                  onClick={() => setSyncOpen(true)}
                >
                  Copy missing A → B ({onlyAPrivileges.length})
                </Button>
              </div>
              <Tabs value={filter} onValueChange={v => setFilter(v as FilterKey)} className="mt-3">
                <TabsList>
                  <TabsTrigger value="diff">Differences</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="onlyA">Only A</TabsTrigger>
                  <TabsTrigger value="onlyB">Only B</TabsTrigger>
                  <TabsTrigger value="depthDiff">Depth Diff</TabsTrigger>
                  <TabsTrigger value="both">Same</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<IconShield className="h-6 w-6" />}
                  title="Nothing to show"
                  description="No privileges match the current filter."
                />
              ) : (
                <div className="space-y-4">
                  {grouped.map(([group, privileges]) => (
                    <div key={group} className="rounded-lg border overflow-hidden">
                      <div className="bg-muted/50 px-3 py-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold">{group}</span>
                        <Badge variant="secondary" className="text-[10px]">{privileges.length}</Badge>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {privileges.map((p, i) => (
                            <tr key={p.name} className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}>
                              <td className="px-3 py-1.5 font-mono text-xs max-w-0 truncate" title={p.name}>
                                {p.name}
                              </td>
                              <td className="px-2 py-1.5 text-center w-20">
                                <DepthBadge depth={p.depthA} />
                              </td>
                              <td className="px-2 py-1.5 text-center w-20">
                                <DepthBadge depth={p.depthB} />
                              </td>
                              <td className="px-3 py-1.5 text-right w-28">
                                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_META[p.status].className)}>
                                  {STATUS_META[p.status].label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* A→B 同步确认 */}
      <ConfirmDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        title="Copy Privileges A → B"
        description={`Add the ${onlyAPrivileges.length} privileges that only "${roleNameA}" has to "${roleNameB}" (with A's depth). This is an incremental union — it never removes privileges from B. The change applies to the first business-unit copy of the role.`}
        confirmText={`Add ${onlyAPrivileges.length} Privileges`}
        loading={syncing}
        onConfirm={handleSync}
      />
    </div>
  )
}

export function SecurityRoleCompare() {
  return (
    <ConnectionGuard>
      <SecurityRoleCompareContent />
    </ConnectionGuard>
  )
}
