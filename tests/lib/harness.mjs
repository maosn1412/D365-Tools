/**
 * 极简测试框架：套件注册 -> 顺序执行 -> 控制台报告 -> 汇总结果。
 * 无任何第三方依赖，直接 `node <test-file>` 或由 run-all.mjs 汇总运行。
 */
import { pathToFileURL } from 'node:url'

/** 判断当前模块是否被直接 node 执行（用于测试文件自运行） */
export function isMain(moduleUrl) {
  if (!process.argv[1]) return false
  return moduleUrl === pathToFileURL(process.argv[1]).href
}

/** 断言：条件为真 */
export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message)
}

/** 断言：严格相等 */
export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message ?? 'values are not equal'}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    )
  }
}

/** 断言：字符串/数组包含指定内容 */
export function assertIncludes(haystack, needle, message) {
  const ok = typeof haystack === 'string' ? haystack.includes(needle) : haystack?.includes?.(needle)
  if (!ok) {
    const preview = typeof haystack === 'string' ? haystack.slice(0, 300) : JSON.stringify(haystack)?.slice(0, 300)
    throw new Error(`${message ?? 'missing expected content'}: ${JSON.stringify(needle)}\n    in: ${preview}`)
  }
}

/** 断言：HTTP 状态码 */
export function assertStatus(result, expected, message) {
  if (result.status !== expected) {
    const body = typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
    throw new Error(`${message ?? 'unexpected status'}: expected ${expected}, got ${result.status}\n    body: ${body?.slice(0, 300)}`)
  }
}

/**
 * 创建测试套件。
 * test(name, fn) 或 test(name, { requiresConnection: true }, fn)。
 * run(context) 中 context.connected 为 false 时，requiresConnection 用例自动标记 skipped。
 */
export function createSuite(name) {
  const tests = []
  return {
    name,
    test(testName, fnOrOpts, maybeFn) {
      const opts = typeof fnOrOpts === 'function' ? {} : fnOrOpts
      const fn = typeof fnOrOpts === 'function' ? fnOrOpts : maybeFn
      tests.push({
        name: testName,
        fn,
        requiresConnection: !!opts.requiresConnection,
        requiresCredentials: !!opts.requiresCredentials,
      })
    },
    async run(context = {}) {
      console.log(`\n=== ${name} ===`)
      let passed = 0
      let failed = 0
      let skipped = 0
      let blocked = 0
      for (const t of tests) {
        if (t.requiresConnection && !context.connected) {
          skipped++
          console.log(`  - ${t.name} (skipped: no connection)`)
          continue
        }
        if (t.requiresCredentials && !context.hasCredentials) {
          skipped++
          console.log(`  - ${t.name} (skipped: no credentials)`)
          continue
        }
        try {
          await t.fn()
          passed++
          console.log(`  ✓ ${t.name}`)
        } catch (error) {
          failed++
          const message = error instanceof Error ? error.message : String(error)
          if (error?.blocked === true) {
            blocked++
            console.error(`  ⊘ ${t.name} (blocked: environment)\n    ${message}`)
          } else {
            console.error(`  ✗ ${t.name}\n    ${message}`)
          }
        }
      }
      const suffix = blocked > 0 ? ` (env-blocked: ${blocked})` : ''
      console.log(`--- ${name}: ${passed} passed, ${failed} failed, ${skipped} skipped${suffix}`)
      return { passed, failed, skipped, blocked, productFailed: failed - blocked }
    },
  }
}
