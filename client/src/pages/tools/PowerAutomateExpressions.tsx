import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import { IconCopy, IconCheck, IconWorkflow } from '@/components/ui/icons'

interface ExpressionTemplate {
  name: string
  category: string
  syntax: string
  description: string
  params: { name: string; placeholder: string; defaultValue?: string }[]
  evaluate: (args: string[]) => string
}

const expressions: ExpressionTemplate[] = [
  // String operations
  {
    name: 'concat', category: 'String', syntax: "concat('str1', 'str2', ...)",
    description: 'Combine multiple strings',
    params: [
      { name: 'String 1', placeholder: 'First string', defaultValue: 'Hello' },
      { name: 'String 2', placeholder: 'Second string', defaultValue: ' World' },
    ],
    evaluate: (args) => args.join(''),
  },
  {
    name: 'toUpper', category: 'String', syntax: "toUpper('text')",
    description: 'Convert to uppercase',
    params: [{ name: 'Input', placeholder: 'Enter text', defaultValue: 'hello' }],
    evaluate: (args) => args[0]?.toUpperCase() || '',
  },
  {
    name: 'toLower', category: 'String', syntax: "toLower('text')",
    description: 'Convert to lowercase',
    params: [{ name: 'Input', placeholder: 'Enter text', defaultValue: 'HELLO' }],
    evaluate: (args) => args[0]?.toLowerCase() || '',
  },
  {
    name: 'substring', category: 'String', syntax: "substring('text', startIndex, length)",
    description: 'Extract part of a string',
    params: [
      { name: 'Input', placeholder: 'Full text', defaultValue: 'Hello World' },
      { name: 'Start Index', placeholder: '0', defaultValue: '0' },
      { name: 'Length', placeholder: '5', defaultValue: '5' },
    ],
    evaluate: (args) => {
      const str = args[0] || ''
      const start = parseInt(args[1] || '0')
      const len = parseInt(args[2] || '5')
      return str.substring(start, start + len)
    },
  },
  {
    name: 'replace', category: 'String', syntax: "replace('text', 'old', 'new')",
    description: 'Replace occurrences in a string',
    params: [
      { name: 'Input', placeholder: 'Original text', defaultValue: 'Hello World' },
      { name: 'Old Value', placeholder: 'Text to find', defaultValue: 'World' },
      { name: 'New Value', placeholder: 'Replacement', defaultValue: 'D365' },
    ],
    evaluate: (args) => (args[0] || '').split(args[1] || '').join(args[2] || ''),
  },
  {
    name: 'indexOf', category: 'String', syntax: "indexOf('text', 'search')",
    description: 'Find position of substring',
    params: [
      { name: 'Input', placeholder: 'Text to search in', defaultValue: 'Hello World' },
      { name: 'Search', placeholder: 'Text to find', defaultValue: 'World' },
    ],
    evaluate: (args) => String((args[0] || '').indexOf(args[1] || '')),
  },
  {
    name: 'length', category: 'String', syntax: "length('text')",
    description: 'Get string length',
    params: [{ name: 'Input', placeholder: 'Enter text', defaultValue: 'Hello World' }],
    evaluate: (args) => String((args[0] || '').length),
  },
  {
    name: 'trim', category: 'String', syntax: "trim(' text ')",
    description: 'Remove leading/trailing whitespace',
    params: [{ name: 'Input', placeholder: 'Text with spaces', defaultValue: '  Hello World  ' }],
    evaluate: (args) => (args[0] || '').trim(),
  },
  // DateTime
  {
    name: 'formatDateTime', category: 'DateTime', syntax: "formatDateTime('2024-01-01', 'yyyy-MM-dd')",
    description: 'Format a date-time string',
    params: [
      { name: 'Timestamp', placeholder: 'ISO date string', defaultValue: '2024-06-15T10:30:00Z' },
      { name: 'Format', placeholder: 'Format string', defaultValue: 'yyyy-MM-dd' },
    ],
    evaluate: (args) => {
      try {
        const d = new Date(args[0] || '')
        const fmt = args[1] || 'yyyy-MM-dd'
        return fmt
          .replace('yyyy', String(d.getUTCFullYear()))
          .replace('MM', String(d.getUTCMonth() + 1).padStart(2, '0'))
          .replace('dd', String(d.getUTCDate()).padStart(2, '0'))
          .replace('HH', String(d.getUTCHours()).padStart(2, '0'))
          .replace('mm', String(d.getUTCMinutes()).padStart(2, '0'))
          .replace('ss', String(d.getUTCSeconds()).padStart(2, '0'))
      } catch { return 'Invalid date' }
    },
  },
  {
    name: 'utcNow', category: 'DateTime', syntax: "utcNow('yyyy-MM-dd')",
    description: 'Get current UTC time',
    params: [{ name: 'Format', placeholder: 'Format string', defaultValue: 'yyyy-MM-ddTHH:mm:ssZ' }],
    evaluate: (args) => {
      const d = new Date()
      const fmt = args[0] || 'yyyy-MM-ddTHH:mm:ssZ'
      return fmt
        .replace('yyyy', String(d.getUTCFullYear()))
        .replace('MM', String(d.getUTCMonth() + 1).padStart(2, '0'))
        .replace('dd', String(d.getUTCDate()).padStart(2, '0'))
        .replace('HH', String(d.getUTCHours()).padStart(2, '0'))
        .replace('mm', String(d.getUTCMinutes()).padStart(2, '0'))
        .replace('ss', String(d.getUTCSeconds()).padStart(2, '0'))
    },
  },
  {
    name: 'addDays', category: 'DateTime', syntax: "addDays('2024-01-01', 7)",
    description: 'Add days to a date',
    params: [
      { name: 'Timestamp', placeholder: 'Base date', defaultValue: '2024-06-15T00:00:00Z' },
      { name: 'Days', placeholder: 'Number of days', defaultValue: '7' },
    ],
    evaluate: (args) => {
      try {
        const d = new Date(args[0] || '')
        d.setUTCDate(d.getUTCDate() + parseInt(args[1] || '0'))
        return d.toISOString()
      } catch { return 'Invalid date' }
    },
  },
  // Logic
  {
    name: 'if', category: 'Logic', syntax: "if(condition, trueValue, falseValue)",
    description: 'Conditional expression',
    params: [
      { name: 'Condition (true/false)', placeholder: 'true or false', defaultValue: 'true' },
      { name: 'True Value', placeholder: 'Value if true', defaultValue: 'Yes' },
      { name: 'False Value', placeholder: 'Value if false', defaultValue: 'No' },
    ],
    evaluate: (args) => (args[0]?.toLowerCase() === 'true' ? args[1] : args[2]) || '',
  },
  {
    name: 'coalesce', category: 'Logic', syntax: "coalesce(val1, val2, val3)",
    description: 'Return first non-null/non-empty value',
    params: [
      { name: 'Value 1', placeholder: 'First value', defaultValue: '' },
      { name: 'Value 2', placeholder: 'Second value', defaultValue: 'Fallback' },
      { name: 'Value 3', placeholder: 'Third value', defaultValue: '' },
    ],
    evaluate: (args) => args.find(a => a !== '' && a != null) || '',
  },
  {
    name: 'equals', category: 'Logic', syntax: "equals('a', 'b')",
    description: 'Check if two values are equal',
    params: [
      { name: 'Value A', placeholder: 'First value', defaultValue: 'hello' },
      { name: 'Value B', placeholder: 'Second value', defaultValue: 'hello' },
    ],
    evaluate: (args) => String(args[0] === args[1]),
  },
  // Conversion
  {
    name: 'json', category: 'Conversion', syntax: "json('{\"key\":\"value\"}')",
    description: 'Parse JSON string',
    params: [{ name: 'JSON String', placeholder: '{"key": "value"}', defaultValue: '{"name":"D365","version":"9.2"}' }],
    evaluate: (args) => {
      try { return JSON.stringify(JSON.parse(args[0] || '{}'), null, 2) }
      catch { return 'Invalid JSON' }
    },
  },
  {
    name: 'string', category: 'Conversion', syntax: "string(value)",
    description: 'Convert to string',
    params: [{ name: 'Value', placeholder: 'Any value', defaultValue: '42' }],
    evaluate: (args) => args[0] || '',
  },
  {
    name: 'int', category: 'Conversion', syntax: "int('42')",
    description: 'Convert to integer',
    params: [{ name: 'Value', placeholder: 'Numeric string', defaultValue: '42' }],
    evaluate: (args) => {
      const n = parseInt(args[0] || '0')
      return isNaN(n) ? 'NaN' : String(n)
    },
  },
  {
    name: 'float', category: 'Conversion', syntax: "float('3.14')",
    description: 'Convert to float',
    params: [{ name: 'Value', placeholder: 'Numeric string', defaultValue: '3.14' }],
    evaluate: (args) => {
      const n = parseFloat(args[0] || '0')
      return isNaN(n) ? 'NaN' : String(n)
    },
  },
  {
    name: 'base64', category: 'Conversion', syntax: "base64('text')",
    description: 'Encode to Base64',
    params: [{ name: 'Input', placeholder: 'Text to encode', defaultValue: 'Hello D365' }],
    evaluate: (args) => {
      try { return btoa(args[0] || '') } catch { return 'Error' }
    },
  },
  {
    name: 'decodeBase64', category: 'Conversion', syntax: "decodeBase64('SGVsbG8=')",
    description: 'Decode from Base64',
    params: [{ name: 'Input', placeholder: 'Base64 string', defaultValue: 'SGVsbG8gRDM2NQ==' }],
    evaluate: (args) => {
      try { return atob(args[0] || '') } catch { return 'Error' }
    },
  },
]

