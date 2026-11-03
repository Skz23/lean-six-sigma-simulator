import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { LESSONS } from '../workflow/lessons'

const KEY = 'lss-lesson-open'
const load = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Rappel de cours d'un outil : l'essentiel visible, le « comment faire » dépliable. */
export function LessonBox({ id }: { id: string }) {
  const l = LESSONS[id]
  const [open, setOpen] = useState(load)
  if (!l) return null
  const toggle = () => {
    const v = !open
    setOpen(v)
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch {
      /* préférence non mémorisée */
    }
  }
  return (
    <div className="no-print mb-4 rounded-xl border border-brand-500/25 bg-brand-500/[.04]">
      <button onClick={toggle} className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left" aria-expanded={open}>
        <BookOpen size={16} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" />
        <span className="min-w-0 flex-1 text-sm">
          <b className="text-brand-700 dark:text-brand-300">Rappel de cours · </b>
          {l.why}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--text-secondary)]">
          <span className="hidden sm:inline">{open ? 'Masquer' : 'Comment faire'}</span>
          <ChevronDown size={15} className={clsx('transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-brand-500/15 px-3.5 py-3 text-sm md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Comment faire</div>
            <ol className="list-decimal space-y-1 pl-5">
              {l.how.map((h) => <li key={h}>{h}</li>)}
            </ol>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">À savoir</div>
            <ul className="list-disc space-y-1 pl-5 text-[var(--text-secondary)]">
              {l.tips.map((h) => <li key={h}>{h}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
