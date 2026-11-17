import { useState, useCallback } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'

export function useConnection(requireConnected: boolean = false) {
  const { connected, environmentUrl, setConnected, setDisconnected } = useConnectionStore()
  const [showDialog, setShowDialog] = useState(false)

  const checkConnection = useCallback(() => {
    if (requireConnected && !connected) {
      setShowDialog(true)
      return false
    }
    return true
  }, [requireConnected, connected])

  const onConnected = useCallback((url: string) => {
    setConnected(url)
    setShowDialog(false)
  }, [setConnected])

  const onDisconnected = useCallback(() => {
    setDisconnected()
  }, [setDisconnected])

  return {
    connected,
    environmentUrl,
    showDialog,
    setShowDialog,
    checkConnection,
    onConnected,
    onDisconnected,
  }
}
