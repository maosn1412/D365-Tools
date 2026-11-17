import { useEffect, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchSelect } from '@/components/ui/search-select'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import { IconShield, IconSearch, IconWifi, IconInspect } from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'
import { cn } from '@/lib/utils'

// ---------- 类型定义 ----------

interface RolePrivilegeRow {
  roleId: string
  roleName: string
  privileges: Partial<Record<string, number>>
}

interface MatrixResponse {
  actions: string[]
  roles: RolePrivilegeRow[]
}

// ---------- 权限深度样式 ----------

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

const NONE_DEPTH: DepthInfo = {
  short: 'None',
  full: 'None',
  className: 'bg-muted text-muted-foreground',
}

function DepthBadge({ depth }: { depth: number | undefined }) {
  const info = (depth && DEPTH_MAP[depth]) || NONE_DEPTH
  return (
    <span
      title={info.full}
      className={cn(
        'inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        info.className
      )}
    >
      {info.short}
    </span>
  )
}

// ---------- 页面内容 ----------

function SecurityRoleViewerContent() {
  const { options: entityOptions, loading: entitiesLoading } = useMetadataEntities()
  const [entityName, setEntityName] = useState('')
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleSearch, setRoleSearch] = useState('')

  useEffect(() => {
    setMatrix(null)
    setError(null)
    if (!entityName) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/dataverse/security/matrix?entityName=${encodeURIComponent(entityName)}`)
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch privilege matrix')
        }
        return res.json()
      })
      .then((data: MatrixResponse) => { if (!cancelled) setMatrix(data) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entityName])

  const filteredRoles = useMemo(() => {
    if (!matrix) return []
    const q = roleSearch.trim().toLowerCase()
    if (!q) return matrix.roles
    return matrix.roles.filter(r => r.roleName.toLowerCase().includes(q))
  }, [matrix, roleSearch])

  const actions = matrix?.actions ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconShield className="h-5 w-5" />}
        title="Security Role Privilege Viewer"
        description="Compare privilege levels across security roles for a specific entity."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full max-w-md space-y-2">
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
            {matrix && (
              <div className="relative min-w-0 flex-1 max-w-xs">
                <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={roleSearch}
                  onChange={e => setRoleSearch(e.target.value)}
                  placeholder="Filter roles..."
                  className="pl-8 h-9"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!entityName ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconInspect className="h-6 w-6" />}
              title="Select an entity"
              description="Choose an entity to view the privilege matrix across all security roles."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent>
            <LoadingState text="Loading privilege matrix..." />
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState message={error} />
      ) : matrix ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Privilege Matrix</CardTitle>
              <Badge variant="secondary">
                {filteredRoles.length}{filteredRoles.length !== matrix.roles.length ? ` / ${matrix.roles.length}` : ''} roles
              </Badge>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {Object.values(DEPTH_MAP).reverse().map(d => (
                  <span
                    key={d.short}
                    className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', d.className)}
                  >
                    {d.full}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRoles.length === 0 ? (
              <EmptyState
                icon={<IconShield className="h-6 w-6" />}
                title="No roles found"
                description="No security roles match your filter."
              />
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-48">
                          Security Role
                        </th>
                        {actions.map(action => (
                          <th key={action} className="px-2 py-2 text-center font-medium text-muted-foreground">
                            {action}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoles.map((role, i) => (
                        <tr
                          key={role.roleId}
                          className={cn(
                            'border-t transition-colors hover:bg-muted/40',
                            i % 2 === 1 && 'bg-muted/30'
                          )}
                        >
                          <td className="px-3 py-2 font-medium max-w-0 truncate" title={role.roleName}>
                            {role.roleName}
                          </td>
                          {actions.map(action => (
                            <td key={action} className="px-2 py-2 text-center">
                              <DepthBadge depth={role.privileges[action]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export function SecurityRoleViewer() {
  return (
    <ConnectionGuard>
      <SecurityRoleViewerContent />
    </ConnectionGuard>
  )
}
