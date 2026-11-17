import { useState, useEffect } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState } from '@/components/ui/state-display'
import { IconSearch, IconPackage, IconChevronRight } from '@/components/ui/icons'

interface Solution {
  solutionid: string
  uniquename: string
  friendlyname: string
  version: string
  ismanaged: boolean
  installedon: string
  updatedon: string
  publisherid?: {
    uniquename: string
    friendlyname: string
  }
}

interface SolutionComponent {
  objectid: string
  componenttype: number
}

// Official solutioncomponent componenttype option set, fetched live from the environment
// metadata endpoint (EntityDefinitions(LogicalName='solutioncomponent')/Attributes...)
const componentTypeMap: Record<number, string> = {
  1: 'Entity', 2: 'Attribute', 3: 'Relationship',
  4: 'Attribute Picklist Value', 5: 'Attribute Lookup Value', 6: 'View Attribute',
  7: 'Localized Label', 8: 'Relationship Extra Condition', 9: 'Option Set',
  10: 'Entity Relationship', 11: 'Entity Relationship Role',
  12: 'Entity Relationship Relationships', 13: 'Managed Property', 14: 'Entity Key',
  16: 'Privilege', 17: 'Privilege Object Type Code', 18: 'Index',
  20: 'Role', 21: 'Role Privilege', 22: 'Display String', 23: 'Display String Map',
  24: 'Form', 25: 'Organization', 26: 'Saved Query', 29: 'Workflow',
  31: 'Report', 32: 'Report Entity', 33: 'Report Category', 34: 'Report Visibility',
  35: 'Attachment', 36: 'Email Template', 37: 'Contract Template',
  38: 'KB Article Template', 39: 'Mail Merge Template',
  44: 'Duplicate Rule', 45: 'Duplicate Rule Condition', 46: 'Entity Map',
  47: 'Attribute Map', 48: 'Ribbon Command', 49: 'Ribbon Context Group',
  50: 'Ribbon Customization', 52: 'Ribbon Rule', 53: 'Ribbon Tab To Command Map',
  55: 'Ribbon Diff', 59: 'Saved Query Visualization', 60: 'System Form',
  61: 'Web Resource', 62: 'Site Map', 63: 'Connection Role', 64: 'Complex Control',
  65: 'Hierarchy Rule', 66: 'Custom Control', 68: 'Custom Control Default Config',
  70: 'Field Security Profile', 71: 'Field Permission',
  90: 'Plugin Type', 91: 'Plugin Assembly', 92: 'SDK Message Processing Step',
  93: 'SDK Message Processing Step Image', 95: 'Service Endpoint',
  150: 'Routing Rule', 151: 'Routing Rule Item', 152: 'SLA', 153: 'SLA Item',
  154: 'Convert Rule', 155: 'Convert Rule Item',
  161: 'Mobile Offline Profile', 162: 'Mobile Offline Profile Item',
  165: 'Similarity Rule', 166: 'Data Source Mapping',
  201: 'SDK Message', 202: 'SDK Message Filter', 203: 'SDK Message Pair',
  204: 'SDK Message Request', 205: 'SDK Message Request Field',
  206: 'SDK Message Response', 207: 'SDK Message Response Field',
  208: 'Import Map', 210: 'Web Wizard',
  300: 'Canvas App', 371: 'Connector', 372: 'Connector',
  380: 'Environment Variable Definition', 381: 'Environment Variable Value',
  400: 'AI Project Type', 401: 'AI Project', 402: 'AI Configuration',
  430: 'Entity Analytics Configuration', 431: 'Attribute Image Configuration',
  432: 'Entity Image Configuration',
}

function SolutionContent() {
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null)
  const [components, setComponents] = useState<SolutionComponent[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSolutions()
  }, [])

  const loadSolutions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dataverse/solutions')
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Failed to fetch solutions')
      }
      const data = await res.json()
      setSolutions(data.value || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load solutions')
    } finally {
      setLoading(false)
    }
  }

  const loadComponents = async (solution: Solution) => {
    setSelectedSolution(solution)
    setLoadingComponents(true)
    setComponents([])
    try {
      const res = await fetch(`/api/dataverse/solutions/${solution.solutionid}/components`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Failed to fetch components')
      }
      const data = await res.json()
      setComponents(data.value || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load components')
    } finally {
      setLoadingComponents(false)
    }
  }

  const filteredSolutions = solutions.filter(s =>
    s.friendlyname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.uniquename.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Group components by numeric type (display names may repeat across codes, e.g. Connector)
  const componentGroups = components.reduce<Record<number, number>>((acc, comp) => {
    acc[comp.componenttype] = (acc[comp.componenttype] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconPackage className="h-5 w-5" />}
        title="Solution Manager"
        description="View installed solutions and their components in your Dataverse environment."
      />

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      <div className="grid grid-cols-[360px_1fr] gap-6">
        {/* Solution List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Solutions ({solutions.length})</CardTitle>
            <div className="relative">
              <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Search solutions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[550px]">
              {loading ? (
                <LoadingState text="Loading solutions..." />
              ) : (
                <div className="space-y-0.5 p-2">
                  {filteredSolutions.map(solution => (
                    <button
                      key={solution.solutionid}
                      onClick={() => loadComponents(solution)}
                      className={`w-full text-left px-3 py-3 rounded text-sm transition-colors ${
                        selectedSolution?.solutionid === solution.solutionid
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconPackage className="h-4 w-4 shrink-0" />
                        <div className="font-medium truncate">{solution.friendlyname}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-6">
                        <span className="text-xs opacity-70">v{solution.version}</span>
                        <Badge variant={solution.ismanaged ? 'default' : 'secondary'} className="text-xs">
                          {solution.ismanaged ? 'Managed' : 'Unmanaged'}
                        </Badge>
                      </div>
                      {solution.publisherid && (
                        <div className="text-xs opacity-60 ml-6 mt-0.5 truncate">
                          {solution.publisherid.friendlyname}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Solution Details */}
        <div className="space-y-4">
          {selectedSolution ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedSolution.friendlyname}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Unique Name</span>
                      <p className="font-mono">{selectedSolution.uniquename}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Version</span>
                      <p>{selectedSolution.version}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Publisher</span>
                      <p>{selectedSolution.publisherid?.friendlyname || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Managed</span>
                      <p>{selectedSolution.ismanaged ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Installed On</span>
                      <p>{selectedSolution.installedon ? new Date(selectedSolution.installedon).toLocaleDateString() : '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Updated On</span>
                      <p>{selectedSolution.updatedon ? new Date(selectedSolution.updatedon).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Component Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingComponents ? (
                    <LoadingState text="Loading components..." />
                  ) : Object.keys(componentGroups).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No components found</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(componentGroups)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm">{componentTypeMap[Number(type)] || `Type ${type}`}</span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  icon={<IconChevronRight className="h-6 w-6" />}
                  title="No solution selected"
                  description="Select a solution from the list to view its details and components."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export function SolutionManager() {
  return (
    <ConnectionGuard>
      <SolutionContent />
    </ConnectionGuard>
  )
}
