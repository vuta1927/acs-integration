import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getConnection, ConnectionState } from '@/lib/signalr'
import type { ConnectionStateDto, CountersDto, ReceivedEventDto, ForwardedMessageDto } from '@/lib/types'

export type HubState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

const MAX_FEED_ROWS = 50

// Flash coalescing — skip flash if last alarm flash was <300ms ago
let lastFlashAt = 0

export function useBridgeHub() {
  const qc = useQueryClient()
  const [hubState, setHubState] = useState<HubState>('disconnected')
  const startedRef = useRef(false)

  const patchStatus = useCallback((conn: ConnectionStateDto) => {
    qc.setQueryData(['status'], (prev: { connection: ConnectionStateDto; counters: CountersDto } | undefined) =>
      prev ? { ...prev, connection: conn } : undefined,
    )
  }, [qc])

  const patchCounters = useCallback((counters: CountersDto) => {
    qc.setQueryData(['status'], (prev: { connection: ConnectionStateDto; counters: CountersDto } | undefined) =>
      prev ? { ...prev, counters } : undefined,
    )
  }, [qc])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const conn = getConnection()

    const syncState = () => {
      const s = conn.state
      if (s === ConnectionState.Connected) setHubState('connected')
      else if (s === ConnectionState.Connecting) setHubState('connecting')
      else if (s === ConnectionState.Reconnecting) setHubState('reconnecting')
      else setHubState('disconnected')
    }

    conn.onreconnecting(() => {
      setHubState('reconnecting')
    })

    conn.onreconnected(async () => {
      setHubState('connected')
      // Refetch on reconnect to close the gap (analysis sec 5)
      await qc.invalidateQueries({ queryKey: ['status'] })
      await qc.invalidateQueries({ queryKey: ['events', 'recent'] })
    })

    conn.onclose(() => {
      setHubState('disconnected')
    })

    conn.on('connectionStateChanged', (dto: ConnectionStateDto) => {
      patchStatus(dto)
    })

    conn.on('countersUpdated', (dto: CountersDto) => {
      patchCounters(dto)
    })

    conn.on('eventReceived', (dto: ReceivedEventDto) => {
      // Prepend to recent feed; cap at MAX_FEED_ROWS
      qc.setQueryData(['events', 'recent'], (prev: ReceivedEventDto[] | undefined) => {
        const next = [dto, ...(prev ?? [])].slice(0, MAX_FEED_ROWS)

        // Flash for alarm rows (coalesced — no strobe on burst)
        if (dto.isAlarm) {
          const now = Date.now()
          if (now - lastFlashAt > 300) {
            lastFlashAt = now
            // CSS animation applied by live-feed-table via data attribute on row element
            requestAnimationFrame(() => {
              document.getElementById(`feed-row-${dto.id}`)?.classList.add('animate-cr-flash')
            })
          }
        }
        return next
      })
    })

    conn.on('eventForwarded', (dto: ForwardedMessageDto) => {
      // Patch the forwardStatus on the matching live-feed row
      qc.setQueryData(['events', 'recent'], (prev: ReceivedEventDto[] | undefined) =>
        prev?.map(r =>
          r.eventId === dto.sourceEventId
            ? { ...r, forwardStatus: dto.status as ReceivedEventDto['forwardStatus'] }
            : r,
        ),
      )
      // Invalidate paged event list so History reflects the update
      void qc.invalidateQueries({ queryKey: ['events'] })
    })

    conn.start().then(syncState).catch(err => {
      console.warn('SignalR initial connect failed:', err)
      setHubState('disconnected')
    })

    return () => {
      // Do not stop the connection on unmount — singleton lives for the app lifetime
    }
  }, [qc, patchStatus, patchCounters])

  return { hubState }
}
