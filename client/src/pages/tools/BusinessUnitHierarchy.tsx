import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { LoadingState, ErrorState } from '@/components/ui/state-display'
import { IconDashboard, IconUser, IconChevronDown, IconChevronRight, IconSpinner } from '@/components/ui/icons'
import { fetchBusinessUnitTree, fetchBusinessUnitDetails, type BUItem, type BUDetails } from '@/services/api'

interface TreeNode extends BUItem {
  children: TreeNode[]
}

function buildTree(units: BUItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const u of units) {
    map.set(u.id, { ...u, children: [] })
  }

  for (const u of units) {
    const node = map.get(u.id)!
    if (u.parentId && map.has(u.parentId)) {
      map.get(u.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function TreeNodeItem({ node, depth, selectedId, onSelect }: {
  node: TreeNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors hover:bg-accent ${
          isSelected ? 'bg-accent font-medium' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            className="shrink-0 p-0.5 rounded hover:bg-accent"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            {expanded
              ? <IconChevronDown className="h-3.5 w-3.5" />
              : <IconChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-4.5 shrink-0" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {node.createdon && (
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(node.createdon).getFullYear()}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BusinessUnitHierarchyInner() {
  const [units, setUnits] = useState<BUItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<BUDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const loadTree = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBusinessUnitTree()
      setUnits(data)
      if (data.length > 0 && !selectedId) {
        const root = buildTree(data)[0]
        if (root) setSelectedId(root.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business units')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadTree()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return
    setDetailsLoading(true)
    fetchBusinessUnitDetails(selectedId)
      .then(setDetails)
      .catch(() => setDetails(null))
      .finally(() => setDetailsLoading(false))
  }, [selectedId])

  const tree = buildTree(units)

  if (loading) return <LoadingState text="Loading business unit hierarchy..." />
  if (error) return <ErrorState message={error} />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconDashboard className="h-5 w-5" />}
        title="Business Unit Hierarchy"
        description="Visualize the organization's business unit structure, users, teams, and role assignments."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Tree */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Business Units ({units.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-0.5 max-h-[600px] overflow-auto">
              {tree.map(node => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Details */}
        <div className="lg:col-span-2 space-y-4">
          {detailsLoading ? (
            <Card>
              <CardContent className="pt-6 flex items-center justify-center">
                <IconSpinner className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading details...</span>
              </CardContent>
            </Card>
          ) : details ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold">{details.stats.userCount}</div>
                    <div className="text-xs text-muted-foreground">Users</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold">{details.stats.teamCount}</div>
                    <div className="text-xs text-muted-foreground">Teams</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold">{details.stats.roleCount}</div>
                    <div className="text-xs text-muted-foreground">Roles</div>
                  </CardContent>
                </Card>
              </div>

              {/* Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{details.name}</CardTitle>
                  <CardDescription>Business Unit Details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">BU ID:</span>{' '}
                      <span className="font-mono text-xs">{details.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Parent BU:</span>{' '}
                      <span className="font-medium">{details.parentName || '(Root)'}</span>
                    </div>
                    {details.createdon && (
                      <div>
                        <span className="text-muted-foreground">Created:</span>{' '}
                        <span>{new Date(details.createdon).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Users */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <IconUser className="h-4 w-4" />
                    Users ({details.users.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {details.users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users in this business unit.</p>
                  ) : (
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {details.users.map(u => (
                        <div key={u.id} className="flex items-center justify-between text-sm rounded px-2 py-1 hover:bg-muted/50">
                          <span>{u.name}</span>
                          <span className="text-xs text-muted-foreground">{u.domain}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Teams */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Teams ({details.teams.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {details.teams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No teams in this business unit.</p>
                  ) : (
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {details.teams.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-sm rounded px-2 py-1 hover:bg-muted/50">
                          <span>{t.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {t.teamType === 0 ? 'Owner' : t.teamType === 1 ? 'Access' : `Type ${t.teamType}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Roles */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Security Roles ({details.roles.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {details.roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No roles in this business unit.</p>
                  ) : (
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {details.roles.map(r => (
                        <div key={r.id} className="flex items-center text-sm rounded px-2 py-1 hover:bg-muted/50">
                          <span>{r.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                Select a business unit from the tree to view details.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export function BusinessUnitHierarchy() {
  return (
    <ConnectionGuard>
      <BusinessUnitHierarchyInner />
    </ConnectionGuard>
  )
}
