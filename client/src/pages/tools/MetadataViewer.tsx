import { useState, useEffect } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState } from '@/components/ui/state-display'
import { IconSearch, IconChevronRight, IconInspect } from '@/components/ui/icons'
import type { EntityMetadataItem, AttributeMetadataItem } from '@/services/api'
import {
  loadEntityAttributeMetadata,
  loadEntityMetadata,
  readCachedAttributes,
  readCachedEntities,
} from '@/lib/metadataCache'
import { useMetadataRefreshStore } from '@/stores/metadataRefreshStore'

type EntityInfo = EntityMetadataItem

interface AttributeInfo extends AttributeMetadataItem {
  RequiredLevel?: { Value?: string }
}

const attributeTypeMap: Record<number, string> = {
  0: 'Boolean', 1: 'DateTime', 2: 'Decimal', 3: 'Double', 4: 'Integer',
  5: 'Lookup', 6: 'Memo', 7: 'Money', 8: 'Owner', 9: 'PartyList',
  10: 'Picklist', 11: 'State', 12: 'Status', 13: 'String', 14: 'UniqueIdentifier',
  15: 'Virtual', 16: 'BigInt', 17: 'ManagedProperty', 18: 'EntityName',
}

function MetadataContent() {
  const [entities, setEntities] = useState<EntityInfo[]>([])
  const [selectedEntity, setSelectedEntity] = useState<EntityInfo | null>(null)
  const [attributes, setAttributes] = useState<AttributeInfo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAttrs, setLoadingAttrs] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attrSearch, setAttrSearch] = useState('')

  // 全局"刷新元数据"后重新拉取
  const metadataEpoch = useMetadataRefreshStore(s => s.epoch)

  useEffect(() => {
    loadEntities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataEpoch])

  const loadEntities = async () => {
    const cached = readCachedEntities()
    if (cached) {
      setEntities(cached.value)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      setEntities(await loadEntityMetadata())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entities')
    } finally {
      setLoading(false)
    }
  }

  const loadAttributes = async (entity: EntityInfo) => {
    setSelectedEntity(entity)
    const cached = readCachedAttributes(entity.LogicalName)
    if (cached) {
      setAttributes(cached.value)
      setLoadingAttrs(false)
    } else {
      setLoadingAttrs(true)
      setAttributes([])
    }
    setError(null)
    try {
      setAttributes(await loadEntityAttributeMetadata(entity.LogicalName))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attributes')
    } finally {
      setLoadingAttrs(false)
    }
  }

  const filteredEntities = entities.filter(e =>
    e.LogicalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.DisplayName?.UserLocalizedLabel?.Label || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredAttributes = attributes.filter(a =>
    a.LogicalName.toLowerCase().includes(attrSearch.toLowerCase()) ||
    (a.DisplayName?.UserLocalizedLabel?.Label || '').toLowerCase().includes(attrSearch.toLowerCase())
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconInspect className="h-5 w-5" />}
        title="Entity Metadata Viewer"
        description="Browse entities and their field metadata from your connected Dataverse environment."
      />

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Entity List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Entities</CardTitle>
            <div className="relative">
              <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Search entities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loading ? (
                <LoadingState text="Loading entities..." />
              ) : (
                <div className="space-y-0.5 p-2">
                  {filteredEntities.map(entity => (
                    <button
                      key={entity.LogicalName}
                      onClick={() => loadAttributes(entity)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                        selectedEntity?.LogicalName === entity.LogicalName
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <IconChevronRight className="h-3 w-3 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{entity.LogicalName}</div>
                        {entity.DisplayName?.UserLocalizedLabel?.Label && (
                          <div className="text-xs opacity-70 truncate">
                            {entity.DisplayName.UserLocalizedLabel.Label}
                          </div>
                        )}
                      </div>
                      <span className="text-xs opacity-50">{entity.ObjectTypeCode ?? '-'}</span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Attributes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {selectedEntity ? `Attributes: ${selectedEntity.LogicalName}` : 'Select an entity'}
                </CardTitle>
                {selectedEntity && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {attributes.length} attributes | Primary Key: {selectedEntity.PrimaryIdAttribute || '-'} | Name: {selectedEntity.PrimaryNameAttribute || '-'}
                  </p>
                )}
              </div>
              {selectedEntity && (
                <div className="relative w-64">
                  <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9"
                    placeholder="Search attributes..."
                    value={attrSearch}
                    onChange={(e) => setAttrSearch(e.target.value)}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loadingAttrs ? (
                <LoadingState text="Loading attributes..." />
              ) : !selectedEntity ? (
                <EmptyState
                  icon={<IconInspect className="h-6 w-6" />}
                  title="No entity selected"
                  description="Select an entity from the list to view its attributes."
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b sticky top-0 bg-card">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Logical Name</th>
                      <th className="px-4 py-2 font-medium">Display Name</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttributes.map(attr => (
                      <tr key={attr.LogicalName} className="border-b last:border-0 even:bg-muted/30 hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-2 font-mono text-xs">{attr.LogicalName}</td>
                        <td className="px-4 py-2">{attr.DisplayName?.UserLocalizedLabel?.Label || '-'}</td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary" className="text-xs">
                            {attributeTypeMap[Number(attr.AttributeType)] || `Type ${attr.AttributeType ?? 'unknown'}`}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs ${
                            attr.RequiredLevel?.Value === 'ApplicationRequired' ? 'text-destructive' :
                            attr.RequiredLevel?.Value === 'Recommended' ? 'text-amber-600' : 'text-muted-foreground'
                          }`}>
                            {attr.RequiredLevel?.Value || 'None'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function MetadataViewer() {
  return (
    <ConnectionGuard>
      <MetadataContent />
    </ConnectionGuard>
  )
}
