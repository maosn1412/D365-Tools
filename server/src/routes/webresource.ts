import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const webresourceRouter: Router = Router()
webresourceRouter.use(requireConnection)

// List web resources (metadata only; base64 content is loaded on demand via /:id
// to keep the list payload small on environments with thousands of resources)
webresourceRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery('/webresourceset', {
      '$select': 'webresourceid,name,displayname,webresourcetype,description,modifiedon',
      '$top': '5000',
      '$orderby': 'name',
    })
    res.json({ value: ((result as { value?: unknown[] }).value || []) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch web resources'
    console.error('Web resources error:', message)
    res.status(500).json({ error: message })
  }
})

// Get a single web resource including its base64 content
webresourceRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery(`/webresourceset(${id})`, {
      '$select': 'webresourceid,name,displayname,webresourcetype,description,content,modifiedon',
    })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch web resource'
    console.error('Web resource detail error:', message)
    res.status(500).json({ error: message })
  }
})

// Publish a single web resource via the PublishXml action
webresourceRouter.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dataverse = DataverseService.getInstance()
    const parameterXml =
      '<importexportxml><webresources>' +
      `<webresource>{${id.replace(/[{}]/g, '')}}</webresource>` +
      '</webresources></importexportxml>'
    await dataverse.post('/PublishXml', { ParameterXml: parameterXml })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish web resource'
    console.error('Web resource publish error:', message)
    res.status(500).json({ error: message })
  }
})
