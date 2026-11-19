import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconSpinner, IconSearch } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchSelectOption {
  value: string
  label: string
}

interface BaseProps {
  options: SearchSelectOption[]
  placeholder?: string
  panelPlaceholder?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  triggerClassName?: string
  emptyText?: string
}

function useSearchableDropdown() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  return { open, setOpen, search, setSearch, containerRef }
}

function useFilteredOptions(options: SearchSelectOption[], search: string) {
  return useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      o => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
    )
  }, [options, search])
}

interface PanelProps {
  loading?: boolean
  filtered: SearchSelectOption[]
  emptyText: string
  search: string
  setSearch: (value: string) => void
  panelPlaceholder: string
  setOpen: (open: boolean) => void
  renderItem: (option: SearchSelectOption) => React.ReactNode
}

function DropdownPanel({
  loading,
  filtered,
  emptyText,
  search,
  setSearch,
  panelPlaceholder,
  setOpen,
  renderItem,
}: PanelProps) {
  return (
    <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md">
      <div className="border-b p-2">
        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            className="h-7 pl-7 text-sm"
            placeholder={panelPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
            }}
          />
        </div>
      </div>
      <div className="max-h-[240px] overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <IconSpinner className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          filtered.map(renderItem)
        )}
      </div>
    </div>
  )
}

interface SearchSelectProps extends BaseProps {
  value: string
  onChange: (value: string) => void
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  panelPlaceholder = 'Search...',
  disabled,
  loading,
  className,
  triggerClassName,
  emptyText = 'No matches',
}: SearchSelectProps) {
  const { open, setOpen, search, setSearch, containerRef } = useSearchableDropdown()
  const filtered = useFilteredOptions(options, search)
  const selected = options.find(o => o.value === value)

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName
        )}
      >
        <span className={cn('min-w-0 truncate text-left', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : value || placeholder}
        </span>
        <IconChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <DropdownPanel
          loading={loading}
          filtered={filtered}
          emptyText={emptyText}
          search={search}
          setSearch={setSearch}
          panelPlaceholder={panelPlaceholder}
          setOpen={setOpen}
          renderItem={(o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                o.value === value && 'bg-accent text-accent-foreground'
              )}
            >
              <span className="truncate">{o.label}</span>
            </button>
          )}
        />
      )}
    </div>
  )
}

interface MultiSearchSelectProps extends BaseProps {
  values: string[]
  onChange: (values: string[]) => void
}

export function MultiSearchSelect({
  values,
  onChange,
  options,
  placeholder = 'Select...',
  panelPlaceholder = 'Search...',
  disabled,
  loading,
  className,
  triggerClassName,
  emptyText = 'No matches',
}: MultiSearchSelectProps) {
  const { open, setOpen, search, setSearch, containerRef } = useSearchableDropdown()
  const filtered = useFilteredOptions(options, search)

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter(v => v !== value) : [...values, value])
  }

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName
        )}
      >
        <span className={cn('min-w-0 truncate text-left', values.length === 0 && 'text-muted-foreground')}>
          {values.length > 0 ? values.join(', ') : placeholder}
        </span>
        <IconChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <DropdownPanel
          loading={loading}
          filtered={filtered}
          emptyText={emptyText}
          search={search}
          setSearch={setSearch}
          panelPlaceholder={panelPlaceholder}
          setOpen={setOpen}
          renderItem={(o) => {
            const checked = values.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-input',
                    checked && 'border-primary bg-primary text-primary-foreground'
                  )}
                >
                  {checked && <IconCheck className="h-2.5 w-2.5" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            )
          }}
        />
      )}
    </div>
  )
}

interface AsyncSearchSelectProps {
  /** 当前选中值（id） */
  value: string
  /** 选中值的显示文本（选项列表可能已变化，由调用方保存） */
  label?: string
  onSelect: (value: string, label: string) => void
  /** 服务端搜索：输入关键字返回选项列表 */
  fetchOptions: (query: string) => Promise<SearchSelectOption[]>
  placeholder?: string
  panelPlaceholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  emptyText?: string
}

/**
 * 服务端搜索下拉框：面板输入防抖 300ms 后调用 fetchOptions 拉取选项，
 * 适用于用户/团队/记录等无法一次性加载全量选项的场景。
 */
export function AsyncSearchSelect({
  value,
  label,
  onSelect,
  fetchOptions,
  placeholder = 'Select...',
  panelPlaceholder = 'Type to search...',
  disabled,
  className,
  triggerClassName,
  emptyText = 'No matches',
}: AsyncSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<SearchSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const fetchRef = useRef(fetchOptions)
  fetchRef.current = fetchOptions

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      fetchRef.current(search.trim())
        .then(list => { if (!cancelled) setOptions(list) })
        .catch(e => {
          if (!cancelled) {
            setOptions([])
            setError(e instanceof Error ? e.message : 'Search failed')
          }
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, search, retryKey])

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName
        )}
      >
        <span className={cn('min-w-0 truncate text-left', !value && 'text-muted-foreground')}>
          {value ? label || value : placeholder}
        </span>
        <IconChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-2">
            <div className="relative">
              <IconSearch className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="h-7 pl-7 text-sm"
                placeholder={panelPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false)
                }}
              />
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <IconSpinner className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="space-y-2 px-3 py-4 text-center text-xs" role="alert">
                <p className="text-destructive">{error}</p>
                <button
                  type="button"
                  className="rounded-md border border-input px-2 py-1 font-medium hover:bg-accent"
                  onClick={() => setRetryKey(key => key + 1)}
                >
                  Retry
                </button>
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
            ) : (
              options.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onSelect(o.value, o.label)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                    o.value === value && 'bg-accent text-accent-foreground'
                  )}
                >
                  <span className="truncate">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