const categories = ['All', ...Array.from(new Set(expressions.map(e => e.category)))]

export function PowerAutomateExpressions() {
  const [selectedExpr, setSelectedExpr] = useState<string>('concat')
  const [category, setCategory] = useState('All')
  const [customExpr, setCustomExpr] = useState('')
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  const expr = expressions.find(e => e.name === selectedExpr) || expressions[0]

  const filteredExpressions = category === 'All'
    ? expressions
    : expressions.filter(e => e.category === category)

  const result = useMemo(() => {
    const args = expr.params.map((p, i) => paramValues[`${expr.name}_${i}`] ?? p.defaultValue ?? '')
    return expr.evaluate(args)
  }, [expr, paramValues])

  const expressionSyntax = useMemo(() => {
    const args = expr.params.map((p, i) => {
      const val = paramValues[`${expr.name}_${i}`] ?? p.defaultValue ?? ''
      return `'${val}'`
    })
    return `${expr.name}(${args.join(', ')})`
  }, [expr, paramValues])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(expressionSyntax)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconWorkflow className="h-5 w-5" />}
        title="Power Automate Expression Tester"
        description="Test and preview Power Automate expressions with real-time results."
      />

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Expression List */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 max-h-[500px] overflow-auto">
            {filteredExpressions.map(e => (
              <button
                key={e.name}
                onClick={() => setSelectedExpr(e.name)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedExpr === e.name ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">{e.name}</div>
                <div className="text-xs opacity-70">{e.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Expression Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{expr.name}</CardTitle>
              <CardDescription>{expr.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {expr.params.map((param, i) => (
                <div key={i} className="space-y-2">
                  <Label>{param.name}</Label>
                  <Input
                    placeholder={param.placeholder}
                    value={paramValues[`${expr.name}_${i}`] ?? param.defaultValue ?? ''}
                    onChange={(e) => setParamValues(prev => ({ ...prev, [`${expr.name}_${i}`]: e.target.value }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Result</CardTitle>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? 'Copied!' : 'Copy Expression'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Expression Syntax</Label>
                <code className="block mt-1 p-3 bg-muted rounded font-mono text-sm break-all">{expressionSyntax}</code>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Evaluated Result</Label>
                <code className="block mt-1 p-3 bg-emerald-50 dark:bg-emerald-950 rounded font-mono text-sm break-all">{result}</code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custom Expression</CardTitle>
              <CardDescription>Write your own expression to see the syntax (no evaluation)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g., concat(toUpper(triggerOutputs()?['body/name']), ' - ', formatDateTime(utcNow(), 'yyyy-MM-dd'))"
                value={customExpr}
                onChange={(e) => setCustomExpr(e.target.value)}
                className="font-mono text-sm min-h-[100px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
