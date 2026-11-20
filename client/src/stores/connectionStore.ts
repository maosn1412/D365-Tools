import { create } from 'zustand'
import { setMetadataCacheScope } from '@/lib/metadataCache'

interface ConnectionState {
  connected: boolean
  environmentUrl: string | null
  setConnected: (environmentUrl: string) => void
  setDisconnected: () => void
}

// Restore connection state from sessionStorage
const stored = sessionStorage.getItem('d365_connection')
const initialState = stored ? JSON.parse(stored) : { connected: false, environmentUrl: null }

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: initialState.connected,
  environmentUrl: initialState.environmentUrl,
  setConnected: (environmentUrl: string) => {
    sessionStorage.setItem('d365_connection', JSON.stringify({ connected: true, environmentUrl }))
    // 换环境时丢弃上一个环境的元数据缓存
    setMetadataCacheScope(environmentUrl)
    set({ connected: true, environmentUrl })
  },
  setDisconnected: () => {
    sessionStorage.removeItem('d365_connection')
    setMetadataCacheScope('')
    set({ connected: false, environmentUrl: null })
  },
}))
