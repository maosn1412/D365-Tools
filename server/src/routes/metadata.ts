import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  clearMetadataCache,
  getMetadataCacheStats,
  loadAttributes,
  loadEntities,
} from '../services/metadataCache.js'
import { requireConnection } from '../middleware/auth.js'

export const metadataRouter: Router = Router()
metadataRouter.use(requireConnection)

// 元数据缓存状态（调试/验证用）
metadataRouter.get('/cache', (_req: Request, res: Response) => {
  res.json(getMetadataCacheStats())
})

// 手动清空元数据缓存（前端"刷新元数据"按钮调用）
metadataRouter.delete('/cache', (_req: Request, res: Response) => {
  clearMetadataCache()
  res.json({ cleared: true })
})

// Get all entity definitions
// Note: EntityDefinitions endpoint does NOT support $top or $orderby on China cloud
// We fetch the full list once (cached server-side), then sort/limit here.
metadataRouter.get('/entities', async (req: Request, res: Response) => {
  try {
    const { value: entities, cached } = await loadEntities()
    res.setHeader('X-Cache', cached ? 'HIT' : 'MISS')
    // Optional limit override via ?limit= (default 200, max 5000)
    const requested = parseInt(String(req.query.limit ?? ''), 10)
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 5000) : 200
    res.json({ value: entities.slice(0, limit), total: entities.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch entities'
    console.error('Metadata entities error:', message)
    res.status(500).json({ error: message })
  }
})

// Get entity attributes
metadataRouter.get('/entities/:entityName/attributes', async (req: Request, res: Response) => {
  try {
    const { entityName } = req.params
    const { value: attrs, cached } = await loadAttributes(entityName)
    res.setHeader('X-Cache', cached ? 'HIT' : 'MISS')
    res.json({ value: attrs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attributes'
    res.status(500).json({ error: message })
  }
})
