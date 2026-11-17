import { useEffect, useMemo, useState } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'
import {
  fetchMetadataEntities,
  fetchEntityAttributes,
  type EntityMetadataItem,
  type AttributeMetadataItem,
} from '@/services/api'
import type { SearchSelectOption } from '@/components/ui/search-select'

/** 实体元数据 → 下拉选项（value = LogicalName，label 附带显示名） */
export function toEntityOptions(list: EntityMetadataItem[]): SearchSelectOption[] {
  return list.map(e => {
    const display = e.DisplayName?.UserLocalizedLabel?.Label
    return {
      value: e.LogicalName,
      label: display && display !== e.LogicalName ? `${e.LogicalName} (${display})` : e.LogicalName,
    }
  })
}

/** 字段元数据 → 下拉选项（value = LogicalName，label 附带显示名） */
export function toAttributeOptions(list: AttributeMetadataItem[]): SearchSelectOption[] {
  return list.map(a => {
    const display = a.DisplayName?.UserLocalizedLabel?.Label
    return {
      value: a.LogicalName,
      label: display && display !== a.LogicalName ? `${a.LogicalName} (${display})` : a.LogicalName,
    }
  })
}

/**
 * 连接感知的实体列表 hook：连接后自动加载环境实体，断开后清空。
 * 供各工具的"实体选择下拉框"使用。
 */
export function useMetadataEntities() {
  const connected = useConnectionStore(s => s.connected)
  const [entities, setEntities] = useState<EntityMetadataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) {
      setEntities([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMetadataEntities()
      .then(list => { if (!cancelled) setEntities(list) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load entities') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [connected])

  const options = useMemo(() => toEntityOptions(entities), [entities])

  return { connected, entities, options, loading, error }
}

/**
 * 连接感知的字段列表 hook：实体变化时自动加载该实体字段。
 * entityName 为空或未连接时返回空列表。
 */
export function useEntityAttributes(entityName: string) {
  const connected = useConnectionStore(s => s.connected)
  const [attributes, setAttributes] = useState<AttributeMetadataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected || !entityName.trim()) {
      setAttributes([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchEntityAttributes(entityName.trim())
      .then(list => { if (!cancelled) setAttributes(list) })
      .catch(e => {
        if (!cancelled) {
          setAttributes([])
          setError(e instanceof Error ? e.message : 'Failed to load attributes')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [connected, entityName])

  const options = useMemo(() => toAttributeOptions(attributes), [attributes])

  return { connected, attributes, options, loading, error }
}
