import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { SearchSelect } from '@/components/ui/search-select'
import { IconCopy, IconCheck, IconPageLayout } from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'

type PageType = 'list' | 'form' | 'dashboard'

export function CustomPageGenerator() {
  const [pageName, setPageName] = useState('MyCustomPage')
  const [publisherPrefix, setPublisherPrefix] = useState('dev')
  const [pageType, setPageType] = useState<PageType>('list')
  const [entityName, setEntityName] = useState('account')
  const [includeNavigation, setIncludeNavigation] = useState(true)
  const [includeCustomComponent, setIncludeCustomComponent] = useState(false)
  const [customComponentName, setCustomComponentName] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('powerfx')

  // Connection-aware entity dropdown (plain input when not connected)
  const { connected, options: entityOptions, loading: entitiesLoading } = useMetadataEntities()

  const fullPageName = `${publisherPrefix}_${pageName}`

  const powerFxFormulas = useMemo(() => {
    let formulas = ''

    if (pageType === 'list') {
      formulas += `// ============================================
// Custom Page: ${fullPageName} - List View
// ============================================

// OnStart property (App.OnStart equivalent for custom page)
Set(varEntityName, "${entityName}");
Set(varPageSize, 25);
Set(varCurrentPage, 1);

// Data source - Load records
ClearCollect(
    colRecords,
    ${entityName}s
);

// Gallery Items property
// Items = colRecords

// Search functionality
// SearchBox.OnChange:
Set(varSearchText, SearchBox.Text);
ClearCollect(
    colFilteredRecords,
    If(
        IsBlank(varSearchText),
        colRecords,
        Filter(colRecords, Search(name, varSearchText))
    )
);

// Pagination - Next button
// NextButton.OnSelect:
Set(varCurrentPage, varCurrentPage + 1);

// Pagination - Previous button
// PrevButton.OnSelect:
If(varCurrentPage > 1, Set(varCurrentPage, varCurrentPage - 1));

// Record count
// RecordCountLabel.Text:
$"{CountRows(colFilteredRecords)} records found"
`
    } else if (pageType === 'form') {
      formulas += `// ============================================
// Custom Page: ${fullPageName} - Form View
// ============================================

// OnStart property
Set(varEntityName, "${entityName}");
Set(varFormMode, FormMode.New);

// Load record if editing (pass record ID as parameter)
// Page parameters: RecordId (Text)
If(
    !IsBlank(RecordId),
    Set(varCurrentRecord, LookUp(${entityName}s, ${entityName}id = GUID(RecordId)));
    Set(varFormMode, FormMode.Edit)
);

// Form DataSource property
// Form.DataSource = varCurrentRecord

// Form DefaultMode property
// Form.DefaultMode = varFormMode

// Save button
// SaveButton.OnSelect:
If(
    varFormMode = FormMode.New,
    Patch(
        ${entityName}s,
        Defaults(${entityName}s),
        Form.Updates
    ),
    Patch(
        ${entityName}s,
        varCurrentRecord,
        Form.Updates
    )
);
Notify("Record saved successfully", NotificationType.Success);
Back();

// Cancel button
// CancelButton.OnSelect:
Back();
`
    } else {
      formulas += `// ============================================
// Custom Page: ${fullPageName} - Dashboard View
// ============================================

// OnStart property
Set(varEntityName, "${entityName}");

// Load summary data
Set(varTotalRecords, CountRows(${entityName}s));
Set(varActiveRecords, CountRows(Filter(${entityName}s, statecode = 0)));
Set(varInactiveRecords, CountRows(Filter(${entityName}s, statecode = 1)));

// Recent records (last 10)
ClearCollect(
    colRecentRecords,
    FirstN(
        Sort(${entityName}s, createdon, SortOrder.Descending),
        10
    )
);

// Chart data source
ClearCollect(
    colChartData,
    AddColumns(
        GroupBy(${entityName}s, "statecode", "grp"),
        "Count", CountRows(grp)
    )
);

// KPI Cards
// TotalCard.Text = varTotalRecords
// ActiveCard.Text = varActiveRecords
// InactiveCard.Text = varInactiveRecords
`
    }

    if (includeNavigation) {
      formulas += `
// ============================================
// Navigation Configuration
// ============================================
// To add this custom page to the site map:
// 1. Go to Power Apps > Solutions
// 2. Open your solution
// 3. Add Site Map > Subarea
// 4. Type: Page
// 5. Select: ${fullPageName}

// Navigate to this page from another page:
// Navigate(${fullPageName})

// Navigate with parameters:
// Navigate(${fullPageName}, ScreenTransition.None, { RecordId: selectedRecord.${entityName}id })
`
    }

    return formulas
  }, [fullPageName, pageType, entityName, includeNavigation])

  const customPageXml = useMemo(() => {
    let xml = `<CustomPage Name="${fullPageName}"
    DisplayName="${pageName}"
    Description="Custom page for ${entityName}"
    PageType="AppPage">
    <Parameters>`

    if (pageType === 'form') {
      xml += `
        <Parameter Name="RecordId" Type="String" Required="false" />`
    }

    xml += `
    </Parameters>
</CustomPage>`
    return xml
  }, [fullPageName, pageName, pageType, entityName])

  const navigationXml = useMemo(() => {
    if (!includeNavigation) return ''
    return `<!-- Site Map Configuration -->
<SubArea Id="subarea_${fullPageName}"
    VectorIcon="/WebResources/${publisherPrefix}_icon"
    Title="${pageName}"
    Description="Navigate to ${pageName}"
    Url="$webresource:${publisherPrefix}_${pageName}">
    <Privilege Entity="${entityName}" Privilege="Read" />
</SubArea>`
  }, [fullPageName, pageName, publisherPrefix, entityName, includeNavigation])

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconPageLayout className="h-5 w-5" />}
        title="Custom Page Template Generator"
        description="Generate D365 Custom Page configuration and Power Fx formula templates."
      />

      <div className="grid grid-cols-[340px_1fr] gap-6">
        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Page Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Page Name</Label>
              <Input value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="MyCustomPage" />
            </div>
            <div className="space-y-2">
              <Label>Publisher Prefix</Label>
              <Input value={publisherPrefix} onChange={(e) => setPublisherPrefix(e.target.value)} placeholder="dev" />
            </div>
            <div className="space-y-2">
              <Label>Target Entity</Label>
              {connected ? (
                <SearchSelect
                  value={entityName}
                  onChange={setEntityName}
                  options={entityOptions}
                  loading={entitiesLoading}
                  placeholder="Select an entity..."
                  panelPlaceholder="Search entities..."
                  triggerClassName="h-10"
                />
              ) : (
                <Input value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="account" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Page Type</Label>
              <Select value={pageType} onValueChange={(v) => setPageType(v as PageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List Page</SelectItem>
                  <SelectItem value="form">Form Page</SelectItem>
                  <SelectItem value="dashboard">Dashboard Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 border-t pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeNavigation} onChange={(e) => setIncludeNavigation(e.target.checked)} className="rounded" />
                Include Navigation Config
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeCustomComponent} onChange={(e) => setIncludeCustomComponent(e.target.checked)} className="rounded" />
                Include Custom Component Reference
              </label>
            </div>
            {includeCustomComponent && (
              <div className="space-y-2">
                <Label>Custom Component Name</Label>
                <Input value={customComponentName} onChange={(e) => setCustomComponentName(e.target.value)} placeholder="dev_MyPCFComponent" />
              </div>
            )}
            <div className="bg-muted p-3 rounded text-sm">
              <p className="font-medium">Full Page Name:</p>
              <code className="text-xs">{fullPageName}</code>
            </div>
          </CardContent>
        </Card>

        {/* Generated Output */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generated Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="powerfx">Power Fx</TabsTrigger>
                <TabsTrigger value="config">Config XML</TabsTrigger>
                {includeNavigation && <TabsTrigger value="nav">Navigation</TabsTrigger>}
              </TabsList>

              <TabsContent value="powerfx" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(powerFxFormulas)}>
                    {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <Textarea value={powerFxFormulas} readOnly className="font-mono text-sm min-h-[450px] resize-none" />
              </TabsContent>

              <TabsContent value="config" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(customPageXml)}>
                    {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <Textarea value={customPageXml} readOnly className="font-mono text-sm min-h-[450px] resize-none" />
              </TabsContent>

              {includeNavigation && (
                <TabsContent value="nav" className="mt-3">
                  <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopy(navigationXml)}>
                      {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <Textarea value={navigationXml} readOnly className="font-mono text-sm min-h-[450px] resize-none" />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
