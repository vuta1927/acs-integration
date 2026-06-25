import type {
  ProWatchConfigDto, RabbitConfigDto, TestResultDto,
  MappingRuleDto, ReceivedEventDto, ReceivedEventDetailDto,
  ForwardedMessageDto, PagedResult, BridgeStatusDto,
  ScenarioDto, ContractsDto, EventFilters, LogEntryDto,
} from './types'

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? ': ' + body : ''}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Config
export const configApi = {
  getProWatch: () => request<ProWatchConfigDto>('/api/config/prowatch'),
  putProWatch: (dto: ProWatchConfigDto) =>
    request<void>('/api/config/prowatch', { method: 'PUT', body: JSON.stringify(dto) }),
  getRabbit: () => request<RabbitConfigDto>('/api/config/rabbit'),
  putRabbit: (dto: RabbitConfigDto) =>
    request<void>('/api/config/rabbit', { method: 'PUT', body: JSON.stringify(dto) }),
  testRabbit: () => request<TestResultDto>('/api/config/rabbit/test', { method: 'POST' }),
}

// Mapping rules
export const mappingApi = {
  list: () => request<MappingRuleDto[]>('/api/mapping-rules'),
  replaceAll: (rules: MappingRuleDto[]) =>
    request<{ count: number }>('/api/mapping-rules', {
      method: 'PUT',
      body: JSON.stringify(rules),
    }),
}

// Events
export const eventsApi = {
  list: (filters: EventFilters = {}) => {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') p.set(k, String(v))
    })
    return request<PagedResult<ReceivedEventDto>>(`/api/events?${p}`)
  },
  recent: (take = 50) =>
    request<ReceivedEventDto[]>(`/api/events/recent?take=${take}`),
  detail: (id: number) =>
    request<ReceivedEventDetailDto>(`/api/events/${id}`),
  forwarded: (eventId: string) =>
    request<ForwardedMessageDto[]>(`/api/events/${eventId}/forwarded`),
  exportUrl: (filters: EventFilters = {}): string => {
    const p = new URLSearchParams()
    const { page: _p, pageSize: _ps, ...rest } = filters
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined && v !== '') p.set(k, String(v))
    })
    const qs = p.toString()
    return `/api/events/export${qs ? '?' + qs : ''}`
  },
}

// Status
export const statusApi = {
  get: () => request<BridgeStatusDto>('/api/status'),
}

// ProWatch control
export const proWatchApi = {
  connect: () => request<void>('/api/prowatch/connect', { method: 'POST' }),
  disconnect: () => request<void>('/api/prowatch/disconnect', { method: 'POST' }),
}

// Simulator
export const simulatorApi = {
  scenarios: () => request<ScenarioDto[]>('/api/simulator/scenarios'),
  emit: (key: string) =>
    request<void>(`/api/simulator/emit/${encodeURIComponent(key)}`, { method: 'POST' }),
}

// Meta / contracts (stale time = infinity — changes only on redeploy)
export const metaApi = {
  contracts: () => request<ContractsDto>('/api/meta/contracts'),
}

// Console logs (initial load — live updates via SignalR "logEntry" event)
export const logsApi = {
  recent: (take = 200, level?: string, category?: string) => {
    const p = new URLSearchParams({ take: String(take) })
    if (level) p.set('level', level)
    if (category) p.set('category', category)
    return request<LogEntryDto[]>(`/api/logs?${p}`)
  },
}
