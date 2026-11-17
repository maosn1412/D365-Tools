import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const auditRouter: Router = Router()
auditRouter.use(requireConnection)

// Dataverse audit Action codes for security-related events
const ACTION_MAP: Record<number, string> = {
  30: 'Role Assignment',
  31: 'Role Removal',
  32: 'Principal Sync',
  36: 'Share',
  37: 'Unshare',
  38: 'Revoke',
  42: 'Grant Access',
  43: 'Modify Access',
  44: 'User Login',
  45: 'User Logout',
  46: 'Privilege Change',
  50: 'Record Create',
  51: 'Record Update',
  52: 'Record Delete',
}

// GET /actions - Return the list of audit action types for filtering
auditRouter.get('/actions', (_req: Request, res: Response) => {
  const actions = Object.entries(ACTION_MAP).map(([code, name]) => ({
    code: Number(code),
    name,
  }))
  res.json({ actions })
})

// GET /logs - Query audit logs with filters (uses FetchXML for audit entity compatibility)
auditRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const top = Math.min(Math.max(Number(req.query.top) || 100, 1), 500)
    const eventTypes = req.query.eventTypes ? String(req.query.eventTypes).split(',').map(Number).filter(n => !isNaN(n)) : null
    const userId = req.query.userId ? String(req.query.userId) : null
    const startDate = req.query.startDate ? String(req.query.startDate) : null
    const endDate = req.query.endDate ? String(req.query.endDate) : null
    const entityName = req.query.entityName ? String(req.query.entityName) : null

    const dataverse = DataverseService.getInstance()

    // Build FetchXML conditions
    const conditions: string[] = []

    if (eventTypes && eventTypes.length > 0) {
      if (eventTypes.length === 1) {
        conditions.push(`<condition attribute="action" operator="eq" value="${eventTypes[0]}" />`)
      } else {
        conditions.push(`
        <condition attribute="action" operator="in">
          ${eventTypes.map(code => `<value>${code}</value>`).join('')}
        </condition>`)
      }
    }

    if (userId) {
      conditions.push(`<condition attribute="userid" operator="eq" value="${userId}" />`)
    }

    if (startDate) {
      conditions.push(`<condition attribute="createdon" operator="ge" value="${startDate}" />`)
    }

    if (endDate) {
      conditions.push(`<condition attribute="createdon" operator="le" value="${endDate}" />`)
    }

    if (entityName) {
      const safe = entityName.replace(/'/g, "''").replace(/"/g, '&quot;')
      conditions.push(`<condition attribute="objecttypecode" operator="eq" value="${safe}" />`)
    }

    const fetchXml = `<fetch mapping="logical">
  <entity name="audit">
    <attribute name="auditid" />
    <attribute name="action" />
    <attribute name="createdon" />
    <attribute name="objecttypecode" />
    <attribute name="changedata" />
    <attribute name="operation" />
    <attribute name="userid" />
    <order attribute="createdon" descending="true" />
    <filter type="and">
      ${conditions.join('')}
    </filter>
  </entity>
</fetch>`

    // Execute FetchXML via the data endpoint
    const entitySet = 'audits'
    const fetchResult = await dataverse.getWithQuery(`/${entitySet}`, {
      fetchXml,
    }) as { value?: Record<string, unknown>[] }

    const logs = (fetchResult.value ?? []).map(row => {
      const actionCode = typeof row.action === 'number' ? row.action : Number(row.action) || 0
      return {
        auditId: String(row.auditid ?? ''),
        action: actionCode,
        actionName: ACTION_MAP[actionCode] || `Unknown (${actionCode})`,
        createdon: row.createdon ? String(row.createdon) : null,
        userId: String(row.userid ?? ''),
        objectTypeCode: row.objecttypecode ? String(row.objecttypecode) : null,
        objectId: row.changedata ? String(row.changedata).slice(0, 200) : null,
        operation: typeof row.operation === 'number' ? row.operation : Number(row.operation) || 0,
        changeNumber: 0,
      }
    })

    res.json({ logs, total: logs.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit logs'
    console.error('Audit logs error:', message)
    res.status(500).json({ error: message })
  }
})
