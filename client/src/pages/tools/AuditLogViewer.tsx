import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state-display'
import { IconRules, IconFilter, IconRefresh } from '@/components/ui/icons'
import { fetchAuditLogs, fetchAuditActions, type AuditLog, type AuditAction } from '@/services/api'

const ACTION_COLORS: Record<string, string> = {
  'Role Assignment': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Role Removal': 'bg-red-100 text-red-800 border-red-200',
  'Share': 'bg-blue-100 text-blue-800 border-blue-200',
  'Unshare': 'bg-orange-100 text-orange-800 border-orange-200',
  'Revoke': 'bg-red-100 text-red-800 border-red-200',
  'Grant Access': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Modify Access': 'bg-amber-100 text-amber-800 border-amber-200',
  'User Login': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'User Logout': 'bg-slate-100 text-slate-800 border-slate-200',
  'Privilege Change': 'bg-purple-100 text-purple-800 border-purple-200',
  'Record Create': 'bg-teal-100 text-teal-800 border-teal-200',
  'Record Update': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Record Delete': 'bg-rose-100 text-rose-800 border-rose-200',
}

function AuditLogViewerInner() {
  const [actions, setActions] = useState<AuditAction[]>([])
  const [selectedActions, setSelectedActions] = useState<number[]>([])
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [entityFilter, setEntityFilter] = useState('')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchAuditActions().then(setActions).catch(() => {})
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAuditLogs({
        eventTypes: selectedActions.length > 0 ? selectedActions : undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
        entityName: entityFilter || undefined,
        top: 200,
      })
      setLogs(data)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [selectedActions, startDate, endDate, entityFilter])

  const toggleAction = (code: number) => {
    setSelectedActions(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconRules className="h-5 w-5" />}
        title="Audit Log Viewer"
        description="Query and review security-related audit events in your Dataverse environment."
      />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconFilter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Event type multi-select */}
          <div className="space-y-2">
            <Label>Event Types</Label>
            <div className="flex flex-wrap gap-2">
              {actions.map(action => (
                <button
                  key={action.code}
                  onClick={() => toggleAction(action.code)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    selectedActions.includes(action.code)
                      ? (ACTION_COLORS[action.name] || 'bg-primary text-primary-foreground border-primary')
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {action.name}
                </button>
              ))}
              {selectedActions.length > 0 && (
                <button
                  onClick={() => setSelectedActions([])}
                  className="px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Entity filter */}
          <div className="space-y-2">
            <Label>Entity (optional)</Label>
            <Input
              placeholder="e.g., account, contact, systemuser"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            />
          </div>

          <Button onClick={loadLogs} disabled={loading}>
            {loading ? <IconRefresh className="h-4 w-4 mr-1.5 animate-spin" /> : <IconFilter className="h-4 w-4 mr-1.5" />}
            {loading ? 'Loading...' : 'Query Logs'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {loading && <LoadingState text="Loading audit logs..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && loaded && logs.length === 0 && (
        <EmptyState title="No audit logs found for the selected filters." />
      )}

      {!loading && !error && logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Audit Events ({logs.length})</CardTitle>
            <CardDescription>Showing most recent events first.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.auditId} className="flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm">
                  <div className="shrink-0 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-xs ${ACTION_COLORS[log.actionName] || ''}`}
                    >
                      {log.actionName}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {log.createdon && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdon).toLocaleString()}
                        </span>
                      )}
                      {log.objectTypeCode && (
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {log.objectTypeCode}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {log.userId && <span>User: {log.userId.slice(0, 8)}...</span>}
                      {log.objectId && <span className="ml-3">Object: {log.objectId.slice(0, 8)}...</span>}
                    </div>
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

export function AuditLogViewer() {
  return (
    <ConnectionGuard>
      <AuditLogViewerInner />
    </ConnectionGuard>
  )
}
