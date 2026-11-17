import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'
import { fetchAllRows, effectiveDepth } from './security.js'

export const recordaccessRouter: Router = Router()
recordaccessRouter.use(requireConnection)

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const SET_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

// Access rights understood by RetrievePrincipalAccess / *Access actions.
const ACCESS_RIGHTS = [
  'ReadAccess',
  'WriteAccess',
  'AppendAccess',
  'AppendToAccess',
  'CreateAccess',
  'DeleteAccess',
  'ShareAccess',
  'AssignAccess',
] as const

const ACCESS_RIGHT_SET = new Set<string>(ACCESS_RIGHTS)

interface TargetInput {
  entitySetName: string
  recordId: string
}

function validateTarget(body: Record<string, unknown>): TargetInput | null {
  const entitySetName = String(body?.entitySetName ?? '')
  const recordId = String(body?.recordId ?? '')
  if (!SET_NAME_RE.test(entitySetName) || !GUID_RE.test(recordId)) return null
  return { entitySetName, recordId }
}

function validatePrincipal(body: Record<string, unknown>): { principalId: string; principalType: 'systemusers' | 'teams' } | null {
  const principalId = String(body?.principalId ?? '')
  const principalType = String(body?.principalType ?? '')
  if (!GUID_RE.test(principalId)) return null
  if (principalType !== 'systemusers' && principalType !== 'teams') return null
  return { principalId, principalType }
}

function entityRef(dataverse: DataverseService, setName: string, id: string) {
  return { '@odata.id': dataverse.buildEntityUrl(`/${setName}(${id})`) }
}

// ---------- effective access fallback ----------

// POA accessrightsmask bits (AccessRights enum)
const POA_BITS: Record<string, number> = {
  ReadAccess: 1,
  WriteAccess: 2,
  AppendAccess: 4,
  AppendToAccess: 16,
  CreateAccess: 32,
  DeleteAccess: 65536,
  ShareAccess: 262144,
  AssignAccess: 524288,
}

const PRIV_ACTION_PATTERN = /^prv(Create|Read|Write|Delete|AppendTo|Append|Assign|Share)(.+)$/i

function findAliasedValue(row: Record<string, unknown>, suffix: string): unknown {
  for (const [key, value] of Object.entries(row)) {
    if (key === suffix || key.endsWith(`.${suffix}`)) return value
  }
  return undefined
}

