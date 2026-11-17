import type { Request, Response, NextFunction } from 'express'
import { DataverseService } from '../services/dataverseService.js'

export function requireConnection(req: Request, res: Response, next: NextFunction) {
  const dataverse = DataverseService.getInstance()
  if (!dataverse.isConnected()) {
    res.status(401).json({ error: 'Not connected to Dataverse environment. Please connect first.' })
    return
  }
  next()
}
