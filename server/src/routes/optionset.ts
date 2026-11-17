import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const optionsetRouter: Router = Router()
optionsetRouter.use(requireConnection)

// List all global option sets (metadata only, options loaded on demand)
// Note: metadata endpoints may not support $top/$orderby on some clouds; sort server-side
optionsetRouter.get('/global', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery('/GlobalOptionSetDefinitions', {
      '$select': 'Name,MetadataId,DisplayName,IsCustomOptionSet',
    })
    const items = ((result as { value: unknown[] }).value || []) as Record<string, unknown>[]
    items.sort((a, b) => String(a.Name).localeCompare(String(b.Name)))
    res.json({ value: items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch global option sets'
    console.error('Global option sets error:', message)
    res.status(500).json({ error: message })
  }
})

// Get a single global option set with all its options
optionsetRouter.get('/global/:metadataId', async (req: Request, res: Response) => {
  try {
    const { metadataId } = req.params
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.get(`/GlobalOptionSetDefinitions(${metadataId})`)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch option set detail'
    res.status(500).json({ error: message })
  }
})

// Get picklist / multi-select fields of an entity with their options
optionsetRouter.get('/entity/:entityName', async (req: Request, res: Response) => {
  try {
    const { entityName } = req.params
    const dataverse = DataverseService.getInstance()

    const fetchPicklists = async (cast: string) => {
      const result = await dataverse.getWithQuery(
        `/EntityDefinitions(LogicalName='${entityName}')/Attributes/Microsoft.Dynamics.CRM.${cast}`,
        { '$select': 'LogicalName,DisplayName', '$expand': 'OptionSet,GlobalOptionSet' }
      )
      return ((result as { value: unknown[] }).value || []) as Record<string, unknown>[]
    }

    const [picklists, multiSelects] = await Promise.all([
      fetchPicklists('PicklistAttributeMetadata').catch(() => [] as Record<string, unknown>[]),
      fetchPicklists('MultiSelectPicklistAttributeMetadata').catch(() => [] as Record<string, unknown>[]),
    ])

    interface OptionSetFieldRow extends Record<string, unknown> {
      LogicalName: string
      MultiSelect: boolean
    }
    const fields: OptionSetFieldRow[] = [
      ...picklists.map(f => ({ ...f, LogicalName: String(f.LogicalName ?? ''), MultiSelect: false })),
      ...multiSelects.map(f => ({ ...f, LogicalName: String(f.LogicalName ?? ''), MultiSelect: true })),
    ]
    fields.sort((a, b) => a.LogicalName.localeCompare(b.LogicalName))

    res.json({ value: fields })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch entity option sets'
    console.error('Entity option sets error:', message)
    res.status(500).json({ error: message })
  }
})
