import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format an ISO-8601 UTC timestamp to browser-local time with tz offset suffix.
// Policy (design-guidelines.md sec 9): local time + tz suffix for operators.
export function formatTs(iso: string, opts?: { dateOnly?: boolean; timeOnly?: boolean }): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const tzOffset = -d.getTimezoneOffset()
  const sign = tzOffset >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0')
  const mm = String(Math.abs(tzOffset) % 60).padStart(2, '0')
  const tz = mm === '00' ? `${sign}${hh}` : `${sign}${hh}:${mm}`

  if (opts?.dateOnly) {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  if (opts?.timeOnly) {
    return (
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
      ' ' + tz
    )
  }
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return `${date} ${time} ${tz}`
}

// Elapsed "HH:MM:SS since" from an ISO-8601 timestamp
export function sinceTs(iso: string | null | undefined): string {
  if (!iso) return '--'
  const elapsed = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (elapsed < 0) return '0s'
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// Current local clock string for the command bar (updates via setInterval in component)
export function nowClock(): string {
  const d = new Date()
  const tzOffset = -d.getTimezoneOffset()
  const sign = tzOffset >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0')
  return (
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
    ` ${sign}${hh}`
  )
}

// Trigger a browser file download from a URL (used by Export button)
export function triggerDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
