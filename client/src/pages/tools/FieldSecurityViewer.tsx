import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchSelect, AsyncSearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import { IconLock, IconWifi, IconSearch, IconPlus, IconTrash, IconUser, IconSpinner, IconInspect } from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'
import {
  fetchFieldSecurityProfiles,
  fetchProfilePermissions,
  fetchProfileMembers,
  assignProfileMember,
  removeProfileMember,
  fetchSecuredFields,
  searchUsers,
  searchTeams,
  type FieldSecurityProfile,
  type FieldPermission,
  type ProfileMember,
  type SecuredField,
} from '@/services/api'
import { cn } from '@/lib/utils'

// ---------- 页面内容 ----------

function FieldSecurityViewerContent() {
  const { options: entityOptions, loading: entitiesLoading } = useMetadataEntities()

  // Profiles 状态
  const [profiles, setProfiles] = useState<FieldSecurityProfile[] | null>(null)
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const [profileSearch, setProfileSearch] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')

  const [permissions, setPermissions] = useState<FieldPermission[] | null>(null)
  const [members, setMembers] = useState<ProfileMember[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [assignOpen, setAssignOpen] = useState(false)
  const [memberType, setMemberType] = useState<'user' | 'team'>('user')
  const [memberId, setMemberId] = useState('')
  const [memberLabel, setMemberLabel] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [removeTarget, setRemoveTarget] = useState<ProfileMember | null>(null)
  const [removing, setRemoving] = useState(false)

  // Secured Fields 状态
  const [entityName, setEntityName] = useState('')
  const [securedFields, setSecuredFields] = useState<SecuredField[] | null>(null)
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldsError, setFieldsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFieldSecurityProfiles()
      .then(list => { if (!cancelled) setProfiles(list) })
      .catch(e => { if (!cancelled) setProfilesError(e instanceof Error ? e.message : 'Failed to load profiles') })
      .finally(() => { if (!cancelled) setProfilesLoading(false) })
    return () => { cancelled = true }
  }, [])

  // 选中 profile 后加载权限与成员
  useEffect(() => {
    if (!selectedProfileId) {
      setPermissions(null)
      setMembers(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    Promise.all([fetchProfilePermissions(selectedProfileId), fetchProfileMembers(selectedProfileId)])
      .then(([perms, mems]) => {
        if (cancelled) return
        setPermissions(perms)
        setMembers(mems)
      })
      .catch(e => { if (!cancelled) setDetailError(e instanceof Error ? e.message : 'Failed to load profile detail') })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedProfileId, reloadKey])

  // Secured Fields 查询
  useEffect(() => {
    setSecuredFields(null)
    setFieldsError(null)
    if (!entityName) return
    let cancelled = false
    setFieldsLoading(true)
    fetchSecuredFields(entityName)
      .then(list => { if (!cancelled) setSecuredFields(list) })
      .catch(e => { if (!cancelled) setFieldsError(e instanceof Error ? e.message : 'Failed to load secured fields') })
      .finally(() => { if (!cancelled) setFieldsLoading(false) })
    return () => { cancelled = true }
  }, [entityName])

  const filteredProfiles = useMemo(() => {
    if (!profiles) return []
    const q = profileSearch.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(p => p.name.toLowerCase().includes(q))
  }, [profiles, profileSearch])

  const selectedProfile = profiles?.find(p => p.fieldsecurityprofileid === selectedProfileId)

  const permissionGroups = useMemo(() => {
    if (!permissions) return []
    const groups = new Map<string, FieldPermission[]>()
    for (const p of permissions) {
      if (!groups.has(p.entityName)) groups.set(p.entityName, [])
      groups.get(p.entityName)!.push(p)
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [permissions])

  const fetchUserOptions = useCallback(async (query: string): Promise<SearchSelectOption[]> => {
    const users = await searchUsers(query)
    return users.map(u => ({
      value: u.systemuserid,
      label: u.internalemailaddress ? `${u.fullname} (${u.internalemailaddress})` : u.fullname,
    }))
  }, [])

  const fetchTeamOptions = useCallback(async (query: string): Promise<SearchSelectOption[]> => {
    const teams = await searchTeams(query)
    return teams.map(t => ({ value: t.teamid, label: t.name }))
  }, [])

  const handleAssign = async () => {
    if (!selectedProfileId || !memberId) return
    setAssigning(true)
    setActionError(null)
    try {
      await assignProfileMember(selectedProfileId, memberId, memberType)
      setAssignOpen(false)
      setMemberId('')
      setMemberLabel('')
      setReloadKey(k => k + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to assign member')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget || !selectedProfileId) return
    setRemoving(true)
    try {
      await removeProfileMember(selectedProfileId, removeTarget.memberType, removeTarget.memberId)
      setRemoveTarget(null)
      setReloadKey(k => k + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove member')
      setRemoveTarget(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconLock className="h-5 w-5" />}
        title="Field Security Profile Viewer"
        description="Inspect field-level security profiles, their permissions, members and secured fields."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

      {actionError && <ErrorState message={actionError} />}

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="secured">Secured Fields</TabsTrigger>
        </TabsList>

        {/* ---------- Profiles Tab ---------- */}
        <TabsContent value="profiles">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 左侧 profile 列表 */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Profiles</CardTitle>
                <div className="relative mt-2">
                  <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={profileSearch}
                    onChange={e => setProfileSearch(e.target.value)}
                    placeholder="Filter profiles..."
                    className="pl-8 h-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {profilesLoading ? (
                  <LoadingState text="Loading profiles..." />
                ) : profilesError ? (
                  <ErrorState message={profilesError} />
                ) : filteredProfiles.length === 0 ? (
                  <EmptyState
                    icon={<IconLock className="h-6 w-6" />}
                    title="No profiles"
                    description="No field security profiles found in this environment."
                  />
                ) : (
                  <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                    {filteredProfiles.map(p => (
                      <button
                        key={p.fieldsecurityprofileid}
                        type="button"
                        onClick={() => setSelectedProfileId(p.fieldsecurityprofileid)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                          p.fieldsecurityprofileid === selectedProfileId && 'border-primary bg-primary/5'
                        )}
                      >
                        <p className="font-medium truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 右侧详情 */}
            <div className="lg:col-span-2 space-y-4">
              {!selectedProfileId ? (
                <Card>
                  <CardContent>
                    <EmptyState
                      icon={<IconLock className="h-6 w-6" />}
                      title="Select a profile"
                      description="Choose a field security profile to view its permissions and members."
                    />
                  </CardContent>
                </Card>
              ) : detailLoading ? (
                <Card>
                  <CardContent>
                    <LoadingState text="Loading profile detail..." />
                  </CardContent>
                </Card>
              ) : detailError ? (
                <ErrorState message={detailError} />
              ) : (
                <>
                  {/* 权限矩阵 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{selectedProfile?.name}</CardTitle>
                        <Badge variant="secondary">{permissions?.length ?? 0} field permissions</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!permissions || permissions.length === 0 ? (
                        <EmptyState
                          icon={<IconLock className="h-6 w-6" />}
                          title="No field permissions"
                          description="This profile has no field permissions configured."
                        />
                      ) : (
                        <div className="space-y-4">
                          {permissionGroups.map(([entity, perms]) => (
                            <div key={entity} className="rounded-lg border overflow-hidden">
                              <div className="bg-muted/50 px-3 py-1.5 flex items-center gap-2">
                                <span className="text-xs font-semibold font-mono">{entity}</span>
                                <Badge variant="secondary" className="text-[10px]">{perms.length}</Badge>
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-muted-foreground">
                                    <th className="px-3 py-1.5 text-left font-medium">Field</th>
                                    <th className="px-3 py-1.5 text-center font-medium w-20">Read</th>
                                    <th className="px-3 py-1.5 text-center font-medium w-20">Update</th>
                                    <th className="px-3 py-1.5 text-center font-medium w-20">Create</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {perms.map((p, i) => (
                                    <tr
                                      key={p.fieldPermissionId}
                                      className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}
                                    >
                                      <td className="px-3 py-1.5 font-mono text-xs">{p.attributeLogicalName}</td>
                                      {[p.canread, p.canupdate, p.cancreate].map((perm, idx) => (
                                        <td key={idx} className="px-3 py-1.5 text-center">
                                          <Badge
                                            variant={perm.label.toLowerCase() === 'yes' ? 'success' : 'secondary'}
                                            className="text-[11px]"
                                          >
                                            {perm.label}
                                          </Badge>
                                        </td>
                                      ))}
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

                  {/* 成员 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">Members</CardTitle>
                        <Badge variant="secondary">{members?.length ?? 0}</Badge>
                        <Button
                          size="sm"
                          className="ml-auto h-8"
                          onClick={() => {
                            setActionError(null)
                            setMemberType('user')
                            setMemberId('')
                            setMemberLabel('')
                            setAssignOpen(true)
                          }}
                        >
                          <IconPlus className="h-3.5 w-3.5 mr-1" /> Assign Member
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!members || members.length === 0 ? (
                        <EmptyState
                          icon={<IconUser className="h-6 w-6" />}
                          title="No members"
                          description="No users or teams are assigned to this profile."
                        />
                      ) : (
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Type</th>
                                <th className="px-3 py-2 w-20" />
                              </tr>
                            </thead>
                            <tbody>
                              {members.map((m, i) => (
                                <tr
                                  key={`${m.memberType}-${m.memberId}`}
                                  className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}
                                >
                                  <td className="px-3 py-2 font-medium max-w-0 truncate" title={m.name}>
                                    {m.name || m.memberId}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant={m.memberType === 'user' ? 'default' : 'secondary'}>
                                      {m.memberType === 'user' ? 'User' : 'Team'}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      title="Remove member"
                                      onClick={() => setRemoveTarget(m)}
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
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ---------- Secured Fields Tab ---------- */}
        <TabsContent value="secured">
          <Card>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>

          <div className="mt-4">
            {!entityName ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={<IconInspect className="h-6 w-6" />}
                    title="Select an entity"
                    description="View which fields of the entity are protected by field-level security."
                  />
                </CardContent>
              </Card>
            ) : fieldsLoading ? (
              <Card>
                <CardContent>
                  <LoadingState text="Loading secured fields..." />
                </CardContent>
              </Card>
            ) : fieldsError ? (
              <ErrorState message={fieldsError} />
            ) : securedFields ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Secured Fields</CardTitle>
                    <Badge variant="secondary">{securedFields.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {securedFields.length === 0 ? (
                    <EmptyState
                      icon={<IconLock className="h-6 w-6" />}
                      title="No secured fields"
                      description={`Entity "${entityName}" has no fields with field-level security enabled.`}
                    />
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Logical Name</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Display Name</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securedFields.map((f, i) => (
                            <tr
                              key={f.logicalName}
                              className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}
                            >
                              <td className="px-3 py-2 font-mono text-xs">{f.logicalName}</td>
                              <td className="px-3 py-2">{f.displayName || '-'}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="text-[11px]">{f.attributeType}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      {/* 分配成员对话框 */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Member</DialogTitle>
            <DialogDescription>
              Assign a user or team to profile "{selectedProfile?.name}". Members immediately gain the profile's field permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={memberType} onValueChange={v => { setMemberType(v as 'user' | 'team'); setMemberId(''); setMemberLabel('') }}>
              <TabsList>
                <TabsTrigger value="user">User</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-2">
              <Label>{memberType === 'user' ? 'User' : 'Team'}</Label>
              <AsyncSearchSelect
                value={memberId}
                label={memberLabel}
                onSelect={(value, label) => { setMemberId(value); setMemberLabel(label) }}
                fetchOptions={memberType === 'user' ? fetchUserOptions : fetchTeamOptions}
                placeholder={memberType === 'user' ? 'Search users...' : 'Search teams...'}
                triggerClassName="min-w-0"
              />
            </div>
            {actionError && assignOpen && (
              <p className="text-xs text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!memberId || assigning}>
              {assigning && <IconSpinner className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移除成员确认 */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={open => { if (!open) setRemoveTarget(null) }}
        title="Remove Profile Member"
        description={`Remove ${removeTarget?.memberType === 'user' ? 'user' : 'team'} "${removeTarget?.name || removeTarget?.memberId}" from profile "${selectedProfile?.name}"? They lose the profile's field permissions immediately.`}
        confirmText="Remove"
        destructive
        loading={removing}
        onConfirm={handleRemove}
      />
    </div>
  )
}

export function FieldSecurityViewer() {
  return (
    <ConnectionGuard>
      <FieldSecurityViewerContent />
    </ConnectionGuard>
  )
}
