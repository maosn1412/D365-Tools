import { useState, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchSelect, MultiSearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { ConnectionDialog } from '@/components/connection/ConnectionDialog'
import { useConnectionStore } from '@/stores/connectionStore'
import {
  executeFetchXml,
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
import {
  IconCopy, IconCheck, IconPlus, IconTrash, IconChevronDown, IconChevronRight,
  IconUploadCloud, IconWifi, IconPlay, IconSpinner, IconDatabase,
} from '@/components/ui/icons'

interface Condition {
  id: string
  attribute: string
  operator: string
  value: string
}

interface OrderExpr {
  id: string
  attribute: string
  descending: boolean
}

interface LinkEntity {
  id: string
  name: string
  from: string
  to: string
  linkType: 'inner' | 'outer'
  alias: string
}

const operators = [
  { value: 'eq', label: 'Equals (eq)' },
  { value: 'ne', label: 'Not Equals (ne)' },
  { value: 'gt', label: 'Greater Than (gt)' },
  { value: 'ge', label: 'Greater or Equal (ge)' },
  { value: 'lt', label: 'Less Than (lt)' },
  { value: 'le', label: 'Less or Equal (le)' },
  { value: 'like', label: 'Like (like)' },
  { value: 'not-like', label: 'Not Like (not-like)' },
  { value: 'in', label: 'In (in)' },
  { value: 'not-in', label: 'Not In (not-in)' },
  { value: 'null', label: 'Null (null)' },
  { value: 'not-null', label: 'Not Null (not-null)' },
  { value: 'contains', label: 'Contains (contains)' },
  { value: 'begins-with', label: 'Begins With (begins-with)' },
  { value: 'ends-with', label: 'Ends With (ends-with)' },
]

let idCounter = 0
function newId() { return `id_${++idCounter}_${Date.now()}` }

function toAttributeOptions(list: AttributeMetadataItem[]): SearchSelectOption[] {
  return list.map(a => {
    const display = a.DisplayName?.UserLocalizedLabel?.Label
    return {
      value: a.LogicalName,
      label: display && display !== a.LogicalName ? `${a.LogicalName} (${display})` : a.LogicalName,
    }
  })
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj['LogicalName']) return String(obj['LogicalName'])
    return JSON.stringify(value)
  }
  return String(value)
}

