import { useEffect, useMemo, useRef, useState } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'
import { useMetadataRefreshStore } from '@/stores/metadataRefreshStore'
import {
  loadEntityAttributeMetadata,
  loadEntityMetadata,
  readCachedAttributes,
  readCachedEntities,
} from '@/lib/metadataCache'
import type { EntityMetadataItem, AttributeMetadataItem } from '@/services/api'
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
 * 连接感知的实体列表 hook：连接后加载环境实体，断开后清空。
 * 走前端元数据缓存——同一环境 TTL 内切换模块不再重复请求；
 * 全局"刷新元数据"通过 epoch 变化触发重新拉取。
 */
export function useMetadataEntities() {
  const connected = useConnectionStore(s => s.connected)
  const environmentUrl = useConnectionStore(s => s.environmentUrl)
  const epoch = useMetadataRefreshStore(s => s.epoch)
  // 先用缓存渲染，避免切换模块时列表空白/闪烁
  const [entities, setEntities] = useState<EntityMetadataItem[]>(() => readCachedEntities()?.value ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const epochRef = useRef(epoch)

  useEffect(() => {
    if (!connected) {
      setEntities([])
      setError(null)
      setLoading(false)
      epochRef.current = epoch
      return
    }

    // epoch 变化（手动刷新）时缓存已被清空，这里直接当作未命中处理
    const refreshed = epochRef.current !== epoch
    epochRef.current = epoch
    const cached = refreshed ? null : readCachedEntities()
    if (cached) {
      setEntities(cached.value)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    let cancelled = false
    loadEntityMetadata()
      .then(list => { if (!cancelled) setEntities(list) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load entities') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [connected, environmentUrl, epoch])

  const options = useMemo(() => toEntityOptions(entities), [entities])

  return { connected, entities, options, loading, error }
}

/**
 * 连接感知的字段列表 hook：实体变化时加载该实体字段（同样走前端缓存）。
 * entityName 为空或未连接时返回空列表。
 */
export function useEntityAttributes(entityName: string) {
  const connected = useConnectionStore(s => s.connected)
  const environmentUrl = useConnectionStore(s => s.environmentUrl)
  const epoch = useMetadataRefreshStore(s => s.epoch)
  const [attributes, setAttributes] = useState<AttributeMetadataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const epochRef = useRef(epoch)

  useEffect(() => {
    if (!connected || !entityName.trim()) {
      setAttributes([])
      setError(null)
      setLoading(false)
      epochRef.current = epoch
      return
    }

    const refreshed = epochRef.current !== epoch
    epochRef.current = epoch
    const cached = refreshed ? null : readCachedAttributes(entityName)
    if (cached) {
      setAttributes(cached.value)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    let cancelled = false
    loadEntityAttributeMetadata(entityName)
      .then(list => { if (!cancelled) setAttributes(list) })
      .catch(e => {
        if (!cancelled) {
          setAttributes([])
          setError(e instanceof Error ? e.message : 'Failed to load attributes')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [connected, environmentUrl, entityName, epoch])

  const options = useMemo(() => toAttributeOptions(attributes), [attributes])

  return { connected, attributes, options, loading, error }
}
