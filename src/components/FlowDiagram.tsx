import clsx from 'clsx'
import { useState } from 'react'
import { ArrowRight, GripVertical, Users, Warehouse } from 'lucide-react'
import type { Scenario } from '../engine/types'
import { fmt, pct } from '../lib/format'

/** Représentation des postes et des flux, avec réordonnancement par glisser-déposer. */
export function FlowDiagram({ sc, selected, onSelect, onReorder, bottleneck, buffers }: { sc: Scenario; selected?: string; onSelect?: (id: string) => void; onReorder?: (from: number, to: number) => void; bottleneck?: number; buffers?: number[] }) {
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-0">
        <div className="flex flex-col items-center justify-center px-2 text-[11px] text-[var(--muted)]">
          <Warehouse size={20} />
          <span className="mt-1">Matière</span>
        </div>
        {sc.stations.map((s, i) => (
          <div key={s.id} className="flex items-stretch">
            <div className="flex flex-col items-center justify-center px-1 text-[var(--muted)]">
              <ArrowRight size={16} />
            </div>
            <div
              draggable={!!onReorder}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(i)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={() => {
                if (drag !== null && drag !== i) onReorder?.(drag, i)
                setDrag(null)
                setOver(null)
              }}
              onDragEnd={() => {
                setDrag(null)
                setOver(null)
              }}
              onClick={() => onSelect?.(s.id)}
              className={clsx(
                'relative w-40 cursor-pointer rounded-xl border-2 bg-[var(--surface-1)] p-2.5 text-left transition-all',
                selected === s.id ? 'border-brand-500 shadow-md' : 'border-black/10 hover:border-black/25 dark:border-white/15 dark:hover:border-white/30',
                bottleneck === i && 'ring-2 ring-[var(--critical)]/60 ring-offset-1 ring-offset-[var(--surface-1)]',
                over === i && drag !== i && 'border-dashed border-brand-500',
                drag === i && 'opacity-50',
              )}
            >
              <div className="flex items-start gap-1">
                {onReorder && <GripVertical size={14} className="mt-0.5 shrink-0 cursor-grab text-[var(--muted)]" />}
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-[var(--muted)]">
                    {s.id} {!s.valueAdded && '· NVA'} {sc.process.stationId === s.id && '· CTQ'}
                  </div>
                  <div className="truncate text-sm font-semibold" title={s.name}>
                    {s.name}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-secondary)] tabular">
                <span>CT</span>
                <span className="text-right font-medium text-[var(--text-primary)]">{fmt(s.cycleTime, 0)} s</span>
                <span>C/O</span>
                <span className="text-right">{fmt(s.changeoverTime, 0)} min</span>
                <span>Dispo.</span>
                <span className="text-right">{pct(s.availability, 0)}</span>
                <span>Défauts</span>
                <span className="text-right">{pct(s.defectRate, 1)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <Users size={12} /> {s.operators} · ×{s.capacity}
              </div>
              {bottleneck === i && <span className="absolute top-1.5 right-1.5 rounded-full bg-[var(--critical)] px-1.5 py-0.5 text-[9px] font-bold text-white">GOULOT</span>}
            </div>
            {i < sc.stations.length - 1 ? (
              <div className="flex w-16 flex-col items-center justify-center gap-0.5 text-center">
                <svg viewBox="0 0 30 26" className="h-6 w-7">
                  <polygon points="15,2 28,24 2,24" fill="var(--warning)" fillOpacity={0.25} stroke="var(--warning)" strokeWidth={1.5} />
                  <text x="15" y="20" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-primary)">
                    I
                  </text>
                </svg>
                <span className="text-[10px] leading-tight text-[var(--text-secondary)] tabular">{buffers ? `${fmt(buffers[i], 0)} / ` : ''}{s.bufferCapacity}</span>
                <span className="text-[9px] text-[var(--muted)]">{s.distanceToNext} m</span>
              </div>
            ) : (
              <div className="flex w-16 flex-col items-center justify-center text-center text-[10px] text-[var(--muted)]">
                <ArrowRight size={16} />
                <span>Client</span>
                <span>{sc.demand}/j</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
