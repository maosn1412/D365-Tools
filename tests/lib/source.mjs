/**
 * 前端源码契约测试辅助：定位并读取页面源码，供关键逻辑模式断言使用。
 * 契约测试的目标：当生成逻辑被意外修改（模板片段、拼接规则、转义逻辑）时测试失败，
 * 防止纯前端工具在重构中发生静默回归。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 读取 client/src/pages/tools 下的页面源码 */
export function readToolSource(fileName) {
  return readFile(path.join(PROJECT_ROOT, 'client', 'src', 'pages', 'tools', fileName), 'utf8')
}

/** 读取项目内任意相对路径文件 */
export function readProjectFile(relativePath) {
  return readFile(path.join(PROJECT_ROOT, relativePath), 'utf8')
}
