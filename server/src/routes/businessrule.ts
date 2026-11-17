import { Router } from 'express'
import type { Request, Response } from 'express'
import { DataverseService } from '../services/dataverseService.js'
import { requireConnection } from '../middleware/auth.js'

export const businessruleRouter: Router = Router()
businessruleRouter.use(requireConnection)

// List business rules for an entity.
// Business rules are stored in the workflow entity: category 2 = Business Rule, type 1 = Definition.
businessruleRouter.get('/', async (req: Request, res: Response) => {
  try {
    const entityName = String(req.query.entityName || '').trim()
    const dataverse = DataverseService.getInstance()
    const filter = entityName
      ? `category eq 2 and type eq 1 and primaryentity eq '${entityName.replace(/'/g, "''")}'`
      : 'category eq 2 and type eq 1'
    const result = await dataverse.getWithQuery('/workflows', {
      '$select': 'workflowid,name,description,modifiedon,statecode,statuscode,primaryentity',
      '$filter': filter,
      '$orderby': 'name',
      '$top': '200',
    })
    res.json({ value: ((result as { value?: unknown[] }).value || []) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch business rules'
    console.error('Business rules error:', message)
    res.status(500).json({ error: message })
  }
})

// ---------- clientdata best-effort parsing ----------

interface ExtractedCondition {
  entity: string | null
  field: string | null
  operator: string | null
  value: string | null
}

interface ExtractedAction {
  type: string | null
  field: string | null
  value: string | null
}

const ATTR_KEYS = ['attributename', 'attribute', 'attributelogicalname', 'fieldname', 'field', 'sourcefield', 'targetfield']
const OP_KEYS = ['operator', 'comparisonoperator', 'conditionoperator']
const ACTION_TYPE_KEYS = ['actiontype', 'actionname', 'ruleactiontype']
const VALUE_KEYS = ['value', 'comparisonvalue', 'newvalue', 'valuetoset']
const MESSAGE_KEYS = ['message', 'messagetext', 'errormessage', 'recommendationtext']
const ACTION_TYPE_PATTERN = /set|show|hide|lock|unlock|visibility|required|error|recommendation|default|clear/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function lowerKeyMap(obj: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const [key, value] of Object.entries(obj)) {
    map.set(key.toLowerCase(), value)
  }
  return map
}

function firstString(map: Map<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = map.get(key)
    if (typeof value === 'string' && value) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function extractRuleParts(root: unknown): { conditions: ExtractedCondition[]; actions: ExtractedAction[] } {
  const conditions: ExtractedCondition[] = []
  const actions: ExtractedAction[] = []
  const MAX_ITEMS = 100
  let visited = 0
  const MAX_VISITED = 5000

  const visit = (node: unknown, depth: number) => {
    if (visited++ > MAX_VISITED || depth > 24) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }
    if (!isRecord(node)) return

    const map = lowerKeyMap(node)
    const attr = firstString(map, ATTR_KEYS)
    const op = firstString(map, OP_KEYS)
    const actionType = firstString(map, ACTION_TYPE_KEYS)

    if (conditions.length < MAX_ITEMS && attr && op) {
      conditions.push({
        entity: firstString(map, ['entityname', 'entity', 'entitylogicalname']),
        field: attr,
        operator: op,
        value: firstString(map, VALUE_KEYS) ?? stringifyValue(map.get('value')),
      })
    } else if (
      actions.length < MAX_ITEMS &&
      actionType &&
      ACTION_TYPE_PATTERN.test(actionType) &&
      (attr || firstString(map, MESSAGE_KEYS) || map.has('value'))
    ) {
      actions.push({
        type: actionType,
        field: attr,
        value:
          firstString(map, VALUE_KEYS) ??
          firstString(map, MESSAGE_KEYS) ??
          stringifyValue(map.get('value')),
      })
    }

    for (const value of Object.values(node)) {
      if (isRecord(value) || Array.isArray(value)) visit(value, depth + 1)
    }
  }

  visit(root, 0)
  return { conditions, actions }
}

// Get a business rule's parsed definition (conditions / actions) from its clientdata JSON.
businessruleRouter.get('/:workflowId/details', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params
    const dataverse = DataverseService.getInstance()
    const workflow = (await dataverse.getWithQuery(`/workflows(${workflowId})`, {
      '$select': 'workflowid,name,clientdata',
    })) as { clientdata?: string }

    let parsed: unknown = null
    if (workflow.clientdata) {
      try {
        parsed = JSON.parse(workflow.clientdata)
      } catch {
        parsed = null
      }
    }

    const { conditions, actions } = parsed ? extractRuleParts(parsed) : { conditions: [], actions: [] }
    res.json({ conditions, actions, raw: parsed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch business rule details'
    console.error('Business rule details error:', message)
    res.status(500).json({ error: message })
  }
})
