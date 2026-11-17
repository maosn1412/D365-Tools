import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { LoadingState } from '@/components/ui/state-display'
import { AsyncSearchSelect } from '@/components/ui/search-select'
import { IconKey, IconShield, IconCheck, IconX, IconLock } from '@/components/ui/icons'
import { diagnosePermission, searchUsers, type PermissionDiagnosis } from '@/services/api'

const DEPTH_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'None', color: 'bg-slate-100 text-slate-600' },
  1: { label: 'User', color: 'bg-blue-100 text-blue-700' },
  2: { label: 'BU', color: 'bg-amber-100 text-amber-700' },
  4: { label: 'P:C BU', color: 'bg-orange-100 text-orange-700' },
  8: { label: 'Org', color: 'bg-emerald-100 text-emerald-700' },
}

const ACTIONS = ['Create', 'Read', 'Write', 'Delete', 'AppendTo', 'Append', 'Assign', 'Share'] as const

function PermissionDiagnosticInner() {
  const [userId, setUserId] = useState('')
  const [entityName, setEntityName] = useState('')
  const [recordId, setRecordId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PermissionDiagnosis | null>(null)

  const handleDiagnose = async () => {
    if (!userId || !entityName) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await diagnosePermission(userId, entityName, recordId || undefined)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to diagnose permissions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        icon={<IconKey className="h-5 w-5" />}
        title="Permission Diagnostic"
        description="Diagnose why a user can or cannot access a specific entity/record. Aggregates all permission sources."
      />

      {/* Input */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic Input</CardTitle>
          <CardDescription>Select a user and entity to analyze permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>User</Label>
              <AsyncSearchSelect
                placeholder="Search user by name or email..."
                fetchOptions={(q) => searchUsers(q).then(users => users.map(u => ({ value: u.systemuserid, label: `${u.fullname} (${u.domainname})` })))}
                value={userId}
                onSelect={(val) => setUserId(val)}
              />
            </div>
            <div className="space-y-2">
              <Label>Entity Name</Label>
              <Input
                placeholder="e.g., account, contact, lead"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Record ID (optional)</Label>
            <Input
              placeholder="GUID of specific record (leave empty for entity-level check)"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
            />
          </div>
          <Button onClick={handleDiagnose} disabled={loading || !userId || !entityName}>
            {loading ? <IconShield className="h-4 w-4 mr-1.5 animate-pulse" /> : <IconKey className="h-4 w-4 mr-1.5" />}
            {loading ? 'Diagnosing...' : 'Diagnose Permissions'}
          </Button>
        </CardContent>
      </Card>

      {loading && <LoadingState text="Analyzing permissions across all sources..." />}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Verdict */}
          <Card className={result.verdict === 'Granted' ? 'border-emerald-200' : 'border-red-200'}>
            <CardContent className="pt-5 flex items-center gap-4">
              {result.verdict === 'Granted'
                ? <IconCheck className="h-8 w-8 text-emerald-500" />
                : <IconX className="h-8 w-8 text-red-500" />}
              <div>
                <div className="text-lg font-bold">{result.verdict}</div>
                <div className="text-sm text-muted-foreground">
                  {result.user.fullname} ({result.user.domainname})
                  {result.verdictSources.length > 0 && (
                    <span> -- via {result.verdictSources.join(', ')}</span>
                  )}
                </div>
              </div>
              {result.user.isdisabled && (
                <Badge variant="destructive" className="ml-auto">User Disabled</Badge>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Direct Roles */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Direct Roles ({result.directRoles.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {result.directRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No direct role assignments.</p>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-auto">
                    {result.directRoles.map(r => (
                      <div key={r.roleId} className="text-sm rounded px-2 py-1 hover:bg-muted/50">{r.name}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Roles */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Team Roles ({result.teamRoles.filter(t => t.roles.length > 0).length} teams with roles)</CardTitle>
              </CardHeader>
              <CardContent>
                {result.teamRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">User is not a member of any team.</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-auto">
                    {result.teamRoles.map(t => (
                      <div key={t.teamId} className="text-sm">
                        <span className="font-medium">{t.teamName}</span>
                        {t.roles.length > 0 && (
                          <span className="text-muted-foreground ml-1">({t.roles.length} roles)</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Effective Privileges */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Effective Privileges on "{entityName}"</CardTitle>
              <CardDescription>Combined depth from all direct and team roles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {ACTIONS.map(action => {
                  const depth = result.effectivePrivileges[action]
                  const info = DEPTH_LABELS[depth] || DEPTH_LABELS[0]
                  return (
                    <div key={action} className="flex flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground">{action}</span>
                      <Badge variant="outline" className={`text-xs ${info.color}`}>
                        {info.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <span>User = Basic (own records)</span>
                <span>BU = Business Unit</span>
                <span>P:C BU = Parent:Child</span>
                <span>Org = Organization (all)</span>
              </div>
            </CardContent>
          </Card>

          {/* Sharing Access */}
          {result.sharingAccess && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Record Sharing (POA)</CardTitle>
                <CardDescription>
                  {recordId ? `Access via sharing for record ${recordId.slice(0, 8)}...` : 'No specific record was checked.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.sharingAccess.granted ? (
                  <div className="flex flex-wrap gap-2">
                    {result.sharingAccess.rights.map(r => (
                      <Badge key={r} variant="success" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No sharing access found for this record.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Field Security */}
          {result.fieldSecurity && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <IconLock className="h-3.5 w-3.5" />
                  Field Security ({result.fieldSecurity.fields.length} secured field{result.fieldSecurity.fields.length !== 1 ? 's' : ''})
                </CardTitle>
                <CardDescription>
                  {result.fieldSecurity.hasSecuredFields
                    ? `Entity "${entityName}" has field-level security enabled on ${result.fieldSecurity.fields.length} attribute(s).`
                    : `No field-level security configured for entity "${entityName}".`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.fieldSecurity.hasSecuredFields ? (
                  <div className="space-y-1 max-h-[200px] overflow-auto">
                    {result.fieldSecurity.fields.map(f => (
                      <div key={f.logicalName} className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-muted/50">
                        <IconLock className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="font-mono text-xs">{f.logicalName}</span>
                        {f.displayName && <span className="text-muted-foreground text-xs">({f.displayName})</span>}
                        <Badge variant="outline" className="text-[10px] ml-auto">{f.attributeType}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No field security profiles are configured for this entity.</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export function PermissionDiagnostic() {
  return (
    <ConnectionGuard>
      <PermissionDiagnosticInner />
    </ConnectionGuard>
  )
}
