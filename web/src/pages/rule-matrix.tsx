import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, LoaderCircle } from 'lucide-react'
import { mappingApi } from '@/lib/api'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { cn } from '@/lib/utils'
import type { MappingRuleDto, Severity } from '@/lib/types'

let nextTempId = -1  // Negative IDs for new rows (not yet persisted)

const SEVERITY_LABELS: Record<Severity, string> = { 0: 'Critical', 1: 'Major', 2: 'Minor' }

// ── Editable rule row ───────────────────────────────────────────────────────
function RuleRow({
  rule,
  onChange,
  onDelete,
}: {
  rule: MappingRuleDto
  onChange: (r: MappingRuleDto) => void
  onDelete: () => void
}) {
  const set = (patch: Partial<MappingRuleDto>) => onChange({ ...rule, ...patch })

  const inputCls = 'w-full rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1 font-mono text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info placeholder:text-cr-dim'

  return (
    <tr className="border-b border-cr-border-subtle text-xs hover:bg-cr-panel-raised">
      <td className="px-2 py-2">
        <input
          type="number"
          value={rule.order}
          onChange={e => set({ order: Number(e.target.value) })}
          className={cn(inputCls, 'w-16')}
          aria-label="Order"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={rule.name}
          onChange={e => set({ name: e.target.value })}
          className={inputCls}
          placeholder="Rule name"
          aria-label="Name"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={e => set({ enabled: e.target.checked })}
          className="h-4 w-4 accent-cr-info"
          aria-label="Enabled"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={rule.matchEventType ?? ''}
          onChange={e => set({ matchEventType: e.target.value || null })}
          className={inputCls}
          placeholder="(any)"
          aria-label="Match event type"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={rule.matchEventCode ?? ''}
          onChange={e => set({ matchEventCode: e.target.value || null })}
          className={inputCls}
          placeholder="(any)"
          aria-label="Match event code"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={rule.cameraIps ?? ''}
          onChange={e => set({ cameraIps: e.target.value || null })}
          className={inputCls}
          placeholder="10.0.0.1,10.0.0.2"
          aria-label="Camera IPs"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={rule.severityLevel}
          onChange={e => set({ severityLevel: Number(e.target.value) as Severity })}
          className="rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
          aria-label="Severity"
        >
          {([0, 1, 2] as Severity[]).map(s => (
            <option key={s} value={s}>{s} — {SEVERITY_LABELS[s]}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <button
          onClick={onDelete}
          className="text-cr-muted hover:text-cr-critical"
          aria-label="Delete rule"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  )
}

// ── Rule Matrix page ────────────────────────────────────────────────────────
export default function RuleMatrix() {
  const qc = useQueryClient()
  const { data: remote = [] } = useQuery({
    queryKey: ['mapping-rules'],
    queryFn: mappingApi.list,
  })

  const [rules, setRules] = useState<MappingRuleDto[]>([])
  const [dirty, setDirty] = useState(false)

  // Sync from server on first load / refetch
  useEffect(() => {
    if (!dirty) setRules(remote)
  }, [remote, dirty])

  const saveMut = useMutation({
    mutationFn: () => mappingApi.replaceAll(rules),
    onSuccess: () => {
      toast.success('Mapping rules saved')
      setDirty(false)
      void qc.invalidateQueries({ queryKey: ['mapping-rules'] })
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`, { duration: 7000 }),
  })

  const update = (idx: number, r: MappingRuleDto) => {
    setRules(prev => prev.map((p, i) => (i === idx ? r : p)))
    setDirty(true)
  }

  const addRule = () => {
    setRules(prev => [
      ...prev,
      {
        id: nextTempId--,
        order: (prev[prev.length - 1]?.order ?? 0) + 10,
        name: 'New rule',
        enabled: true,
        matchEventType: null,
        matchEventCode: null,
        cameraIps: null,
        severityLevel: 1,
      },
    ])
    setDirty(true)
  }

  const deleteRule = (idx: number) => {
    setRules(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs text-cr-muted">
        Event → CCTV mapping rules. Alarm-only. Top-down by Order; first match wins. Empty fields = wildcard.
        Routing key is global (set in RabbitMQ settings) — rules control matching, severity, and camera IPs.
      </p>

      <div className="rounded-card border border-cr-border bg-cr-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-cr-border bg-cr-bg-deep text-left">
                {['Ord','Name','On','Match Type','Match Code','Camera IPs','Severity',''].map(h => (
                  <th key={h} className="px-2 py-2 text-2xs font-medium uppercase tracking-wide text-cr-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-cr-dim">
                    No rules defined. Click &quot;Add rule&quot; to create one.
                  </td>
                </tr>
              )}
              {rules.map((r, i) => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  onChange={upd => update(i, upd)}
                  onDelete={() => deleteRule(i)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-cr-border px-4 py-3">
          <button
            onClick={addRule}
            className="inline-flex items-center gap-1.5 rounded-control border border-cr-border bg-cr-panel px-3 py-1.5 text-xs text-cr-muted hover:text-cr-text"
          >
            <Plus size={14} strokeWidth={1.75} />
            Add rule
          </button>

          <div className="flex items-center gap-3">
            {dirty && <span className="text-2xs text-cr-warn">Unsaved changes</span>}
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !dirty}
              aria-busy={saveMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-control border border-cr-info/40 bg-cr-info/10 px-4 py-1.5 text-xs text-cr-info hover:bg-cr-info/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveMut.isPending && <LoaderCircle size={12} className="animate-spin" />}
              {saveMut.isPending ? 'Saving...' : 'Save rules'}
            </button>
          </div>
        </div>
      </div>

      {/* Severity legend */}
      <div className="flex items-center gap-3">
        <span className="text-2xs text-cr-muted">Severity:</span>
        {([0, 1, 2] as Severity[]).map(s => <SeverityBadge key={s} level={s} />)}
      </div>
    </div>
  )
}
