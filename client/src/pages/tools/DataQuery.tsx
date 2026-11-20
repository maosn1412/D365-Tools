import { useState, useEffect, useMemo } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchSelect, MultiSearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import {
  type EntityMetadataItem,
  type AttributeMetadataItem,
} from '@/services/api'
import {
  loadEntityAttributeMetadata,
  loadEntityMetadata,
  readCachedAttributes,
  readCachedEntities,
} from '@/lib/metadataCache'
import { useMetadataRefreshStore } from '@/stores/metadataRefreshStore'
import { PageHeader } from '@/components/ui/page-header'
import { IconSearch, IconSpinner, IconChevronRight, IconTable } from '@/components/ui/icons'

interface QueryResult {
  [key: string]: unknown
}

function toAttributeOptions(list: AttributeMetadataItem[]): SearchSelectOption[] {
  return list.map(a => {
    const display = a.DisplayName?.UserLocalizedLabel?.Label
    return {
      value: a.LogicalName,
      label: display && display !== a.LogicalName ? `${a.LogicalName} (${display})` : a.LogicalName,
    }
  })
}

function DataQueryContent() {
  const [entityName, setEntityName] = useState('account')
  const [selectFields, setSelectFields] = useState('')
  const [filterExpr, setFilterExpr] = useState('')
  const [orderByField, setOrderByField] = useState('')
  const [orderByDesc, setOrderByDesc] = useState(false)
  const [top, setTop] = useState('25')
  const [results, setResults] = useState<QueryResult[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [nextLink, setNextLink] = useState<string | null>(null)

  // Metadata for dropdowns
  const [entities, setEntities] = useState<EntityMetadataItem[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(false)
  const [entitiesError, setEntitiesError] = useState<string | null>(null)
  const [attributes, setAttributes] = useState<AttributeMetadataItem[]>([])
  const [attrsLoading, setAttrsLoading] = useState(false)

  // Load entities on mount (this tool is only rendered when connected)
  // 走元数据缓存：切模块回来时不再重复请求；全局刷新（epoch 变化）时重新拉取
  const metadataEpoch = useMetadataRefreshStore(s => s.epoch)
  useEffect(() => {
    let cancelled = false
    const cached = readCachedEntities()
    if (cached) {
      setEntities(cached.value)
      setEntitiesLoading(false)
    } else {
      setEntitiesLoading(true)
    }
    setEntitiesError(null)
    loadEntityMetadata()
      .then(list => { if (!cancelled) setEntities(list) })
      .catch(e => { if (!cancelled) setEntitiesError(e instanceof Error ? e.message : 'Failed to load entities') })
      .finally(() => { if (!cancelled) setEntitiesLoading(false) })
    return () => { cancelled = true }
  }, [metadataEpoch])

  // Load attributes for the selected entity
  useEffect(() => {
    if (!entityName.trim()) {
      setAttributes([])
      return
    }
    let cancelled = false
    const cached = readCachedAttributes(entityName)
    if (cached) {
      setAttributes(cached.value)
      setAttrsLoading(false)
    } else {
      setAttributes([])
      setAttrsLoading(true)
    }
    loadEntityAttributeMetadata(entityName.trim())
      .then(list => { if (!cancelled) setAttributes(list) })
      .catch(e => {
        if (!cancelled) {
          setAttributes([])
          setError(e instanceof Error ? e.message : 'Failed to load attributes')
        }
      })
      .finally(() => { if (!cancelled) setAttrsLoading(false) })
    return () => { cancelled = true }
  }, [entityName, metadataEpoch])

  const entityOptions: SearchSelectOption[] = useMemo(
    () =>
      entities.filter(e => e.EntitySetName).map(e => {
        const display = e.DisplayName?.UserLocalizedLabel?.Label
        return {
          value: e.LogicalName,
          label: display && display !== e.LogicalName ? `${e.LogicalName} (${display})` : e.LogicalName,
        }
      }),
    [entities]
  )

  const attributeOptions = useMemo(() => toAttributeOptions(attributes), [attributes])
  const selectedFieldsList = selectFields.split(',').map(f => f.trim()).filter(Boolean)

  const handleEntityChange = (logicalName: string) => {
    setEntityName(logicalName)
    // Selected fields/order belong to the previous entity - reset them
    setSelectFields('')
    setOrderByField('')
    setOrderByDesc(false)
  }

  const executeQuery = async () => {
    const target = entities.find(e => e.LogicalName === entityName.trim())
    const entitySetName = target?.EntitySetName
    if (entitiesLoading || entitiesError || !entitySetName) return

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectFields) params.set('$select', selectFields)
      if (filterExpr) params.set('$filter', filterExpr)
      if (orderByField) params.set('$orderby', orderByDesc ? `${orderByField} desc` : orderByField)
      params.set('$top', top || '25')

      const res = await fetch(`/api/dataverse/data/${entitySetName}?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Query failed')
      }
      const data = await res.json()
      const records = data.value || []
      setResults(records)
      setNextLink(data['@odata.nextLink'] || null)
      setTotalCount(data['@odata.count'] != null ? data['@odata.count'] : null)

      // Columns: selected fields first (kept visible even when null in every record, since
      // Dataverse omits null attributes from responses), then any extra attributes present
      // in the records (e.g., the primary id)
      const cols: string[] = []
      const seen = new Set<string>()
      selectedFieldsList.forEach(f => {
        if (!seen.has(f)) {
          seen.add(f)
          cols.push(f)
        }
      })
      records.slice(0, 50).forEach((record: QueryResult) => {
        Object.keys(record).forEach(k => {
          if (!k.startsWith('@') && !k.startsWith('_') && !seen.has(k)) {
            seen.add(k)
            cols.push(k)
          }
        })
      })
      setColumns(cols)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed')
      setResults([])
      setColumns([])
    } finally {
      setLoading(false)
    }
  }

  const loadNextPage = async () => {
    if (!nextLink) return
    setLoading(true)
    try {
      // nextLink is a full URL from Dataverse, we need to proxy it
      const url = new URL(nextLink)
      const path = url.pathname.replace('/api/data/v9.2', '')
      const qs = url.search
      const res = await fetch(`/api/dataverse${path}${qs}`)
      if (!res.ok) throw new Error('Failed to load next page')
      const data = await res.json()
      const records = data.value || []
      setResults(prev => [...prev, ...records])
      setNextLink(data['@odata.nextLink'] || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load next page')
    } finally {
      setLoading(false)
    }
  }

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>
      if (obj['LogicalName']) return String(obj['LogicalName'])
      return JSON.stringify(value)
    }
    return String(value)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<IconTable className="h-5 w-5" />}
        title="Data Query Tool"
        description="Query and browse entity records from your connected Dataverse environment."
      />

      {entitiesLoading && (
        <div className="p-3 bg-muted text-muted-foreground rounded-md text-sm">Loading entity metadata...</div>
      )}
      {entitiesError && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{entitiesError}</div>
      )}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {/* Query Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query Configuration</CardTitle>
          <CardDescription>Select an entity and its fields, then run the query.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entity Name</Label>
              <div className="flex gap-2">
                <SearchSelect
                  className="flex-1 min-w-0"
                  value={entityName}
                  onChange={handleEntityChange}
                  options={entityOptions}
                  loading={entitiesLoading}
                  placeholder="Select entity..."
                  panelPlaceholder="Search entities..."
                  triggerClassName="h-9"
                />
                <Button
                  onClick={executeQuery}
                  disabled={loading || entitiesLoading || !!entitiesError || !entities.some(e => e.LogicalName === entityName.trim() && e.EntitySetName)}
                >
                  {loading ? <IconSpinner className="h-4 w-4 animate-spin" /> : <IconSearch className="h-4 w-4 mr-1" />}
                  Query
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>$select (fields)</Label>
              <MultiSearchSelect
                values={selectedFieldsList}
                onChange={(vals) => setSelectFields(vals.join(','))}
                options={attributeOptions}
                loading={attrsLoading}
                placeholder="Select fields..."
                panelPlaceholder="Search fields..."
                triggerClassName="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label>$filter</Label>
              <Input placeholder="statecode eq 0" value={filterExpr} onChange={(e) => setFilterExpr(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>$order by</Label>
                <div className="flex gap-2">
                  <SearchSelect
                    className="flex-1 min-w-0"
                    value={orderByField}
                    onChange={setOrderByField}
                    options={attributeOptions}
                    loading={attrsLoading}
                    placeholder="Select field..."
                    panelPlaceholder="Search fields..."
                    triggerClassName="h-9"
                  />
                  <Select value={orderByDesc ? 'desc' : 'asc'} onValueChange={(v) => setOrderByDesc(v === 'desc')}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Asc</SelectItem>
                      <SelectItem value="desc">Desc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>$top</Label>
                <Input type="number" placeholder="25" value={top} onChange={(e) => setTop(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Results</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {results.length} records loaded
                {totalCount !== null && ` (total: ${totalCount})`}
              </p>
            </div>
            {nextLink && (
              <Button variant="outline" size="sm" onClick={loadNextPage} disabled={loading}>
                {loading ? <IconSpinner className="h-4 w-4 animate-spin mr-1" /> : <IconChevronRight className="h-3.5 w-3.5 mr-1" />}
                Load More
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <IconSpinner className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No results. Select an entity and click Query.
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b sticky top-0 bg-card">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium text-xs text-muted-foreground w-10">#</th>
                      {columns.map(col => (
                        <th key={col} className="px-3 py-2 font-medium text-xs whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((record, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                        {columns.map(col => (
                          <td key={col} className="px-3 py-2 text-xs max-w-[200px] truncate" title={formatCellValue(record[col])}>
                            {formatCellValue(record[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function DataQuery() {
  return (
    <ConnectionGuard>
      <DataQueryContent />
    </ConnectionGuard>
  )
}
