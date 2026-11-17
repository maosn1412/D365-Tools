import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import { SearchSelect, MultiSearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { IconCopy, IconCheck, IconPlus, IconTrash, IconLink, IconWifi } from '@/components/ui/icons'
import { useConnectionStore } from '@/stores/connectionStore'
import { useMetadataEntities, useEntityAttributes } from '@/hooks/useMetadata'

type OperationType = 'GET' | 'GET_SINGLE' | 'POST' | 'PATCH' | 'DELETE' | 'FUNCTION'

interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string
}

let idCounter = 0
function newId() { return `id_${++idCounter}_${Date.now()}` }

const commonFunctions = [
  { name: 'WhoAmI', path: '/WhoAmI', description: 'Get current user info', method: 'GET' },
  { name: 'RetrieveTotalRecordCount', path: '/RetrieveTotalRecordCount', description: 'Get total record count', method: 'GET' },
  { name: 'GetTimeZoneCodeByLocalizedName', path: '/GetTimeZoneCodeByLocalizedName', description: 'Get timezone code', method: 'GET' },
  { name: 'CalculateRollupField', path: '/accounts({id})/Microsoft.Dynamics.CRM.CalculateRollupField', description: 'Calculate rollup field', method: 'GET' },
]

const filterOperators = [
  { value: 'eq', label: 'eq (Equals)' },
  { value: 'ne', label: 'ne (Not Equals)' },
  { value: 'gt', label: 'gt (Greater Than)' },
  { value: 'ge', label: 'ge (Greater or Equal)' },
  { value: 'lt', label: 'lt (Less Than)' },
  { value: 'le', label: 'le (Less or Equal)' },
  { value: 'contains', label: 'contains' },
  { value: 'startswith', label: 'startswith' },
  { value: 'endswith', label: 'endswith' },
]

