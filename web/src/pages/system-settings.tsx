import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { configApi } from '@/lib/api'
import { SecretInput } from '@/components/ui/secret-input'
import { cn } from '@/lib/utils'
import type { ProWatchConfigDto, RabbitConfigDto } from '@/lib/types'

// ── Shared field components ─────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-cr-muted">{label}</label>
      {children}
      {hint && <p className="text-2xs text-cr-dim">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-control border border-cr-border bg-cr-bg-deep px-3 py-2 text-base text-cr-text placeholder:text-cr-dim focus:outline-none focus:ring-2 focus:ring-cr-info focus:ring-offset-0 disabled:opacity-50'

function TextInput({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={inputCls}
    />
  )
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={cn(inputCls, 'w-28')}
    />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-cr-info' : 'bg-cr-border',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
      <span className="text-xs text-cr-muted">{label}</span>
    </label>
  )
}

// ── Pro-Watch form ──────────────────────────────────────────────────────────
function ProWatchForm() {
  const qc = useQueryClient()
  const { data: remote } = useQuery({
    queryKey: ['config', 'prowatch'],
    queryFn: configApi.getProWatch,
    staleTime: Infinity,
  })

  const [form, setForm] = useState<ProWatchConfigDto>({
    baseUrl: '', hubPath: '/pwevents', accessToken: null, accessTokenSet: false,
    userName: null, workstationName: null, autoConnect: true, reconnectSeconds: 5,
  })

  const initializedRef = useRef(false)
  useEffect(() => {
    if (remote && !initializedRef.current) {
      setForm(remote)
      initializedRef.current = true
    }
  }, [remote])

  const set = (patch: Partial<ProWatchConfigDto>) => setForm(f => ({ ...f, ...patch }))

  const saveMut = useMutation({
    mutationFn: () => configApi.putProWatch(form),
    onSuccess: () => {
      toast.success('Pro-Watch config saved — reconnecting...')
      void qc.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`, { duration: 7000 }),
  })

  return (
    <div className="space-y-4">
      <Field label="Base URL">
        <TextInput value={form.baseUrl} onChange={v => set({ baseUrl: v })} placeholder="http://prowatch-server:5240" />
      </Field>
      <Field label="Hub path">
        <TextInput value={form.hubPath} onChange={v => set({ hubPath: v })} placeholder="/pwevents" />
      </Field>
      <Field label="Access token" hint="Optional. Pro-Watch Event Service authenticates by user name + workstation; no password is used here.">
        <SecretInput
          value={form.accessToken ?? ''}
          onChange={v => set({ accessToken: v || null })}
          isSet={remote?.accessTokenSet}
          optional
        />
      </Field>
      <Field label="User name">
        <TextInput value={form.userName ?? ''} onChange={v => set({ userName: v || null })} />
      </Field>
      <Field label="Workstation name">
        <TextInput value={form.workstationName ?? ''} onChange={v => set({ workstationName: v || null })} />
      </Field>
      <Field label="Reconnect interval (seconds)">
        <NumberInput value={form.reconnectSeconds} onChange={v => set({ reconnectSeconds: v })} />
      </Field>
      <Toggle checked={form.autoConnect} onChange={v => set({ autoConnect: v })} label="Auto-connect on startup" />

      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        aria-busy={saveMut.isPending}
        className="inline-flex items-center gap-2 rounded-control border border-cr-info/40 bg-cr-info/10 px-4 py-2 text-xs text-cr-info hover:bg-cr-info/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saveMut.isPending && <LoaderCircle size={13} className="animate-spin" />}
        {saveMut.isPending ? 'Saving...' : 'Save & reconnect'}
      </button>
    </div>
  )
}

// ── RabbitMQ form ───────────────────────────────────────────────────────────
function RabbitForm() {
  const qc = useQueryClient()
  const { data: remote } = useQuery({
    queryKey: ['config', 'rabbit'],
    queryFn: configApi.getRabbit,
    staleTime: Infinity,
  })

  const [form, setForm] = useState<RabbitConfigDto>({
    enabled: true, hostName: 'localhost', port: 5672, virtualHost: '/',
    userName: 'guest', password: null, passwordSet: false, useTls: false, tlsVersion: 'Tls13',
    serverName: null, caCertPath: null, clientCertPath: null, clientCertPassword: null,
    clientCertPasswordSet: false, allowUntrustedRoot: false,
    exchange: 'cctv', exchangeType: 'topic', defaultRoutingKey: 'cctv.*',
  })

  const initializedRef = useRef(false)
  useEffect(() => {
    if (remote && !initializedRef.current) {
      setForm(remote)
      initializedRef.current = true
    }
  }, [remote])

  const set = (patch: Partial<RabbitConfigDto>) => setForm(f => ({ ...f, ...patch }))

  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  const handleTest = async () => {
    setTestState('testing')
    setTestError(null)
    try {
      const r = await configApi.testRabbit()
      if (r.success) {
        setTestState('ok')
        toast.success('RabbitMQ connection OK')
        setTimeout(() => setTestState('idle'), 4000)
      } else {
        setTestState('err')
        setTestError(r.error ?? 'Failed')
        toast.error(`RabbitMQ test failed: ${r.error}`, { duration: 7000 })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setTestState('err')
      setTestError(msg)
      toast.error(`RabbitMQ error: ${msg}`, { duration: 7000 })
    }
  }

  const saveMut = useMutation({
    mutationFn: () => configApi.putRabbit(form),
    onSuccess: () => {
      toast.success('RabbitMQ config saved')
      void qc.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`, { duration: 7000 }),
  })

  return (
    <div className="space-y-4">
      <Toggle checked={form.enabled} onChange={v => set({ enabled: v })} label="Enabled" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Host name">
          <TextInput value={form.hostName} onChange={v => set({ hostName: v })} />
        </Field>
        <Field label="Port">
          <NumberInput value={form.port} onChange={v => set({ port: v })} />
        </Field>
        <Field label="Virtual host">
          <TextInput value={form.virtualHost} onChange={v => set({ virtualHost: v })} />
        </Field>
        <Field label="User name">
          <TextInput value={form.userName} onChange={v => set({ userName: v })} />
        </Field>
      </div>

      <Field label="Password">
        <SecretInput value={form.password ?? ''} onChange={v => set({ password: v || null })} isSet={remote?.passwordSet} />
      </Field>

      <div className="space-y-2">
        <Toggle checked={form.useTls} onChange={v => set({ useTls: v })} label="Use TLS" />
        {form.useTls && (
          <div className="grid grid-cols-2 gap-4 pl-4">
            <Field label="TLS version">
              <select
                value={form.tlsVersion}
                onChange={e => set({ tlsVersion: e.target.value })}
                className="w-full rounded-control border border-cr-border bg-cr-bg-deep px-2 py-2 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
              >
                {['Tls', 'Tls11', 'Tls12', 'Tls13'].map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Server name (SNI)">
              <TextInput value={form.serverName ?? ''} onChange={v => set({ serverName: v || null })} />
            </Field>
            <Field label="CA cert path">
              <TextInput value={form.caCertPath ?? ''} onChange={v => set({ caCertPath: v || null })} placeholder="/certs/ca.pem" />
            </Field>
            <Field label="Client cert path (.pfx)">
              <TextInput value={form.clientCertPath ?? ''} onChange={v => set({ clientCertPath: v || null })} />
            </Field>
            <Field label="Client cert password">
              <SecretInput value={form.clientCertPassword ?? ''} onChange={v => set({ clientCertPassword: v || null })} isSet={remote?.clientCertPasswordSet} optional />
            </Field>
            <div className="flex items-start gap-2 col-span-2">
              <Toggle
                checked={form.allowUntrustedRoot}
                onChange={v => set({ allowUntrustedRoot: v })}
                label=""
              />
              <span className={cn('flex items-center gap-1 text-xs', form.allowUntrustedRoot ? 'text-cr-major' : 'text-cr-muted')}>
                <TriangleAlert size={13} strokeWidth={1.75} aria-hidden />
                Allow untrusted root — TEST ONLY
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Exchange">
          <TextInput value={form.exchange} onChange={v => set({ exchange: v })} />
        </Field>
        <Field label="Exchange type">
          <TextInput value={form.exchangeType} onChange={v => set({ exchangeType: v })} placeholder="topic" />
        </Field>
        <Field label="Routing key" hint="Single routing key used for all CCTV messages.">
          <TextInput value={form.defaultRoutingKey} onChange={v => set({ defaultRoutingKey: v })} placeholder="cctv.sacs.queue" />
        </Field>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          aria-busy={saveMut.isPending}
          className="inline-flex items-center gap-2 rounded-control border border-cr-info/40 bg-cr-info/10 px-4 py-2 text-xs text-cr-info hover:bg-cr-info/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveMut.isPending && <LoaderCircle size={13} className="animate-spin" />}
          {saveMut.isPending ? 'Saving...' : 'Save'}
        </button>

        <button
          onClick={handleTest}
          disabled={testState === 'testing'}
          aria-busy={testState === 'testing'}
          className="inline-flex items-center gap-2 rounded-control border border-cr-border bg-cr-panel px-4 py-2 text-xs text-cr-muted hover:text-cr-text disabled:opacity-40"
        >
          {testState === 'testing' && <LoaderCircle size={13} className="animate-spin" />}
          {testState === 'testing' ? 'Testing...' : 'Test connection'}
        </button>

        {testState === 'ok' && <span className="text-xs text-cr-ok">Connection OK</span>}
        {testState === 'err' && <span className="font-mono text-xs text-cr-critical">{testError}</span>}
      </div>
    </div>
  )
}

// ── System Settings page ────────────────────────────────────────────────────
export default function SystemSettings() {
  const [tab, setTab] = useState<'prowatch' | 'rabbit'>('prowatch')

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-base font-semibold text-cr-text">System Settings</h1>

      {/* Tabs */}
      <div className="flex border-b border-cr-border">
        {(['prowatch', 'rabbit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors',
              tab === t
                ? 'border-b-2 border-cr-info text-cr-info'
                : 'text-cr-muted hover:text-cr-text',
            )}
          >
            {t === 'prowatch' ? 'Pro-Watch (SAC)' : 'RabbitMQ (CCTV/AMQPS)'}
          </button>
        ))}
      </div>

      <div className="rounded-card border border-cr-border bg-cr-panel p-6">
        {tab === 'prowatch' ? <ProWatchForm /> : <RabbitForm />}
      </div>
    </div>
  )
}
