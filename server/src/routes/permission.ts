import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'
import { fetchAllRows, effectiveDepth } from './security.js'

export const permissionRouter: Router = Router()
permissionRouter.use(requireConnection)

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const ACTIONS = ['Create', 'Read', 'Write', 'Delete', 'AppendTo', 'Append', 'Assign', 'Share'] as const

// POST /diagnose - Comprehensive permission diagnosis for a user against an entity/record
permissionRouter.post('/diagnose', async (req: Request, res: Response) => {
  try {
    const { userId, entityName, recordId } = req.body as {
      userId?: string
      entityName?: string
      recordId?: string
    }

    if (!userId || !GUID_RE.test(userId)) {
      res.status(400).json({ error: 'Valid userId (GUID) is required' })
      return
    }
    if (!entityName || typeof entityName !== 'string') {
      res.status(400).json({ error: 'entityName is required' })
      return
    }

    const dataverse = DataverseService.getInstance()
    const safeEntity = entityName.replace(/[%_\\\[\]]/g, '').replace(/'/g, "''")

    // 1. User profile (direct roles + teams)
    const user = (await dataverse.get(
      `/systemusers(${userId})?$select=systemuserid,fullname,domainname,internalemailaddress,isdisabled,accessmode&$expand=businessunitid($select=name)`
    )) as Record<string, unknown>

    const businessUnit = user.businessunitid as Record<string, unknown> | undefined

    // 2. Direct roles
    const directRoleRows = await fetchAllRows(dataverse, '/roles', `
  <entity name="role">
    <attribute name="roleid" />
    <attribute name="name" />
    <link-entity name="systemuserroles" from="roleid" to="roleid" link-type="inner">
      <filter>
        <condition attribute="systemuserid" operator="eq" value="${userId}" />
      </filter>
    </link-entity>
  </entity>`)

    const directRoles = directRoleRows.map(r => ({
      roleId: String(r.roleid ?? ''),
      name: String(r.name ?? ''),
    }))

    // 3. Teams and team roles
    const teamRows = await fetchAllRows(dataverse, '/teams', `
  <entity name="team">
    <attribute name="teamid" />
    <attribute name="name" />
    <link-entity name="teammembership" from="teamid" to="teamid" link-type="inner">
      <filter>
        <condition attribute="systemuserid" operator="eq" value="${userId}" />
      </filter>
    </link-entity>
  </entity>`)

    const teamIds = teamRows.map(r => String(r.teamid ?? '')).filter(Boolean)
    const teamRoles: { teamId: string; teamName: string; roles: { roleId: string; name: string }[] }[] = []

    if (teamIds.length > 0) {
      const teamRoleRows = await fetchAllRows(dataverse, '/roles', `
  <entity name="role">
    <attribute name="roleid" />
    <attribute name="name" />
    <link-entity name="teamroles" from="roleid" to="roleid" link-type="inner">
      <attribute name="teamid" alias="teamid" />
      <filter>
        <condition attribute="teamid" operator="in">
          ${teamIds.map(id => `<value>${id}</value>`).join('')}
        </condition>
      </filter>
    </link-entity>
  </entity>`)

      const byTeam = new Map<string, { roleId: string; name: string }[]>()
      for (const row of teamRoleRows) {
        const teamId = String(row.teamid ?? '')
        if (!byTeam.has(teamId)) byTeam.set(teamId, [])
        byTeam.get(teamId)!.push({ roleId: String(row.roleid ?? ''), name: String(row.name ?? '') })
      }

      for (const t of teamRows) {
        const tid = String(t.teamid ?? '')
        teamRoles.push({
          teamId: tid,
          teamName: String(t.name ?? ''),
          roles: byTeam.get(tid) ?? [],
        })
      }
    }

    // 4. Effective privileges for the entity (across all direct + team roles)
    const allRoleIds = [
      ...directRoles.map(r => r.roleId),
      ...teamRoles.flatMap(t => t.roles.map(r => r.roleId)),
    ]

    const effectivePrivileges: Record<string, number> = {}
    for (const action of ACTIONS) {
      effectivePrivileges[action] = 0
    }

    if (allRoleIds.length > 0) {
      const roleIdsFilter = allRoleIds.map(id => `<value>${id}</value>`).join('')
      const privilegeRows = await fetchAllRows(dataverse, '/roleprivilegescollection', `
  <entity name="roleprivileges">
    <attribute name="roleid" />
    <attribute name="privilegedepthmask" alias="depth" />
    <filter>
      <condition attribute="roleid" operator="in">
        ${roleIdsFilter}
      </condition>
    </filter>
    <link-entity name="privilege" from="privilegeid" to="privilegeid" link-type="inner">
      <attribute name="name" alias="privilegename" />
      <filter>
        <condition attribute="name" operator="like" value="%${safeEntity}" />
      </filter>
    </link-entity>
  </entity>`)

      const actionPattern = /^prv(Create|Read|Write|Delete|AppendTo|Append|Assign|Share)(.+)$/i

      for (const row of privilegeRows) {
        const privName = typeof row.privilegename === 'string'
          ? row.privilegename
          : String((row as Record<string, unknown>)['privilegename.alias'] ?? '')
        if (typeof privName !== 'string') continue

        const match = actionPattern.exec(privName)
        if (!match) continue
        const [, actionRaw, entityPart] = match
        if (entityPart.toLowerCase() !== entityName.toLowerCase()) continue

        const action = ACTIONS.find(a => a.toLowerCase() === actionRaw.toLowerCase())
        if (!action) continue

        const depthRaw = typeof row.depth === 'number' ? row.depth : Number((row as Record<string, unknown>)['depth.alias'] ?? 0)
        const mask = typeof depthRaw === 'number' ? depthRaw : Number(depthRaw) || 0
        const depth = effectiveDepth(mask)
        if (depth > effectivePrivileges[action]) {
          effectivePrivileges[action] = depth
        }
      }
    }

    // 5. Sharing access (if recordId provided)
    let sharingAccess: { granted: boolean; rights: string[] } | null = null
    if (recordId && GUID_RE.test(recordId)) {
      try {
        // Resolve entity set name
        const entityMeta = await dataverse.getWithQuery(`/EntityDefinitions(LogicalName='${safeEntity}')`, {
          $select: 'EntitySetName',
        }) as Record<string, unknown>
        const entitySet = entityMeta.EntitySetName ? String(entityMeta.EntitySetName) : entityName + 's'

        // Check POA for this user+record
        const poaResult = await dataverse.getWithQuery('/principalobjectaccesses', {
          $select: 'accessrightsmask',
          $filter: `objectid eq ${recordId} and principalid eq ${userId}`,
          $top: '1',
        }) as { value?: Record<string, unknown>[] }

        const poaRow = poaResult.value?.[0]
        if (poaRow) {
          const mask = typeof poaRow.accessrightsmask === 'number'
            ? poaRow.accessrightsmask
            : Number(poaRow.accessrightsmask) || 0
          const rights: string[] = []
          if (mask & 1) rights.push('Read')
          if (mask & 2) rights.push('Write')
          if (mask & 4) rights.push('Append')
          if (mask & 16) rights.push('AppendTo')
          if (mask & 32) rights.push('Create')
          if (mask & 65536) rights.push('Delete')
          if (mask & 131072) rights.push('Share')
          if (mask & 262144) rights.push('Assign')
          sharingAccess = { granted: rights.length > 0, rights }
        } else {
          sharingAccess = { granted: false, rights: [] }
        }
      } catch {
        sharingAccess = null
      }
    }

    // 6. Field-level security (secured fields for this entity)
    let fieldSecurity: { hasSecuredFields: boolean; fields: { logicalName: string; attributeType: string; displayName: string }[] } | null = null
    try {
      const attrResult = (await dataverse.getWithQuery(
        `/EntityDefinitions(LogicalName='${safeEntity}')/Attributes`,
        {
          $select: 'LogicalName,AttributeType,DisplayName',
          $filter: 'IsSecured eq true',
        }
      )) as { value?: Record<string, unknown>[] }

      const fields = (attrResult.value ?? []).map(row => {
        const displayName = row.DisplayName as Record<string, unknown> | undefined
        const localized = Array.isArray(displayName?.LocalizedLabels) ? displayName.LocalizedLabels : []
        return {
          logicalName: String(row.LogicalName ?? ''),
          attributeType: String(row.AttributeType ?? ''),
          displayName: String((localized[0] as Record<string, unknown> | undefined)?.Label ?? ''),
        }
      })
      fields.sort((a, b) => a.logicalName.localeCompare(b.logicalName))
      fieldSecurity = { hasSecuredFields: fields.length > 0, fields }
    } catch {
      fieldSecurity = null
    }

    // 7. Verdict
    const hasAnyPrivilege = Object.values(effectivePrivileges).some(d => d > 0)
    const verdict = hasAnyPrivilege ? 'Granted' : 'Denied'
    const sources: string[] = []
    if (directRoles.length > 0) sources.push(`${directRoles.length} direct role(s)`)
    if (teamRoles.some(t => t.roles.length > 0)) sources.push(`roles via ${teamRoles.filter(t => t.roles.length > 0).length} team(s)`)
    if (sharingAccess?.granted) sources.push('record sharing (POA)')
    if (fieldSecurity?.hasSecuredFields) sources.push(`${fieldSecurity.fields.length} field-level secured attribute(s)`)

    res.json({
      user: {
        systemuserid: String(user.systemuserid ?? userId),
        fullname: String(user.fullname ?? ''),
        domainname: String(user.domainname ?? ''),
        isdisabled: user.isdisabled === true,
        businessUnitName: String(businessUnit?.name ?? ''),
      },
      directRoles,
      teamRoles,
      effectivePrivileges,
      sharingAccess,
      fieldSecurity,
      verdict,
      verdictSources: sources,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to diagnose permissions'
    console.error('Permission diagnose error:', message)
    res.status(500).json({ error: message })
  }
})
