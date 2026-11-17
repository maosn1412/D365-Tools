import { create } from 'zustand'

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
    set({ connected: true, environmentUrl })
  },
  setDisconnected: () => {
    sessionStorage.removeItem('d365_connection')
    set({ connected: false, environmentUrl: null })
  },
}))
