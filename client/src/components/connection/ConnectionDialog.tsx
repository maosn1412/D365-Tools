import { useEffect, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { IconCopy, IconSpinner, IconTrash } from '@/components/ui/icons'
import { connectToDataverse } from '@/services/api'
import {
  listSavedConnections,
  removeSavedConnection,
  saveSavedConnection,
  type SavedConnection,
} from '@/lib/savedConnections'

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected: (environmentUrl: string) => void
}

export function ConnectionDialog({ open, onOpenChange, onConnected }: ConnectionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'clientSecret' | 'usernamePassword'>('clientSecret')
  const [saved, setSaved] = useState<SavedConnection[]>([])
  const [connectingId, setConnectingId] = useState<string | null>(null)

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

  // 弹窗实例是常驻挂载的（关闭只卸载 DialogContent），所以列表必须在每次打开时重新读取
  useEffect(() => {
    if (open) {
      setSaved(listSavedConnections())
      setError(null)
      setConnectingId(null)
    }
  }, [open])

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
      saveSavedConnection({ authType: 'clientSecret', environmentUrl: csEnvUrl, tenantId, clientId, clientSecret })
      setSaved(listSavedConnections())
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
      saveSavedConnection({
        authType: 'usernamePassword',
        environmentUrl: upEnvUrl,
        tenantId: upTenantId,
        clientId: upClientId,
        username,
        password,
      })
      setSaved(listSavedConnections())
      onConnected(result.environmentUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSavedConnect = async (entry: SavedConnection) => {
    if (loading || connectingId) return
    setConnectingId(entry.id)
    setError(null)
    try {
      const result = await connectToDataverse({
        authType: entry.authType,
        environmentUrl: entry.environmentUrl,
        tenantId: entry.tenantId,
        clientId: entry.clientId,
        clientSecret: entry.clientSecret,
        username: entry.username,
        password: entry.password,
      })
      saveSavedConnection(entry)
      setSaved(listSavedConnections())
      onConnected(result.environmentUrl)
    } catch (e) {
      // 失败时保留条目：密钥轮换或密码过期很常见，删掉记录会连修复线索一起丢掉
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnectingId(null)
    }
  }

  const handlePrefill = (entry: SavedConnection) => {
    setTab(entry.authType)
    setError(null)
    if (entry.authType === 'clientSecret') {
      setCsEnvUrl(entry.environmentUrl)
      setTenantId(entry.tenantId ?? '')
      setClientId(entry.clientId ?? '')
      setClientSecret(entry.clientSecret ?? '')
    } else {
      setUpEnvUrl(entry.environmentUrl)
      setUpTenantId(entry.tenantId ?? '')
      setUpClientId(entry.clientId ?? '')
      setUsername(entry.username ?? '')
      setPassword(entry.password ?? '')
    }
  }

  const handleRemove = (id: string) => {
    // 只清除本浏览器里的记录，不影响当前连接
    removeSavedConnection(id)
    setSaved(listSavedConnections())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect to D365 Environment</DialogTitle>
          <DialogDescription>
            Pick a previously connected environment to reconnect instantly, or enter credentials below.
          </DialogDescription>
        </DialogHeader>

        {saved.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Saved environments ({saved.length})
            </p>
            <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {saved.map((entry) => {
                const identity =
                  entry.authType === 'usernamePassword' ? entry.username ?? '' : entry.clientId?.slice(0, 8) ?? ''
                const lastUsed = entry.lastUsedAt ? new Date(entry.lastUsedAt).toLocaleDateString() : 'unknown'

                return (
                  <div key={entry.id} className="flex items-center gap-1 rounded-md border px-2 py-1.5">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left disabled:opacity-60"
                      disabled={loading || connectingId !== null}
                      onClick={() => handleSavedConnect(entry)}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{entry.label}</span>
                        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                          {entry.authType === 'clientSecret' ? 'Secret' : 'Password'}
                        </Badge>
                        {connectingId === entry.id && (
                          <IconSpinner className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {identity} · •••••••• · used {lastUsed}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Fill into the form below"
                      onClick={() => handlePrefill(entry)}
                    >
                      <IconCopy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Forget this environment (removes its credentials from this browser)"
                      onClick={() => handleRemove(entry.id)}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Credentials are kept in this browser only (never on disk or in git), so the server still holds
              nothing after a restart. Click a row to reconnect, or use the trash icon to forget one.
            </p>
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'clientSecret' | 'usernamePassword')}
          className="w-full"
        >
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
