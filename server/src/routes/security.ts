import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const securityRouter: Router = Router()
securityRouter.use(requireConnection)

interface PagedFetchResponse {
  value?: Record<string, unknown>[]
  '@Microsoft.Dynamics.CRM.fetchxmlpagingcookie'?: string
}

// FetchXML via the Web API pages at 5000 rows. More pages exist while the
// response carries a fetchxmlpagingcookie; pass its (already encoded)
// pagingcookie value back via the paging-cookie attribute. Page cap is a
// runaway safeguard.
export async function fetchAllRows(
  dataverse: DataverseService,
  entitySet: string,
  innerFetchXml: string,
  maxPages = 50
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let pagingCookie: string | null = null
  for (let page = 1; page <= maxPages; page++) {
    const cookieAttr = pagingCookie ? ` paging-cookie="${pagingCookie}"` : ''
    const fetchXml = `<fetch page="${page}"${cookieAttr}>${innerFetchXml}</fetch>`
    const result = (await dataverse.getWithQuery(entitySet, { fetchXml })) as PagedFetchResponse
    rows.push(...(result.value ?? []))
    const cookieHeader = result['@Microsoft.Dynamics.CRM.fetchxmlpagingcookie']
    const nextCookie = cookieHeader ? /pagingcookie="([^"]*)"/.exec(cookieHeader)?.[1] : undefined
    if (!nextCookie) break
    // The returned cookie is URL-encoded twice, and the platform parses the
    // paging-cookie attribute value directly as XML (no URL decoding on the
    // way in), so decode fully and XML-escape it for the attribute.
    pagingCookie = decodeURIComponent(decodeURIComponent(nextCookie))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
  }
  return rows
}

const rolesFetchInner = `
  <entity name="role">
    <attribute name="roleid" />
    <attribute name="name" />
    <order attribute="name" />
    <order attribute="roleid" />
  </entity>`

// List all security roles.
// Dataverse creates one role copy per business unit under the same name with a
// different roleid, so the result is merged by name (first roleid wins).
securityRouter.get('/roles', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const rows = await fetchAllRows(dataverse, '/roles', rolesFetchInner)

    const byName = new Map<string, { roleid: string; name: string }>()
    for (const row of rows) {
      const name = String(row.name ?? '')
      if (!byName.has(name)) {
        byName.set(name, { roleid: String(row.roleid ?? ''), name })
      }
    }
    res.json({ value: [...byName.values()] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch security roles'
    console.error('Security roles error:', message)
    res.status(500).json({ error: message })
  }
})

const ACTIONS = ['Create', 'Read', 'Write', 'Delete', 'AppendTo', 'Append', 'Assign', 'Share'] as const
type ActionName = (typeof ACTIONS)[number]

interface RolePrivilegeRow {
  roleId: string
  roleName: string
  privileges: Partial<Record<ActionName, number>>
}

// Privilege depth bitmask (privilegedepthmask on the roleprivileges intersect entity)
// 1 = User (Basic), 2 = Business Unit (Local), 4 = Parent:Child BU (Deep), 8 = Organization (Global)
const DEPTH_BITS = [8, 4, 2, 1]

export function effectiveDepth(mask: number): number {
  for (const bit of DEPTH_BITS) {
    if ((mask & bit) === bit) return bit
  }
  return 0
}

function findAliasedValue(row: Record<string, unknown>, suffix: string): unknown {
  for (const [key, value] of Object.entries(row)) {
    if (key === suffix || key.endsWith(`.${suffix}`)) return value
  }
  return undefined
}

