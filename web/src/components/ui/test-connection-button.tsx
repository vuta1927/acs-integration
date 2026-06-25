import { useState } from 'react'
import { LoaderCircle, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { configApi } from '@/lib/api'

type TestState = 'idle' | 'testing' | 'ok' | 'error'

interface TestConnectionButtonProps {
  className?: string
}

export function TestConnectionButton({ className }: TestConnectionButtonProps) {
  const [state, setState] = useState<TestState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleTest = async () => {
    setState('testing')
    setErrorMsg(null)
    try {
      const result = await configApi.testRabbit()
      if (result.success) {
        setState('ok')
        setTimeout(() => setState('idle'), 4000)
      } else {
        setState('error')
        setErrorMsg(result.error ?? 'Connection failed')
      }
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Request failed')
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        onClick={handleTest}
        disabled={state === 'testing'}
        aria-busy={state === 'testing'}
        className={cn(
          'inline-flex items-center gap-2 rounded-control border px-4 py-2 text-xs font-medium',
          'border-cr-border bg-cr-panel text-cr-text transition-colors hover:bg-cr-panel-raised',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        )}
      >
        {state === 'testing' && <LoaderCircle size={14} className="animate-spin" aria-hidden />}
        {state === 'testing' ? 'Testing...' : 'Test connection'}
      </button>

      {state === 'ok' && (
        <span className="inline-flex items-center gap-1 text-xs text-cr-ok">
          <Check size={14} /> Connection OK
        </span>
      )}
      {state === 'error' && (
        <span className="inline-flex items-center gap-1 text-xs text-cr-critical font-mono">
          <X size={14} />
          {errorMsg}
        </span>
      )}
    </div>
  )
}
