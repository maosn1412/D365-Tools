import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const metadataRouter: Router = Router()
metadataRouter.use(requireConnection)

// Get all entity definitions
// Note: EntityDefinitions endpoint does NOT support $top or $orderby on China cloud
// We use $select only and do sorting/limiting server-side
metadataRouter.get('/entities', async (req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery('/EntityDefinitions', {
      '$select': 'LogicalName,DisplayName,ObjectTypeCode,PrimaryIdAttribute,PrimaryNameAttribute,EntitySetName',
    })
    // Sort and limit server-side for compatibility
    const entities = ((result as { value: unknown[] }).value || []) as Record<string, unknown>[]
    entities.sort((a, b) =>
      String(a.LogicalName).localeCompare(String(b.LogicalName))
    )
    // Optional limit override via ?limit= (default 200, max 5000)
    const requested = parseInt(String(req.query.limit ?? ''), 10)
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 5000) : 200
    res.json({ value: entities.slice(0, limit) })
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
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery(`/EntityDefinitions(LogicalName='${entityName}')/Attributes`, {
      '$select': 'LogicalName,DisplayName,AttributeType,RequiredLevel',
    })
    // Sort server-side for compatibility
    const attrs = ((result as { value: unknown[] }).value || []) as Record<string, unknown>[]
    attrs.sort((a, b) =>
      String(a.LogicalName).localeCompare(String(b.LogicalName))
    )
    res.json({ value: attrs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attributes'
    res.status(500).json({ error: message })
  }
})
