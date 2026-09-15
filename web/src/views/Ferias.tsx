import { ChevronLeft, ChevronRight, FileSpreadsheet, Pencil, Plus, Trash2, Undo2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Banner, Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import { AvatarCircles } from '@/components/ui/avatar-circles'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { dayOf, monthGrid } from '@/lib/calendar'
import { comboText, useHotkey } from '@/lib/hotkey'
import { errorText, useAsync } from '@/lib/useAsync'
import { stagger } from '@/lib/motion'
import { cn, memberColour, monthName, ptDate, teamTag, WEEKDAYS_SHORT } from '@/lib/utils'
import { absences as absencesApi, holidays as holidaysApi, imports as importsApi, teams as teamsApi, users as usersApi } from '@/services'
import type { Absence, CommitReport, ImportPreview, PreviewRow, Team, User } from '@/services/types'

type Tab = 'calendario' | 'lista' | 'importacoes'

/**
 * How many bands a day cell holds before it starts counting instead.
 *
 * The rows are `auto-rows-fr`, so every cell in the month is as tall as the fullest
 * one: whatever the busiest day costs, the other thirty pay too. Six is about what a
 * cell can show and still leave a month readable on one screen.
 */
const CELL_BANDS = 6

/** How many names the colour key holds before it counts the rest, as on the dashboard. */
const LEGEND_NAMES = 10

const OUTCOME_TONE = {
  NEW: 'ok', UNCHANGED: 'muted', UPDATE: 'info', CONFLICT: 'warn', UNMATCHED: 'danger'
} as const
const OUTCOME_LABEL = {
  NEW: 'NOVA', UNCHANGED: 'IGUAL', UPDATE: 'ALTERADA', CONFLICT: 'CONFLITO', UNMATCHED: 'SEM CORRESPONDÊNCIA'
} as const

function CalendarTab({ month, year, setMonth, absences, people, teams, rosters, holidayDates }: {
  month: number
  year: number
  setMonth: (shift: number) => void
  absences: Absence[]
  people: User[]
  /** Every commitment, because a day short for any of them is worth flagging. */
  teams: Team[]
  /** Who is on each commitment, by team id. */
  rosters: Map<number, number[]>
  holidayDates: Map<string, string>
}) {
  const awayOn = (iso: string, userId: number) =>
    absences.some((a) => a.user.id === userId && a.startDate <= iso && a.endDate >= iso)

  /**
   * Only the people who are actually away this month get a slot.
   *
   * Every person keeps a fixed row so overlapping absences read as horizontal bands
   * across the week, but reserving a row for all ten of them made a cell 208 pixels
   * tall to show three bands. The alignment is what matters, not the roll call.
   */
  const active = people.filter((person) =>
    monthGrid(year, month).some((iso) => iso !== null && awayOn(iso, person.id))
  )

  /**
   * Which commitments want this date, and whether enough of their roster is free.
   *
   * Counted per commitment rather than over everyone: six people free is plenty for
   * the office and one short for the client, and averaging the two would hide both.
   */
  const wanting = (iso: string) => {
    if (holidayDates.has(iso)) return []
    const weekday = new Date(iso + 'T00:00:00Z').getUTCDay()
    return teams.filter((team) => team.onSiteWeekday % 7 === weekday)
  }

  const shortFor = (iso: string) =>
    wanting(iso).filter((team) => {
      const free = (rosters.get(team.id) ?? []).filter((id) => !awayOn(iso, id))
      return free.length < team.requiredOnSite
    })

  const short = monthGrid(year, month).filter((iso): iso is string => Boolean(iso) && shortFor(iso!).length > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-[31px] items-center rounded border border-line">
            <button
              onClick={() => setMonth(-1)}
              aria-label="Mês anterior"
              title={`Mês anterior · ${comboText('arrowleft')}`}
              className="flex h-full items-center px-2.5 text-fg-muted hover:text-fg-strong"
            >
              <ChevronLeft size={15} strokeWidth={1.6} />
            </button>
            <span className="border-x border-line px-3 font-mono text-[12.5px] font-semibold uppercase leading-[29px] text-fg-strong">
              {monthName(month)} {year}
            </span>
            <button
              onClick={() => setMonth(1)}
              aria-label="Mês seguinte"
              title={`Mês seguinte · ${comboText('arrowright')}`}
              className="flex h-full items-center px-2.5 text-fg-muted hover:text-fg-strong"
            >
              <ChevronRight size={15} strokeWidth={1.6} />
            </button>
          </div>
          {short.length > 0 && (
            <Badge tone="warn">
              {short.length} {short.length === 1 ? 'DIA' : 'DIAS'} SEM EQUIPA COMPLETA
            </Badge>
          )}
        </div>
        {/* Wraps, and is allowed to shrink. Held on one line it grew with the
            roster until it was three times the width of the card: the names past
            the edge were unreachable, because the shell hides the overflow rather
            than scrolling it, and on the way out it squeezed the month stepper
            beside it into two lines. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
          {active.slice(0, LEGEND_NAMES).map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 text-xs text-fg">
              <i className="h-[11px] w-[11px] rounded-sm not-italic" style={{ background: memberColour(m.id) }} />
              {m.forename}
            </span>
          ))}
          {active.length > LEGEND_NAMES && (
            <span className="font-mono text-[11px] text-fg-faint">+{active.length - LEGEND_NAMES}</span>
          )}
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="pl-1 font-mono text-[9.5px] font-semibold tracking-[0.1em] text-fg-faint">
            {d.toUpperCase()}
          </span>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
        {monthGrid(year, month).map((iso, index) => {
          if (!iso) return <div key={index} />
          const holiday = holidayDates.get(iso)
          const onSite = wanting(iso)
          const isOnSite = onSite.length > 0
          const lacking = shortFor(iso)
          const understaffed = lacking.length > 0
          // Fixed rows while the roster fits the cell, and only the people actually
          // away once it does not.
          const aligned = active.length <= CELL_BANDS
          const inCell = aligned ? active : active.filter((m) => awayOn(iso, m.id))
          const bands = inCell.slice(0, CELL_BANDS)
          const more = inCell.slice(CELL_BANDS)
          return (
            <div
              key={iso}
              style={stagger(index, 14, 34)}
              className={cn(
                'animate-rise flex min-h-0 flex-col gap-[3px] overflow-hidden rounded border border-line-soft p-1.5',
                isOnSite && !holiday && 'border-[var(--monln)] bg-[var(--monbg)]',
                understaffed && 'border-warn-line bg-warn-bg',
                holiday && 'hatch'
              )}
            >
              <div className="flex h-3.5 min-w-0 items-center justify-between gap-1">
                <span
                  className={cn(
                    'font-mono text-[11.5px] text-fg-soft',
                    isOnSite && !holiday && 'font-semibold text-fg-strong',
                    holiday && 'text-fg-faint line-through'
                  )}
                >
                  {dayOf(iso)}
                </span>
                <span
                  title={holiday || undefined}
                  className={cn(
                    'truncate font-mono text-[8px] font-semibold tracking-[0.1em]',
                    understaffed ? 'text-warn' : 'text-fg-muted'
                  )}
                >
                  {holiday
                    ? 'FERIADO'
                    : understaffed
                      ? lacking.map((t) => teamTag(t.name)).join(' ')
                      : isOnSite
                        ? onSite.map((t) => teamTag(t.name)).join(' ')
                        : ''}
                </span>
              </div>
              {/* Each member keeps the same vertical slot, so overlapping absences
                  read as horizontal bands across the week.

                  That alignment costs one slot per member in every cell whether they
                  are away or not, so the cell is priced by the roster rather than by
                  the absences in it: forty people made every cell eight hundred
                  pixels tall, most of it empty. Past what a cell can hold the bands
                  give up their fixed rows and only the people actually away are
                  drawn — the alignment is worth having, but not at the price of a
                  calendar nobody can see a month of. */}
              {bands.map((m) => {
                const away = awayOn(iso, m.id)
                // The slot is always rendered so each member keeps the same row and
                // absences line up across the week, but an empty one carries no text:
                // a hidden name would still be read out and copied with the page.
                if (!away) return <div key={m.id} className="h-[15px] shrink-0" aria-hidden />
                return (
                  <div
                    key={m.id}
                    className={
                      'flex h-[15px] shrink-0 origin-left animate-grow items-center rounded-sm ' +
                      'border-l-2 px-1.5 font-mono text-[8.5px] font-semibold text-fg-strong'
                    }
                    style={{
                      background: `color-mix(in srgb, ${memberColour(m.id)} 22%, transparent)`,
                      borderLeftColor: memberColour(m.id),
                      animationDelay: `${140 + index * 12}ms`
                    }}
                  >
                    {m.forename}
                  </div>
                )
              })}
              {more.length > 0 && <AvatarCircles users={more} limit={CELL_BANDS} size={13} className="pl-1" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PreviewPanel({ preview, people, teams, onCancel, onCommitted }: {
  preview: ImportPreview
  people: User[]
  teams: Team[]
  onCancel: () => void
  onCommitted: () => void
}) {
  const navigate = useNavigate()
  const [rows, setRows] = useState(
    preview.rows.map((r) => ({ ...r, apply: r.outcome !== 'CONFLICT' && r.outcome !== 'UNMATCHED' }))
  )
  const [busy, setBusy] = useState(false)
  // The report of a commit that found contradictions. Held here rather than only in
  // a toast because the panel is where the person who can fix the plan is standing:
  // closing it on success would send the warning away with the work it belongs to.
  const [report, setReport] = useState<CommitReport | null>(null)

  const update = (line: number, patch: Partial<PreviewRow & { apply: boolean }>) =>
    setRows((all) => all.map((r) => (r.line === line ? { ...r, ...patch } : r)))

  async function commit() {
    setBusy(true)
    try {
      const result = await importsApi.commit(
        preview.importId,
        rows.map((r) => ({
          line: r.line, name: r.name, startDate: r.startDate, endDate: r.endDate,
          userId: r.userId, apply: r.apply
        }))
      )
      toast.success(
        `${result.inserted} novas, ${result.updated} alteradas, ${result.unchanged} sem mudança, ${result.skipped} ignoradas.`
      )
      // Contradictions keep the panel open: they are not a failure of the import,
      // but they are not nothing either, and a toast cannot hold a list of days.
      if (result.conflicts.length > 0) {
        setReport(result)
      } else {
        onCommitted()
      }
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const conflictText = (userId: number, date: string, teamId: number) => {
    const person = people.find((p) => p.id === userId)?.displayName ?? `elemento ${userId}`
    const team = teams.find((t) => t.id === teamId)?.name
    return `${person} — ${ptDate(date)}${team ? ` (${team})` : ''}`
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet size={16} strokeWidth={1.6} className="text-ok" />
          <span className="text-[13px] font-semibold text-fg-strong">{preview.filename}</span>
          <span className="font-mono text-[11px] text-fg-soft">
            {Object.entries(preview.summary).map(([k, v]) => `${v} ${OUTCOME_LABEL[k as keyof typeof OUTCOME_LABEL].toLowerCase()}`).join(' · ')}
          </span>
        </div>
        <div className="flex gap-2">
          {report ? (
            <Button variant="default" onClick={onCommitted}>FECHAR</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onCancel} disabled={busy}>CANCELAR</Button>
              <Button variant="default" onClick={commit} disabled={busy}>APLICAR</Button>
            </>
          )}
        </div>
      </div>

      {/* The commit is done and stays done; this is what it left behind. The import
          never touches the plan, so the day is named for the person to go and look. */}
      {report && report.conflicts.length > 0 && (
        <div className="border-b border-line-soft px-4 py-2.5">
          <Banner>
            <span>
              Aplicado, mas o plano publicado põe em dia de férias:{' '}
              {report.conflicts.map((c) => conflictText(c.userId, c.date, c.teamId)).join('; ')}.{' '}
              O plano não foi alterado —{' '}
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={() => navigate('/plano')}
              >
                ver o plano
              </button>
            </span>
          </Banner>
        </div>
      )}

      {preview.rejected.length > 0 && (
        <div className="border-b border-line-soft px-4 py-2.5">
          <Banner>
            {preview.rejected.length} {preview.rejected.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}:{' '}
            {preview.rejected.map((r) => `linha ${r.line} (${r.reason})`).join(', ')}
          </Banner>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="table-fixed" minWidth={940}>
          <colgroup>
            <col className="w-[60px]" /><col /><col className="w-[210px]" />
            <col className="w-[190px]" /><col className="w-[190px]" /><col className="w-[90px]" />
          </colgroup>
          <thead>
            <tr>
              <Th>LINHA</Th><Th>NOME NO FICHEIRO</Th><Th>PERÍODO</Th>
              <Th>SUBSTITUI</Th><Th>RESULTADO</Th><Th>APLICAR</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.line}>
                <Td className="font-mono text-fg-soft">{row.line}</Td>
                <Td className="text-fg-strong">{row.name}</Td>
                <Td className="font-mono">{ptDate(row.startDate)} a {ptDate(row.endDate)}</Td>
                <Td className="font-mono text-fg-muted">
                  {row.existingStartDate ? `${ptDate(row.existingStartDate)} a ${ptDate(row.existingEndDate!)}` : '—'}
                </Td>
                <Td>
                  {row.outcome === 'UNMATCHED' ? (
                    <Select
                      value={row.userId ?? ''}
                      onChange={(e) =>
                        update(row.line, {
                          userId: e.target.value ? Number(e.target.value) : null,
                          apply: Boolean(e.target.value)
                        })
                      }
                      className="w-full"
                    >
                      <option value="">Escolher elemento</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>{person.displayName}</option>
                      ))}
                    </Select>
                  ) : (
                    <Badge tone={OUTCOME_TONE[row.outcome]}>{OUTCOME_LABEL[row.outcome]}</Badge>
                  )}
                </Td>
                <Td className="text-right">
                  <input
                    type="checkbox"
                    aria-label={`Aplicar linha ${row.line}`}
                    checked={row.apply}
                    disabled={row.outcome === 'UNMATCHED' && !row.userId}
                    onChange={(e) => update(row.line, { apply: e.target.checked })}
                    className="h-4 w-4 accent-[var(--acc)]"
                  />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      {preview.missing.length > 0 && (
        <div className="border-t border-line-soft px-4 py-3 text-xs text-fg-muted">
          <b className="font-semibold text-fg-strong">Já não constam do ficheiro, e não são apagadas:</b>{' '}
          {preview.missing.map((a) => `${a.user.displayName} ${ptDate(a.startDate)} a ${ptDate(a.endDate)}`).join('; ')}.
        </div>
      )}
    </Card>
  )
}

export function Ferias() {
  const { user } = useAuth()
  const now = new Date()
  const [tab, setTab] = useState<Tab>('calendario')
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [editing, setEditing] = useState<Absence | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // No commitment is selected here. An absence belongs to a person: if someone is
  // on holiday they are away from the office and from the client at once, so this
  // page is about everybody. The commitments are still loaded, but only to say which
  // of them a given day would leave short.
  const base = useAsync(async () => {
    const [people, teams, list, history, hol] = await Promise.all([
      usersApi.list(),
      teamsApi.list(),
      absencesApi.list(),
      importsApi.history(),
      holidaysApi.byYear(cursor.year)
    ])
    const rosters = new Map(
      await Promise.all(
        teams.map(async (t) => [
          t.id,
          (await teamsApi.members(t.id)).filter((m) => !m.leftAt).map((m) => m.user.id)
        ] as const)
      )
    )
    return { people, teams, rosters, list, history, holidays: hol }
  }, [cursor.year])

  const holidayDates = useMemo(
    () => new Map((base.data?.holidays ?? []).map((h) => [h.date, h.name])),
    [base.data]
  )

  const shiftMonth = (shift: number) => {
    setCursor(({ year, month }) => {
      const next = month + shift
      if (next < 1) return { year: year - 1, month: 12 }
      if (next > 12) return { year: year + 1, month: 1 }
      return { year, month: next }
    })
  }

  // The stepper's keys, and only on the tab that has a stepper: the other two are
  // lists, and an arrow that moved something off screen there would be a key that
  // did something nobody could see.
  useHotkey('arrowleft', () => shiftMonth(-1), { enabled: tab === 'calendario' })
  useHotkey('arrowright', () => shiftMonth(1), { enabled: tab === 'calendario' })

  async function act<T>(work: () => Promise<T>, done: string) {
    setBusy(true)
    try {
      await work()
      toast.success(done)
      base.reload()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File) {
    setBusy(true)
    try {
      setPreview(await importsApi.upload(file))
      setTab('importacoes')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'calendario', label: 'CALENDÁRIO' },
    { id: 'lista', label: 'LISTA', count: base.data?.list.length },
    { id: 'importacoes', label: 'IMPORTAÇÕES', count: base.data?.history.length }
  ]

  return (
    <Shell
      title="Férias"
      actions={
        <>
          <Button onClick={() => setAdding(true)}>
            <Plus size={14} strokeWidth={1.6} />
            ADICIONAR
          </Button>
          {user?.isAdmin && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <Button variant="default" disabled={busy} onClick={() => fileInput.current?.click()}>
                <Upload size={14} strokeWidth={1.6} />
                IMPORTAR EXCEL
              </Button>
            </>
          )}
        </>
      }
    >
      {base.error && <Badge tone="danger">{base.error}</Badge>}

      <div className="-mb-px flex gap-0.5 border-b border-line-soft">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent px-3.5 pb-2.5',
              'font-mono text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg-strong',
              tab === t.id && 'border-b-accent text-fg-strong'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <b
                className={cn(
                  'rounded-full bg-elev px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-fg-muted',
                  tab === t.id && 'bg-accent-bg text-fg-strong'
                )}
              >
                {t.count}
              </b>
            )}
          </button>
        ))}
      </div>

      {adding && base.data && (
        <AbsenceForm
          people={base.data.people}
          canPickAnyone={Boolean(user?.isAdmin)}
          defaultUserId={user!.id}
          onCancel={() => setAdding(false)}
          onSave={(body) => act(() => absencesApi.create(body).then(() => setAdding(false)), 'Ausência criada.')}
        />
      )}

      {editing && base.data && (
        <AbsenceForm
          people={base.data.people}
          canPickAnyone={false}
          defaultUserId={editing.user.id}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(body) =>
            act(
              () => absencesApi.update(editing.id, body).then(() => setEditing(null)),
              'Ausência atualizada.'
            )
          }
        />
      )}

      {base.loading && <Skeleton className="min-h-0 flex-1" />}

      {!base.loading && base.data && tab === 'calendario' && (
        <CalendarTab
          month={cursor.month}
          year={cursor.year}
          setMonth={shiftMonth}
          absences={base.data.list}
          people={base.data.people}
          teams={base.data.teams}
          rosters={base.data.rosters}
          holidayDates={holidayDates}
        />
      )}

      {!base.loading && tab === 'lista' && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Table className="table-fixed">
            <colgroup>
              <col /><col className="w-[120px]" /><col className="w-[120px]" /><col className="w-[70px]" />
              <col className="w-[100px]" /><col className="w-[170px]" /><col className="w-[90px]" />
            </colgroup>
            <thead>
              <tr>
                <Th>ELEMENTO</Th><Th>INÍCIO</Th><Th>FIM</Th><Th className="text-right">DIAS</Th>
                <Th>TIPO</Th><Th>ORIGEM</Th><Th />
              </tr>
            </thead>
            <tbody>
              {!base.data?.list.length && (
                <tr>
                  <td colSpan={7}>
                    <Empty title="Sem ausências registadas." hint="Importe o mapa de férias ou adicione à mão." />
                  </td>
                </tr>
              )}
              {base.data?.list.map((absence, index) => {
                const mine = absence.user.id === user?.id
                return (
                  <Tr key={absence.id} className="animate-rise" style={stagger(index)}>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar user={absence.user} className="h-[18px] w-[18px] text-[8px]" />
                        {absence.user.displayName}
                      </span>
                    </Td>
                    <Td className="font-mono">{ptDate(absence.startDate)}</Td>
                    <Td className="font-mono">{ptDate(absence.endDate)}</Td>
                    <Td className="text-right font-mono text-fg-muted">{absence.days}</Td>
                    <Td><Badge>{absence.kind === 'VACATION' ? 'FÉRIAS' : 'OUTRO'}</Badge></Td>
                    <Td>
                      {absence.source === 'IMPORT' ? (
                        <Badge tone={absence.manuallyEdited ? 'warn' : 'ok'}>
                          {absence.manuallyEdited ? 'EXCEL · EDITADO' : 'EXCEL'}
                        </Badge>
                      ) : (
                        <Badge tone="info">MANUAL</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {(user?.isAdmin || mine) && (
                        <>
                          <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(absence)}>
                            <Pencil size={14} strokeWidth={1.6} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Remover"
                            disabled={busy}
                            onClick={() => act(() => absencesApi.remove(absence.id), 'Ausência removida.')}
                          >
                            <Trash2 size={14} strokeWidth={1.6} />
                          </Button>
                        </>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {!base.loading && tab === 'importacoes' && preview && base.data && (
        <PreviewPanel
          preview={preview}
          people={base.data.people}
          teams={base.data.teams}
          onCancel={() => act(() => importsApi.discard(preview.importId).then(() => setPreview(null)), 'Importação descartada.')}
          onCommitted={() => { setPreview(null); base.reload() }}
        />
      )}

      {!base.loading && tab === 'importacoes' && !preview && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Table className="table-fixed" minWidth={700}>
            <colgroup>
              <col /><col className="w-[180px]" /><col className="w-[100px]" /><col className="w-[150px]" /><col className="w-[90px]" />
            </colgroup>
            <thead>
              <tr>
                <Th>FICHEIRO</Th><Th>CARREGADO</Th><Th className="text-right">LINHAS</Th><Th>ESTADO</Th><Th />
              </tr>
            </thead>
            <tbody>
              {!base.data?.history.length && (
                <tr>
                  <td colSpan={5}>
                    <Empty title="Ainda não houve importações." hint="Carregue um .xlsx com o mapa de férias." />
                  </td>
                </tr>
              )}
              {base.data?.history.map((record, index) => (
                <Tr key={record.id} className="animate-rise" style={stagger(index)}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <FileSpreadsheet
                        size={15}
                        strokeWidth={1.6}
                        className={record.status === 'COMMITTED' ? 'text-ok' : 'text-fg-soft'}
                      />
                      {record.filename}
                    </span>
                  </Td>
                  <Td className="font-mono text-fg-muted">
                    {ptDate(record.uploadedAt.slice(0, 10))} {record.uploadedAt.slice(11, 16)}
                  </Td>
                  <Td className="text-right font-mono">{record.rowCount}</Td>
                  <Td>
                    <Badge tone={record.status === 'COMMITTED' ? 'ok' : record.status === 'PENDING' ? 'warn' : 'muted'}>
                      {record.status === 'COMMITTED' ? 'APLICADO' : record.status === 'PENDING' ? 'POR APLICAR' : 'DESCARTADO'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {user?.isAdmin && record.status !== 'DISCARDED' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Descartar importação"
                        aria-label={`Descartar a importação de ${record.filename}`}
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            const { removed } = await importsApi.discard(record.id)
                            return removed
                          }, 'Importação descartada.')
                        }
                      >
                        <Undo2 size={15} strokeWidth={1.6} />
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </Shell>
  )
}

function AbsenceForm({ people, canPickAnyone, defaultUserId, initial, onCancel, onSave }: {
  people: User[]
  canPickAnyone: boolean
  defaultUserId: number
  initial?: Absence
  onCancel: () => void
  onSave: (body: { userId: number; startDate: string; endDate: string; kind: 'VACATION' | 'OTHER'; note?: string }) => void
}) {
  const [userId, setUserId] = useState(initial?.user.id ?? defaultUserId)
  const [startDate, setStart] = useState(initial?.startDate ?? '')
  const [endDate, setEnd] = useState(initial?.endDate ?? '')
  const [kind, setKind] = useState<'VACATION' | 'OTHER'>(initial?.kind ?? 'VACATION')
  const [note, setNote] = useState(initial?.note ?? '')

  const invalid = !startDate || !endDate || endDate < startDate

  return (
    <Card className="flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[180px]">
        <Label htmlFor="who">ELEMENTO</Label>
        <Select
          id="who"
          value={userId}
          disabled={!canPickAnyone}
          onChange={(e) => setUserId(Number(e.target.value))}
          className="h-[34px] w-full"
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>{person.displayName}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="start">INÍCIO</Label>
        <Input id="start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} className="w-[150px]" />
      </div>
      <div>
        <Label htmlFor="end">FIM</Label>
        <Input id="end" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} className="w-[150px]" />
      </div>
      <div>
        <Label htmlFor="kind">TIPO</Label>
        <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as 'VACATION' | 'OTHER')} className="h-[34px]">
          <option value="VACATION">Férias</option>
          <option value="OTHER">Outro</option>
        </Select>
      </div>
      <div className="min-w-[180px] flex-1">
        <Label htmlFor="note">NOTA</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
      </div>
      <Button variant="ghost" onClick={onCancel}>CANCELAR</Button>
      <Button
        variant="default"
        disabled={invalid}
        onClick={() => onSave({ userId, startDate, endDate, kind, note: note || undefined })}
      >
        GUARDAR
      </Button>
      {endDate && startDate && endDate < startDate && (
        <span className="pb-2 text-[11.5px] text-danger">A data de fim é anterior à de início.</span>
      )}
    </Card>
  )
}