// Privilege matrix for an entity across all roles.
// Privilege names follow the prv{Action}{Entity} convention (e.g. prvReadAccount).
//
// Two paged queries instead of one outer join:
//  1. all role records (one copy per business unit), merged by name;
//  2. only the role-privilege pairs whose privilege matches the entity (inner
//     join). An outer join would multiply row counts per role and silently
//     truncate late-alphabet roles once the page limit is hit.
securityRouter.get('/matrix', async (req: Request, res: Response) => {
  try {
    const entityName = String(req.query.entityName || '').trim()
    if (!entityName) {
      res.status(400).json({ error: 'entityName is required' })
      return
    }
    const safeEntity = entityName.replace(/[%_\\\[\]]/g, '')
    const dataverse = DataverseService.getInstance()

    // Phase 1: every role record, merged by name (BU copies share a name).
    const roleRows = await fetchAllRows(dataverse, '/roles', rolesFetchInner)
    const rolesByName = new Map<string, RolePrivilegeRow>()
    const roleNameById = new Map<string, string>()
    for (const row of roleRows) {
      const roleId = String(row.roleid ?? '')
      if (!roleId) continue
      const roleName = String(row.name ?? '')
      roleNameById.set(roleId, roleName)
      if (!rolesByName.has(roleName)) {
        rolesByName.set(roleName, { roleId, roleName, privileges: {} })
      }
    }

    // Phase 2: matching role-privilege pairs only.
    const privilegeRows = await fetchAllRows(dataverse, '/roleprivilegescollection', `
  <entity name="roleprivileges">
    <attribute name="roleid" />
    <attribute name="privilegedepthmask" alias="depth" />
    <order attribute="roleid" />
    <link-entity name="privilege" from="privilegeid" to="privilegeid" link-type="inner">
      <attribute name="name" alias="privilegename" />
      <filter>
        <condition attribute="name" operator="like" value="%${safeEntity}" />
      </filter>
    </link-entity>
  </entity>`)

    const actionPattern = /^prv(Create|Read|Write|Delete|AppendTo|Append|Assign|Share)(.+)$/i

    for (const row of privilegeRows) {
      const roleName = roleNameById.get(String(row.roleid ?? ''))
      if (!roleName) continue
      const entry = rolesByName.get(roleName)
      if (!entry) continue

      const privName = findAliasedValue(row, 'privilegename')
      if (typeof privName !== 'string') continue

      const match = actionPattern.exec(privName)
      if (!match) continue
      const [, actionRaw, entityPart] = match
      // Strict suffix match on entity name to filter out look-alike privileges
      if (entityPart.toLowerCase() !== entityName.toLowerCase()) continue

      const action = ACTIONS.find(a => a.toLowerCase() === actionRaw.toLowerCase())
      if (!action) continue

      const depthRaw = findAliasedValue(row, 'depth')
      const mask = typeof depthRaw === 'number' ? depthRaw : Number(depthRaw) || 0
      const depth = effectiveDepth(mask)
      const existing = entry.privileges[action] ?? 0
      if (depth > existing) entry.privileges[action] = depth
    }

    const roles = [...rolesByName.values()].sort((a, b) => a.roleName.localeCompare(b.roleName))
    res.json({ actions: ACTIONS, roles })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch privilege matrix'
    console.error('Privilege matrix error:', message)
    res.status(500).json({ error: message })
  }
})

// ---------- shared validation helpers ----------

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function isGuid(value: string): boolean {
  return GUID_RE.test(value)
}

// ---------- User Access Analyzer ----------

// Search users by display name or email. Without a search term only enabled
// users are listed (admins usually search for a specific person).
securityRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || '').trim()
    const top = Math.min(Math.max(Number(req.query.top) || 20, 1), 100)
    const dataverse = DataverseService.getInstance()

    const params: Record<string, string> = {
      $select: 'systemuserid,fullname,domainname,internalemailaddress,isdisabled',
      $orderby: 'fullname',
      $top: String(top),
    }
    if (search) {
      const safe = search.replace(/'/g, "''")
      params.$filter = `(contains(fullname,'${safe}') or contains(internalemailaddress,'${safe}'))`
    } else {
      params.$filter = 'isdisabled eq false'
    }

    const result = await dataverse.getWithQuery('/systemusers', params)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search users'
    console.error('User search error:', message)
    res.status(500).json({ error: message })
  }
})

// Search teams by name (for sharing / profile member pickers).
securityRouter.get('/teams', async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || '').trim()
    const top = Math.min(Math.max(Number(req.query.top) || 20, 1), 100)
    const dataverse = DataverseService.getInstance()

    const params: Record<string, string> = {
      $select: 'teamid,name,teamtype,isdefault',
      $orderby: 'name',
      $top: String(top),
    }
    if (search) {
      params.$filter = `contains(name,'${search.replace(/'/g, "''")}')`
    }

    const result = await dataverse.getWithQuery('/teams', params)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search teams'
    console.error('Team search error:', message)
    res.status(500).json({ error: message })
  }
})

interface NamedRole {
  roleId: string
  name: string
}

