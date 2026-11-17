import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchSelect, AsyncSearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import { IconShare, IconWifi, IconPlus, IconTrash, IconCheck, IconSpinner } from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'
import {
  searchRecords,
  searchUsers,
  searchTeams,
  fetchSharedPrincipals,
  shareRecord,
  revokeRecordAccess,
  type SharedPrincipal,
} from '@/services/api'
import { cn } from '@/lib/utils'

// ---------- 常量 ----------

const ALL_RIGHTS = [
  'ReadAccess',
  'WriteAccess',
  'AppendAccess',
  'AppendToAccess',
  'CreateAccess',
  'DeleteAccess',
  'ShareAccess',
  'AssignAccess',
] as const

function shortRight(right: string): string {
  return right.replace(/Access$/, '')
}

// ---------- 共享对话框状态 ----------

interface ShareDialogState {
  mode: 'new' | 'edit'
  principalType: 'systemusers' | 'teams'
  principalId: string
  principalLabel: string
  rights: string[]
}

const EMPTY_SHARE_DIALOG: ShareDialogState = {
  mode: 'new',
  principalType: 'systemusers',
  principalId: '',
  principalLabel: '',
  rights: ['ReadAccess'],
}

// ---------- 页面内容 ----------

function RecordSharingAuditorContent() {
  const { entities, options: entityOptions, loading: entitiesLoading } = useMetadataEntities()

  const [entityName, setEntityName] = useState('')
  const [recordId, setRecordId] = useState('')
  const [recordLabel, setRecordLabel] = useState('')

  const [principals, setPrincipals] = useState<SharedPrincipal[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [shareDialog, setShareDialog] = useState<ShareDialogState | null>(null)
  const [sharing, setSharing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [revokeTarget, setRevokeTarget] = useState<SharedPrincipal | null>(null)
  const [revoking, setRevoking] = useState(false)

  const selectedEntity = useMemo(
    () => entities.find(e => e.LogicalName === entityName),
    [entities, entityName]
  )

  const fetchRecordOptions = useCallback(
    async (query: string): Promise<SearchSelectOption[]> => {
      if (!selectedEntity?.EntitySetName || !selectedEntity.PrimaryIdAttribute || !selectedEntity.PrimaryNameAttribute) {
        return []
      }
      const records = await searchRecords(
        selectedEntity.EntitySetName,
        selectedEntity.PrimaryIdAttribute,
        selectedEntity.PrimaryNameAttribute,
        query
      )
      return records.map(r => ({ value: r.id, label: r.name || r.id }))
    },
    [selectedEntity]
  )

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

  useEffect(() => {
    if (!selectedEntity?.EntitySetName || !recordId) {
      setPrincipals(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchSharedPrincipals(selectedEntity.EntitySetName, recordId)
      .then(list => { if (!cancelled) setPrincipals(list) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load shared principals') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedEntity, recordId, reloadKey])

  const toggleRight = (right: string) => {
    setShareDialog(prev => {
      if (!prev) return prev
      const has = prev.rights.includes(right)
      return { ...prev, rights: has ? prev.rights.filter(r => r !== right) : [...prev.rights, right] }
    })
  }

  const handleShare = async () => {
    if (!shareDialog || !selectedEntity?.EntitySetName || !recordId) return
    setSharing(true)
    setActionError(null)
    try {
      await shareRecord({
        entitySetName: selectedEntity.EntitySetName,
        recordId,
        principalId: shareDialog.principalId,
        principalType: shareDialog.principalType,
        rights: shareDialog.rights,
        isExisting: shareDialog.mode === 'edit',
      })
      setShareDialog(null)
      setReloadKey(k => k + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to share record')
    } finally {
      setSharing(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget || !selectedEntity?.EntitySetName || !recordId) return
    setRevoking(true)
    try {
      await revokeRecordAccess({
        entitySetName: selectedEntity.EntitySetName,
        recordId,
        principalId: revokeTarget.principalId,
        principalType: revokeTarget.principalType,
      })
      setRevokeTarget(null)
      setReloadKey(k => k + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to revoke access')
      setRevokeTarget(null)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconShare className="h-5 w-5" />}
        title="Record Sharing Auditor"
        description="See who a record is shared with, grant new shares or revoke existing ones."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label>Entity</Label>
              <SearchSelect
                value={entityName}
                onChange={v => {
                  setEntityName(v)
                  setRecordId('')
                  setRecordLabel('')
                  setPrincipals(null)
                  setActionError(null)
                }}
                options={entityOptions}
                loading={entitiesLoading}
                placeholder="Select an entity..."
                triggerClassName="min-w-0"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Record</Label>
              <AsyncSearchSelect
                value={recordId}
                label={recordLabel}
                onSelect={(value, label) => {
                  setRecordId(value)
                  setRecordLabel(label)
                  setActionError(null)
                }}
                fetchOptions={fetchRecordOptions}
                disabled={!entityName}
                placeholder={entityName ? 'Search records by name...' : 'Select an entity first'}
                triggerClassName="min-w-0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {actionError && <ErrorState message={actionError} />}

      {!recordId ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconShare className="h-6 w-6" />}
              title="Select a record"
              description="Pick an entity and a record to audit its sharing."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent>
            <LoadingState text="Loading shared principals..." />
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState message={error} />
      ) : principals ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Shared Principals</CardTitle>
              <Badge variant="secondary">{principals.length}</Badge>
              <span className="text-xs text-muted-foreground truncate max-w-xs">{recordLabel}</span>
              <Button
                size="sm"
                className="ml-auto h-8"
                onClick={() => { setActionError(null); setShareDialog(EMPTY_SHARE_DIALOG) }}
              >
                <IconPlus className="h-3.5 w-3.5 mr-1" /> Share Record
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {principals.length === 0 ? (
              <EmptyState
                icon={<IconShare className="h-6 w-6" />}
                title="Not shared"
                description="This record is not explicitly shared with any user or team."
              />
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Principal</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rights</th>
                      <th className="px-3 py-2 w-32" />
                    </tr>
                  </thead>
                  <tbody>
                    {principals.map((p, i) => (
                      <tr
                        key={`${p.principalType}-${p.principalId}`}
                        className={cn('border-t transition-colors hover:bg-muted/40', i % 2 === 1 && 'bg-muted/30')}
                      >
                        <td className="px-3 py-2 font-medium max-w-0 truncate" title={p.name}>
                          {p.name || p.principalId}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={p.principalType === 'systemusers' ? 'default' : 'secondary'}>
                            {p.principalType === 'systemusers' ? 'User' : 'Team'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {p.rights.map(r => (
                              <Badge key={r} variant="outline" className="text-[11px]">{shortRight(r)}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setActionError(null)
                              setShareDialog({
                                mode: 'edit',
                                principalType: p.principalType,
                                principalId: p.principalId,
                                principalLabel: p.name || p.principalId,
                                rights: [...p.rights],
                              })
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Revoke all shared access"
                            onClick={() => setRevokeTarget(p)}
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
      ) : null}

      {/* 共享/编辑对话框 */}
      <Dialog open={shareDialog !== null} onOpenChange={open => { if (!open) setShareDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{shareDialog?.mode === 'edit' ? 'Edit Shared Access' : 'Share Record'}</DialogTitle>
            <DialogDescription>
              {shareDialog?.mode === 'edit'
                ? `Modify the access rights of ${shareDialog.principalLabel} on this record.`
                : 'Grant a user or team access to this record.'}
            </DialogDescription>
          </DialogHeader>
          {shareDialog && (
            <div className="space-y-4">
              {shareDialog.mode === 'new' && (
                <>
                  <Tabs
                    value={shareDialog.principalType}
                    onValueChange={v => setShareDialog(prev => prev && {
                      ...prev,
                      principalType: v as 'systemusers' | 'teams',
                      principalId: '',
                      principalLabel: '',
                    })}
                  >
                    <TabsList>
                      <TabsTrigger value="systemusers">User</TabsTrigger>
                      <TabsTrigger value="teams">Team</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="space-y-2">
                    <Label>{shareDialog.principalType === 'systemusers' ? 'User' : 'Team'}</Label>
                    <AsyncSearchSelect
                      value={shareDialog.principalId}
                      label={shareDialog.principalLabel}
                      onSelect={(value, label) => setShareDialog(prev => prev && {
                        ...prev,
                        principalId: value,
                        principalLabel: label,
                      })}
                      fetchOptions={shareDialog.principalType === 'systemusers' ? fetchUserOptions : fetchTeamOptions}
                      placeholder={shareDialog.principalType === 'systemusers' ? 'Search users...' : 'Search teams...'}
                      triggerClassName="min-w-0"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Access Rights</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_RIGHTS.map(right => {
                    const checked = shareDialog.rights.includes(right)
                    return (
                      <button
                        key={right}
                        type="button"
                        onClick={() => toggleRight(right)}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-left transition-colors',
                          checked ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-input',
                            checked && 'border-primary bg-primary text-primary-foreground'
                          )}
                        >
                          {checked && <IconCheck className="h-2.5 w-2.5" />}
                        </span>
                        {shortRight(right)}
                      </button>
                    )
                  })}
                </div>
              </div>
              {actionError && (
                <p className="text-xs text-destructive">{actionError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialog(null)} disabled={sharing}>
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={!shareDialog || !shareDialog.principalId || shareDialog.rights.length === 0 || sharing}
            >
              {sharing && <IconSpinner className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {shareDialog?.mode === 'edit' ? 'Save' : 'Share'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤销确认 */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={open => { if (!open) setRevokeTarget(null) }}
        title="Revoke Shared Access"
        description={`Revoke ALL shared access of "${revokeTarget?.name || revokeTarget?.principalId}" on this record. This removes every shared right for this principal.`}
        confirmText="Revoke"
        destructive
        loading={revoking}
        onConfirm={handleRevoke}
      />
    </div>
  )
}

export function RecordSharingAuditor() {
  return (
    <ConnectionGuard>
      <RecordSharingAuditorContent />
    </ConnectionGuard>
  )
}
