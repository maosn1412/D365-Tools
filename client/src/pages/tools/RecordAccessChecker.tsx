import { useCallback, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchSelect, AsyncSearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState } from '@/components/ui/state-display'
import { IconKey, IconWifi, IconInspect, IconCheck, IconX, IconUser, IconSpinner } from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'
import {
  searchRecords,
  searchUsers,
  checkRecordAccess,
  fetchEnvironmentInfo,
  type RecordAccessRight,
} from '@/services/api'
import { cn } from '@/lib/utils'

// ---------- 页面内容 ----------

function RecordAccessCheckerContent() {
  const { entities, options: entityOptions, loading: entitiesLoading } = useMetadataEntities()

  const [entityName, setEntityName] = useState('')
  const [recordId, setRecordId] = useState('')
  const [recordLabel, setRecordLabel] = useState('')
  const [userId, setUserId] = useState('')
  const [userLabel, setUserLabel] = useState('')

  const [rights, setRights] = useState<RecordAccessRight[] | null>(null)
  const [source, setSource] = useState<'function' | 'computed' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)

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

  const useCurrentIdentity = async () => {
    setIdentityLoading(true)
    setError(null)
    try {
      const info = await fetchEnvironmentInfo()
      if (!info.userId) throw new Error('Could not resolve current user identity')
      setUserId(info.userId)
      setUserLabel(info.user?.fullname ? `${info.user.fullname} (current connection)` : 'Current connection identity')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve identity')
    } finally {
      setIdentityLoading(false)
    }
  }

  const canCheck = Boolean(selectedEntity?.EntitySetName && recordId && userId)

  const runCheck = async () => {
    if (!canCheck || !selectedEntity?.EntitySetName) return
    setLoading(true)
    setError(null)
    try {
      const result = await checkRecordAccess(selectedEntity.EntitySetName, recordId, userId)
      setRights(result.rights)
      setSource(result.source)
    } catch (e) {
      setRights(null)
      setError(e instanceof Error ? e.message : 'Failed to check access')
    } finally {
      setLoading(false)
    }
  }

  const grantedCount = rights?.filter(r => r.granted).length ?? 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconKey className="h-5 w-5" />}
        title="Record Access Checker"
        description="Check what a user can actually do on a specific record (RetrievePrincipalAccess)."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 min-w-0">
              <Label>Entity</Label>
              <SearchSelect
                value={entityName}
                onChange={v => {
                  setEntityName(v)
                  setRecordId('')
                  setRecordLabel('')
                  setRights(null)
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
                  setRights(null)
                }}
                fetchOptions={fetchRecordOptions}
                disabled={!entityName}
                placeholder={entityName ? 'Search records by name...' : 'Select an entity first'}
                triggerClassName="min-w-0"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>User</Label>
              <div className="flex gap-2">
                <AsyncSearchSelect
                  value={userId}
                  label={userLabel}
                  onSelect={(value, label) => {
                    setUserId(value)
                    setUserLabel(label)
                    setRights(null)
                  }}
                  fetchOptions={fetchUserOptions}
                  placeholder="Search users..."
                  className="flex-1"
                  triggerClassName="min-w-0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  title="Use the user of the current connection"
                  onClick={useCurrentIdentity}
                  disabled={identityLoading}
                >
                  {identityLoading
                    ? <IconSpinner className="h-3.5 w-3.5 animate-spin" />
                    : <IconUser className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="h-8" onClick={runCheck} disabled={!canCheck || loading}>
              {loading && <IconSpinner className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Check Access
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} />}

      {!rights && !error && (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconInspect className="h-6 w-6" />}
              title="Check record access"
              description="Pick an entity, a record and a user, then run the access check."
            />
          </CardContent>
        </Card>
      )}

      {rights && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Access Rights</CardTitle>
              <Badge variant="secondary">{grantedCount} / {rights.length} granted</Badge>
              <span className="ml-auto text-xs text-muted-foreground truncate max-w-md">
                {recordLabel || recordId} — {userLabel || userId}
              </span>
            </div>
            {source === 'computed' && (
              <p className="mt-2 text-xs text-muted-foreground">
                This environment does not expose RetrievePrincipalAccess; rights are computed from the user's role privileges and explicit shares (POA).
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {rights.map(r => (
                <div
                  key={r.right}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5',
                    r.granted ? 'border-emerald-200 bg-emerald-50/60' : 'bg-muted/40'
                  )}
                >
                  {r.granted ? (
                    <IconCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <IconX className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  )}
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium truncate', !r.granted && 'text-muted-foreground')}>
                      {r.right.replace(/Access$/, '')}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{r.granted ? 'Granted' : 'Denied'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function RecordAccessChecker() {
  return (
    <ConnectionGuard>
      <RecordAccessCheckerContent />
    </ConnectionGuard>
  )
}
