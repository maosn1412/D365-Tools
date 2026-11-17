import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** 页面前置图标（可选） */
  icon?: ReactNode
  title: string
  description?: string
  /** 右侧操作区（按钮、徽标等） */
  actions?: ReactNode
  className?: string
}

/**
 * 统一页头组件：渐变标题 + 描述 + 右侧操作区 + 底部细分割线。
 * 所有工具页面接入，保持排版一致。
 */
export function PageHeader({ icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('border-b pb-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
