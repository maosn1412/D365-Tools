import { Router } from 'express'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const scaffoldRouter: Router = Router()

const NAMESPACE_RE = /^[A-Za-z][A-Za-z0-9]{0,19}$/
const PUBLISHER_RE = /^[a-z][a-z0-9_]{0,7}$/
const PUBLISHER_BLOCKLIST = new Set(['msdyn', 'microsoft', 'mscrm'])
const BOM = '\uFEFF'
const BOM_EXTS = new Set(['.cs', '.csproj', '.sln', '.config', '.projitems', '.shproj'])
const BINARY_EXTS = new Set(['.snk'])

function resolveTemplateDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'templates/plugin-framework'),
    fileURLToPath(new URL('../templates/plugin-framework', import.meta.url)),
    fileURLToPath(new URL('../../templates/plugin-framework', import.meta.url)),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  throw new Error('Template directory not found (server/templates/plugin-framework)')
}

function isSameOrInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function validateTargetDir(raw: string): { ok: true; dir: string } | { ok: false; error: string } {
  const input = raw.trim()
  if (!input) return { ok: false, error: 'targetDir 不能为空' }
  if (input.includes(String.fromCharCode(0))) return { ok: false, error: 'targetDir 包含非法字符' }
  if (input.split(/[\\/]+/).some(seg => seg === '..')) return { ok: false, error: 'targetDir 不允许包含 .. 路径穿越' }
  if (!path.win32.isAbsolute(input)) return { ok: false, error: 'targetDir 必须是绝对路径（如 D:\\projects）' }
  const dir = path.resolve(input)
  if (/^[A-Za-z]:[\\/]?$/.test(input)) return { ok: false, error: 'targetDir 不允许是磁盘根目录' }
  const lower = dir.toLowerCase()
  for (const sys of ['c:\\windows', 'c:\\program files', 'c:\\program files (x86)']) {
    if (isSameOrInside(sys, lower)) return { ok: false, error: `targetDir 不允许位于系统目录 ${sys} 下` }
  }
  const repoRoot = path.resolve(process.cwd(), '..')
  if (isSameOrInside(repoRoot, dir)) return { ok: false, error: 'targetDir 不允许位于本工具项目目录内' }
  return { ok: true, dir }
}

interface ScaffoldBody {
  namespacePrefix?: unknown
  publisherPrefix?: unknown
  targetDir?: unknown
}

scaffoldRouter.post('/plugin-project', async (req, res) => {
  try {
    const { namespacePrefix, publisherPrefix, targetDir } = req.body as ScaffoldBody

    if (typeof namespacePrefix !== 'string' || !NAMESPACE_RE.test(namespacePrefix.trim())) {
      res.status(400).json({ error: 'namespacePrefix 格式不正确：需以字母开头，仅含字母和数字，最长 20 位（如 ABC）' })
      return
    }
    const ns = namespacePrefix.trim()

    if (typeof publisherPrefix !== 'string' || !PUBLISHER_RE.test(publisherPrefix.trim())) {
      res.status(400).json({ error: 'publisherPrefix 格式不正确：需以小写字母开头，仅含小写字母/数字/下划线，最长 8 位（如 abc）' })
      return
    }
    const pub = publisherPrefix.trim()
    if (pub.endsWith('_')) {
      res.status(400).json({ error: 'publisherPrefix 不允许以下划线结尾' })
      return
    }
    if (PUBLISHER_BLOCKLIST.has(pub)) {
      res.status(400).json({ error: `publisherPrefix 不允许使用保留前缀 ${pub}` })
      return
    }

    if (typeof targetDir !== 'string') {
      res.status(400).json({ error: 'targetDir 不能为空' })
      return
    }
    const dirCheck = validateTargetDir(targetDir)
    if (!dirCheck.ok) {
      res.status(400).json({ error: dirCheck.error })
      return
    }

    const solutionRoot = path.join(dirCheck.dir, `${ns}.CRM.D365`)
    try {
      const existing = await fs.readdir(solutionRoot)
      if (existing.length > 0) {
        res.status(409).json({ error: `目标目录 ${solutionRoot} 已存在且非空，请更换前缀或目标路径` })
        return
      }
    } catch { /* not exists yet */ }

    const templateDir = resolveTemplateDir()
    const guids = { share: randomUUID(), sample: randomUUID(), test: randomUUID(), folder: randomUUID() }
    const upper = (u: string) => `{${u.toUpperCase()}}`
    const tokenMap: Record<string, string> = {
      '{{NamespacePrefix}}': ns,
      '{{PublisherPrefix}}': pub,
      '{{GUID_SHARE}}': upper(guids.share),
      '{{GUID_SAMPLE}}': upper(guids.sample),
      '{{GUID_TEST}}': upper(guids.test),
      '{{GUID_FOLDER}}': upper(guids.folder),
      '{{guid_share}}': guids.share,
    }
    const applyTokens = (text: string): string => {
      let out = text
      for (const [token, value] of Object.entries(tokenMap)) out = out.split(token).join(value)
      return out
    }

    const files: string[] = []
    async function walk(srcDir: string, dstDir: string): Promise<void> {
      for (const entry of await fs.readdir(srcDir, { withFileTypes: true })) {
        const outName = entry.name.split('__NS__').join(ns)
        const srcPath = path.join(srcDir, entry.name)
        const dstPath = path.join(dstDir, outName)
        if (entry.isDirectory()) {
          await fs.mkdir(dstPath, { recursive: true })
          await walk(srcPath, dstPath)
          continue
        }
        const ext = path.extname(entry.name).toLowerCase()
        if (BINARY_EXTS.has(ext)) {
          await fs.mkdir(path.dirname(dstPath), { recursive: true })
          await fs.copyFile(srcPath, dstPath)
        } else {
          let content = await fs.readFile(srcPath, 'utf8')
          if (content.startsWith(BOM)) content = content.slice(1)
          content = applyTokens(content)
          if (/\{\{|\}\}/.test(content) || content.includes('__NS__')) {
            throw new Error(`模板占位符未完全替换: ${path.relative(templateDir, srcPath)}`)
          }
          await fs.mkdir(path.dirname(dstPath), { recursive: true })
          await fs.writeFile(dstPath, (BOM_EXTS.has(ext) ? BOM : '') + content, 'utf8')
        }
        files.push(path.relative(solutionRoot, dstPath))
      }
    }

    await fs.mkdir(solutionRoot, { recursive: true })
    await walk(templateDir, solutionRoot)

    res.json({
      success: true,
      rootDir: solutionRoot,
      solutionFile: path.join(solutionRoot, `${ns}.CRM.D365.sln`),
      projects: [
        { name: 'Crm.Plugins.Share', path: path.join(solutionRoot, 'Crm.Plugins.Share'), guid: upper(guids.share) },
        { name: `${ns}.Plugins.Sample`, path: path.join(solutionRoot, `${ns}.Plugins.Sample`), guid: upper(guids.sample) },
        { name: `${ns}.Plugins.UnitTest`, path: path.join(solutionRoot, `${ns}.Plugins.UnitTest`), guid: upper(guids.test) },
      ],
      files: files.sort(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成项目失败'
    console.error('scaffold plugin-project error:', message)
    res.status(500).json({ error: message })
  }
})
