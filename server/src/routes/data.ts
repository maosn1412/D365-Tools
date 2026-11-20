import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { resolveEntitySetName } from '../services/metadataCache.js'
import { requireConnection } from '../middleware/auth.js'

export const dataRouter: Router = Router()
dataRouter.use(requireConnection)

// Execute FetchXML query against the connected environment
dataRouter.post('/fetchxml', async (req: Request, res: Response) => {
  try {
    const { fetchXml, entitySetName } = req.body as { fetchXml?: string; entitySetName?: string }
    if (!fetchXml) {
      res.status(400).json({ error: 'fetchXml is required' })
      return
    }

    const dataverse = DataverseService.getInstance()
    let setName = entitySetName

    // Fall back to resolving the entity set name from the fetch root entity
    if (!setName) {
      const rootMatch = fetchXml.match(/<entity\s[^>]*name="([^"]+)"/)
      const logicalName = rootMatch?.[1]
      if (!logicalName) {
        res.status(400).json({ error: 'Cannot determine root entity from fetchXml' })
        return
      }
      // 命中元数据缓存时零额外请求
      const resolved = await resolveEntitySetName(logicalName)
      setName = resolved ?? undefined
      if (!setName) {
        res.status(404).json({ error: `Entity '${logicalName}' not found in environment` })
        return
      }
    }

    const result = await dataverse.getWithQuery(`/${setName}`, { fetchXml })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute FetchXML'
    res.status(500).json({ error: message })
  }
})

// Query entity records
dataRouter.get('/:entityName', async (req: Request, res: Response) => {
  try {
    const { entityName } = req.params
    const queryParams: Record<string, string> = {}

    if (req.query.$select) queryParams['$select'] = req.query.$select as string
    if (req.query.$filter) queryParams['$filter'] = req.query.$filter as string
    if (req.query.$orderby) queryParams['$orderby'] = req.query.$orderby as string
    if (req.query.$top) queryParams['$top'] = req.query.$top as string
    if (req.query.$skip) queryParams['$skip'] = req.query.$skip as string
    queryParams['$top'] = queryParams['$top'] || '50'

    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery(`/${entityName}`, queryParams)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query data'
    res.status(500).json({ error: message })
  }
})

// Get single record
dataRouter.get('/:entityName/:id', async (req: Request, res: Response) => {
  try {
    const { entityName, id } = req.params
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.get(`/${entityName}(${id})`)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch record'
    res.status(500).json({ error: message })
  }
})
