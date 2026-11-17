import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { IconSearch, IconCheck, IconX, IconConnString } from '@/components/ui/icons'

interface ParsedParam {
  key: string
  value: string
  valid: boolean
  hint?: string
}

interface Issue {
  severity: 'error' | 'warning' | 'info'
  message: string
  fix?: string
}

type AuthMethod = 'ClientSecret' | 'Certificate' | 'Office365' | 'OAuth' | 'CallerIdentity' | 'Unknown'
type CloudEnvironment = 'Public' | 'China' | 'GCC' | 'GCC High' | 'Unknown'

function parseConnectionString(raw: string): ParsedParam[] {
  const params: ParsedParam[] = []
  if (!raw.trim()) return params

  const parts = raw.split(';').filter(p => p.trim())
  for (const part of parts) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) {
      params.push({ key: part.trim(), value: '', valid: false, hint: 'Missing value' })
      continue
    }
    const key = part.slice(0, eqIdx).trim()
    const value = part.slice(eqIdx + 1).trim()
    params.push({ key, value, valid: true })
  }
  return params
}

function detectAuthMethod(params: ParsedParam[]): AuthMethod {
  const map = new Map(params.map(p => [p.key.toLowerCase(), p.value]))
  if (map.has('thumbprint')) return 'Certificate'
  if (map.has('clientsecret')) return 'ClientSecret'
  if (map.has('username') && map.has('password')) return 'Office365'
  if (map.has('clientid') && !map.has('clientsecret') && !map.has('thumbprint')) return 'OAuth'
  if (map.get('authtype')?.toLowerCase() === 'calleridentity') return 'CallerIdentity'
  return 'Unknown'
}

function detectCloud(url: string): CloudEnvironment {
  if (!url) return 'Unknown'
  const lower = url.toLowerCase()
  if (lower.includes('.dynamics.cn') || lower.includes('.crm.chinacloudapi.cn')) return 'China'
  if (lower.includes('.crm9.dynamics.com')) return 'GCC High'
  if (lower.includes('.crm.dynamics.com') && (lower.includes('gov') || lower.includes('gcc'))) return 'GCC'
  if (lower.includes('.dynamics.com') || lower.includes('.crm.dynamics.com')) return 'Public'
  return 'Unknown'
}

function validateGuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
}

function validateParams(params: ParsedParam[], authMethod: AuthMethod, cloud: CloudEnvironment): Issue[] {
  const issues: Issue[] = []
  const map = new Map(params.map(p => [p.key.toLowerCase(), p.value]))

  // URL validation
  const url = map.get('url') || ''
  if (!url) {
    issues.push({ severity: 'error', message: 'Missing Url parameter', fix: 'Add Url=https://yourorg.crm.dynamics.com' })
  } else if (!url.startsWith('https://')) {
    issues.push({ severity: 'warning', message: 'Url should start with https://', fix: 'Ensure the URL uses HTTPS protocol' })
  }

  // Auth-specific validation
  if (authMethod === 'ClientSecret') {
    if (!map.get('clientid')) {
      issues.push({ severity: 'error', message: 'ClientSecret auth requires ClientId', fix: 'Add ClientId=<your-app-id>' })
    } else if (!validateGuid(map.get('clientid')!)) {
      issues.push({ severity: 'warning', message: 'ClientId is not a valid GUID format' })
    }
    if (!map.get('clientsecret')) {
      issues.push({ severity: 'error', message: 'ClientSecret auth requires ClientSecret', fix: 'Add ClientSecret=<your-secret>' })
    }
  } else if (authMethod === 'Certificate') {
    if (!map.get('clientid')) {
      issues.push({ severity: 'error', message: 'Certificate auth requires ClientId', fix: 'Add ClientId=<your-app-id>' })
    }
    if (!map.get('thumbprint')) {
      issues.push({ severity: 'error', message: 'Certificate auth requires Thumbprint', fix: 'Add Thumbprint=<cert-thumbprint>' })
    }
  } else if (authMethod === 'Office365') {
    if (!map.get('username')) {
      issues.push({ severity: 'error', message: 'Office365 auth requires Username', fix: 'Add Username=user@org.onmicrosoft.com' })
    }
    if (!map.get('password')) {
      issues.push({ severity: 'error', message: 'Office365 auth requires Password', fix: 'Add Password=<your-password>' })
    }
  }

  // Tenant ID format check
  const tenantId = map.get('tenantid')
  if (tenantId) {
    if (!tenantId.includes('.') && !validateGuid(tenantId)) {
      issues.push({
        severity: 'warning',
        message: 'TenantId looks like a short name, not a full domain or GUID',
        fix: 'Use full domain (e.g., yourorg.onmicrosoft.com) or GUID format',
      })
    }
  }

  // Cloud-specific checks
  if (cloud === 'China') {
    const authority = map.get('authority') || ''
    if (authority && !authority.includes('chinacloudapi') && !authority.includes('partner.microsoftonline')) {
      issues.push({
        severity: 'error',
        message: 'China cloud environment should use China-specific authority endpoint',
        fix: 'Use Authority=https://login.chinacloudapi.cn/<tenant> or login.partner.microsoftonline.cn',
      })
    }
  }

  // General security advice
  if (authMethod === 'Office365') {
    issues.push({
      severity: 'info',
      message: 'Username/Password auth is not recommended for production environments',
      fix: 'Consider using Client Secret or Certificate authentication instead',
    })
  }

  return issues
}

