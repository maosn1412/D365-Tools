import { useEffect, useMemo, useState } from 'react'
import { ConnectionGuard } from '@/components/connection/ConnectionGuard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-display'
import {
  IconGlobeCode, IconSearch, IconChevronDown, IconChevronRight, IconWifi,
  IconUploadCloud, IconCheck, IconSpinner, IconCopy, IconRefresh,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils'

// ---------- 类型与常量 ----------

interface WebResource {
  webresourceid: string
  name?: string
  displayname?: string
  webresourcetype?: number
  description?: string
  modifiedon?: string
  content?: string
}

const TYPE_NAMES: Record<number, string> = {
  1: 'HTML', 2: 'CSS', 3: 'JavaScript', 4: 'XML', 5: 'PNG', 6: 'JPG',
  7: 'GIF', 8: 'XAP', 9: 'XSL', 10: 'ICO', 11: 'SVG', 12: 'RESX',
}

const CODE_TYPES = new Set([1, 2, 3, 4, 9, 12])

const IMAGE_MIME: Record<number, string> = {
  5: 'image/png', 6: 'image/jpeg', 7: 'image/gif', 10: 'image/x-icon', 11: 'image/svg+xml',
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All types' },
  ...Object.entries(TYPE_NAMES).map(([value, label]) => ({ value, label })),
]

function typeName(type?: number): string {
  return type !== undefined ? (TYPE_NAMES[type] ?? `Type ${type}`) : '-'
}

function formatDate(iso?: string): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString()
}

/** base64 → UTF-8 文本 */
function decodeContent(base64: string): string {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return '(unable to decode content)'
  }
}

// ---------- 详情面板 ----------

function DetailPanel({ resource }: { resource: WebResource }) {
  const [detail, setDetail] = useState<WebResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/dataverse/webresources/${resource.webresourceid}`)
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch web resource')
        }
        return res.json()
      })
      .then((data: WebResource) => { if (!cancelled) setDetail(data) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [resource.webresourceid])

  const publish = () => {
    setPublishing(true)
    setPublishError(null)
    fetch(`/api/dataverse/webresources/${resource.webresourceid}/publish`, { method: 'POST' })
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Publish failed')
        }
        setPublished(true)
        setTimeout(() => setPublished(false), 2000)
      })
      .catch(e => setPublishError(e instanceof Error ? e.message : 'Publish failed'))
      .finally(() => setPublishing(false))
  }

  if (loading) return <LoadingState text="Loading content..." />
  if (error) return <ErrorState message={error} />
  if (!detail) return null

  const type = detail.webresourcetype
  const isCode = type !== undefined && CODE_TYPES.has(type)
  const imageMime = type !== undefined ? IMAGE_MIME[type] : undefined
  const textContent = isCode && detail.content ? decodeContent(detail.content) : null

  const copyContent = () => {
    if (!textContent) return
    navigator.clipboard.writeText(textContent).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{typeName(type)}</Badge>
        {detail.description && (
          <span className="text-xs text-muted-foreground truncate">{detail.description}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {textContent !== null && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={copyContent}>
              {copied ? (
                <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <IconCopy className="h-3.5 w-3.5" />
              )}
              Copy
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={publish} disabled={publishing}>
            {publishing ? (
              <IconSpinner className="h-3.5 w-3.5 animate-spin" />
            ) : published ? (
              <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <IconUploadCloud className="h-3.5 w-3.5" />
            )}
            {published ? 'Published' : 'Publish'}
          </Button>
        </div>
      </div>

      {publishError && <ErrorState message={publishError} />}

      {textContent !== null ? (
        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-all">
          {textContent}
        </pre>
      ) : imageMime && detail.content ? (
        <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-6">
          <img
            src={`data:${imageMime};base64,${detail.content}`}
            alt={detail.displayname || detail.name || 'web resource'}
            className="max-h-64 max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No preview available for this resource type.</p>
      )}
    </div>
  )
}

// ---------- 页面内容 ----------

function WebResourceManagerContent() {
  const [resources, setResources] = useState<WebResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetch('/api/dataverse/webresources')
      .then(async res => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Failed to fetch web resources')
        }
        return res.json()
      })
      .then((data: { value: WebResource[] }) => setResources(data.value || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return resources.filter(r => {
      if (typeFilter && String(r.webresourcetype) !== typeFilter) return false
      if (!q) return true
      return (
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.displayname ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [resources, search, typeFilter])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconGlobeCode className="h-5 w-5" />}
        title="Web Resource Manager"
        description="Browse, preview, and publish web resources in your environment."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
              <IconRefresh className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Badge variant="success" className="gap-1"><IconWifi className="h-3 w-3" /> Connected</Badge>
          </div>
        }
      />

      {/* 工具栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 max-w-sm">
              <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, display name, or description..."
                className="pl-8 h-9"
              />
            </div>
            <div className="w-44 min-w-0">
              <SearchSelect
                value={typeFilter}
                onChange={setTypeFilter}
                options={TYPE_FILTER_OPTIONS}
                placeholder="All types"
                triggerClassName="min-w-0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<IconGlobeCode className="h-6 w-6" />}
              title="No web resources"
              description={resources.length === 0
                ? 'This environment has no web resources.'
                : 'No web resources match your filters.'}
            />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Display Name</th>
                      <th className="w-28 px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                      <th className="w-28 px-3 py-2 text-left font-medium text-muted-foreground">Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const isOpen = expandedId === r.webresourceid
                      return (
                        <FragmentRow
                          key={r.webresourceid}
                          resource={r}
                          index={i}
                          isOpen={isOpen}
                          onToggle={() => setExpandedId(isOpen ? null : r.webresourceid)}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {filtered.length} of {resources.length} web resources
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FragmentRow({
  resource, index, isOpen, onToggle,
}: {
  resource: WebResource
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'border-t cursor-pointer transition-colors hover:bg-muted/40',
          index % 2 === 1 && 'bg-muted/30',
          isOpen && 'bg-primary/5'
        )}
      >
        <td className="px-3 py-2 text-muted-foreground">
          {isOpen ? (
            <IconChevronDown className="h-4 w-4" />
          ) : (
            <IconChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-3 py-2 font-mono text-xs max-w-0 truncate" title={resource.name}>
          {resource.name}
        </td>
        <td className="px-3 py-2 max-w-0 truncate" title={resource.displayname}>
          {resource.displayname || '-'}
        </td>
        <td className="px-3 py-2">
          <Badge variant="outline" className="text-[10px]">{typeName(resource.webresourcetype)}</Badge>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(resource.modifiedon)}</td>
      </tr>
      {isOpen && (
        <tr className="border-t bg-muted/20">
          <td colSpan={5} className="px-6 py-4">
            <DetailPanel resource={resource} />
          </td>
        </tr>
      )}
    </>
  )
}

export function WebResourceManager() {
  return (
    <ConnectionGuard>
      <WebResourceManagerContent />
    </ConnectionGuard>
  )
}
