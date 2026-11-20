import { NavLink, Outlet } from 'react-router-dom'
import { useConnectionStore } from '@/stores/connectionStore'
import { useMetadataRefreshStore } from '@/stores/metadataRefreshStore'
import { ConnectionDialog } from '@/components/connection/ConnectionDialog'
import { disconnectFromDataverse } from '@/services/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useState, type ReactNode } from 'react'
import {
  IconConnString,
  IconWorkflow,
  IconDatabase,
  IconLink,
  IconPlugin,
  IconBlocks,
  IconPageLayout,
  IconInspect,
  IconPackage,
  IconTable,
  IconShield,
  IconGlobeCode,
  IconRules,
  IconOptionsList,
  IconDashboard,
  IconWifi,
  IconWifiOff,
  IconLogout,
  IconUser,
  IconKey,
  IconShare,
  IconCompare,
  IconLock,
  IconStethoscope,
  IconOrgTree,
  IconAuditLog,
  IconAnalyze,
  IconCloudShield,
  IconScaffold,
  IconRefresh,
  IconSpinner,
} from '@/components/ui/icons'

interface ToolNavItem {
  name: string
  path: string
  icon: ReactNode
  requiresConnection: boolean
}

interface ToolNavGroup {
  label: string
  items: ToolNavItem[]
}

const toolGroups: ToolNavGroup[] = [
  {
    label: 'Code Generators',
    items: [
      { name: 'Plugin Generator', path: '/tools/plugin-generator', icon: <IconPlugin className="h-4 w-4" />, requiresConnection: false },
      { name: 'PCF Generator', path: '/tools/pcf-generator', icon: <IconBlocks className="h-4 w-4" />, requiresConnection: false },
      { name: 'Custom Page Generator', path: '/tools/custom-page-generator', icon: <IconPageLayout className="h-4 w-4" />, requiresConnection: false },
      { name: 'Connection String Builder', path: '/tools/connection-string-builder', icon: <IconConnString className="h-4 w-4" />, requiresConnection: false },
      { name: 'Connection String Analyzer', path: '/tools/connection-string-analyzer', icon: <IconAnalyze className="h-4 w-4" />, requiresConnection: false },
      { name: 'Azure AD Config Checker', path: '/tools/azure-ad-config-checker', icon: <IconCloudShield className="h-4 w-4" />, requiresConnection: false },
      { name: 'Plugin Scaffolder', path: '/tools/plugin-project-scaffolder', icon: <IconScaffold className="h-4 w-4" />, requiresConnection: false },
    ],
  },
  {
    label: 'Query & Data',
    items: [
      { name: 'FetchXML Builder', path: '/tools/fetchxml-builder', icon: <IconDatabase className="h-4 w-4" />, requiresConnection: false },
      { name: 'OData URL Builder', path: '/tools/odata-url-builder', icon: <IconLink className="h-4 w-4" />, requiresConnection: false },
      { name: 'Data Query', path: '/tools/data-query', icon: <IconTable className="h-4 w-4" />, requiresConnection: true },
      { name: 'Power Automate Expressions', path: '/tools/power-automate-expressions', icon: <IconWorkflow className="h-4 w-4" />, requiresConnection: false },
    ],
  },
  {
    label: 'Environment',
    items: [
      { name: 'Dashboard', path: '/tools/environment-dashboard', icon: <IconDashboard className="h-4 w-4" />, requiresConnection: true },
      { name: 'Metadata Viewer', path: '/tools/metadata-viewer', icon: <IconInspect className="h-4 w-4" />, requiresConnection: true },
      { name: 'Solution Manager', path: '/tools/solution-manager', icon: <IconPackage className="h-4 w-4" />, requiresConnection: true },
      { name: 'Option Set Viewer', path: '/tools/option-set-viewer', icon: <IconOptionsList className="h-4 w-4" />, requiresConnection: true },
      { name: 'Web Resources', path: '/tools/web-resource-manager', icon: <IconGlobeCode className="h-4 w-4" />, requiresConnection: true },
      { name: 'Business Rules', path: '/tools/business-rule-inspector', icon: <IconRules className="h-4 w-4" />, requiresConnection: true },
      { name: 'BU Hierarchy', path: '/tools/business-unit-hierarchy', icon: <IconOrgTree className="h-4 w-4" />, requiresConnection: true },
      { name: 'Audit Log Viewer', path: '/tools/audit-log-viewer', icon: <IconAuditLog className="h-4 w-4" />, requiresConnection: true },
    ],
  },
  {
    label: 'Security',
    items: [
      { name: 'Security Roles', path: '/tools/security-role-viewer', icon: <IconShield className="h-4 w-4" />, requiresConnection: true },
      { name: 'User Access', path: '/tools/user-access-analyzer', icon: <IconUser className="h-4 w-4" />, requiresConnection: true },
      { name: 'Record Access', path: '/tools/record-access-checker', icon: <IconKey className="h-4 w-4" />, requiresConnection: true },
      { name: 'Sharing Auditor', path: '/tools/record-sharing-auditor', icon: <IconShare className="h-4 w-4" />, requiresConnection: true },
      { name: 'Role Compare', path: '/tools/security-role-compare', icon: <IconCompare className="h-4 w-4" />, requiresConnection: true },
      { name: 'Field Security', path: '/tools/field-security-viewer', icon: <IconLock className="h-4 w-4" />, requiresConnection: true },
      { name: 'Permission Diagnostic', path: '/tools/permission-diagnostic', icon: <IconStethoscope className="h-4 w-4" />, requiresConnection: true },
    ],
  },
]

