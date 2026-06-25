import { Plug, LoaderCircle } from 'lucide-react'
import type { HubState } from '@/hooks/use-bridge-hub'

interface ConnectionBannerProps {
  hubState: HubState
  onRetry?: () => void
}

// Thin non-blocking strip shown only when hub is not connected (replaces Blazor reconnect modal)
export function ConnectionBanner({ hubState, onRetry }: ConnectionBannerProps) {
  if (hubState === 'connected') return null

  const isHardFail = hubState === 'disconnected'

  return (
    <div
      role="status"
      aria-live="polite"
      className="z-40 flex items-center gap-2 border-b border-cr-critical/30 bg-cr-critical/10 px-4 py-1.5 text-xs text-cr-critical"
    >
      <Plug size={13} strokeWidth={1.75} aria-hidden />
      {isHardFail ? (
        <>
          <span>Live feed lost.</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 underline underline-offset-2 hover:text-cr-text"
            >
              Retry
            </button>
          )}
        </>
      ) : (
        <>
          <LoaderCircle size={13} className="animate-spin" aria-hidden />
          <span>Reconnecting to live feed...</span>
        </>
      )}
    </div>
  )
}
