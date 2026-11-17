import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { connectToDataverse } from '@/services/api'

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected: (environmentUrl: string) => void
}

export function ConnectionDialog({ open, onOpenChange, onConnected }: ConnectionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Client Secret form state
  const [csEnvUrl, setCsEnvUrl] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')

  // Username/Password form state
  const [upEnvUrl, setUpEnvUrl] = useState('')
  const [upTenantId, setUpTenantId] = useState('')
  const [upClientId, setUpClientId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleClientSecretConnect = async () => {
    if (!csEnvUrl || !tenantId || !clientId || !clientSecret) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await connectToDataverse({
        authType: 'clientSecret',
        environmentUrl: csEnvUrl,
        tenantId,
        clientId,
        clientSecret,
      })
      onConnected(result.environmentUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const handleUsernamePasswordConnect = async () => {
    if (!upEnvUrl || !upTenantId || !upClientId || !username || !password) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await connectToDataverse({
        authType: 'usernamePassword',
        environmentUrl: upEnvUrl,
        tenantId: upTenantId,
        clientId: upClientId,
        username,
        password,
      })
      onConnected(result.environmentUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect to D365 Environment</DialogTitle>
          <DialogDescription>
            Enter your Dataverse environment credentials to connect.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="clientSecret" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clientSecret">Client ID + Secret</TabsTrigger>
            <TabsTrigger value="usernamePassword">Username + Password</TabsTrigger>
          </TabsList>

          <TabsContent value="clientSecret" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Environment URL</Label>
              <Input
                placeholder="https://yourorg.crm.dynamics.com"
                value={csEnvUrl}
                onChange={(e) => setCsEnvUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tenant ID</Label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input
                type="password"
                placeholder="Enter client secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleClientSecretConnect}
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </TabsContent>

          <TabsContent value="usernamePassword" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Environment URL</Label>
              <Input
                placeholder="https://yourorg.crm.dynamics.com"
                value={upEnvUrl}
                onChange={(e) => setUpEnvUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tenant ID</Label>
              <Input
                placeholder="yourorg.onmicrosoft.com or GUID"
                value={upTenantId}
                onChange={(e) => setUpTenantId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={upClientId}
                onChange={(e) => setUpClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="user@yourorg.onmicrosoft.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleUsernamePasswordConnect}
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <DialogFooter>
            <p className="text-sm text-destructive w-full text-center">{error}</p>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
