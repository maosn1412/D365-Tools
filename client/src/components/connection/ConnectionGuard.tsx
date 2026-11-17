import { useConnectionStore } from '@/stores/connectionStore'
import { ConnectionDialog } from '@/components/connection/ConnectionDialog'
import { useState } from 'react'
import { IconWifi, IconWifiOff } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ConnectionGuardProps {
  children: React.ReactNode
}

export function ConnectionGuard({ children }: ConnectionGuardProps) {
  const { connected, setConnected } = useConnectionStore()
  const [showDialog, setShowDialog] = useState(false)

  if (!connected) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <IconWifiOff className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">Environment Connection Required</h3>
            <p className="text-sm text-muted-foreground">
              This tool requires a connection to your D365 Dataverse environment.
              Please connect using your credentials to proceed.
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <IconWifi className="h-4 w-4 mr-2" />
              Connect Environment
            </Button>
          </CardContent>
        </Card>

        <ConnectionDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          onConnected={(url) => {
            setConnected(url)
            setShowDialog(false)
          }}
        />
      </div>
    )
  }

  return <>{children}</>
}
