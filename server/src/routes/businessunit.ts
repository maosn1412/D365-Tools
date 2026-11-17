import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const businessunitRouter: Router = Router()
businessunitRouter.use(requireConnection)

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// GET /tree - Return all business units with parent references for tree building
businessunitRouter.get('/tree', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery('/businessunits', {
      $select: 'businessunitid,name,_parentbusinessunitid_value,createdon',
      $orderby: 'name',
    }) as { value?: Record<string, unknown>[] }

    const units = (result.value ?? []).map(u => ({
      id: String(u.businessunitid ?? ''),
      name: String(u.name ?? ''),
      parentId: u._parentbusinessunitid_value ? String(u._parentbusinessunitid_value) : null,
      createdon: u.createdon ? String(u.createdon) : null,
    }))

    res.json({ units })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch business units'
    console.error('BU tree error:', message)
    res.status(500).json({ error: message })
  }
})

// GET /:id/details - Return BU details with user/team/role counts
businessunitRouter.get('/:id/details', async (req: Request, res: Response) => {
  try {
    const buId = req.params.id
    if (!GUID_RE.test(buId)) {
      res.status(400).json({ error: 'Invalid business unit id' })
      return
    }

    const dataverse = DataverseService.getInstance()

    // BU info
    const bu = await dataverse.get(
      `/businessunits(${buId})?$select=businessunitid,name,_parentbusinessunitid_value,createdon&$expand=parentbusinessunitid($select=name)`
    ) as Record<string, unknown>

    // User count in this BU
    const usersResult = await dataverse.getWithQuery('/systemusers', {
      $select: 'systemuserid,fullname,domainname',
      $filter: `_businessunitid_value eq ${buId}`,
      $orderby: 'fullname',
      $top: '200',
    }) as { value?: Record<string, unknown>[] }

    const users = (usersResult.value ?? []).map(u => ({
      id: String(u.systemuserid ?? ''),
      name: String(u.fullname ?? ''),
      domain: String(u.domainname ?? ''),
    }))

    // Team count in this BU
    const teamsResult = await dataverse.getWithQuery('/teams', {
      $select: 'teamid,name,teamtype',
      $filter: `_businessunitid_value eq ${buId}`,
      $orderby: 'name',
      $top: '200',
    }) as { value?: Record<string, unknown>[] }

    const teams = (teamsResult.value ?? []).map(t => ({
      id: String(t.teamid ?? ''),
      name: String(t.name ?? ''),
      teamType: typeof t.teamtype === 'number' ? t.teamtype : Number(t.teamtype) || 0,
    }))

    // Role assignments in this BU (roles assigned to users in this BU)
    const roleAssignResult = await dataverse.getWithQuery('/roles', {
      $select: 'roleid,name',
      $filter: `_businessunitid_value eq ${buId}`,
      $orderby: 'name',
      $top: '200',
    }) as { value?: Record<string, unknown>[] }

    const roles = (roleAssignResult.value ?? []).map(r => ({
      id: String(r.roleid ?? ''),
      name: String(r.name ?? ''),
    }))

    const parentBu = bu.parentbusinessunitid as Record<string, unknown> | undefined

    res.json({
      id: String(bu.businessunitid ?? buId),
      name: String(bu.name ?? ''),
      parentId: bu._parentbusinessunitid_value ? String(bu._parentbusinessunitid_value) : null,
      parentName: parentBu?.name ? String(parentBu.name) : null,
      createdon: bu.createdon ? String(bu.createdon) : null,
      users,
      teams,
      roles,
      stats: {
        userCount: users.length,
        teamCount: teams.length,
        roleCount: roles.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch BU details'
    console.error('BU details error:', message)
    res.status(500).json({ error: message })
  }
})
