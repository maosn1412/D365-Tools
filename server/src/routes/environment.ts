import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const environmentRouter: Router = Router()
environmentRouter.use(requireConnection)

interface WhoAmIResult {
  BusinessUnitId?: string
  UserId?: string
  OrganizationId?: string
}

// Environment basic info: organization + current user + version
environmentRouter.get('/info', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()

    const whoAmI = (await dataverse.get('/WhoAmI')) as WhoAmIResult

    // Run organization / user / version lookups in parallel; each is optional
    const [orgResult, userResult, versionResult] = await Promise.allSettled([
      whoAmI.OrganizationId
        ? dataverse.getWithQuery(`/organizations(${whoAmI.OrganizationId})`, {
            // Note: 'urlname' is not a valid organization property (causes Dataverse 400)
            '$select': 'organizationid,name,basecurrencyid,languagecode',
          })
        : Promise.resolve(null),
      whoAmI.UserId
        ? dataverse.getWithQuery(`/systemusers(${whoAmI.UserId})`, {
            '$select': 'fullname,domainname,internalemailaddress',
          })
        : Promise.resolve(null),
      dataverse.get('/RetrieveVersion'),
    ])

    const organization = orgResult.status === 'fulfilled' ? orgResult.value : null
    const user = userResult.status === 'fulfilled' ? userResult.value : null
    const version =
      versionResult.status === 'fulfilled'
        ? (versionResult.value as { Version?: string })?.Version ?? null
        : null

    res.json({ organization, user, version, userId: whoAmI.UserId ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch environment info'
    console.error('Environment info error:', message)
    res.status(500).json({ error: message })
  }
})

// Environment statistics: counts of key artifacts
environmentRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()

    const countQuery = async (path: string, select: string): Promise<number | null> => {
      try {
        const result = (await dataverse.getWithQuery(path, {
          '$select': select,
          '$top': '1',
          '$count': 'true',
        })) as { '@odata.count'?: number }
        return result['@odata.count'] ?? null
      } catch {
        return null
      }
    }

    // EntityDefinitions does not support $count on some clouds; fetch names and count server-side
    const entityCount = (async (): Promise<number | null> => {
      try {
        const result = (await dataverse.getWithQuery('/EntityDefinitions', {
          '$select': 'LogicalName',
        })) as { value?: unknown[] }
        return result.value?.length ?? null
      } catch {
        return null
      }
    })()

    const [solutions, webResources, users, entities] = await Promise.all([
      countQuery('/solutions', 'solutionid'),
      countQuery('/webresourceset', 'webresourceid'),
      countQuery('/systemusers', 'systemuserid'),
      entityCount,
    ])

    res.json({ solutions, webResources, users, entities })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch environment stats'
    console.error('Environment stats error:', message)
    res.status(500).json({ error: message })
  }
})
