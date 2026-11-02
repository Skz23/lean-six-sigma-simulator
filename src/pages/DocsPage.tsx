import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import hypotheses from '../../docs/HYPOTHESES.md?raw'
import formules from '../../docs/FORMULES.md?raw'
import { Card, PageHeader, Tabs } from '../components/ui'

/** Rendu Markdown minimal (titres, listes, tableaux, code, gras, code en ligne). */
function inline(s: string): React.ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>
    if (p.startsWith('`')) return <code key={i} className="rounded bg-black/5 px-1 text-[0.9em] dark:bg-white/10">{p.slice(1, -1)}</code>
    if (p.startsWith('*') && p.length > 2) return <i key={i}>{p.slice(1, -1)}</i>
    return p
  })
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      out.push(<pre key={i} className="my-3 overflow-x-auto rounded-lg bg-black/[.04] p-3 text-xs leading-relaxed dark:bg-white/[.06]">{code.join('\n')}</pre>)
      i++
    } else if (l.startsWith('# ')) {
      out.push(<h1 key={i} className="mb-3 text-xl font-semibold">{l.slice(2)}</h1>)
      i++
    } else if (l.startsWith('## ')) {
      out.push(<h2 key={i} className="mt-6 mb-2 text-base font-semibold text-brand-700 dark:text-brand-300">{l.slice(3)}</h2>)
      i++
    } else if (l.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s|:-]+\|$/.test(lines[i])) rows.push(lines[i].slice(1, -1).split('|').map((c) => c.trim()))
        i++
      }
      out.push(
        <div key={i} className="my-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-black/10 dark:border-white/10">{rows[0].map((c, j) => <th key={j} className="px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)]">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.slice(1).map((r, k) => <tr key={k} className="border-b border-black/[.05] dark:border-white/[.06]">{r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
    } else if (/^\s*- /.test(l)) {
      const items: string[] = []
      while (i < lines.length && /^\s*- /.test(lines[i])) items.push(lines[i++].replace(/^\s*- /, ''))
      out.push(<ul key={i} className="my-2 list-disc space-y-1 pl-5 text-sm">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>)
    } else if (l.trim()) {
      out.push(<p key={i} className="my-2 text-sm leading-relaxed">{inline(l)}</p>)
      i++
    } else i++
  }
  return <div>{out}</div>
}

export default function DocsPage() {
  const [tab, setTab] = useState<'h' | 'f'>('h')
  return (
    <div>
      <PageHeader icon={<BookOpen size={20} />} title="Hypothèses & formules" subtitle="Documentation du modèle de simulation et des calculs — transparence totale sur les résultats" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'h', label: 'Hypothèses du modèle' }, { id: 'f', label: 'Formules et méthodes' }]} />
      <Card bodyClass="p-5 max-w-4xl">
        <Markdown text={tab === 'h' ? hypotheses : formules} />
      </Card>
    </div>
  )
}
