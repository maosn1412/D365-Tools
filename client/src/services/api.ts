const API_BASE = '/api'

export async function connectToDataverse(params: {
  authType: 'clientSecret' | 'usernamePassword'
  environmentUrl: string
  tenantId?: string
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
}): Promise<{ success: boolean; environmentUrl: string }> {
  const res = await fetch(`${API_BASE}/connection/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Connection failed')
  }
  return res.json()
}

export async function getConnectionStatus(): Promise<{ connected: boolean; environmentUrl?: string }> {
  const res = await fetch(`${API_BASE}/connection/status`)
  if (!res.ok) throw new Error('Failed to get connection status')
  return res.json()
}

export async function disconnectFromDataverse(): Promise<void> {
  const res = await fetch(`${API_BASE}/connection/disconnect`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to disconnect')
}

export async function fetchDataverse(path: string, queryParams?: Record<string, string>): Promise<unknown> {
  const qs = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : ''
  const res = await fetch(`${API_BASE}/dataverse${path}${qs}`)
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Dataverse API error')
  }
  return res.json()
}

// --- Dataverse metadata & FetchXML helpers ---

export interface MetadataDisplayName {
  UserLocalizedLabel?: { Label?: string }
}

export interface EntityMetadataItem {
  LogicalName: string
  DisplayName?: MetadataDisplayName
  EntitySetName?: string
  ObjectTypeCode?: number
  PrimaryIdAttribute?: string
  PrimaryNameAttribute?: string
}

export interface AttributeMetadataItem {
  LogicalName: string
  DisplayName?: MetadataDisplayName
  AttributeType?: number
}

export async function fetchMetadataEntities(limit = 2000): Promise<EntityMetadataItem[]> {
  const res = await fetch(`${API_BASE}/dataverse/metadata/entities?limit=${limit}`)
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Failed to fetch entities')
  }
  const data = await res.json()
  return data.value || []
}

export async function fetchEntityAttributes(entityName: string): Promise<AttributeMetadataItem[]> {
  const res = await fetch(`${API_BASE}/dataverse/metadata/entities/${encodeURIComponent(entityName)}/attributes`)
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Failed to fetch attributes')
  }
  const data = await res.json()
  return data.value || []
}

/** 清空服务端元数据缓存（全局"刷新元数据"按钮使用） */
export async function clearServerMetadataCache(): Promise<void> {
  const res = await fetch(`${API_BASE}/dataverse/metadata/cache`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Failed to clear metadata cache')
  }
}

export async function executeFetchXml(
  fetchXml: string,
  entitySetName?: string
): Promise<{ value: Record<string, unknown>[]; '@odata.nextLink'?: string }> {
  const res = await fetch(`${API_BASE}/dataverse/data/fetchxml`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fetchXml, entitySetName }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Failed to execute FetchXML')
  }
  return res.json()
}

// --- Security & access tools ---

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Request failed')
  }
  return res.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Request failed')
  }
  return res.json() as Promise<T>
}

async function deleteJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Request failed')
  }
  return res.json() as Promise<T>
}

export interface UserSearchResult {
  systemuserid: string
  fullname: string
  domainname?: string
  internalemailaddress?: string
  isdisabled?: boolean
}

export interface TeamSearchResult {
  teamid: string
  name: string
  teamtype?: number
  isdefault?: boolean
}

export interface NamedRole {
  roleId: string
  name: string
}

export interface TeamWithRoles {
  teamId: string
  name: string
  teamType: number
  isDefault: boolean
  roles: NamedRole[]
}

export interface UserSecurityProfile {
  user: {
    systemuserid: string
    fullname: string
    domainname: string
    internalemailaddress: string
    isdisabled: boolean
    accessmode: number
    businessUnitName: string
  }
  directRoles: NamedRole[]
  teams: TeamWithRoles[]
}

export function searchUsers(search: string, top = 20): Promise<UserSearchResult[]> {
  return getJson<{ value?: UserSearchResult[] }>(
    `/dataverse/security/users?search=${encodeURIComponent(search)}&top=${top}`
  ).then(d => d.value ?? [])
}

export function searchTeams(search: string, top = 20): Promise<TeamSearchResult[]> {
  return getJson<{ value?: TeamSearchResult[] }>(
    `/dataverse/security/teams?search=${encodeURIComponent(search)}&top=${top}`
  ).then(d => d.value ?? [])
}

export function fetchUserProfile(userId: string): Promise<UserSecurityProfile> {
  return getJson(`/dataverse/security/users/${userId}/profile`)
}

export function fetchSecurityRoles(): Promise<NamedRole[]> {
  return getJson<{ value?: { roleid: string; name: string }[] }>('/dataverse/security/roles')
    .then(d => (d.value ?? []).map(r => ({ roleId: r.roleid, name: r.name })))
}

export function assignUserRole(userId: string, roleId: string): Promise<{ success: boolean }> {
  return postJson(`/dataverse/security/users/${userId}/roles`, { roleId })
}

export function removeUserRole(userId: string, roleId: string): Promise<{ success: boolean }> {
  return deleteJson(`/dataverse/security/users/${userId}/roles/${roleId}`)
}

// --- Record access ---

export interface RecordAccessRight {
  right: string
  granted: boolean
}

export interface RecordSearchResult {
  id: string
  name: string
}

export function checkRecordAccess(
  entitySetName: string,
  recordId: string,
  userId: string
): Promise<{ rights: RecordAccessRight[]; raw: string; source: 'function' | 'computed' }> {
  return postJson('/dataverse/recordaccess/check', { entitySetName, recordId, userId })
}

export function searchRecords(
  entitySetName: string,
  primaryIdField: string,
  primaryNameField: string,
  searchText: string
): Promise<RecordSearchResult[]> {
  return postJson<{ records: RecordSearchResult[] }>('/dataverse/recordaccess/record-search', {
    entitySetName,
    primaryIdField,
    primaryNameField,
    searchText,
  }).then(d => d.records)
}

export interface SharedPrincipal {
  principalId: string
  principalType: 'systemusers' | 'teams'
  name: string
  rights: string[]
}

export function fetchSharedPrincipals(
  entitySetName: string,
  recordId: string
): Promise<SharedPrincipal[]> {
  return postJson<{ principals: SharedPrincipal[] }>('/dataverse/recordaccess/shared', {
    entitySetName,
    recordId,
  }).then(d => d.principals)
}

export function shareRecord(params: {
  entitySetName: string
  recordId: string
  principalId: string
  principalType: 'systemusers' | 'teams'
  rights: string[]
  isExisting: boolean
}): Promise<{ success: boolean }> {
  return postJson('/dataverse/recordaccess/share', params)
}

export function revokeRecordAccess(params: {
  entitySetName: string
  recordId: string
  principalId: string
  principalType: 'systemusers' | 'teams'
}): Promise<{ success: boolean }> {
  return postJson('/dataverse/recordaccess/revoke', params)
}

// --- Role compare ---

export interface ComparedPrivilege {
  name: string
  privilegeId: string
  depthA: number
  depthB: number
  status: 'both' | 'onlyA' | 'onlyB' | 'depthDiff'
}

export interface RoleCompareResult {
  privileges: ComparedPrivilege[]
  summary: { onlyA: number; onlyB: number; depthDiff: number; same: number }
}

export function compareRoles(roleIdA: string, roleIdB: string): Promise<RoleCompareResult> {
  return getJson(`/dataverse/security/compare?roleIdA=${roleIdA}&roleIdB=${roleIdB}`)
}

export function addRolePrivileges(
  roleId: string,
  privileges: { privilegeId: string; depth: number }[]
): Promise<{ success: boolean; added: number }> {
  return postJson(`/dataverse/security/roles/${roleId}/add-privileges`, { privileges })
}

// --- Field security ---

export interface FieldSecurityProfile {
  fieldsecurityprofileid: string
  name: string
  description?: string
}

export interface FieldPermissionValue {
  value: number
  label: string
}

export interface FieldPermission {
  fieldPermissionId: string
  attributeLogicalName: string
  entityName: string
  canread: FieldPermissionValue
  canupdate: FieldPermissionValue
  cancreate: FieldPermissionValue
}

export interface ProfileMember {
  memberId: string
  memberType: 'user' | 'team'
  name: string
}

export interface SecuredField {
  logicalName: string
  attributeType: string
  displayName: string
}

export function fetchFieldSecurityProfiles(): Promise<FieldSecurityProfile[]> {
  return getJson<{ value?: FieldSecurityProfile[] }>('/dataverse/fieldsecurity/profiles')
    .then(d => d.value ?? [])
}

export function fetchProfilePermissions(profileId: string): Promise<FieldPermission[]> {
  return getJson<{ permissions: FieldPermission[] }>(
    `/dataverse/fieldsecurity/profiles/${profileId}/permissions`
  ).then(d => d.permissions)
}

export function fetchProfileMembers(profileId: string): Promise<ProfileMember[]> {
  return getJson<{ members: ProfileMember[] }>(
    `/dataverse/fieldsecurity/profiles/${profileId}/members`
  ).then(d => d.members)
}

export function assignProfileMember(
  profileId: string,
  memberId: string,
  memberType: 'user' | 'team'
): Promise<{ success: boolean }> {
  return postJson(`/dataverse/fieldsecurity/profiles/${profileId}/members`, { memberId, memberType })
}

export function removeProfileMember(
  profileId: string,
  memberType: 'user' | 'team',
  memberId: string
): Promise<{ success: boolean }> {
  return deleteJson(`/dataverse/fieldsecurity/profiles/${profileId}/members/${memberType}/${memberId}`)
}

export function fetchSecuredFields(entityName: string): Promise<SecuredField[]> {
  return getJson<{ fields: SecuredField[] }>(
    `/dataverse/fieldsecurity/secured-fields?entityName=${encodeURIComponent(entityName)}`
  ).then(d => d.fields)
}

// --- Business Unit Hierarchy ---

export interface BUItem {
  id: string
  name: string
  parentId: string | null
  createdon: string | null
}

export interface BUDetails {
  id: string
  name: string
  parentId: string | null
  parentName: string | null
  createdon: string | null
  users: { id: string; name: string; domain: string }[]
  teams: { id: string; name: string; teamType: number }[]
  roles: { id: string; name: string }[]
  stats: { userCount: number; teamCount: number; roleCount: number }
}

export function fetchBusinessUnitTree(): Promise<BUItem[]> {
  return getJson<{ units: BUItem[] }>('/dataverse/businessunit/tree').then(d => d.units)
}

export function fetchBusinessUnitDetails(buId: string): Promise<BUDetails> {
  return getJson<BUDetails>(`/dataverse/businessunit/${buId}/details`)
}

// --- Audit Log Viewer ---

export interface AuditAction {
  code: number
  name: string
}

export interface AuditLog {
  auditId: string
  action: number
  actionName: string
  createdon: string | null
  userId: string | null
  objectTypeCode: string | null
  objectId: string | null
  operation: number
  changeNumber: number
}

export function fetchAuditActions(): Promise<AuditAction[]> {
  return getJson<{ actions: AuditAction[] }>('/dataverse/audit/actions').then(d => d.actions)
}

export function fetchAuditLogs(params: {
  eventTypes?: number[]
  userId?: string
  startDate?: string
  endDate?: string
  entityName?: string
  top?: number
}): Promise<AuditLog[]> {
  const qs = new URLSearchParams()
  if (params.eventTypes?.length) qs.set('eventTypes', params.eventTypes.join(','))
  if (params.userId) qs.set('userId', params.userId)
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  if (params.entityName) qs.set('entityName', params.entityName)
  if (params.top) qs.set('top', String(params.top))
  const queryStr = qs.toString()
  return getJson<{ logs: AuditLog[]; total: number }>(
    `/dataverse/audit/logs${queryStr ? `?${queryStr}` : ''}`
  ).then(d => d.logs)
}

// --- Permission Diagnostic ---

export interface PermissionDiagnosis {
  user: {
    systemuserid: string
    fullname: string
    domainname: string
    isdisabled: boolean
    businessUnitName: string
  }
  directRoles: { roleId: string; name: string }[]
  teamRoles: { teamId: string; teamName: string; roles: { roleId: string; name: string }[] }[]
  effectivePrivileges: Record<string, number>
  sharingAccess: { granted: boolean; rights: string[] } | null
  fieldSecurity: { hasSecuredFields: boolean; fields: { logicalName: string; attributeType: string; displayName: string }[] } | null
  verdict: string
  verdictSources: string[]
}

export function diagnosePermission(
  userId: string,
  entityName: string,
  recordId?: string
): Promise<PermissionDiagnosis> {
  return postJson<PermissionDiagnosis>('/dataverse/permission/diagnose', { userId, entityName, recordId })
}

// --- Environment info (WhoAmI) ---

export interface EnvironmentInfo {
  userId: string | null
  user: { fullname?: string; domainname?: string; internalemailaddress?: string } | null
  organization: { name?: string } | null
  version: string | null
}

export function fetchEnvironmentInfo(): Promise<EnvironmentInfo> {
  return getJson('/dataverse/environment/info')
}

// --- Plugin project scaffolder (local filesystem, no connection required) ---

export interface ScaffoldPluginProjectRequest {
  namespacePrefix: string
  publisherPrefix: string
  targetDir: string
}

export interface ScaffoldProjectInfo {
  name: string
  path: string
  guid: string
}

export interface ScaffoldPluginProjectResponse {
  success: boolean
  rootDir: string
  solutionFile: string
  projects: ScaffoldProjectInfo[]
  files: string[]
}

export function scaffoldPluginProject(req: ScaffoldPluginProjectRequest): Promise<ScaffoldPluginProjectResponse> {
  return postJson<ScaffoldPluginProjectResponse>('/scaffold/plugin-project', req)
}
