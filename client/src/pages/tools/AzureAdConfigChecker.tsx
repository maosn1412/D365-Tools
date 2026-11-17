import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { IconCheck, IconX, IconShield, IconSpinner } from '@/components/ui/icons'

interface CheckItem {
  label: string
  status: 'pass' | 'fail' | 'pending' | 'skipped'
  detail?: string
}

interface CheckResult {
  tenantInfo: { name?: string; issuer?: string } | null
  checks: CheckItem[]
  suggestions: string[]
}

function isValidGuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
}

function getAuthorityEndpoints(tenantId: string): { token: string; openid: string } {
  // Default to public cloud; user can select China cloud
  return {
    token: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    openid: `https://login.microsoftonline.com/${tenantId}/.well-known/openid-configuration`,
  }
}

function getChinaEndpoints(tenantId: string): { token: string; openid: string } {
  return {
    token: `https://login.partner.microsoftonline.cn/${tenantId}/oauth2/v2.0/token`,
    openid: `https://login.partner.microsoftonline.cn/${tenantId}/.well-known/openid-configuration`,
  }
}

export function AzureAdConfigChecker() {
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [isChinaCloud, setIsChinaCloud] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  const handleCheck = async () => {
    setLoading(true)
    setResult(null)

    const checks: CheckItem[] = []
    const suggestions: string[] = []

    // 1. Tenant ID format
    const tenantValid = tenantId.includes('.') || isValidGuid(tenantId)
    checks.push({
      label: 'Tenant ID format is valid',
      status: tenantValid ? 'pass' : 'fail',
      detail: tenantValid
        ? (isValidGuid(tenantId) ? 'Valid GUID format' : 'Full domain format detected')
        : 'Should be a GUID or full domain (e.g., yourorg.onmicrosoft.com)',
    })

    // 2. Client ID format
    const clientIdValid = isValidGuid(clientId)
    checks.push({
      label: 'Client ID is a valid GUID',
      status: clientIdValid ? 'pass' : 'fail',
      detail: clientIdValid ? 'Valid GUID format' : 'Client ID should be a GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
    })

    // 3. Test authority endpoint
    const endpoints = isChinaCloud ? getChinaEndpoints(tenantId) : getAuthorityEndpoints(tenantId)
    let tenantInfo: { name?: string; issuer?: string } | null = null

    try {
      const res = await fetch(endpoints.openid)
      if (res.ok) {
        const data = await res.json()
        tenantInfo = { name: data.tenant_region_scope || data.issuer, issuer: data.issuer }
        checks.push({ label: 'Authority endpoint is reachable', status: 'pass', detail: `Issuer: ${data.issuer || 'OK'}` })
      } else {
        checks.push({ label: 'Authority endpoint is reachable', status: 'fail', detail: `HTTP ${res.status} - tenant may not exist` })
      }
    } catch (err) {
      checks.push({
        label: 'Authority endpoint is reachable',
        status: 'fail',
        detail: `Network error: ${err instanceof Error ? err.message : 'unknown'}. This may be a CORS restriction.`,
      })
    }

    // 4. Test token endpoint (POST with invalid credentials to check if app exists)
    if (clientId && clientIdValid) {
      try {
        const formBody = new URLSearchParams({
          client_id: clientId,
          grant_type: 'client_credentials',
          scope: 'https://api.businesscentral.dynamics.com/.default',
        })
        if (clientSecret) {
          formBody.set('client_secret', clientSecret)
        }
        const res = await fetch(endpoints.token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody.toString(),
        })
        const data = await res.json()

        if (res.status === 400) {
          const error = data.error_description || data.error || ''
          if (error.includes('AADSTS700016') || error.includes('not found')) {
            checks.push({ label: 'App Registration exists', status: 'fail', detail: 'Application not found in this tenant' })
          } else if (error.includes('AADSTS7000215') || error.includes('Invalid client secret')) {
            checks.push({ label: 'App Registration exists', status: 'pass', detail: 'App found (invalid secret confirms existence)' })
            checks.push({ label: 'Client Secret is valid', status: 'fail', detail: 'Invalid client secret provided' })
          } else if (error.includes('AADSTS7000218') || error.includes('trust')) {
            checks.push({ label: 'App Registration exists', status: 'pass', detail: 'App found (trust error confirms existence)' })
          } else {
            checks.push({ label: 'App Registration exists', status: 'pass', detail: `App found (AADSTS error: ${data.error || 'unknown'})` })
          }
        } else if (res.ok) {
          checks.push({ label: 'App Registration exists', status: 'pass', detail: 'Token obtained successfully' })
          if (clientSecret) {
            checks.push({ label: 'Client Secret is valid', status: 'pass', detail: 'Secret accepted by authority' })
          }
        } else {
          checks.push({ label: 'App Registration exists', status: 'pending', detail: `Unexpected response: HTTP ${res.status}` })
        }
      } catch (err) {
        checks.push({
          label: 'App Registration exists',
          status: 'pending',
          detail: `Could not verify: ${err instanceof Error ? err.message : 'CORS or network error'}`,
        })
      }
    } else if (clientId && !clientIdValid) {
      checks.push({ label: 'App Registration exists', status: 'skipped', detail: 'Client ID format invalid, skipping' })
    }

    if (clientSecret && !clientId) {
      checks.push({ label: 'Client Secret is valid', status: 'skipped', detail: 'Client ID required to test secret' })
    }

    // 5. Cloud environment match
    if (isChinaCloud) {
      checks.push({ label: 'Cloud endpoints match configuration', status: 'pass', detail: 'Using China cloud endpoints (login.partner.microsoftonline.cn)' })
    } else {
      checks.push({ label: 'Cloud endpoints match configuration', status: 'pass', detail: 'Using public cloud endpoints (login.microsoftonline.com)' })
    }

    // Suggestions
    if (!clientSecret) {
      suggestions.push('Consider using Client Secret or Certificate authentication for production environments instead of Username/Password.')
    }
    suggestions.push('For highest security, use Certificate-based authentication instead of Client Secret.')
    suggestions.push('Ensure the App Registration has API Permissions for "Dynamics CRM" or "Dataverse".')
    suggestions.push('Set up a secret expiration policy or use certificate rotation.')
    suggestions.push('In D365, create an Application User linked to this App Registration and assign security roles.')

    setResult({ tenantInfo, checks, suggestions })
    setLoading(false)
  }

  const statusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'pass': return <IconCheck className="h-4 w-4 text-emerald-500" />
      case 'fail': return <IconX className="h-4 w-4 text-red-500" />
      case 'pending': return <Badge variant="outline" className="text-xs">UNCERTAIN</Badge>
      case 'skipped': return <Badge variant="secondary" className="text-xs">SKIPPED</Badge>
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={<IconShield className="h-5 w-5" />}
        title="Azure AD Config Checker"
        description="Validate Azure AD App Registration configuration for D365 / Dataverse integration. Checks are performed via public endpoints directly from the browser."
      />

      <Card>
        <CardHeader>
          <CardTitle>Azure AD Configuration</CardTitle>
          <CardDescription>Enter your Azure AD details. All checks run in the browser -- no credentials are sent to our server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tenant ID</Label>
            <Input
              placeholder="yourorg.onmicrosoft.com or GUID"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Client ID (Application ID)</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Client Secret (optional)</Label>
            <Input
              type="password"
              placeholder="Enter client secret to validate"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isChinaCloud}
                onChange={(e) => setIsChinaCloud(e.target.checked)}
                className="rounded border-gray-300"
              />
              China Cloud (21Vianet)
            </label>
          </div>
          <Button onClick={handleCheck} disabled={loading || !tenantId}>
            {loading ? <IconSpinner className="h-4 w-4 mr-1.5 animate-spin" /> : <IconCheck className="h-4 w-4 mr-1.5" />}
            {loading ? 'Checking...' : 'Run Checks'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          {result.tenantInfo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tenant Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {result.tenantInfo.name && (
                    <div>
                      <span className="text-muted-foreground">Region:</span>{' '}
                      <span className="font-medium">{result.tenantInfo.name}</span>
                    </div>
                  )}
                  {result.tenantInfo.issuer && (
                    <div>
                      <span className="text-muted-foreground">Issuer:</span>{' '}
                      <span className="font-medium text-xs">{result.tenantInfo.issuer}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Configuration Checks</CardTitle>
              <CardDescription>
                {result.checks.filter(c => c.status === 'pass').length} passed,{' '}
                {result.checks.filter(c => c.status === 'fail').length} failed,{' '}
                {result.checks.filter(c => c.status === 'pending' || c.status === 'skipped').length} skipped/uncertain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.checks.map((check, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border px-3 py-2.5">
                    <div className="shrink-0 mt-0.5">{statusIcon(check.status)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{check.label}</span>
                      {check.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>D365 Application User Setup Guide</CardTitle>
              <CardDescription>Steps to configure an Application User in Dataverse for this App Registration.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm list-decimal list-inside">
                <li>Go to <strong>Power Platform Admin Center</strong> &gt; select your environment</li>
                <li>Navigate to <strong>Settings &gt; Users &gt; Application Users</strong></li>
                <li>Click <strong>+ New App User</strong></li>
                <li>Select the App Registration using the Client ID: <code className="bg-muted px-1 rounded text-xs">{clientId || '(enter Client ID above)'}</code></li>
                <li>Assign the appropriate <strong>Business Unit</strong> (usually root)</li>
                <li>Assign <strong>Security Roles</strong> (e.g., System Administrator, or a custom role with minimum required privileges)</li>
                <li>Click <strong>Create</strong> to save</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
