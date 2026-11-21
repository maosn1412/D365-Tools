import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const optionsetRouter: Router = Router()
optionsetRouter.use(requireConnection)

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** Dataverse 对不存在的实体返回 404；用于区分未知实体与已知实体的上游失败 */
function isEntityMissingError(error: unknown): boolean {
  const message = errorMessage(error, '').toLowerCase()
  return message.includes('does not exist') || message.includes('not found') || message.includes('404')
}

/** 上游网络/网关错误不能被当作“可选 cast 不支持”而返回部分数据 */
function isTransientUpstreamError(error: unknown): boolean {
  const message = errorMessage(error, '').toLowerCase()
  return [
    'network',
    'timeout',
    'econn',
    'socket',
    'upstream connect failed',
    'fetch failed',
    'aborted',
    '502',
    '503',
    '504',
  ].some(signature => message.includes(signature))
}

// List all global option sets (metadata only, options loaded on demand)
// Note: metadata endpoints may not support $top/$orderby on some clouds; sort server-side
optionsetRouter.get('/global', async (_req: Request, res: Response) => {
  try {
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.getWithQuery('/GlobalOptionSetDefinitions', {
      '$select': 'Name,MetadataId,DisplayName,IsCustomOptionSet',
    })
    const items = ((result as { value: unknown[] }).value || []) as Record<string, unknown>[]
    items.sort((a, b) => String(a.Name).localeCompare(String(b.Name)))
    res.json({ value: items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch global option sets'
    console.error('Global option sets error:', message)
    res.status(500).json({ error: message })
  }
})

// Get a single global option set with all its options
optionsetRouter.get('/global/:metadataId', async (req: Request, res: Response) => {
  try {
    const { metadataId } = req.params
    const dataverse = DataverseService.getInstance()
    const result = await dataverse.get(`/GlobalOptionSetDefinitions(${metadataId})`)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch option set detail'
    res.status(500).json({ error: message })
  }
})

// Get picklist / multi-select fields of an entity with their options
optionsetRouter.get('/entity/:entityName', async (req: Request, res: Response) => {
  try {
    const { entityName } = req.params
    const dataverse = DataverseService.getInstance()

    const entityExists = async (): Promise<boolean> => {
      try {
        await dataverse.getWithQuery(`/EntityDefinitions(LogicalName='${entityName}')`, {
          '$select': 'LogicalName',
        })
        return true
      } catch (error) {
        if (isEntityMissingError(error)) return false
        throw error
      }
    }

    const fetchPicklists = async (cast: string) => {
      try {
        const result = await dataverse.getWithQuery(
          `/EntityDefinitions(LogicalName='${entityName}')/Attributes/Microsoft.Dynamics.CRM.${cast}`,
          { '$select': 'LogicalName,DisplayName', '$expand': 'OptionSet,GlobalOptionSet' }
        )
        return {
          value: ((result as { value: unknown[] }).value || []) as Record<string, unknown>[],
          error: null,
        }
      } catch (error) {
        return { value: [] as Record<string, unknown>[], error }
      }
    }

    const [picklistResult, multiSelectResult] = await Promise.all([
      fetchPicklists('PicklistAttributeMetadata'),
      fetchPicklists('MultiSelectPicklistAttributeMetadata'),
    ])

    // 单路 cast 失败可容忍（部分环境不支持 MultiSelect cast）；但网络/5xx 失败不能
    // 降级成“部分字段”，否则 UI 会把不完整结果当成完整元数据。
    if (picklistResult.error || multiSelectResult.error) {
      if (await entityExists()) {
        const upstreamError = [picklistResult.error, multiSelectResult.error]
          .find(error => error && isTransientUpstreamError(error))
        const bothFailed = picklistResult.error && multiSelectResult.error
        if (upstreamError || bothFailed) {
          const detail = [picklistResult.error, multiSelectResult.error]
            .filter((error): error is unknown => Boolean(error))
            .map(error => errorMessage(error, 'Option set query failed'))
            .join(' | ')
          console.error(`Entity option sets error for '${entityName}':`, detail)
          res.status(500).json({
            error: `Failed to fetch option set fields for '${entityName}': ${detail}`,
          })
          return
        }
      }
    }

    interface OptionSetFieldRow extends Record<string, unknown> {
      LogicalName: string
      MultiSelect: boolean
    }
    const fields: OptionSetFieldRow[] = [
      ...picklistResult.value.map(f => ({ ...f, LogicalName: String(f.LogicalName ?? ''), MultiSelect: false })),
      ...multiSelectResult.value.map(f => ({ ...f, LogicalName: String(f.LogicalName ?? ''), MultiSelect: true })),
    ]
    fields.sort((a, b) => a.LogicalName.localeCompare(b.LogicalName))

    // 已有实体的选项集字段不应为空；空结果意味着上游元数据异常，提示用户重试，
    // 而不是把 200 空数组当成合法的“无字段”。
    if (fields.length === 0 && await entityExists()) {
      const message = `No option set fields returned for entity '${entityName}'. Please retry.`
      console.error(`Entity option sets empty for '${entityName}'`)
      res.status(503).json({ error: message, retryable: true })
      return
    }

    res.json({ value: fields })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch entity option sets'
    console.error('Entity option sets error:', message)
    res.status(500).json({ error: message })
  }
})
