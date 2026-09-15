import { ArrowLeft, Ban, Info, Pin, Sparkles, TriangleAlert } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { TeamSwitcher } from '@/components/layout/TeamSwitcher'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Bar } from '@/components/ui/bar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Orb } from '@/components/ui/orb'
import { DateRangePicker } from '@/components/ui/date-range'
import { Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { useTeam } from '@/context/TeamContext'
import { stagger } from '@/lib/motion'
import { errorText } from '@/lib/useAsync'
import { cn, monthName, ptDate, todayIso, WEEKDAYS_SHORT } from '@/lib/utils'
import { plans as plansApi, teams as teamsApi } from '@/services'
import type { PlanPreview, TeamMember } from '@/services/types'

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}`

/** Three months is the ordinary run, and the dates are the first thing asked. */
const defaultTo = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
}

/**
 * Composing a plan, on a page rather than in a dialog.
 *
 * A dialog was the wrong room for it. Generating asks three questions — a period, who
 * is fixed, who is left out — and every one of them changes an answer worth seeing
 * before it is committed to. A modal has no space to show that answer and no way to
 * sit beside it, so the choice was made blind and reviewed afterwards by reading the
 * plan it produced.
 *
 * The page asks on the left and answers on the right. The answer is the real one:
 * `POST /plans/preview` runs the same generator on the same inputs and writes nothing,
 * so what is on screen is what GERAR will store. Anything else would be a second
 * implementation of the rule that section 6 of AGENTS.md exists to keep single.
 */
export function GerarPlano() {
  const { team } = useTeam()
  const navigate = useNavigate()

  const [from, setFrom] = useState(todayIso)
  const [to, setTo] = useState(defaultTo)
  const [pinned, setPinned] = useState<number[]>([])
  const [excluded, setExcluded] = useState<number[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])

  const [preview, setPreview] = useState<PlanPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!team) return
    teamsApi.members(team.id).then((all) => setMembers(all.filter((m) => !m.leftAt)))
  }, [team?.id])

  /*
   * The preview follows the questions, a beat behind.
   *
   * Every keystroke in a date field is a valid date on the way to another one, and
   * asking on each of them would spend three requests to show two plans nobody wanted.
   * The delay is what makes the answer feel attached to the question rather than to
   * the typing.
   */
  useEffect(() => {
    if (!team || to < from) {
      setPreview(null)
      return
    }
    setPreviewing(true)
    const timer = setTimeout(() => {
      plansApi
        .preview(team.id, from, to, pinned, excluded)
        .then((result) => {
          setPreview(result)
          setProblem(null)
        })
        .catch((e) => {
          setPreview(null)
          setProblem(errorText(e))
        })
        .finally(() => setPreviewing(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [team?.id, from, to, pinned, excluded])

  const working = preview?.days.filter((d) => !d.isHoliday) ?? []
  const holidays = preview?.days.filter((d) => d.isHoliday) ?? []
  const short = working.filter((d) => d.understaffed)

  const byMonth = useMemo(() => {
    const groups = new Map<string, typeof working>()
    for (const day of preview?.days ?? []) {
      const key = day.date.slice(0, 7)
      groups.set(key, [...(groups.get(key) ?? []), day])
    }
    return [...groups.entries()]
  }, [preview])

  const most = Math.max(1, ...(preview?.balances ?? []).map((b) => b.assigned))

  function cycle(userId: number) {
    // normal → fixo → fora → normal
    if (pinned.includes(userId)) {
      setPinned((p) => p.filter((id) => id !== userId))
      setExcluded((e) => [...e, userId])
    } else if (excluded.includes(userId)) {
      setExcluded((e) => e.filter((id) => id !== userId))
    } else {
      setPinned((p) => [...p, userId])
    }
  }

  async function commit() {
    if (!team) return
    setBusy(true)
    try {
      const created = await plansApi.generate(team.id, from, to, pinned, excluded)
      toast.success('Plano gerado.')
      navigate(`/plano?plan=${created.id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell
      title={
        <>
          <button
            type="button"
            onClick={() => navigate('/plano')}
            aria-label="Voltar aos planos"
            className="-ml-1 rounded p-1 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
          </button>
          Gerar plano
          <TeamSwitcher />
        </>
      }
      actions={
        <Button variant="default" disabled={busy || !preview || working.length === 0} onClick={commit}>
          {/* Generating is the one wait in the application with no shape to hold: one
              button, nothing coming to lay out, and only the question of whether it is
              still going. The orb answers that where the icon said nothing. */}
          {busy ? (
            <Orb state="solving" label="A gerar o plano" onAccent />
          ) : (
            <Sparkles size={14} strokeWidth={1.6} />
          )}
          GERAR
        </Button>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ asking */}
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <Label className="mb-0">PERÍODO</Label>
              <span className="font-mono text-[10.5px] text-fg-soft">
                {ptDate(from)} — {ptDate(to)}
              </span>
            </div>
            <DateRangePicker
              from={from}
              to={to}
              onSiteWeekday={team?.onSiteWeekday ?? 1}
              onChange={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo) }}
            />
          </Card>

          <Card className="flex min-h-0 flex-col p-4">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Label className="mb-0">EXCEÇÕES</Label>
              <Tooltip
                content={
                  <span className="block max-w-[220px] leading-snug">
                    Uma vez fixa em todos os dias, outra deixa de fora. Quem for fixo
                    continua a contar no balanço, por isso o saldo baixa.
                  </span>
                }
              >
                <button
                  type="button"
                  aria-label="O que fazem as exceções"
                  className="shrink-0 rounded-full p-0.5 text-fg-faint hover:text-fg-muted"
                >
                  <Info size={12} strokeWidth={1.8} />
                </button>
              </Tooltip>
              {pinned.length + excluded.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setPinned([]); setExcluded([]) }}
                  className="ml-auto font-mono text-[10px] tracking-[0.08em] text-fg-soft hover:text-fg-strong"
                >
                  LIMPAR
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const isPinned = pinned.includes(m.user.id)
                const isExcluded = excluded.includes(m.user.id)
                return (
                  <button
                    key={m.user.id}
                    type="button"
                    aria-pressed={isPinned || isExcluded}
                    title={m.user.displayName}
                    onClick={() => cycle(m.user.id)}
                    className={cn(
                      'inline-flex h-[30px] items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5',
                      'text-xs transition-colors',
                      !isPinned && !isExcluded &&
                        'border-line text-fg-muted hover:bg-[var(--hover2)] hover:text-fg-strong',
                      isPinned && 'border-accent bg-accent-wash text-fg-strong',
                      isExcluded && 'border-line-soft text-fg-faint'
                    )}
                  >
                    <Avatar
                      user={m.user}
                      className="h-[21px] w-[21px] text-[8.5px]"
                      style={isExcluded ? { opacity: 0.4 } : undefined}
                    />
                    {/* The full name: two people on this team are called João. */}
                    <span className={cn(isExcluded && 'line-through')}>{m.user.displayName}</span>
                    {isPinned && <Pin size={11} strokeWidth={2} className="shrink-0 text-accent" />}
                    {isExcluded && <Ban size={11} strokeWidth={2} className="shrink-0" />}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* The ledger this plan would leave behind, which is the part of the answer
              a dialog had nowhere to put. Fixing somebody shows up here first. */}
          {preview && preview.balances.length > 0 && (
            <Card className="flex min-h-0 flex-col p-4">
              <Label>SALDO DEPOIS DESTE PLANO</Label>
              <div className="flex flex-col gap-2.5">
                {preview.balances.map((b, i) => (
                  <div key={b.user.id} className="animate-rise" style={stagger(i, 40)}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-fg">
                        <Avatar user={b.user} className="h-[17px] w-[17px] text-[7.5px]" />
                        <span className="truncate">{b.user.forename}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
                        <span className="text-fg-soft">{b.assigned}</span>
                        <Badge tone={b.debt > 0.5 ? 'accent' : b.debt < -0.5 ? 'warn' : 'muted'}>
                          {signed(b.debt)}
                        </Badge>
                      </span>
                    </div>
                    <Bar fraction={b.assigned / most} colour="var(--acc)" delay={i * 40} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ---------------------------------------------------------- answering */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft px-4 py-3">
            <span className="font-mono text-[10px] font-semibold tracking-[0.13em] text-fg-strong">
              PRÉ-VISUALIZAÇÃO
            </span>
            {preview && (
              <>
                <span className="font-mono text-[11px] text-fg-soft">
                  {working.length} {working.length === 1 ? 'dia' : 'dias'}
                </span>
                {holidays.length > 0 && (
                  <Badge>{holidays.length} FERIADO{holidays.length === 1 ? '' : 'S'}</Badge>
                )}
                {short.length > 0 && (
                  <Badge tone="warn">
                    <TriangleAlert size={11} strokeWidth={2} className="mr-1 inline align-[-1px]" />
                    {short.length} SEM EQUIPA COMPLETA
                  </Badge>
                )}
              </>
            )}
            {previewing && (
              <span className="ml-auto font-mono text-[10px] tracking-[0.08em] text-fg-faint">
                A CALCULAR…
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {problem && <Badge tone="danger">{problem}</Badge>}

            {!preview && !problem && (
              previewing ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[42px]" style={{ animationDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              ) : (
                <Empty title="Escolha um período." hint="O plano aparece aqui antes de ser criado." />
              )
            )}

            {preview && (
              <div className="flex flex-col gap-4">
                {byMonth.map(([key, group]) => (
                  <Fragment key={key}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[9.5px] tracking-[0.14em] text-fg-strong">
                        {monthName(Number(key.slice(5, 7))).toUpperCase()} {key.slice(0, 4)}
                      </span>
                      <span className="font-mono text-[9.5px] tracking-[0.14em] text-fg-faint">
                        {group.filter((d) => !d.isHoliday).length} DIAS
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                      {group.map((day, i) => (
                        <div
                          key={day.date}
                          style={stagger(i, 18, 20)}
                          className={cn(
                            'flex animate-rise items-center gap-2.5 rounded border px-2.5 py-2',
                            day.isHoliday && 'hatch border-line-soft',
                            !day.isHoliday && day.understaffed && 'border-warn-line bg-warn-bg',
                            !day.isHoliday && !day.understaffed && 'border-line-soft'
                          )}
                        >
                          <span className="flex w-[30px] shrink-0 flex-col items-center">
                            <span className="font-mono text-[15px] leading-none text-fg-strong">
                              {Number(day.date.slice(8, 10))}
                            </span>
                            <span className="mt-0.5 font-mono text-[8.5px] uppercase text-fg-faint">
                              {WEEKDAYS_SHORT[day.weekday - 1]}
                            </span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                            {day.isHoliday ? (
                              <span className="truncate text-[11.5px] text-fg-soft">
                                {day.holidayName}
                              </span>
                            ) : day.assigned.length === 0 ? (
                              <span className="text-[11.5px] text-warn">Ninguém disponível</span>
                            ) : (
                              day.assigned.map((u) => (
                                <Avatar
                                  key={u.id}
                                  user={u}
                                  className="h-[19px] w-[19px] text-[8px]"
                                />
                              ))
                            )}
                          </span>
                          {!day.isHoliday && day.understaffed && day.assigned.length > 0 && (
                            <span className="shrink-0 font-mono text-[10px] text-warn">
                              {day.assigned.length}/{day.requiredCount}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  )
}