export function ODataUrlBuilder() {
  const { connected, environmentUrl } = useConnectionStore()

  const [operation, setOperation] = useState<OperationType>('GET')
  const [baseUrl, setBaseUrl] = useState('https://yourorg.crm.dynamics.com')
  const [entityName, setEntityName] = useState('accounts')
  const [recordId, setRecordId] = useState('')
  const [selectFields, setSelectFields] = useState('')
  const [expandFields, setExpandFields] = useState('')
  const [orderField, setOrderField] = useState('')
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('asc')
  const [top, setTop] = useState('')
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [includeCount, setIncludeCount] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState('')
  const [requestBody, setRequestBody] = useState('{}')
  const [copied, setCopied] = useState(false)

  // Connection-aware metadata
  const { entities, loading: entitiesLoading } = useMetadataEntities()

  // Auto-fill base URL from the connected environment
  useEffect(() => {
    if (connected && environmentUrl) setBaseUrl(environmentUrl)
  }, [connected, environmentUrl])

  // entityName holds the EntitySetName (e.g. "accounts"); resolve the LogicalName
  // for attribute metadata loading.
  const selectedEntity = useMemo(
    () => entities.find(e => (e.EntitySetName || e.LogicalName) === entityName),
    [entities, entityName]
  )
  const logicalName = selectedEntity?.LogicalName || ''
  const { options: attributeOptions, loading: attrsLoading } = useEntityAttributes(connected ? logicalName : '')

  // Entity dropdown options keyed by EntitySetName (OData URLs use set names)
  const entitySetOptions: SearchSelectOption[] = useMemo(
    () =>
      entities.map(e => {
        const setName = e.EntitySetName || e.LogicalName
        const display = e.DisplayName?.UserLocalizedLabel?.Label
        return {
          value: setName,
          label: display && display !== e.LogicalName ? `${setName} (${display})` : setName,
        }
      }),
    [entities]
  )

  // Changing entity resets field-related selections (prevents stale cross-entity picks)
  const handleEntityChange = (value: string) => {
    setEntityName(value)
    setSelectFields('')
    setOrderField('')
    setFilters([])
  }

  const addFilter = () => setFilters([...filters, { id: newId(), field: '', operator: 'eq', value: '' }])
  const removeFilter = (id: string) => setFilters(filters.filter(f => f.id !== id))
  const updateFilter = (id: string, field: keyof FilterCondition, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  const selectedFieldsList = selectFields.split(',').map(f => f.trim()).filter(Boolean)
  const orderBy = orderField ? `${orderField}${orderDir === 'desc' ? ' desc' : ''}` : ''

  const builtUrl = useMemo(() => {
    const base = baseUrl.replace(/\/$/, '')
    const apiBase = `${base}/api/data/v9.2`

    if (operation === 'FUNCTION' && selectedFunction) {
      const func = commonFunctions.find(f => f.name === selectedFunction)
      if (func) return `${apiBase}${func.path}`
    }

    let path = `/${entityName}`

    if ((operation === 'GET_SINGLE' || operation === 'PATCH' || operation === 'DELETE') && recordId) {
      path += `(${recordId})`
    }

    const params: string[] = []

    if (selectFields) params.push(`$select=${selectFields}`)
    if (expandFields) params.push(`$expand=${expandFields}`)
    if (orderBy) params.push(`$orderby=${orderBy}`)
    if (top) params.push(`$top=${top}`)
    if (includeCount) params.push('$count=true')

    const filterParts = filters
      .filter(f => f.field)
      .map(f => {
        if (f.operator === 'contains' || f.operator === 'startswith' || f.operator === 'endswith') {
          return `${f.operator}(${f.field},'${f.value}')`
        }
        const val = isNaN(Number(f.value)) ? `'${f.value}'` : f.value
        return `${f.field} ${f.operator} ${val}`
      })

    if (filterParts.length > 0) {
      params.push(`$filter=${filterParts.join(' and ')}`)
    }

    const qs = params.length > 0 ? `?${params.join('&')}` : ''
    return `${apiBase}${path}${qs}`
  }, [operation, baseUrl, entityName, recordId, selectFields, expandFields, orderBy, top, filters, includeCount, selectedFunction])

  const httpMethod = useMemo(() => {
    switch (operation) {
      case 'GET': case 'GET_SINGLE': case 'FUNCTION': return 'GET'
      case 'POST': return 'POST'
      case 'PATCH': return 'PATCH'
      case 'DELETE': return 'DELETE'
    }
  }, [operation])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(builtUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconLink className="h-5 w-5" />}
        title="OData URL Builder"
        description="Construct D365 Web API (OData v4) request URLs with query parameters."
        actions={connected ? <Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge> : undefined}
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Builder */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input placeholder="https://yourorg.crm.dynamics.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Operation</Label>
                  <Select value={operation} onValueChange={(v) => setOperation(v as OperationType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET (List)</SelectItem>
                      <SelectItem value="GET_SINGLE">GET (Single Record)</SelectItem>
                      <SelectItem value="POST">POST (Create)</SelectItem>
                      <SelectItem value="PATCH">PATCH (Update)</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="FUNCTION">Function</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {operation === 'FUNCTION' ? (
                <div className="space-y-2">
                  <Label>Function</Label>
                  <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                    <SelectTrigger><SelectValue placeholder="Select a function" /></SelectTrigger>
                    <SelectContent>
                      {commonFunctions.map(f => (
                        <SelectItem key={f.name} value={f.name}>
                          {f.name} - {f.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Entity Set Name</Label>
                    {connected ? (
                      <SearchSelect
                        value={entityName}
                        onChange={handleEntityChange}
                        options={entitySetOptions}
                        loading={entitiesLoading}
                        placeholder="Select an entity set..."
                        panelPlaceholder="Search entity sets..."
                        triggerClassName="h-10"
                      />
                    ) : (
                      <Input placeholder="e.g., accounts, contacts, leads" value={entityName} onChange={(e) => setEntityName(e.target.value)} />
                    )}
                  </div>

                  {(operation === 'GET_SINGLE' || operation === 'PATCH' || operation === 'DELETE') && (
                    <div className="space-y-2">
                      <Label>Record ID (GUID)</Label>
                      <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={recordId} onChange={(e) => setRecordId(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {operation !== 'FUNCTION' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Query Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>$select (fields)</Label>
                  {connected ? (
                    <MultiSearchSelect
                      values={selectedFieldsList}
                      onChange={(values) => setSelectFields(values.join(','))}
                      options={attributeOptions}
                      loading={attrsLoading}
                      placeholder="Select fields..."
                      panelPlaceholder="Search fields..."
                    />
                  ) : (
                    <Input placeholder="name,accountid,createdon" value={selectFields} onChange={(e) => setSelectFields(e.target.value)} />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>$expand (navigation properties)</Label>
                  <Input placeholder="primarycontactid($select=fullname)" value={expandFields} onChange={(e) => setExpandFields(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>$orderby</Label>
                    {connected ? (
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <SearchSelect
                            value={orderField}
                            onChange={setOrderField}
                            options={attributeOptions}
                            loading={attrsLoading}
                            placeholder="Select field..."
                            panelPlaceholder="Search fields..."
                          />
                        </div>
                        <Select value={orderDir} onValueChange={(v) => setOrderDir(v as 'asc' | 'desc')}>
                          <SelectTrigger className="h-8 w-[100px] shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Asc</SelectItem>
                            <SelectItem value="desc">Desc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <Input placeholder="createdon desc" value={orderField} onChange={(e) => setOrderField(e.target.value)} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>$top</Label>
                    <Input type="number" placeholder="50" value={top} onChange={(e) => setTop(e.target.value)} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeCount} onChange={(e) => setIncludeCount(e.target.checked)} className="rounded" />
                  Include $count=true
                </label>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label>$filter Conditions</Label>
                    <Button size="sm" variant="outline" onClick={addFilter}>
                      <IconPlus className="h-3.5 w-3.5 mr-1" /> Add Filter
                    </Button>
                  </div>
                  {filters.map((filter) => (
                    <div key={filter.id} className="flex gap-2 items-end mb-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        {connected ? (
                          <SearchSelect
                            value={filter.field}
                            onChange={(v) => updateFilter(filter.id, 'field', v)}
                            options={attributeOptions}
                            loading={attrsLoading}
                            placeholder="field name"
                            panelPlaceholder="Search fields..."
                          />
                        ) : (
                          <Input className="h-8 text-sm" value={filter.field} onChange={(e) => updateFilter(filter.id, 'field', e.target.value)} placeholder="field name" />
                        )}
                      </div>
                      <div className="w-[150px] shrink-0 space-y-1">
                        <Select value={filter.operator} onValueChange={(v) => updateFilter(filter.id, 'operator', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {filterOperators.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <Input className="h-8 text-sm" value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} placeholder="value" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFilter(filter.id)}>
                        <IconTrash className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(operation === 'POST' || operation === 'PATCH') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request Body (JSON)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="font-mono text-sm min-h-[120px]"
                  placeholder='{"name": "Sample Account"}'
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Request Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  httpMethod === 'GET' ? 'bg-blue-100 text-blue-800' :
                  httpMethod === 'POST' ? 'bg-green-100 text-green-800' :
                  httpMethod === 'PATCH' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {httpMethod}
                </span>
                <Button variant="outline" size="sm" onClick={handleCopy} className="ml-auto">
                  {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? 'Copied!' : 'Copy URL'}
                </Button>
              </div>
              <div className="p-3 bg-muted rounded-lg break-all">
                <code className="text-sm">{builtUrl}</code>
              </div>

              {(operation === 'POST' || operation === 'PATCH') && (
                <div>
                  <Label className="text-xs text-muted-foreground">Request Body</Label>
                  <Textarea value={requestBody} readOnly className="font-mono text-sm mt-1 min-h-[100px] resize-none" />
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">cURL Command</Label>
                <Textarea
                  readOnly
                  className="font-mono text-xs mt-1 min-h-[100px] resize-none"
                  value={`curl -X ${httpMethod} "${builtUrl}" \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -H "OData-MaxVersion: 4.0" \\\n  -H "OData-Version: 4.0"${(operation === 'POST' || operation === 'PATCH') ? ` \\\n  -d '${requestBody}'` : ''}`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