export function AppLayout() {
  const { connected, environmentUrl, setDisconnected } = useConnectionStore()
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const { refreshing, error: refreshError, lastRefreshedAt, refresh } = useMetadataRefreshStore()

  const handleDisconnect = async () => {
    try {
      await disconnectFromDataverse()
    } catch {
      // ignore
    }
    setDisconnected()
  }

  const refreshTitle = refreshError
    ? `Metadata refresh failed: ${refreshError}`
    : 'Refresh entity metadata from the environment'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h1 className="text-lg font-bold tracking-tight">D365 CRM Tools</h1>
          {/* Connection Status Card */}
          <div className={`rounded-lg border p-3 transition-colors ${
            connected
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-muted/50 border-border'
          }`}>
            {connected ? (
              <>
                <div className="flex items-center gap-2">
                  <IconWifi className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="flex-1 min-w-0">
                    <Badge variant="success" className="text-xs">Connected</Badge>
                    <p className="text-xs text-muted-foreground truncate mt-1" title={environmentUrl || ''}>
                      {environmentUrl}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => { void refresh() }}
                    disabled={refreshing}
                    title={refreshTitle}
                    aria-label="Refresh entity metadata"
                  >
                    {refreshing
                      ? <IconSpinner className="h-3.5 w-3.5 animate-spin" />
                      : <IconRefresh className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDisconnect} title="Disconnect">
                    <IconLogout className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {refreshError ? (
                  <p className="mt-1.5 text-[11px] leading-tight text-destructive break-words">{refreshError}</p>
                ) : lastRefreshedAt ? (
                  <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">
                    Metadata refreshed {new Date(lastRefreshedAt).toLocaleTimeString()}
                  </p>
                ) : null}
              </>
            ) : (
              <button
                className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowConnectionDialog(true)}
              >
                <IconWifiOff className="h-4 w-4 shrink-0" />
                <span>Not connected</span>
                <span className="ml-auto text-xs text-primary font-medium">Connect</span>
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <nav className="p-2 pb-4">
            {toolGroups.map((group) => (
              <div key={group.label} className="pt-3 first:pt-1">
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((tool) => (
                    <NavLink
                      key={tool.path}
                      to={tool.path}
                      className={({ isActive }) =>
                        `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                          isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                          )}
                          <span className="shrink-0">{tool.icon}</span>
                          <span className="flex-1 min-w-0 truncate">{tool.name}</span>
                          {tool.requiresConnection && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Requires connection" />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50/50">
        <Outlet />
      </main>

      {/* Connection Dialog */}
      <ConnectionDialog
        open={showConnectionDialog}
        onOpenChange={setShowConnectionDialog}
        onConnected={(url) => {
          useConnectionStore.getState().setConnected(url)
          setShowConnectionDialog(false)
        }}
      />

      {/* Floating connect button when not connected */}
      {!connected && (
        <div className="fixed bottom-4 right-4">
          <Button onClick={() => setShowConnectionDialog(true)} size="sm" className="shadow-lg">
            <IconWifi className="h-4 w-4 mr-2" />
            Connect Environment
          </Button>
        </div>
      )}
    </div>
  )
}
