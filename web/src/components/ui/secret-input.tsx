import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SecretInputProps {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Whether the server currently has a non-empty value stored. undefined = unknown. */
  isSet?: boolean
  /** Optional secret — when not set, show a neutral hint instead of a red "required" warning. */
  optional?: boolean
}

// Masked secret field — server always returns null for secrets on GET.
// Blank on save = keep existing (MergeSecret server-side). Never round-trips a sentinel.
export function SecretInput({ id, value, onChange, placeholder = '••••••••', className, disabled, isSet, optional }: SecretInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="new-password"
        className={cn(
          'w-full rounded-control border border-cr-border bg-cr-bg-deep px-3 py-2 pr-9',
          'font-mono text-base text-cr-text placeholder:text-cr-dim',
          'focus:outline-none focus:ring-2 focus:ring-cr-info focus:ring-offset-0',
          'disabled:opacity-50',
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-cr-muted hover:text-cr-text"
        aria-label={show ? 'Hide secret' : 'Show secret'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
      </button>
      {isSet === true && (
        <p className="mt-1 text-2xs text-cr-ok">Saved — leave blank to keep, or type to replace</p>
      )}
      {isSet === false && optional && (
        <p className="mt-1 text-2xs text-cr-muted">Optional — leave blank if not used</p>
      )}
      {isSet === false && !optional && (
        <p className="mt-1 text-2xs text-cr-critical">Not configured — enter a value</p>
      )}
      {isSet === undefined && (
        <p className="mt-1 text-2xs text-cr-muted">Leave blank to keep current value</p>
      )}
    </div>
  )
}
