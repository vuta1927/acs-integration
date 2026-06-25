import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JsonViewerProps {
  value: unknown
  className?: string
}

function highlight(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return `<span style="color:var(--cr-info)">${match}</span>`
          return `<span style="color:var(--cr-text)">${match}</span>`
        }
        if (/true|false|null/.test(match)) return `<span style="color:var(--cr-text-muted)">${match}</span>`
        return `<span style="color:var(--cr-minor)">${match}</span>`
      },
    )
}

export function JsonViewer({ value, className }: JsonViewerProps) {
  const [copied, setCopied] = useState(false)

  const formatted = (() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  })()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('relative overflow-hidden rounded-control border border-cr-border bg-cr-bg-deep', className)}>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-control border border-cr-border bg-cr-panel px-2 py-1 text-2xs text-cr-muted transition-colors hover:text-cr-text"
        aria-label="Copy JSON"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre
        className="max-h-[inherit] overflow-auto p-3 pt-8 font-mono text-2xs leading-relaxed"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: highlight(formatted) }}
      />
    </div>
  )
}
