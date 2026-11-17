import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { IconScaffold, IconCheck } from '@/components/ui/icons'
import { scaffoldPluginProject, type ScaffoldPluginProjectResponse } from '@/services/api'

const NAMESPACE_RE = /^[A-Za-z][A-Za-z0-9]{0,19}$/
const PUBLISHER_RE = /^[a-z][a-z0-9_]{0,7}$/

export function PluginProjectScaffolder() {
  const [namespacePrefix, setNamespacePrefix] = useState('ABC')
  const [publisherPrefix, setPublisherPrefix] = useState('abc')
  const [targetDir, setTargetDir] = useState('D:\\Code\\个人项目\\初始化项目测试')
  const [errors, setErrors] = useState<{ namespacePrefix?: string; publisherPrefix?: string; targetDir?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ScaffoldPluginProjectResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!NAMESPACE_RE.test(namespacePrefix.trim())) {
      next.namespacePrefix = '需以字母开头，仅含字母和数字，最长 20 位（如 ABC）'
    }
    const pub = publisherPrefix.trim()
    if (!PUBLISHER_RE.test(pub) || pub.endsWith('_')) {
      next.publisherPrefix = '需以小写字母开头，仅含小写字母/数字/下划线，最长 8 位，且不能以下划线结尾（如 abc）'
    } else if (['msdyn', 'microsoft', 'mscrm'].includes(pub)) {
      next.publisherPrefix = `${pub} 是保留前缀，请换一个`
    }
    if (!targetDir.trim()) {
      next.targetDir = '目标目录不能为空'
    } else if (!/^[A-Za-z]:[\\/]/.test(targetDir.trim())) {
      next.targetDir = '必须是绝对路径（如 D:\\projects）'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    setResult(null)
    setSubmitError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await scaffoldPluginProject({
        namespacePrefix: namespacePrefix.trim(),
        publisherPrefix: publisherPrefix.trim(),
        targetDir: targetDir.trim(),
      })
      setResult(res)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '生成失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        icon={<IconScaffold className="h-5 w-5" />}
        title="Plugin Project Scaffolder"
        description="初始化 D365 CRM 插件解决方案框架：共享框架项目 + 示例插件项目 + 单元测试项目（本地生成，无需连接环境）"
      />

      <Card>
        <CardHeader>
          <CardTitle>项目配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="namespacePrefix">项目命名空间前缀</Label>
            <Input
              id="namespacePrefix"
              value={namespacePrefix}
              onChange={e => setNamespacePrefix(e.target.value)}
              placeholder="例如 ABC → ABC.Plugins.Sample / ABC.CRM.D365.sln"
            />
            {errors.namespacePrefix && <p className="text-sm text-destructive">{errors.namespacePrefix}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="publisherPrefix">发布者前缀</Label>
            <Input
              id="publisherPrefix"
              value={publisherPrefix}
              onChange={e => setPublisherPrefix(e.target.value)}
              placeholder="例如 abc → 示例实体 abc_sample"
            />
            {errors.publisherPrefix && <p className="text-sm text-destructive">{errors.publisherPrefix}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetDir">目标目录</Label>
            <Input
              id="targetDir"
              value={targetDir}
              onChange={e => setTargetDir(e.target.value)}
              placeholder="D:\Code\个人项目\初始化项目测试"
            />
            {errors.targetDir && <p className="text-sm text-destructive">{errors.targetDir}</p>}
            <p className="text-xs text-muted-foreground">
              将在目标目录下创建 {'{前缀}'}.CRM.D365 文件夹；若该文件夹已存在且非空将拒绝覆盖。
            </p>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? '正在生成…' : '生成项目框架'}
          </Button>

          {submitError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCheck className="h-5 w-5 text-green-600" />
              生成成功
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">根目录：</span>{result.rootDir}</p>
              <p><span className="text-muted-foreground">解决方案：</span>{result.solutionFile}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">项目（{result.projects.length}）</p>
              <ul className="space-y-1 text-sm">
                {result.projects.map(p => (
                  <li key={p.guid} className="flex flex-col">
                    <span className="font-mono">{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.guid}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">生成文件（{result.files.length}）</p>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                {result.files.join('\n')}
              </pre>
            </div>

            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
              下一步：在解决方案根目录执行 <code className="font-mono">nuget restore {namespacePrefix.trim()}.CRM.D365.sln</code>（或在 Visual Studio 中还原 NuGet 程序包），然后使用 VS 2019/2022 打开解决方案生成。
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
