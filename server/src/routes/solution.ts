import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const solutionRouter: Router = Router()
solutionRouter.use(requireConnection)

// Get all solutions
solutionRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery('/solutions', {
      '$select': 'uniquename,friendlyname,version,ismanaged,installedon,updatedon',
      '$expand': 'publisherid($select=uniquename,friendlyname)',
      '$top': '200',
      '$orderby': 'friendlyname',
    })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch solutions'
    console.error('Solutions error:', message)
    res.status(500).json({ error: message })
  }
})

// Get solution components
solutionRouter.get('/:solutionId/components', async (req: Request, res: Response) => {
  try {
    const { solutionId } = req.params
    const dataverse = DataverseService.getInstance()
    // solutionid on solutioncomponent is a lookup (navigation) property; comparing it directly
    // with a GUID fails with "binary operator with incompatible types" (0x80060888). OData
    // requires the bound path _solutionid_value for filtering lookup attributes.
    const result = await dataverse.getWithQuery(`/solutioncomponents`, {
      '$filter': `_solutionid_value eq ${solutionId}`,
      '$select': 'objectid,componenttype',
      '$top': '500',
    })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch solution components'
    res.status(500).json({ error: message })
  }
})
