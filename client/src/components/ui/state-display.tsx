import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IconSpinner, IconSearch } from '@/components/ui/icons'

interface LoadingStateProps {
  /** 加载提示文字 */
  text?: string
  className?: string
}

/** 统一加载态：spinner + 文字描述 */
export function LoadingState({ text = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground', className)}>
      <IconSpinner className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

interface EmptyStateProps {
  /** 前置图标（可选，默认放大镜） */
  icon?: ReactNode
  title: string
  description?: string
  /** 底部操作（如"连接环境"按钮） */
  action?: ReactNode
  className?: string
}

/** 统一空状态：图标 + 标题 + 提示文案居中 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <IconSearch className="h-6 w-6" />}
      </div>
      <p className="text-sm font-medium text-foreground mt-1">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  message: string
  className?: string
}

/** 统一错误提示条 */
export function ErrorState({ message, className }: ErrorStateProps) {
  return (
    <div className={cn('rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive', className)}>
      {message}
    </div>
  )
}