export function ConnectionStringAnalyzer() {
  const [input, setInput] = useState('')
  const [analyzed, setAnalyzed] = useState(false)

  const analysis = useMemo(() => {
    if (!analyzed || !input.trim()) return null

    const params = parseConnectionString(input)
    if (params.length === 0) return null

    const authMethod = detectAuthMethod(params)
    const url = params.find(p => p.key.toLowerCase() === 'url')?.value || ''
    const cloud = detectCloud(url)
    const issues = validateParams(params, authMethod, cloud)

    return { params, authMethod, cloud, issues }
  }, [input, analyzed])

  const handleAnalyze = () => setAnalyzed(true)
  const handleClear = () => {
    setInput('')
    setAnalyzed(false)
  }

  const severityVariant = (s: 'error' | 'warning' | 'info') => {
    switch (s) {
      case 'error': return 'destructive' as const
      case 'warning': return 'default' as const
      case 'info': return 'outline' as const
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={<IconConnString className="h-5 w-5" />}
        title="Connection String Analyzer"
        description="Paste a D365 / Dataverse connection string to analyze its structure, validate format, and detect common configuration issues."
      />

      <Card>
        <CardHeader>
          <CardTitle>Connection String Input</CardTitle>
          <CardDescription>Paste your connection string below and click Analyze.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Url=https://yourorg.crm.dynamics.com;ClientId=xxx;ClientSecret=xxx;TenantId=xxx"
            value={input}
            onChange={(e) => { setInput(e.target.value); setAnalyzed(false) }}
            className="font-mono text-sm min-h-[120px] resize-none"
          />
          <div className="flex gap-2">
            <Button onClick={handleAnalyze} disabled={!input.trim()}>
              <IconSearch className="h-3.5 w-3.5 mr-1.5" />
              Analyze
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={!input}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Connection Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>Parsed Parameters</CardTitle>
              <CardDescription>Individual key-value pairs from the connection string.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.params.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                    <span className="font-mono font-medium text-foreground min-w-[140px]">{p.key}</span>
                    <span className="font-mono text-muted-foreground flex-1 truncate">
                      {p.key.toLowerCase() === 'clientsecret' || p.key.toLowerCase() === 'password'
                        ? '••••••••'
                        : p.value || '(empty)'}
                    </span>
                    {p.hint ? (
                      <Badge variant="destructive" className="text-xs">{p.hint}</Badge>
                    ) : (
                      <IconCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Auth Method & Cloud */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Authentication Method</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={analysis.authMethod === 'Unknown' ? 'destructive' : 'default'} className="text-sm">
                  {analysis.authMethod}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {analysis.authMethod === 'ClientSecret' && 'Service principal with client secret credential'}
                  {analysis.authMethod === 'Certificate' && 'Service principal with X.509 certificate'}
                  {analysis.authMethod === 'Office365' && 'Interactive user authentication (username + password)'}
                  {analysis.authMethod === 'OAuth' && 'OAuth interactive flow without secret'}
                  {analysis.authMethod === 'CallerIdentity' && 'Uses the current process identity (AD integrated)'}
                  {analysis.authMethod === 'Unknown' && 'Could not determine authentication method'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Target Cloud Environment</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={analysis.cloud === 'Unknown' ? 'outline' : 'default'}
                  className={analysis.cloud === 'China' ? 'bg-amber-600' : ''}
                >
                  {analysis.cloud}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {analysis.cloud === 'Public' && 'Standard Azure public cloud (*.crm.dynamics.com)'}
                  {analysis.cloud === 'China' && '21Vianet operated cloud (*.dynamics.cn)'}
                  {analysis.cloud === 'GCC' && 'US Government Community cloud'}
                  {analysis.cloud === 'GCC High' && 'US GCC High DoD cloud (*.crm9.dynamics.com)'}
                  {analysis.cloud === 'Unknown' && 'Could not determine cloud from URL pattern'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Issues & Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>Issues & Suggestions</CardTitle>
              <CardDescription>
                {analysis.issues.length === 0
                  ? 'No issues detected. The connection string looks valid.'
                  : `Found ${analysis.issues.filter(i => i.severity === 'error').length} error(s), ${analysis.issues.filter(i => i.severity === 'warning').length} warning(s), ${analysis.issues.filter(i => i.severity === 'info').length} info.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.issues.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <IconCheck className="h-5 w-5" />
                  <span className="font-medium">All checks passed</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.issues.map((issue, i) => (
                    <div key={i} className="flex gap-3 rounded-md border px-3 py-2.5">
                      <div className="shrink-0 mt-0.5">
                        {issue.severity === 'error' && <IconX className="h-4 w-4 text-red-500" />}
                        {issue.severity === 'warning' && <IconX className="h-4 w-4 text-amber-500" />}
                        {issue.severity === 'info' && <IconCheck className="h-4 w-4 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={severityVariant(issue.severity)} className="text-xs">
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm">{issue.message}</span>
                        </div>
                        {issue.fix && (
                          <p className="text-xs text-muted-foreground mt-1">Fix: {issue.fix}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