// Some clouds (e.g. 21Vianet crm5) do not expose RetrievePrincipalAccess in
// their function catalog. Fall back to computing effective access from the
// user's role privileges (direct + via teams, depth evaluated against the
// record's owner / business unit) unioned with explicit POA shares.
async function computeEffectiveAccess(
  dataverse: DataverseService,
  entitySetName: string,
  recordId: string,
  userId: string
): Promise<{ right: string; granted: boolean }[]> {
  // 1. entity logical name (privileges are suffixed with it)
  const meta = (await dataverse.getWithQuery('/EntityDefinitions', {
    $select: 'LogicalName',
    $filter: `EntitySetName eq '${entitySetName}'`,
  })) as { value?: Record<string, unknown>[] }
  const entityName = String(meta.value?.[0]?.LogicalName ?? '').toLowerCase()
  if (!entityName) throw new Error(`Cannot resolve entity for set '${entitySetName}'`)

  // 2. user business unit + team memberships
  const user = (await dataverse.get(`/systemusers(${userId})?$select=_businessunitid_value`)) as Record<string, unknown>
  const userBU = String(user._businessunitid_value ?? '')
  const teamRows = await fetchAllRows(dataverse, '/teams', `
  <entity name="team">
    <attribute name="teamid" />
    <link-entity name="teammembership" from="teamid" to="teamid" link-type="inner">
      <filter>
        <condition attribute="systemuserid" operator="eq" value="${userId}" />
      </filter>
    </link-entity>
  </entity>`)
  const teamIds = teamRows.map(r => String(r.teamid ?? '')).filter(Boolean)

  // 3. record owner + owning business unit
  const record = (await dataverse.get(
    `/${entitySetName}(${recordId})?$select=_ownerid_value,_owningbusinessunit_value`
  )) as Record<string, unknown>
  const ownerId = String(record._ownerid_value ?? '')
  const recordBU = String(record._owningbusinessunit_value ?? '')

  // 4. all role ids the user has (direct + via teams)
  const roleIds = new Set<string>()
  const directRoleRows = await fetchAllRows(dataverse, '/roles', `
  <entity name="role">
    <attribute name="roleid" />
    <link-entity name="systemuserroles" from="roleid" to="roleid" link-type="inner">
      <filter>
        <condition attribute="systemuserid" operator="eq" value="${userId}" />
      </filter>
    </link-entity>
  </entity>`)
  for (const r of directRoleRows) roleIds.add(String(r.roleid ?? ''))
  if (teamIds.length > 0) {
    const teamRoleRows = await fetchAllRows(dataverse, '/roles', `
  <entity name="role">
    <attribute name="roleid" />
    <link-entity name="teamroles" from="roleid" to="roleid" link-type="inner">
      <filter>
        <condition attribute="teamid" operator="in">
          ${teamIds.map(id => `<value>${id}</value>`).join('')}
        </condition>
      </filter>
    </link-entity>
  </entity>`)
    for (const r of teamRoleRows) roleIds.add(String(r.roleid ?? ''))
  }
  roleIds.delete('')

  // 5. max privilege depth per action for this entity across all roles
  const maxDepth = new Map<string, number>()
  if (roleIds.size > 0) {
    const privRows = await fetchAllRows(dataverse, '/roleprivilegescollection', `
  <entity name="roleprivileges">
    <attribute name="privilegedepthmask" alias="depth" />
    <order attribute="roleid" />
    <filter>
      <condition attribute="roleid" operator="in">
        ${[...roleIds].map(id => `<value>${id}</value>`).join('')}
      </condition>
    </filter>
    <link-entity name="privilege" from="privilegeid" to="privilegeid" link-type="inner">
      <attribute name="name" alias="privilegename" />
      <filter>
        <condition attribute="name" operator="like" value="%${entityName}" />
      </filter>
    </link-entity>
  </entity>`)
    for (const row of privRows) {
      const privName = findAliasedValue(row, 'privilegename')
      if (typeof privName !== 'string') continue
      const match = PRIV_ACTION_PATTERN.exec(privName)
      if (!match || match[2].toLowerCase() !== entityName) continue
      const action = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()
      const depthRaw = findAliasedValue(row, 'depth')
      const mask = typeof depthRaw === 'number' ? depthRaw : Number(depthRaw) || 0
      const depth = effectiveDepth(mask)
      if (depth > (maxDepth.get(action) ?? 0)) maxDepth.set(action, depth)
    }
  }

  // 6. record BU ancestor chain (for Parent:Child BU depth checks)
  const buChain = new Set<string>()
  let buCursor = recordBU
  for (let i = 0; buCursor && i < 50; i++) {
    buChain.add(buCursor)
    const bu = (await dataverse.get(`/businessunits(${buCursor})?$select=_parentbusinessunitid_value`)) as Record<string, unknown>
    buCursor = String(bu._parentbusinessunitid_value ?? '')
  }

  // 7. POA shares for the user and their teams on this record.
  // principalobjectaccess exposes objectid / principalid as plain Guid
  // properties (no _*_value lookups).
  let poaMask = 0
  const principals = [userId, ...teamIds]
  const poaFilter = `objectid eq ${recordId} and (${principals.map(id => `principalid eq ${id}`).join(' or ')})`
  const poa = (await dataverse.getWithQuery('/principalobjectaccessset', {
    $select: 'accessrightsmask',
    $filter: poaFilter,
  })) as { value?: Record<string, unknown>[] }
  for (const row of poa.value ?? []) {
    const mask = typeof row.accessrightsmask === 'number' ? row.accessrightsmask : Number(row.accessrightsmask) || 0
    poaMask |= mask
  }

  // 8. evaluate each right
  return ACCESS_RIGHTS.map(right => {
    const action = right.replace(/Access$/, '')
    const depth = maxDepth.get(action) ?? 0
    let granted = false
    if (action === 'Create') {
      // Create is not record-scoped: any depth above None grants it somewhere
      granted = depth > 0
    } else if (depth === 8) {
      granted = true
    } else if (depth === 4 && userBU && buChain.has(userBU)) {
      granted = true
    } else if (depth === 2 && userBU && recordBU === userBU) {
      granted = true
    } else if (depth === 1 && (ownerId === userId || (ownerId && teamIds.includes(ownerId)))) {
      granted = true
    }
    if (!granted && (poaMask & POA_BITS[right]) !== 0) granted = true
    return { right, granted }
  })
}

