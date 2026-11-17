import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const fieldsecurityRouter: Router = Router()
fieldsecurityRouter.use(requireConnection)

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const LOGICAL_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

// N:N navigation names on fieldsecurityprofile for members.
const MEMBER_NAV: Record<'user' | 'team', { nav: string; set: string; idField: string; nameField: string }> = {
  user: { nav: 'systemuserprofiles_association', set: 'systemusers', idField: 'systemuserid', nameField: 'fullname' },
  team: { nav: 'teamprofiles_association', set: 'teams', idField: 'teamid', nameField: 'name' },
}

// List all field security profiles.
fieldsecurityRouter.get('/profiles', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery('/fieldsecurityprofiles', {
      $select: 'fieldsecurityprofileid,name,description',
      $orderby: 'name',
    })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch field security profiles'
    console.error('Field security profiles error:', message)
    res.status(500).json({ error: message })
  }
})

// canread/canupdate/cancreate are picklists; resolve their labels live from
// metadata (same approach as the solutioncomponent optionset).
async function getPermissionLabels(dataverse: DataverseService): Promise<Record<number, string>> {
  const meta = (await dataverse.get(
    "/EntityDefinitions(LogicalName='fieldpermission')/Attributes(LogicalName='canread')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)"
  )) as Record<string, unknown>
  const optionSet = meta.OptionSet as Record<string, unknown> | undefined
  const options = Array.isArray(optionSet?.Options) ? optionSet.Options : []
  const labels: Record<number, string> = {}
  for (const opt of options as Record<string, unknown>[]) {
    const value = Number(opt.Value)
    const label = opt.Label as Record<string, unknown> | undefined
    const localized = Array.isArray(label?.LocalizedLabels) ? label.LocalizedLabels : []
    const text = String((localized[0] as Record<string, unknown> | undefined)?.Label ?? value)
    labels[value] = text
  }
  return labels
}

// Permissions of one profile, grouped by entity on the client.
fieldsecurityRouter.get('/profiles/:id/permissions', async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id
    if (!GUID_RE.test(profileId)) {
      res.status(400).json({ error: 'Invalid profile id' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const [result, labels] = await Promise.all([
      dataverse.getWithQuery('/fieldpermissions', {
        $select: 'fieldpermissionid,attributelogicalname,entityname,canread,canupdate,cancreate',
        $filter: `_fieldsecurityprofileid_value eq ${profileId}`,
      }) as Promise<{ value?: Record<string, unknown>[] }>,
      getPermissionLabels(dataverse),
    ])

    const permissions = (result.value ?? []).map(row => {
      const perm: Record<string, unknown> = {
        fieldPermissionId: String(row.fieldpermissionid ?? ''),
        attributeLogicalName: String(row.attributelogicalname ?? ''),
        entityName: String(row.entityname ?? ''),
      }
      for (const key of ['canread', 'canupdate', 'cancreate'] as const) {
        const value = typeof row[key] === 'number' ? row[key] : Number(row[key]) || 0
        perm[key] = { value, label: labels[value] ?? String(value) }
      }
      return perm
    })
    permissions.sort((a, b) =>
      String(a.entityName).localeCompare(String(b.entityName)) ||
      String(a.attributeLogicalName).localeCompare(String(b.attributeLogicalName))
    )
    res.json({ permissions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile permissions'
    console.error('Profile permissions error:', message)
    res.status(500).json({ error: message })
  }
})

// Members (users + teams) assigned to a profile, via the N:N navigations.
fieldsecurityRouter.get('/profiles/:id/members', async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id
    if (!GUID_RE.test(profileId)) {
      res.status(400).json({ error: 'Invalid profile id' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const members: { memberId: string; memberType: 'user' | 'team'; name: string }[] = []

    await Promise.all((Object.keys(MEMBER_NAV) as ('user' | 'team')[]).map(async type => {
      const cfg = MEMBER_NAV[type]
      const result = (await dataverse.get(
        `/fieldsecurityprofiles(${profileId})/${cfg.nav}?$select=${cfg.idField},${cfg.nameField}`
      )) as { value?: Record<string, unknown>[] }
      for (const row of result.value ?? []) {
        members.push({
          memberId: String(row[cfg.idField] ?? ''),
          memberType: type,
          name: String(row[cfg.nameField] ?? ''),
        })
      }
    }))

    members.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ members })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile members'
    console.error('Profile members error:', message)
    res.status(500).json({ error: message })
  }
})

// Assign a user or team to a profile (N:N $ref).
fieldsecurityRouter.post('/profiles/:id/members', async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id
    const memberId = String(req.body?.memberId ?? '')
    const memberType = String(req.body?.memberType ?? '') as 'user' | 'team'
    const cfg = MEMBER_NAV[memberType]
    if (!GUID_RE.test(profileId) || !GUID_RE.test(memberId) || !cfg) {
      res.status(400).json({ error: 'Valid profile id, memberId and memberType (user|team) are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    await dataverse.post(`/fieldsecurityprofiles(${profileId})/${cfg.nav}/$ref`, {
      '@odata.id': dataverse.buildEntityUrl(`/${cfg.set}(${memberId})`),
    })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign profile member'
    console.error('Assign profile member error:', message)
    res.status(500).json({ error: message })
  }
})

// Remove a user or team from a profile (N:N $ref delete).
fieldsecurityRouter.delete('/profiles/:id/members/:type/:memberId', async (req: Request, res: Response) => {
  try {
    const { id: profileId, type, memberId } = req.params
    const cfg = MEMBER_NAV[type as 'user' | 'team']
    if (!GUID_RE.test(profileId) || !GUID_RE.test(memberId) || !cfg) {
      res.status(400).json({ error: 'Valid profile id, type (user|team) and memberId are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    await dataverse.delete(`/fieldsecurityprofiles(${profileId})/${cfg.nav}/$ref`, {
      $id: dataverse.buildEntityUrl(`/${cfg.set}(${memberId})`),
    })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove profile member'
    console.error('Remove profile member error:', message)
    res.status(500).json({ error: message })
  }
})

// All secured fields of an entity (IsSecured=true), for the "which fields are
// protected" troubleshooting view.
fieldsecurityRouter.get('/secured-fields', async (req: Request, res: Response) => {
  try {
    const entityName = String(req.query.entityName || '').trim()
    if (!LOGICAL_NAME_RE.test(entityName)) {
      res.status(400).json({ error: 'Valid entityName is required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const result = (await dataverse.getWithQuery(
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes`,
      {
        $select: 'LogicalName,AttributeType,DisplayName',
        $filter: 'IsSecured eq true',
      }
    )) as { value?: Record<string, unknown>[] }

    const fields = (result.value ?? []).map(row => {
      const displayName = row.DisplayName as Record<string, unknown> | undefined
      const localized = Array.isArray(displayName?.LocalizedLabels) ? displayName.LocalizedLabels : []
      return {
        logicalName: String(row.LogicalName ?? ''),
        attributeType: String(row.AttributeType ?? ''),
        displayName: String((localized[0] as Record<string, unknown> | undefined)?.Label ?? ''),
      }
    })
    fields.sort((a, b) => a.logicalName.localeCompare(b.logicalName))
    res.json({ fields })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch secured fields'
    console.error('Secured fields error:', message)
    res.status(500).json({ error: message })
  }
})
