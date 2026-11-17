import { Router } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import type { Request, Response } from 'express'

interface ConnectRequest {
  authType: 'clientSecret' | 'usernamePassword'
  environmentUrl: string
  tenantId?: string
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
}

// In-memory session store
let currentSession: { connected: boolean; environmentUrl: string } | null = null

export const connectionRouter: Router = Router()

connectionRouter.post('/connect', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectRequest

    if (!body.environmentUrl || !body.authType) {
      res.status(400).json({ error: 'Missing required fields: environmentUrl, authType' })
      return
    }

    const dataverse = DataverseService.getInstance()

    if (body.authType === 'clientSecret') {
      if (!body.tenantId || !body.clientId || !body.clientSecret) {
        res.status(400).json({ error: 'Client Secret auth requires tenantId, clientId, clientSecret' })
        return
      }
      await dataverse.connectWithClientSecret(
        body.tenantId,
        body.clientId,
        body.clientSecret,
        body.environmentUrl
      )
    } else if (body.authType === 'usernamePassword') {
      if (!body.tenantId || !body.clientId || !body.username || !body.password) {
        res.status(400).json({ error: 'Username/Password auth requires tenantId, clientId, username, password' })
        return
      }
      await dataverse.connectWithUsernamePassword(
        body.tenantId,
        body.clientId,
        body.username,
        body.password,
        body.environmentUrl
      )
    } else {
      res.status(400).json({ error: 'Invalid authType' })
      return
    }

    currentSession = { connected: true, environmentUrl: body.environmentUrl }
    res.json({ success: true, environmentUrl: body.environmentUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    res.status(500).json({ error: message })
  }
})

connectionRouter.get('/status', (_req: Request, res: Response) => {
  if (currentSession?.connected) {
    res.json({ connected: true, environmentUrl: currentSession.environmentUrl })
  } else {
    res.json({ connected: false })
  }
})

connectionRouter.post('/disconnect', (_req: Request, res: Response) => {
  const dataverse = DataverseService.getInstance()
  dataverse.disconnect()
  currentSession = null
  res.json({ success: true })
})
