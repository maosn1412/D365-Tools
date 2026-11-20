import { create } from 'zustand'
import { clearServerMetadataCache } from '@/services/api'
import { clearClientMetadataCache } from '@/lib/metadataCache'

/**
 * 全局"刷新元数据"：清空服务端与前端两层缓存，并递增 epoch。
 * 各元数据 hook / 页面把 epoch 放进依赖数组，epoch 变化即重新从环境拉取。
 */
interface MetadataRefreshState {
  epoch: number
  refreshing: boolean
  lastRefreshedAt: number | null
  error: string | null
  refresh: () => Promise<void>
}

export const useMetadataRefreshStore = create<MetadataRefreshState>((set, get) => ({
  epoch: 0,
  refreshing: false,
  lastRefreshedAt: null,
  error: null,
  refresh: async () => {
    // 并发点击只跑一次
    if (get().refreshing) return
    set({ refreshing: true, error: null })

    let error: string | null = null
    try {
      await clearServerMetadataCache()
    } catch (e) {
      // 服务端缓存清理失败不阻断本地刷新：前端照常重新拉取，错误只做提示
      error = e instanceof Error ? e.message : 'Failed to clear server metadata cache'
    }

    clearClientMetadataCache()
    set(state => ({
      refreshing: false,
      error,
      epoch: state.epoch + 1,
      lastRefreshedAt: Date.now(),
    }))
  },
}))