export function FetchXmlBuilder() {
  const { connected, environmentUrl, setConnected } = useConnectionStore()

  const [entityName, setEntityName] = useState('account')
  const [selectFields, setSelectFields] = useState('')
  const [conditions, setConditions] = useState<Condition[]>([])
  const [orders, setOrders] = useState<OrderExpr[]>([])
  const [linkEntities, setLinkEntities] = useState<LinkEntity[]>([])
  const [aggregate, setAggregate] = useState(false)
  const [top, setTop] = useState('')
  const [distinct, setDistinct] = useState(false)
  const [importXml, setImportXml] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedSections, setExpandedSections] = useState({ conditions: true, orders: true, links: true })

  // Connection-aware metadata
  const [showConnDialog, setShowConnDialog] = useState(false)
  const [entities, setEntities] = useState<EntityMetadataItem[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(false)
  const [attributes, setAttributes] = useState<AttributeMetadataItem[]>([])
  const [attrsLoading, setAttrsLoading] = useState(false)
  const [linkAttrCache, setLinkAttrCache] = useState<Record<string, AttributeMetadataItem[]>>({})
  const [metaError, setMetaError] = useState<string | null>(null)

  // Query execution
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [resultColumns, setResultColumns] = useState<string[]>([])

  // Load entities when connected to an environment
  // 走元数据缓存：切模块回来时不再重复请求；全局刷新（epoch 变化）时重新拉取
  const metadataEpoch = useMetadataRefreshStore(s => s.epoch)
  const linkAttrsEpochRef = useRef(metadataEpoch)
  const linkAttrsSeqRef = useRef(0)
  useEffect(() => {
    if (!connected) {
      setEntities([])
      setAttributes([])
      setLinkAttrCache({})
      setMetaError(null)
      return
    }
    let cancelled = false
    const cached = readCachedEntities()
    if (cached) {
      setEntities(cached.value)
      setEntitiesLoading(false)
    } else {
      setEntitiesLoading(true)
    }
    setMetaError(null)
    loadEntityMetadata()
      .then(list => { if (!cancelled) setEntities(list) })
      .catch(e => { if (!cancelled) setMetaError(e instanceof Error ? e.message : 'Failed to load entities') })
      .finally(() => { if (!cancelled) setEntitiesLoading(false) })
    return () => { cancelled = true }
  }, [connected, metadataEpoch])

  // Load attributes for the selected entity
  useEffect(() => {
    if (!connected || !entityName.trim()) {
      setAttributes([])
      return
    }
    let cancelled = false
    const cached = readCachedAttributes(entityName)
    if (cached) {
      setAttributes(cached.value)
      setAttrsLoading(false)
    } else {
      setAttrsLoading(true)
    }
    loadEntityAttributeMetadata(entityName.trim())
      .then(list => { if (!cancelled) setAttributes(list) })
      .catch(e => {
        if (!cancelled) {
          setAttributes([])
          setMetaError(e instanceof Error ? e.message : 'Failed to load attributes')
        }
      })
      .finally(() => { if (!cancelled) setAttrsLoading(false) })
    return () => { cancelled = true }
  }, [connected, entityName, metadataEpoch])

  // Lazily fetch attributes for link entities
  useEffect(() => {
    if (!connected) {
      linkAttrsEpochRef.current = metadataEpoch
      linkAttrsSeqRef.current += 1
      return
    }
    const refreshed = linkAttrsEpochRef.current !== metadataEpoch
    // 必须先更新 epoch，再清空本地缓存，避免 setState 重入后再次判定为刷新
    linkAttrsEpochRef.current = metadataEpoch
    if (refreshed) {
      linkAttrsSeqRef.current += 1
      setLinkAttrCache({})
      return
    }
    const seq = linkAttrsSeqRef.current
    linkEntities.forEach(link => {
      const name = link.name.trim()
      if (!name || linkAttrCache[name]) return
      loadEntityAttributeMetadata(name)
        .then(list => {
          if (seq !== linkAttrsSeqRef.current) return
          setLinkAttrCache(prev => (prev[name] ? prev : { ...prev, [name]: list }))
        })
        .catch(() => { /* ignore link entity metadata errors */ })
    })
  }, [connected, linkEntities, linkAttrCache, metadataEpoch])

  const entityOptions: SearchSelectOption[] = useMemo(
    () =>
      entities.map(e => {
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

  const addCondition = () => setConditions([...conditions, { id: newId(), attribute: '', operator: 'eq', value: '' }])
  const removeCondition = (id: string) => setConditions(conditions.filter(c => c.id !== id))
  const updateCondition = (id: string, field: keyof Condition, value: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const addOrder = () => setOrders([...orders, { id: newId(), attribute: '', descending: false }])
  const removeOrder = (id: string) => setOrders(orders.filter(o => o.id !== id))
  const updateOrder = (id: string, field: keyof OrderExpr, value: string | boolean) => {
    setOrders(orders.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const addLinkEntity = () => setLinkEntities([...linkEntities, { id: newId(), name: '', from: '', to: '', linkType: 'inner', alias: '' }])
  const removeLinkEntity = (id: string) => setLinkEntities(linkEntities.filter(l => l.id !== id))
  const updateLinkEntity = (id: string, field: keyof LinkEntity, value: string) => {
    setLinkEntities(linkEntities.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const fetchXml = useMemo(() => {
    const attrs: string[] = []
    if (top) attrs.push(`top="${top}"`)
    if (distinct) attrs.push('distinct="true"')
    if (aggregate) attrs.push('aggregate="true"')

    const fields = selectFields.split(',').map(f => f.trim()).filter(Boolean)
    const attributesXml = fields.map(f => `  <attribute name="${f}" />`).join('\n')

    const conditionsXml = conditions
      .filter(c => c.attribute)
      .map(c => {
        if (c.operator === 'null' || c.operator === 'not-null') {
          return `    <condition attribute="${c.attribute}" operator="${c.operator}" />`
        }
        return `    <condition attribute="${c.attribute}" operator="${c.operator}" value="${c.value}" />`
      })
      .join('\n')

    const filterXml = conditionsXml ? `\n  <filter type="and">\n${conditionsXml}\n  </filter>` : ''

    const ordersXml = orders
      .filter(o => o.attribute)
      .map(o => `  <order attribute="${o.attribute}" descending="${o.descending}" />`)
      .join('\n')

    const linksXml = linkEntities
      .filter(l => l.name)
      .map(l => `  <link-entity name="${l.name}" from="${l.from}" to="${l.to}" link-type="${l.linkType}"${l.alias ? ` alias="${l.alias}"` : ''} />`)
      .join('\n')

    const parts = [attributesXml, filterXml, ordersXml, linksXml].filter(Boolean)
    const inner = parts.join('\n')

    return `<fetch${attrs.length ? ' ' + attrs.join(' ') : ''}>\n  <entity name="${entityName}">\n${inner}\n  </entity>\n</fetch>`
  }, [entityName, selectFields, conditions, orders, linkEntities, aggregate, top, distinct])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fetchXml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleImport = () => {
    // Simple import: just set the raw XML for now
    setImportXml('')
    setShowImport(false)
  }

  const handleFetchData = async () => {
    setFetching(true)
    setFetchError(null)
    try {
      const target = entities.find(e => e.LogicalName === entityName.trim())
      const data = await executeFetchXml(fetchXml, target?.EntitySetName)
      const records = (data.value || []) as Record<string, unknown>[]
      setResults(records)
      // Columns: selected fields first (kept visible even when null in every record,
      // since Dataverse omits null attributes from responses), then any extra attributes
      // present in the records (e.g., the primary id)
      const cols: string[] = []
      const seen = new Set<string>()
      selectFields.split(',').map(f => f.trim()).filter(Boolean).forEach(f => {
        if (!seen.has(f)) {
          seen.add(f)
          cols.push(f)
        }
      })
      records.slice(0, 50).forEach(record => {
        Object.keys(record).forEach(k => {
          if (!k.startsWith('@') && !k.startsWith('_') && !seen.has(k)) {
            seen.add(k)
            cols.push(k)
          }
        })
      })
      setResultColumns(cols)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch data')
      setResults([])
      setResultColumns([])
    } finally {
      setFetching(false)
    }
  }

  const toggleSection = (section: 'conditions' | 'orders' | 'links') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconDatabase className="h-5 w-5" />}
        title="FetchXML Builder"
        description="Visually build FetchXML queries for Dataverse."
        actions={(
          <>
            {connected ? (
              <Badge variant="secondary" className="h-9 gap-1.5 px-3 font-normal">
                <IconWifi className="h-3.5 w-3.5 text-emerald-600" />
                <span className="max-w-[240px] truncate">{environmentUrl}</span>
              </Badge>
            ) : (
              <Button variant="outline" onClick={() => setShowConnDialog(true)}>
                <IconWifi className="h-4 w-4 mr-2" />
                Connect Environment
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowImport(!showImport)}>
              <IconUploadCloud className="h-4 w-4 mr-2" />
              Import XML
            </Button>
          </>
        )}
      />

      {metaError && (
        <div className="flex items-center justify-between gap-3 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          <span>{metaError}</span>
          <Button size="sm" variant="outline" onClick={() => setShowConnDialog(true)}>
            Reconnect
          </Button>
        </div>
      )}

      {showImport && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Label>Paste FetchXML to import</Label>
            <Textarea value={importXml} onChange={(e) => setImportXml(e.target.value)} className="font-mono text-sm min-h-[120px]" placeholder="<fetch>...</fetch>" />
            <Button size="sm" onClick={handleImport}>Import</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Builder Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Entity Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entity Name</Label>
                  {connected ? (
                    <SearchSelect
                      value={entityName}
                      onChange={setEntityName}
                      options={entityOptions}
                      loading={entitiesLoading}
                      placeholder="Select entity..."
                      panelPlaceholder="Search entities..."
                      triggerClassName="h-9"
                    />
                  ) : (
                    <Input placeholder="e.g., account" value={entityName} onChange={(e) => setEntityName(e.target.value)} />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Top (limit)</Label>
                  <Input type="number" placeholder="50" value={top} onChange={(e) => setTop(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Select Fields (comma separated)</Label>
                {connected ? (
                  <MultiSearchSelect
                    values={selectedFieldsList}
                    onChange={(vals) => setSelectFields(vals.join(', '))}
                    options={attributeOptions}
                    loading={attrsLoading}
                    placeholder="Select fields..."
                    panelPlaceholder="Search fields..."
                    triggerClassName="h-9"
                  />
                ) : (
                  <Input placeholder="name, accountid, createdon" value={selectFields} onChange={(e) => setSelectFields(e.target.value)} />
                )}
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={distinct} onChange={(e) => setDistinct(e.target.checked)} className="rounded" />
                  Distinct
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={aggregate} onChange={(e) => setAggregate(e.target.checked)} className="rounded" />
                  Aggregate
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => toggleSection('conditions')}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {expandedSections.conditions ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
                  Conditions ({conditions.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); addCondition() }}>
                  <IconPlus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            {expandedSections.conditions && (
              <CardContent className="space-y-3">
                {conditions.length === 0 && <p className="text-sm text-muted-foreground">No conditions added</p>}
                {conditions.map((cond) => (
                  <div key={cond.id} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Attribute</Label>
                      {connected ? (
                        <SearchSelect
                          value={cond.attribute}
                          onChange={(v) => updateCondition(cond.id, 'attribute', v)}
                          options={attributeOptions}
                          loading={attrsLoading}
                          placeholder="Select attribute..."
                          panelPlaceholder="Search attributes..."
                          triggerClassName="h-8 text-sm"
                        />
                      ) : (
                        <Input className="h-8 text-sm" value={cond.attribute} onChange={(e) => updateCondition(cond.id, 'attribute', e.target.value)} placeholder="e.g., name" />
                      )}
                    </div>
                    <div className="w-[160px] space-y-1">
                      <Label className="text-xs">Operator</Label>
                      <Select value={cond.operator} onValueChange={(v) => updateCondition(cond.id, 'operator', v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {operators.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {cond.operator !== 'null' && cond.operator !== 'not-null' && (
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Value</Label>
                        <Input className="h-8 text-sm" value={cond.value} onChange={(e) => updateCondition(cond.id, 'value', e.target.value)} placeholder="value" />
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCondition(cond.id)}>
                      <IconTrash className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Orders */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => toggleSection('orders')}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {expandedSections.orders ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
                  Order By ({orders.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); addOrder() }}>
                  <IconPlus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            {expandedSections.orders && (
              <CardContent className="space-y-3">
                {orders.length === 0 && <p className="text-sm text-muted-foreground">No order expressions added</p>}
                {orders.map((order) => (
                  <div key={order.id} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Attribute</Label>
                      {connected ? (
                        <SearchSelect
                          value={order.attribute}
                          onChange={(v) => updateOrder(order.id, 'attribute', v)}
                          options={attributeOptions}
                          loading={attrsLoading}
                          placeholder="Select attribute..."
                          panelPlaceholder="Search attributes..."
                          triggerClassName="h-8 text-sm"
                        />
                      ) : (
                        <Input className="h-8 text-sm" value={order.attribute} onChange={(e) => updateOrder(order.id, 'attribute', e.target.value)} placeholder="e.g., createdon" />
                      )}
                    </div>
                    <div className="w-[130px] space-y-1">
                      <Label className="text-xs">Direction</Label>
                      <Select value={order.descending ? 'true' : 'false'} onValueChange={(v) => updateOrder(order.id, 'descending', v === 'true')}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Ascending</SelectItem>
                          <SelectItem value="true">Descending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOrder(order.id)}>
                      <IconTrash className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Link Entities */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => toggleSection('links')}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {expandedSections.links ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
                  Link Entities ({linkEntities.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); addLinkEntity() }}>
                  <IconPlus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            {expandedSections.links && (
              <CardContent className="space-y-3">
                {linkEntities.length === 0 && <p className="text-sm text-muted-foreground">No link entities added</p>}
                {linkEntities.map((link) => (
                  <div key={link.id} className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[120px] space-y-1">
                      <Label className="text-xs">Entity</Label>
                      {connected ? (
                        <SearchSelect
                          value={link.name}
                          onChange={(v) => updateLinkEntity(link.id, 'name', v)}
                          options={entityOptions}
                          loading={entitiesLoading}
                          placeholder="Select entity..."
                          panelPlaceholder="Search entities..."
                          triggerClassName="h-8 text-sm"
                        />
                      ) : (
                        <Input className="h-8 text-sm" value={link.name} onChange={(e) => updateLinkEntity(link.id, 'name', e.target.value)} placeholder="e.g., contact" />
                      )}
                    </div>
                    <div className="w-[100px] space-y-1">
                      <Label className="text-xs">From</Label>
                      {connected ? (
                        <SearchSelect
                          value={link.from}
                          onChange={(v) => updateLinkEntity(link.id, 'from', v)}
                          options={link.name.trim() && linkAttrCache[link.name.trim()] ? toAttributeOptions(linkAttrCache[link.name.trim()]) : []}
                          loading={!!link.name.trim() && !linkAttrCache[link.name.trim()]}
                          placeholder="from"
                          panelPlaceholder="Search attributes..."
                          triggerClassName="h-8 text-sm"
                        />
                      ) : (
                        <Input className="h-8 text-sm" value={link.from} onChange={(e) => updateLinkEntity(link.id, 'from', e.target.value)} placeholder="from" />
                      )}
                    </div>
                    <div className="w-[100px] space-y-1">
                      <Label className="text-xs">To</Label>
                      {connected ? (
                        <SearchSelect
                          value={link.to}
                          onChange={(v) => updateLinkEntity(link.id, 'to', v)}
                          options={attributeOptions}
                          loading={attrsLoading}
                          placeholder="to"
                          panelPlaceholder="Search attributes..."
                          triggerClassName="h-8 text-sm"
                        />
                      ) : (
                        <Input className="h-8 text-sm" value={link.to} onChange={(e) => updateLinkEntity(link.id, 'to', e.target.value)} placeholder="to" />
                      )}
                    </div>
                    <div className="w-[100px] space-y-1">
                      <Label className="text-xs">Link Type</Label>
                      <Select value={link.linkType} onValueChange={(v) => updateLinkEntity(link.id, 'linkType', v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inner">Inner</SelectItem>
                          <SelectItem value="outer">Outer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLinkEntity(link.id)}>
                      <IconTrash className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">FetchXML Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchData}
                    disabled={fetching || !connected}
                    title={connected ? 'Execute this FetchXML against the connected environment' : 'Connect to an environment first'}
                  >
                    {fetching ? <IconSpinner className="h-4 w-4 mr-1 animate-spin" /> : <IconPlay className="h-3.5 w-3.5 mr-1" />}
                    Fetch Data
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={fetchXml} readOnly className="font-mono text-sm min-h-[500px] resize-none" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Query Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Query Results</CardTitle>
          <p className="text-xs text-muted-foreground">
            {results.length > 0
              ? `${results.length} records returned`
              : resultColumns.length > 0
                ? '0 records returned'
                : 'Run the query to see results here'}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {fetchError ? (
            <div className="p-4 text-sm text-destructive">{fetchError}</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {resultColumns.length > 0
                ? 'Query returned 0 records.'
                : connected
                  ? 'Click "Fetch Data" to execute the FetchXML against your environment.'
                  : 'Connect to an environment to fetch data.'}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b sticky top-0 bg-card">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium text-xs text-muted-foreground w-10">#</th>
                      {resultColumns.map(col => (
                        <th key={col} className="px-3 py-2 font-medium text-xs whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((record, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                        {resultColumns.map(col => (
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

      <ConnectionDialog
        open={showConnDialog}
        onOpenChange={setShowConnDialog}
        onConnected={(url) => {
          setConnected(url)
          setShowConnDialog(false)
        }}
      />
    </div>
  )
}
