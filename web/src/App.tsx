import { Routes, Route } from 'react-router-dom'
import { CommandBar } from '@/components/layout/command-bar'
import { TopNav } from '@/components/layout/top-nav'
import { ConnectionBanner } from '@/components/layout/connection-banner'
import { useBridgeHub } from '@/hooks/use-bridge-hub'
import { lazy, Suspense } from 'react'
import { getConnection } from '@/lib/signalr'

const OperationsWall    = lazy(() => import('@/pages/operations-wall'))
const EventLog          = lazy(() => import('@/pages/event-log'))
const ForwardErrorLog   = lazy(() => import('@/pages/forward-error-log'))
const ConsoleLog        = lazy(() => import('@/pages/console-log'))
const RuleMatrix        = lazy(() => import('@/pages/rule-matrix'))
const SystemSettings    = lazy(() => import('@/pages/system-settings'))

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-cr-muted">
      <p className="text-hero font-mono text-cr-border">404</p>
      <p className="text-base">Page not found.</p>
    </div>
  )
}

export default function App() {
  const { hubState } = useBridgeHub()

  const handleRetry = () => {
    getConnection().start().catch(console.warn)
  }

  return (
    <div className="flex min-h-screen flex-col bg-cr-bg">
      <CommandBar />
      <TopNav />
      <ConnectionBanner hubState={hubState} onRetry={handleRetry} />
      <main className="flex-1">
        <Suspense fallback={<div className="p-8 text-cr-muted text-xs">Loading...</div>}>
          <Routes>
            <Route path="/"        element={<OperationsWall />} />
            <Route path="/history" element={<EventLog />} />
            <Route path="/errors"  element={<ForwardErrorLog />} />
            <Route path="/console" element={<ConsoleLog />} />
            <Route path="/mapping" element={<RuleMatrix />} />
            <Route path="/config"  element={<SystemSettings />} />
            <Route path="*"        element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