function toNamedRoles(rows: Record<string, unknown>[]): NamedRole[] {
  const byName = new Map<string, NamedRole>()
  for (const row of rows) {
    const name = String(row.name ?? '')
    if (!byName.has(name)) {
      byName.set(name, { roleId: String(row.roleid ?? ''), name })
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// Aggregated security profile for one user: identity, business unit, direct
// roles, teams, and each team's roles. Roles are merged by name (BU copies).
securityRouter.get('/users/:id/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id
    if (!isGuid(userId)) {
      res.status(400).json({ error: 'Invalid user id' })
      return
    }
    const dataverse = DataverseService.getInstance()

    const user = (await dataverse.get(
      `/systemusers(${userId})?$select=systemuserid,fullname,domainname,internalemailaddress,isdisabled,accessmode&$expand=businessunitid($select=name)`
    )) as Record<string, unknown>

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

    const teamRows = await fetchAllRows(dataverse, '/teams', `
  <entity name="team">
    <attribute name="teamid" />
    <attribute name="name" />
    <attribute name="teamtype" />
    <attribute name="isdefault" />
    <link-entity name="teammembership" from="teamid" to="teamid" link-type="inner">
      <filter>
        <condition attribute="systemuserid" operator="eq" value="${userId}" />
      </filter>
    </link-entity>
  </entity>`)

    const teamIds = teamRows.map(r => String(r.teamid ?? '')).filter(Boolean)
    const teamRolesByTeam = new Map<string, NamedRole[]>()
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

      const byTeam = new Map<string, Record<string, unknown>[]>()
      for (const row of teamRoleRows) {
        const teamId = String(findAliasedValue(row, 'teamid') ?? '')
        if (!byTeam.has(teamId)) byTeam.set(teamId, [])
        byTeam.get(teamId)!.push(row)
      }
      for (const [teamId, rows] of byTeam) {
        teamRolesByTeam.set(teamId, toNamedRoles(rows))
      }
    }

    const teams = teamRows
      .map(r => {
        const teamId = String(r.teamid ?? '')
        return {
          teamId,
          name: String(r.name ?? ''),
          teamType: typeof r.teamtype === 'number' ? r.teamtype : Number(r.teamtype) || 0,
          isDefault: r.isdefault === true,
          roles: teamRolesByTeam.get(teamId) ?? [],
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const businessUnit = user.businessunitid as Record<string, unknown> | undefined
    res.json({
      user: {
        systemuserid: String(user.systemuserid ?? userId),
        fullname: String(user.fullname ?? ''),
        domainname: String(user.domainname ?? ''),
        internalemailaddress: String(user.internalemailaddress ?? ''),
        isdisabled: user.isdisabled === true,
        accessmode: typeof user.accessmode === 'number' ? user.accessmode : Number(user.accessmode) || 0,
        businessUnitName: String(businessUnit?.name ?? ''),
      },
      directRoles: toNamedRoles(directRoleRows),
      teams,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user security profile'
    console.error('User profile error:', message)
    res.status(500).json({ error: message })
  }
})

// Assign a security role to a user (N:N $ref).
securityRouter.post('/users/:id/roles', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id
    const roleId = String(req.body?.roleId || '')
    if (!isGuid(userId) || !isGuid(roleId)) {
      res.status(400).json({ error: 'Valid user id and roleId are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    await dataverse.post(`/systemusers(${userId})/systemuserroles_association/$ref`, {
      '@odata.id': dataverse.buildEntityUrl(`/roles(${roleId})`),
    })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign role'
    console.error('Assign role error:', message)
    res.status(500).json({ error: message })
  }
})

// Remove a security role from a user (N:N $ref delete).
securityRouter.delete('/users/:id/roles/:roleId', async (req: Request, res: Response) => {
  try {
    const { id: userId, roleId } = req.params
    if (!isGuid(userId) || !isGuid(roleId)) {
      res.status(400).json({ error: 'Valid user id and role id are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    await dataverse.delete(`/systemusers(${userId})/systemuserroles_association/$ref`, {
      $id: dataverse.buildEntityUrl(`/roles(${roleId})`),
    })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove role'
    console.error('Remove role error:', message)
    res.status(500).json({ error: message })
  }
})

// ---------- Security Role Compare ----------

interface RolePrivilege {
  privilegeId: string
  name: string
  depth: number
}

async function getRolePrivileges(dataverse: DataverseService, roleId: string): Promise<RolePrivilege[]> {
  const rows = await fetchAllRows(dataverse, '/roleprivilegescollection', `
  <entity name="roleprivileges">
    <attribute name="roleid" />
    <attribute name="privilegedepthmask" alias="depth" />
    <order attribute="roleid" />
    <filter>
      <condition attribute="roleid" operator="eq" value="${roleId}" />
    </filter>
    <link-entity name="privilege" from="privilegeid" to="privilegeid" link-type="inner">
      <attribute name="privilegeid" alias="privilegeid" />
      <attribute name="name" alias="privilegename" />
    </link-entity>
  </entity>`)

  // Merge by privilege name, keeping the highest depth seen.
  const byName = new Map<string, RolePrivilege>()
  for (const row of rows) {
    const name = findAliasedValue(row, 'privilegename')
    if (typeof name !== 'string') continue
    const privilegeId = String(findAliasedValue(row, 'privilegeid') ?? '')
    const depthRaw = findAliasedValue(row, 'depth')
    const mask = typeof depthRaw === 'number' ? depthRaw : Number(depthRaw) || 0
    const depth = effectiveDepth(mask)
    const existing = byName.get(name)
    if (!existing || depth > existing.depth) {
      byName.set(name, { privilegeId, name, depth })
    }
  }
  return [...byName.values()]
}

// Full privilege list of a single role.
securityRouter.get('/role-privileges', async (req: Request, res: Response) => {
  try {
    const roleId = String(req.query.roleId || '')
    if (!isGuid(roleId)) {
      res.status(400).json({ error: 'Valid roleId is required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const privileges = await getRolePrivileges(dataverse, roleId)
    privileges.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ privileges })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch role privileges'
    console.error('Role privileges error:', message)
    res.status(500).json({ error: message })
  }
})

// Compare two roles: union of privileges with per-side depth and diff status.
securityRouter.get('/compare', async (req: Request, res: Response) => {
  try {
    const roleIdA = String(req.query.roleIdA || '')
    const roleIdB = String(req.query.roleIdB || '')
    if (!isGuid(roleIdA) || !isGuid(roleIdB)) {
      res.status(400).json({ error: 'Valid roleIdA and roleIdB are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const [privA, privB] = await Promise.all([
      getRolePrivileges(dataverse, roleIdA),
      getRolePrivileges(dataverse, roleIdB),
    ])

    const mapA = new Map(privA.map(p => [p.name, p]))
    const mapB = new Map(privB.map(p => [p.name, p]))
    const names = [...new Set([...mapA.keys(), ...mapB.keys()])].sort((a, b) => a.localeCompare(b))

    const summary = { onlyA: 0, onlyB: 0, depthDiff: 0, same: 0 }
    const privileges = names.map(name => {
      const a = mapA.get(name)
      const b = mapB.get(name)
      let status: 'both' | 'onlyA' | 'onlyB' | 'depthDiff'
      if (a && !b) { status = 'onlyA'; summary.onlyA++ }
      else if (!a && b) { status = 'onlyB'; summary.onlyB++ }
      else if (a && b && a.depth !== b.depth) { status = 'depthDiff'; summary.depthDiff++ }
      else { status = 'both'; summary.same++ }
      return {
        name,
        privilegeId: (a ?? b)?.privilegeId ?? '',
        depthA: a?.depth ?? 0,
        depthB: b?.depth ?? 0,
        status,
      }
    })

    res.json({ privileges, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compare roles'
    console.error('Role compare error:', message)
    res.status(500).json({ error: message })
  }
})

// Depth enum names expected by the AddPrivilegesRole action.
const DEPTH_ENUM: Record<number, string> = { 1: 'Basic', 2: 'Local', 4: 'Deep', 8: 'Global' }

// Add privileges to a role (incremental union; never removes existing ones).
securityRouter.post('/roles/:roleId/add-privileges', async (req: Request, res: Response) => {
  try {
    const roleId = req.params.roleId
    if (!isGuid(roleId)) {
      res.status(400).json({ error: 'Invalid role id' })
      return
    }
    const privileges = req.body?.privileges
    if (!Array.isArray(privileges) || privileges.length === 0 || privileges.length > 500) {
      res.status(400).json({ error: 'privileges must be an array of 1-500 entries' })
      return
    }
    for (const p of privileges) {
      if (!isGuid(String(p?.privilegeId ?? '')) || !DEPTH_ENUM[Number(p?.depth)]) {
        res.status(400).json({ error: 'Each privilege needs a valid privilegeId and depth (1/2/4/8)' })
        return
      }
    }
    const dataverse = DataverseService.getInstance()
    await dataverse.post(`/roles(${roleId})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, {
      Privileges: privileges.map((p: { privilegeId: string; depth: number }) => ({
        PrivilegeId: p.privilegeId,
        Depth: DEPTH_ENUM[Number(p.depth)],
      })),
    })
    res.json({ success: true, added: privileges.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add privileges to role'
    console.error('Add privileges error:', message)
    res.status(500).json({ error: message })
  }
})
