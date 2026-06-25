// DTO types mirroring the .NET backend — camelCase, hand-written (no codegen)
// Timestamps are ISO-8601 UTC strings; never blind new Date() for display logic.

// --- Config ---
export interface ProWatchConfigDto {
  baseUrl: string
  hubPath: string
  accessToken: string | null   // masked (null) on GET
  accessTokenSet: boolean      // true if a value is currently stored server-side
  userName: string | null
  workstationName: string | null
  autoConnect: boolean
  reconnectSeconds: number
}

export interface RabbitConfigDto {
  enabled: boolean
  hostName: string
  port: number
  virtualHost: string
  userName: string
  password: string | null       // masked on GET
  passwordSet: boolean          // true if a value is currently stored server-side
  useTls: boolean
  tlsVersion: string
  serverName: string | null
  caCertPath: string | null
  clientCertPath: string | null
  clientCertPassword: string | null  // masked on GET
  clientCertPasswordSet: boolean     // true if a value is currently stored server-side
  allowUntrustedRoot: boolean
  exchange: string
  exchangeType: string
  defaultRoutingKey: string
}

export interface TestResultDto {
  success: boolean
  error: string | null
}

// --- Events ---
export interface ReceivedEventDto {
  id: number
  eventId: string
  eventType: string
  eventCode: string
  eventDate: string     // ISO-8601 UTC
  doorId: string | null
  userId: string | null
  badgeId: string | null
  deviceId: string | null
  location: string | null
  priority: number
  isAlarm: boolean
  message: string | null
  receivedAt: string    // ISO-8601 UTC
  forwardStatus: ForwardStatus
}

export interface ReceivedEventDetailDto extends ReceivedEventDto {
  raw: unknown  // JsonElement passthrough
}

export interface AcsEventExportDto {
  eventId: string
  eventType: string
  eventCode: string
  eventDate: string
  doorId: string | null
  userId: string | null
  badgeId: string | null
  deviceId: string | null
  location: string | null
  priority: number
  isAlarm: boolean
  message: string | null
  receivedAt: string
  raw: unknown
}

export interface ForwardedMessageDto {
  id: number
  sourceEventId: string
  commandId: string
  exchange: string
  routingKey: string
  status: string
  error: string | null
  payload: unknown  // JsonElement passthrough
  forwardedAt: string
  processingMs: number
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  hasMore: boolean
}

// --- Status / real-time ---
export type ForwardStatus = 'Pending' | 'Published' | 'Skipped' | 'Failed'
export type ConnectionState = 'Connected' | 'Connecting' | 'Reconnecting' | 'Error' | string

export interface ConnectionStateDto {
  proWatchState: ConnectionState
  proWatchError: string | null
  proWatchConnectedAt: string | null
  subscribed: boolean
  rabbitState: ConnectionState
  rabbitError: string | null
}

export interface CountersDto {
  totalReceived: number
  totalForwarded: number
  totalFailed: number
  totalSkipped: number
}

export interface BridgeStatusDto {
  connection: ConnectionStateDto
  counters: CountersDto
}

// --- Simulator / meta ---
export interface ScenarioDto {
  key: string
  eventType: string
  eventCode: string
  isAlarm: boolean
  priority: number
}

export interface EventCodeDto {
  code: string
  description: string
}

export interface ContractsDto {
  eventTypes: string[]
  eventCodes: EventCodeDto[]
  scenarios: ScenarioDto[]
}

// --- Console logs ---
export type LogLevel = 'Trace' | 'Debug' | 'Information' | 'Warning' | 'Error' | 'Critical'

export interface LogEntryDto {
  id: number
  timestamp: string   // ISO-8601 UTC
  level: LogLevel
  category: string    // shortened (last 2 segments)
  message: string
  exception: string | null
}

// --- Event filter params ---
export interface EventFilters {
  page?: number
  pageSize?: number
  eventType?: string
  isAlarm?: boolean
  forwardStatus?: ForwardStatus
  from?: string
  to?: string
  q?: string
}
