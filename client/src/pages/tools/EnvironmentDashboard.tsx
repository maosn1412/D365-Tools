import { useEffect, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/state-display'
import {
  IconDashboard, IconPackage, IconGlobeCode, IconWifi, IconInspect, IconTable,
} from '@/components/ui/icons'
import { useConnectionStore } from '@/stores/connectionStore'

interface OrganizationInfo {
  organizationid?: string
  name?: string
  languagecode?: number
}

interface UserInfo {
  fullname?: string
  domainname?: string
  internalemailaddress?: string
}

interface EnvironmentInfo {
  organization: OrganizationInfo | null
  user: UserInfo | null
  version: string | null
}

interface EnvironmentStats {
  solutions: number | null
  webResources: number | null
  users: number | null
  entities: number | null
}

function InfoRow({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-sm truncate ${mono ? 'font-mono' : 'font-medium'}`} title={String(value ?? '')}>
        {value ?? '-'}
      </p>
    </div>
  )
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tracking-tight">{value ?? '-'}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
      <div className="h-4 w-3/4 rounded bg-muted" />
    </div>
  )
}

function DashboardContent() {
  const { environmentUrl } = useConnectionStore()
  const [info, setInfo] = useState<EnvironmentInfo | null>(null)
  const [stats, setStats] = useState<EnvironmentStats | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/dataverse/environment/info')
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch environment info')
        }
        return res.json()
      })
      .then((data: EnvironmentInfo) => { if (!cancelled) setInfo(data) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load environment info') })
      .finally(() => { if (!cancelled) setLoadingInfo(false) })

    fetch('/api/dataverse/environment/stats')
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch environment stats')
        }
        return res.json()
      })
      .then((data: EnvironmentStats) => { if (!cancelled) setStats(data) })
      .catch(() => { /* stats are best-effort; info card already reports errors */ })
      .finally(() => { if (!cancelled) setLoadingStats(false) })

    return () => { cancelled = true }
  }, [])

  const org = info?.organization
  const user = info?.user

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconDashboard className="h-5 w-5" />}
        title="Environment Dashboard"
        description="Overview of your connected Dataverse environment."
        actions={<Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>}
      />

      {error && <ErrorState message={error} />}

      <div className="grid grid-cols-2 gap-6">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInfo ? <CardSkeleton /> : (
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Name" value={org?.name} />
                <InfoRow label="Language Code" value={org?.languagecode} />
                <InfoRow label="Organization ID" value={org?.organizationid} mono />
                <InfoRow label="D365 Version" value={info?.version} mono />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current User</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInfo ? <CardSkeleton /> : (
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Full Name" value={user?.fullname} />
                <InfoRow label="Email" value={user?.internalemailaddress} />
                <div className="col-span-2">
                  <InfoRow label="Domain Name" value={user?.domainname} mono />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Environment Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Environment Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? <CardSkeleton /> : (
              <div className="grid grid-cols-2 gap-3">
                <StatItem icon={<IconInspect className="h-4 w-4" />} label="Entities" value={stats?.entities ?? null} />
                <StatItem icon={<IconPackage className="h-4 w-4" />} label="Solutions" value={stats?.solutions ?? null} />
                <StatItem icon={<IconGlobeCode className="h-4 w-4" />} label="Web Resources" value={stats?.webResources ?? null} />
                <StatItem icon={<IconTable className="h-4 w-4" />} label="System Users" value={stats?.users ?? null} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <InfoRow label="Environment URL" value={environmentUrl} mono />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge variant="success" className="gap-1">
                  <IconWifi className="h-3 w-3" /> Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function EnvironmentDashboard() {
  return (
    <ConnectionGuard>
      <DashboardContent />
    </ConnectionGuard>
  )
}
