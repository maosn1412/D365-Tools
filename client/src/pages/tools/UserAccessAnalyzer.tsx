import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchSelect, AsyncSearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import { IconUser, IconWifi, IconPlus, IconTrash, IconShield, IconSpinner } from '@/components/ui/icons'
import {
  searchUsers,
  fetchUserProfile,
  fetchSecurityRoles,
  assignUserRole,
  removeUserRole,
  type UserSecurityProfile,
  type NamedRole,
} from '@/services/api'
import { cn } from '@/lib/utils'

// ---------- 常量 ----------

const ACCESS_MODE_MAP: Record<number, string> = {
  0: 'Read-Write',
  1: 'Administrative',
  2: 'Read',
  3: 'Support User',
  4: 'Non-interactive',
}

const TEAM_TYPE_MAP: Record<number, string> = {
  0: 'Owner',
  1: 'Access',
  2: 'AAD Security Group',
  3: 'AAD Office Group',
}

// ---------- 页面内容 ----------

function UserAccessAnalyzerContent() {
  const [userId, setUserId] = useState('')
  const [userLabel, setUserLabel] = useState('')
  const [profile, setProfile] = useState<UserSecurityProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // 角色分配对话框
  const [assignOpen, setAssignOpen] = useState(false)
  const [roleOptions, setRoleOptions] = useState<SearchSelectOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // 角色移除确认
  const [removeTarget, setRemoveTarget] = useState<NamedRole | null>(null)
  const [removing, setRemoving] = useState(false)

  const fetchUserOptions = useCallback(async (query: string): Promise<SearchSelectOption[]> => {
    const users = await searchUsers(query)
    return users.map(u => ({
      value: u.systemuserid,
      label: u.internalemailaddress ? `${u.fullname} (${u.internalemailaddress})` : u.fullname,
    }))
  }, [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUserProfile(userId)
      .then(data => { if (!cancelled) setProfile(data) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load profile') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, reloadKey])

  // 打开分配对话框时加载角色列表（过滤掉已直接分配的角色）
  const openAssignDialog = () => {
    setSelectedRoleId('')
    setActionError(null)
    setAssignOpen(true)
    if (roleOptions.length === 0) {
      setRolesLoading(true)
      fetchSecurityRoles()
        .then(roles => setRoleOptions(roles.map(r => ({ value: r.roleId, label: r.name }))))
        .catch(e => setActionError(e instanceof Error ? e.message : 'Failed to load roles'))
        .finally(() => setRolesLoading(false))
    }
  }

  const availableRoleOptions = useMemo(() => {
    if (!profile) return roleOptions
    const assigned = new Set(profile.directRoles.map(r => r.name))
    return roleOptions.filter(o => !assigned.has(o.label))
  }, [roleOptions, profile])

  const handleAssign = async () => {
    if (!selectedRoleId || !userId) return
    setAssigning(true)
    setActionError(null)
    try {
      await assignUserRole(userId, selectedRoleId)
      setAssignOpen(false)
      setReloadKey(k => k + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to assign role')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget || !userId) return
    setRemoving(true)
    try {
      await removeUserRole(userId, removeTarget.roleId)
      setRemoveTarget(null)
      setReloadKey(k => k + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove role')
      setRemoveTarget(null)
    } finally {
      setRemoving(false)
    }
  }

  // 有效角色：直接角色 + 团队角色按名称合并，标注来源
  const effectiveRoles = useMemo(() => {
    if (!profile) return []
    const byName = new Map<string, string[]>()
    const add = (name: string, source: string) => {
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name)!.push(source)
    }
    for (const r of profile.directRoles) add(r.name, 'Direct')
    for (const t of profile.teams) {
      for (const r of t.roles) add(r.name, `Team: ${t.name}`)
    }
    return [...byName.entries()]
      .map(([name, sources]) => ({ name, sources }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [profile])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconUser className="h-5 w-5" />}
        title="User Access Analyzer"
        description="Inspect a user's security roles, team memberships and effective permissions."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="w-full max-w-xl space-y-2">
            <Label>User</Label>
            <AsyncSearchSelect
              value={userId}
              label={userLabel}
              onSelect={(value, label) => {
                setUserId(value)
                setUserLabel(label)
                setActionError(null)
              }}
              fetchOptions={fetchUserOptions}
              placeholder="Search users by name or email..."
              triggerClassName="min-w-0"
            />
          </div>
        </CardContent>
      </Card>

      {actionError && <ErrorState message={actionError} />}

      {!userId ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconUser className="h-6 w-6" />}
              title="Select a user"
              description="Search for a user to view their complete security profile."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent>
            <LoadingState text="Loading security profile..." />
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState message={error} />
      ) : profile ? (
        <>
          {/* 用户信息卡片 */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{profile.user.fullname}</CardTitle>
                <Badge variant={profile.user.isdisabled ? 'destructive' : 'success'}>
                  {profile.user.isdisabled ? 'Disabled' : 'Enabled'}
                </Badge>
                <Badge variant="secondary">
                  {ACCESS_MODE_MAP[profile.user.accessmode] ?? `Mode ${profile.user.accessmode}`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Email</dt>
                  <dd className="mt-0.5 break-all">{profile.user.internalemailaddress || '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Domain Account</dt>
                  <dd className="mt-0.5 break-all">{profile.user.domainname || '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Business Unit</dt>
                  <dd className="mt-0.5">{profile.user.businessUnitName || '-'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Tabs defaultValue="direct">
            <TabsList>
              <TabsTrigger value="direct">Direct Roles ({profile.directRoles.length})</TabsTrigger>
              <TabsTrigger value="teams">Teams ({profile.teams.length})</TabsTrigger>
              <TabsTrigger value="effective">Effective Roles ({effectiveRoles.length})</TabsTrigger>
            </TabsList>

            {/* 直接角色 */}
            <TabsContent value="direct">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Directly Assigned Roles</CardTitle>
                    <Button size="sm" className="ml-auto h-8" onClick={openAssignDialog}>
                      <IconPlus className="h-3.5 w-3.5 mr-1" /> Assign Role
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {profile.directRoles.length === 0 ? (
                    <EmptyState
                      icon={<IconShield className="h-6 w-6" />}
                      title="No direct roles"
                      description="This user has no directly assigned security roles."
                    />
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Role Name</th>
                            <th className="px-3 py-2 w-24" />
                          </tr>
                        </thead>
                        <tbody>
                          {profile.directRoles.map((role, i) => (
                            <tr
                              key={role.roleId}
                              className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}
                            >
                              <td className="px-3 py-2 font-medium">{role.name}</td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Remove role"
                                  onClick={() => setRemoveTarget(role)}
                                >
                                  <IconTrash className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 团队 */}
            <TabsContent value="teams">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Team Memberships</CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.teams.length === 0 ? (
                    <EmptyState
                      icon={<IconUser className="h-6 w-6" />}
                      title="No teams"
                      description="This user is not a member of any team."
                    />
                  ) : (
                    <div className="space-y-3">
                      {profile.teams.map(team => (
                        <div key={team.teamId} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm">{team.name}</span>
                            <Badge variant="secondary">{TEAM_TYPE_MAP[team.teamType] ?? `Type ${team.teamType}`}</Badge>
                            {team.isDefault && <Badge variant="outline">Default BU Team</Badge>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {team.roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No roles assigned to this team</span>
                            ) : (
                              team.roles.map(r => (
                                <Badge key={r.roleId} variant="outline" className="text-xs">{r.name}</Badge>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 有效角色 */}
            <TabsContent value="effective">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Effective Roles (Direct + via Teams)</CardTitle>
                </CardHeader>
                <CardContent>
                  {effectiveRoles.length === 0 ? (
                    <EmptyState
                      icon={<IconShield className="h-6 w-6" />}
                      title="No effective roles"
                      description="This user has no roles from any source."
                    />
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Role Name</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveRoles.map((role, i) => (
                            <tr
                              key={role.name}
                              className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}
                            >
                              <td className="px-3 py-2 font-medium">{role.name}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {role.sources.map((s, idx) => (
                                    <Badge
                                      key={idx}
                                      variant={s === 'Direct' ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {s}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      {/* 分配角色对话框 */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Security Role</DialogTitle>
            <DialogDescription>
              Assign a security role directly to {profile?.user.fullname || 'this user'}. The role takes effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role</Label>
            <SearchSelect
              value={selectedRoleId}
              onChange={setSelectedRoleId}
              options={availableRoleOptions}
              loading={rolesLoading}
              placeholder="Select a role..."
              triggerClassName="min-w-0"
            />
            {actionError && assignOpen && (
              <p className="text-xs text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedRoleId || assigning}>
              {assigning && <IconSpinner className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移除角色确认 */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={open => { if (!open) setRemoveTarget(null) }}
        title="Remove Security Role"
        description={`Remove role "${removeTarget?.name}" from ${profile?.user.fullname || 'this user'}? The user's effective permissions change immediately.`}
        confirmText="Remove"
        destructive
        loading={removing}
        onConfirm={handleRemove}
      />
    </div>
  )
}

export function UserAccessAnalyzer() {
  return (
    <ConnectionGuard>
      <UserAccessAnalyzerContent />
    </ConnectionGuard>
  )
}
