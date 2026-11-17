import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import { IconCopy, IconCheck, IconConnString } from '@/components/ui/icons'

type AuthType = 'clientSecret' | 'certificate' | 'office365' | 'oauth'
type OutputFormat = 'csharp' | 'powershell' | 'paccli'

export function ConnectionStringBuilder() {
  const [authType, setAuthType] = useState<AuthType>('clientSecret')
  const [serverUrl, setServerUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [certThumbprint, setCertThumbprint] = useState('')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('csharp')
  const [copied, setCopied] = useState(false)

  const connectionString = useMemo(() => {
    const parts: string[] = []

    switch (authType) {
      case 'clientSecret':
        parts.push(`Url=${serverUrl}`)
        if (clientId) parts.push(`ClientId=${clientId}`)
        if (clientSecret) parts.push(`ClientSecret=${clientSecret}`)
        if (tenantId) parts.push(`TenantId=${tenantId}`)
        break
      case 'certificate':
        parts.push(`Url=${serverUrl}`)
        if (clientId) parts.push(`ClientId=${clientId}`)
        if (certThumbprint) parts.push(`Thumbprint=${certThumbprint}`)
        if (tenantId) parts.push(`TenantId=${tenantId}`)
        break
      case 'office365':
        parts.push(`Url=${serverUrl}`)
        if (username) parts.push(`Username=${username}`)
        if (password) parts.push(`Password=${password}`)
        if (clientId) parts.push(`ClientId=${clientId}`)
        if (redirectUri) parts.push(`RedirectUri=${redirectUri}`)
        break
      case 'oauth':
        parts.push(`Url=${serverUrl}`)
        if (clientId) parts.push(`ClientId=${clientId}`)
        if (redirectUri) parts.push(`RedirectUri=${redirectUri}`)
        if (loginPrompt()) parts.push(`LoginPrompt=${loginPrompt()}`)
        break
    }

    return parts.join(';')
  }, [authType, serverUrl, clientId, clientSecret, tenantId, username, password, redirectUri, certThumbprint])

  function loginPrompt(): string {
    return ''
  }

  const formattedOutput = useMemo(() => {
    switch (outputFormat) {
      case 'csharp':
        return `// C# Connection String\nvar connectionString = "${connectionString}";\n\n// Usage with ServiceClient\nusing Microsoft.PowerPlatform.Dataverse.Client;\nvar client = new ServiceClient(connectionString);`
      case 'powershell':
        return `# PowerShell Connection\n$ConnectionString = "${connectionString}"\n\n# Usage with Dataverse module\nConnect-DataverseService -ConnectionString $ConnectionString`
      case 'paccli': {
        let pac = `# PAC CLI Authentication\npac auth create\n  --kind CDS\n  --url "${serverUrl}"`
        if (clientId) pac += `\n  --applicationId "${clientId}"`
        if (authType === 'clientSecret' && clientSecret) pac += `\n  --clientSecret "${clientSecret}"`
        return pac
      }
      default:
        return connectionString
    }
  }, [outputFormat, connectionString, serverUrl, clientId, clientSecret, authType])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={<IconConnString className="h-5 w-5" />}
        title="Connection String Builder"
        description="Generate D365 / Dataverse connection strings for various authentication types and formats."
      />

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Select authentication type and fill in the required fields.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Authentication Type</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clientSecret">Client Secret</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="office365">Office 365 (Username/Password)</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csharp">C#</SelectItem>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                  <SelectItem value="paccli">PAC CLI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Server URL (Environment URL)</Label>
            <Input placeholder="https://yourorg.crm.dynamics.com" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Client ID (Application ID)</Label>
            <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>

          {authType === 'clientSecret' && (
            <>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input type="password" placeholder="Enter client secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tenant ID</Label>
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
              </div>
            </>
          )}

          {authType === 'certificate' && (
            <>
              <div className="space-y-2">
                <Label>Certificate Thumbprint</Label>
                <Input placeholder="Certificate thumbprint" value={certThumbprint} onChange={(e) => setCertThumbprint(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tenant ID</Label>
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
              </div>
            </>
          )}

          {authType === 'office365' && (
            <>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input placeholder="user@yourorg.onmicrosoft.com" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Redirect URI</Label>
                <Input placeholder="http://localhost" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
              </div>
            </>
          )}

          {authType === 'oauth' && (
            <div className="space-y-2">
              <Label>Redirect URI</Label>
              <Input placeholder="http://localhost" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Generated Output</CardTitle>
              <CardDescription>Connection string in {outputFormat} format</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={formattedOutput} readOnly className="font-mono text-sm min-h-[160px] resize-none" />
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground">Raw Connection String:</Label>
            <code className="block mt-1 p-2 bg-muted rounded text-xs break-all">{connectionString || '(empty)'}</code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