// Unbound FUNCTION with crmbaseentity parameters. The alias query keys (@t/@p)
// must stay literal in the query string, so the URL is assembled manually
// instead of going through axios params serialization (which encodes '@').
function functionCallUrl(dataverse: DataverseService, name: string, aliases: Record<string, unknown>): string {
  const aliasNames = Object.keys(aliases)
  const signature = aliasNames.map((k, i) => `${k}=@a${i}`).join(',')
  const query = aliasNames
    .map((k, i) => `@a${i}=${encodeURIComponent(JSON.stringify(aliases[k]))}`)
    .join('&')
  return `/${name}(${signature})?${query}`
}

// RetrievePrincipalAccess is an unbound FUNCTION (GET) returning a
// comma-separated AccessRights string like "ReadAccess, WriteAccess".
recordaccessRouter.post('/check', async (req: Request, res: Response) => {
  try {
    const target = validateTarget(req.body ?? {})
    const userId = String(req.body?.userId ?? '')
    if (!target || !GUID_RE.test(userId)) {
      res.status(400).json({ error: 'entitySetName, recordId and userId are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const url = functionCallUrl(dataverse, 'RetrievePrincipalAccess', {
      Target: entityRef(dataverse, target.entitySetName, target.recordId),
      Principal: entityRef(dataverse, 'systemusers', userId),
    })
    try {
      const result = (await dataverse.get(url)) as Record<string, unknown>
      const raw = String(result.AccessRights ?? '')
      const granted = new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
      const rights = ACCESS_RIGHTS.map(r => ({ right: r, granted: granted.has(r) }))
      res.json({ rights, raw, source: 'function' })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.includes("Resource not found for the segment")) throw error
      const rights = await computeEffectiveAccess(dataverse, target.entitySetName, target.recordId, userId)
      res.json({ rights, raw: '', source: 'computed' })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check record access'
    console.error('Record access check error:', message)
    res.status(500).json({ error: message })
  }
})

// Search records by the entity's primary name field so users don't paste GUIDs.
recordaccessRouter.post('/record-search', async (req: Request, res: Response) => {
  try {
    const entitySetName = String(req.body?.entitySetName ?? '')
    const primaryIdField = String(req.body?.primaryIdField ?? '')
    const primaryNameField = String(req.body?.primaryNameField ?? '')
    const searchText = String(req.body?.searchText ?? '').trim()
    if (!SET_NAME_RE.test(entitySetName) || !SET_NAME_RE.test(primaryIdField) || !SET_NAME_RE.test(primaryNameField)) {
      res.status(400).json({ error: 'entitySetName, primaryIdField and primaryNameField are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const params: Record<string, string> = {
      $select: `${primaryIdField},${primaryNameField}`,
      $orderby: primaryNameField,
      $top: '10',
    }
    if (searchText) {
      params.$filter = `contains(${primaryNameField},'${searchText.replace(/'/g, "''")}')`
    }
    const result = (await dataverse.getWithQuery(`/${entitySetName}`, params)) as { value?: Record<string, unknown>[] }
    const records = (result.value ?? [])
      .map(r => ({ id: String(r[primaryIdField] ?? ''), name: String(r[primaryNameField] ?? '') }))
      .filter(r => r.id)
    res.json({ records })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search records'
    console.error('Record search error:', message)
    res.status(500).json({ error: message })
  }
})

interface PrincipalAccessEntry {
  principalId: string
  principalType: 'systemusers' | 'teams'
  rights: string[]
}

// RetrieveSharedPrincipalsAndAccess is an unbound FUNCTION (GET). The returned
// Principal only carries type + id, so display names are resolved separately.
recordaccessRouter.post('/shared', async (req: Request, res: Response) => {
  try {
    const target = validateTarget(req.body ?? {})
    if (!target) {
      res.status(400).json({ error: 'entitySetName and recordId are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    const url = functionCallUrl(dataverse, 'RetrieveSharedPrincipalsAndAccess', {
      Target: entityRef(dataverse, target.entitySetName, target.recordId),
    })
    const result = (await dataverse.get(url)) as Record<string, unknown>

    const entries: PrincipalAccessEntry[] = []
    // Serialization differs by cloud: the collection key can be
    // 'PrincipalAccesses' (observed on crm5), 'PrincipalAccess' or 'value'.
    const rawList = Array.isArray(result.PrincipalAccesses)
      ? result.PrincipalAccesses
      : Array.isArray(result.PrincipalAccess)
        ? result.PrincipalAccess
        : Array.isArray(result.value) ? result.value : []
    for (const item of rawList as Record<string, unknown>[]) {
      const principal = item.Principal as Record<string, unknown> | undefined
      if (!principal) continue
      // Principal is an entity reference: the id property can be the primary
      // key name (systemuserid/teamid), 'ownerid' (observed on crm5) or 'Id';
      // @odata.type distinguishes users from teams.
      const odataType = String(principal['@odata.type'] ?? '')
      const isUser = 'systemuserid' in principal || odataType.includes('systemuser')
      const isTeam = !isUser && ('teamid' in principal || odataType.includes('team'))
      if (!isUser && !isTeam) continue
      const idRaw = principal[isUser ? 'systemuserid' : 'teamid'] ?? principal.ownerid ?? principal.Id
      // Function serialization may return upper-case GUIDs; normalize so
      // clients can compare against ids from regular entity queries.
      const principalId = String(idRaw ?? '').toLowerCase()
      if (!GUID_RE.test(principalId)) continue
      const rights = String(item.AccessMask ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(s => ACCESS_RIGHT_SET.has(s))
      entries.push({ principalId, principalType: isUser ? 'systemusers' : 'teams', rights })
    }

    // Resolve display names per principal type.
    const names = new Map<string, string>()
    await Promise.all((['systemusers', 'teams'] as const).map(async type => {
      const ids = entries.filter(e => e.principalType === type).map(e => e.principalId)
      if (ids.length === 0) return
      const idField = type === 'systemusers' ? 'systemuserid' : 'teamid'
      const nameField = type === 'systemusers' ? 'fullname' : 'name'
      const filter = ids.map(id => `${idField} eq ${id}`).join(' or ')
      const resolved = (await dataverse.getWithQuery(`/${type}`, {
        $select: `${idField},${nameField}`,
        $filter: filter,
      })) as { value?: Record<string, unknown>[] }
      for (const row of resolved.value ?? []) {
        names.set(String(row[idField] ?? ''), String(row[nameField] ?? ''))
      }
    }))

    res.json({
      principals: entries.map(e => ({ ...e, name: names.get(e.principalId) ?? '' })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch shared principals'
    console.error('Shared principals error:', message)
    res.status(500).json({ error: message })
  }
})

// Grant or modify a share. ModifyAccess replaces the principal's rights and is
// used when the principal already appears in the shared list.
recordaccessRouter.post('/share', async (req: Request, res: Response) => {
  try {
    const target = validateTarget(req.body ?? {})
    const principal = validatePrincipal(req.body ?? {})
    const rights: string[] = Array.isArray(req.body?.rights) ? req.body.rights.map(String) : []
    const isExisting = req.body?.isExisting === true
    if (!target || !principal || rights.length === 0 || rights.some((r: string) => !ACCESS_RIGHT_SET.has(r))) {
      res.status(400).json({ error: 'Valid target, principal and rights are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    await dataverse.post(`/${isExisting ? 'ModifyAccess' : 'GrantAccess'}`, {
      Target: entityRef(dataverse, target.entitySetName, target.recordId),
      PrincipalAccess: {
        Principal: entityRef(dataverse, principal.principalType, principal.principalId),
        AccessMask: rights.join(', '),
      },
    })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to share record'
    console.error('Share record error:', message)
    res.status(500).json({ error: message })
  }
})

// Revoke all shared access of a principal on a record.
recordaccessRouter.post('/revoke', async (req: Request, res: Response) => {
  try {
    const target = validateTarget(req.body ?? {})
    const principal = validatePrincipal(req.body ?? {})
    if (!target || !principal) {
      res.status(400).json({ error: 'Valid target and principal are required' })
      return
    }
    const dataverse = DataverseService.getInstance()
    await dataverse.post('/RevokeAccess', {
      Target: entityRef(dataverse, target.entitySetName, target.recordId),
      Revokee: entityRef(dataverse, principal.principalType, principal.principalId),
    })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke access'
    console.error('Revoke access error:', message)
    res.status(500).json({ error: message })
  }
})
