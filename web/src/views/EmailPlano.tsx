import { ArrowLeft, ChevronDown, Copy, RotateCcw, Save, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Banner, Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { MonthRangePicker } from '@/components/ui/month-range'
import { Orb } from '@/components/ui/orb'
import { Popover } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { useTeam } from '@/context/TeamContext'
import { errorText, useAsync } from '@/lib/useAsync'
import { cn, monthShort, ptDate, todayIso } from '@/lib/utils'
import { plans as plansApi, teams as teamsApi } from '@/services'
import type { Plan, RenderedEmail, Team } from '@/services/types'

/** What the message opens with when the sender does not say otherwise. */
const GREETING = 'Bom dia,'

/**
 * The run of months as the bar says it: `SET–DEZ 2026`, `SET 2026 – FEV 2027`.
 *
 * Short and mono, because it is the face of a control rather than a sentence. The
 * sentence is the subject's, and how that is said — a list, a range, the year once —
 * is the renderer's rule and is not worth keeping a second copy of here.
 */
function runLabel(months: string[]) {
  if (months.length === 0) return 'NENHUM MÊS'
  const short = (month: string) => monthShort(Number(month.slice(5, 7))).toUpperCase()
  const first = months[0]
  const last = months[months.length - 1]
  if (first === last) return `${short(first)} ${first.slice(0, 4)}`
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${short(first)}–${short(last)} ${first.slice(0, 4)}`
  }
  return `${short(first)} ${first.slice(0, 4)} – ${short(last)} ${last.slice(0, 4)}`
}

/**
 * The email in a page of its own, for the preview to stand in.
 *
 * An iframe rather than the markup dropped into the view: the message carries its own
 * colours and its own widths, and this application's are not the ones it will be read
 * in — a preview inheriting the dark theme would be showing the one thing the message
 * is styled to stop happening. `color-scheme: light` says the same to the browser,
 * which otherwise darkens a scrollbar inside the frame.
 */
const framed = (html: string) =>
  '<!doctype html><html lang="pt"><head><meta charset="utf-8">' +
  '<style>html{color-scheme:light}body{margin:0;padding:22px;background:#ffffff}</style>' +
  `</head><body>${html}</body></html>`

/**
 * A line of the left column: a label over whatever answers it.
 *
 * Set at the top of the ramp rather than the bottom of it. A label is normally
 * furniture and is drawn as furniture across the application, but this page is nothing
 * but labels over fields the sender is reading before they send: at --fg4 over a dark
 * card they were a grey that had to be looked for, and the eye read the low chroma as
 * a blue cast rather than as grey.
 */
function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-fg-strong">{label}</Label>
        {hint && <span className="mb-[7px] text-[10.5px] text-fg">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/**
 * A checkbox and the thing it turns on, as one line the whole of which is clickable.
 *
 * [indeterminate] is a property of the node and not an attribute of the tag, so it can
 * only be set through the element itself. It is what a year some of whose months are
 * going has to say: neither ticked nor empty.
 */
function Toggle({ checked, indeterminate = false, onChange, className, children }: {
  checked: boolean
  indeterminate?: boolean
  onChange: (next: boolean) => void
  className?: string
  children: React.ReactNode
}) {
  const box = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (box.current) box.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 py-[3px] text-[12.5px] text-fg-strong',
        className
      )}
    >
      <input
        ref={box}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-[var(--acc)]"
      />
      {children}
    </label>
  )
}

const textarea =
  'w-full rounded border border-line bg-field px-3 py-2 text-[13px] text-fg-strong placeholder:text-fg-soft'

/**
 * The message that carries a plan out of here.
 *
 * A page rather than a dialog, for the reason Gerar is a page: every field on the left
 * changes something worth seeing before it is sent, and a modal has no room to show
 * that and no way to sit beside it. The plan used to go straight to the clipboard, so
 * the first sight of it was in Outlook, already pasted — and the subject, which the
 * API has rendered all along, was never shown at all and had to be typed from memory.
 *
 * The team's wording is the starting point and not the end of it. Every message is
 * sent by a person on a day: "Boa tarde" instead of "Bom dia", a sentence about
 * December, a plan generated two months at a time and sent a month at a time, a roster
 * that counts the people on it because it is going to a client. None of that is worth
 * storing on the team, and all of it was previously impossible without editing the
 * team's template and putting it back afterwards.
 *
 * The preview is the real message: `POST /plans/{id}/email` renders exactly what COPIAR
 * EMAIL puts on the clipboard, so nothing on screen is this page's own idea of it.
 */
export function EmailPlano() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { team } = useTeam()
  const wanted = Number(params.get('plan')) || null

  /*
   * The plan named in the address, with the team it belongs to — not the team the
   * switcher happens to be on. The wording comes from that team, and an AT plan shown
   * in the PSE words would be a draft of the wrong message.
   */
  const base = useAsync(async () => {
    const teams = await teamsApi.list()
    let id = wanted
    if (!id) {
      const first = team ?? teams[0]
      if (!first) return null
      id = (await plansApi.list(first.id))[0]?.id ?? null
    }
    if (!id) return null
    const plan = await plansApi.get(id)
    return { plan, owner: teams.find((t) => t.id === plan.teamId) ?? null }
  }, [team?.id, wanted])

  const plan: Plan | null = base.data?.plan ?? null
  const owner: Team | null = base.data?.owner ?? null

  const [greeting, setGreeting] = useState(GREETING)
  const [subject, setSubject] = useState('')
  const [intro, setIntro] = useState('')
  const [notes, setNotes] = useState('')
  // Null until the plan is known, because "every month" cannot be listed before then.
  const [months, setMonths] = useState<string[] | null>(null)
  const [nameMembers, setNameMembers] = useState(true)
  const [weekends, setWeekends] = useState(true)
  const [holidays, setHolidays] = useState(true)

  /** Every month the plan covers, in order, as `2026-09`. */
  const allMonths = useMemo(
    () => [...new Set((plan?.days ?? []).map((day) => day.date.slice(0, 7)))].sort(),
    [plan]
  )

  const chosen = months ?? allMonths

  /**
   * What is still to come, which is what a plan is sent about.
   *
   * The page used to open with every month the plan covers, and a plan is generated
   * three or four months at a time: in November, a September plan opened four screens
   * of message deep, three of them about weeks that have already happened. So the
   * default is this year, from this month on — the month that is running counts,
   * because half of it has not.
   *
   * Everything else stays one click away rather than hidden: a month already past is
   * sometimes exactly what is being resent, and next year is a question for next year.
   * The fallback is what stops a plan generated in December for January opening on
   * nothing at all.
   */
  const opening = useMemo(() => {
    const now = todayIso().slice(0, 7)
    const ahead = allMonths.filter((month) => month.slice(0, 4) === now.slice(0, 4) && month >= now)
    return ahead.length ? ahead : allMonths
  }, [allMonths])

  const [saving, setSaving] = useState(false)

  /**
   * Keeps the wording for next time.
   *
   * The two fields that belong to the team go back to the team, and the notes go back
   * to the plan they were written about. The greeting and the choices under "o que
   * enviar" are not saved and are not meant to be: they are true of this message on
   * this day, and a stored "Boa tarde" would be wrong by the morning.
   */
  async function save() {
    if (!plan || !owner) return
    setSaving(true)
    try {
      await teamsApi.updateEmail(owner.id, { emailSubject: subject, emailIntro: intro })
      if ((plan.notes ?? '') !== notes) {
        await plansApi.updateNotes(plan.id, notes.trim() || null)
      }
      toast.success('Guardado para a próxima mensagem.')
      base.reload()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  /** Back to what the team says and the months still to come: where a send starts. */
  function reset() {
    setGreeting(GREETING)
    setSubject(owner?.emailSubject ?? '')
    setIntro(owner?.emailIntro ?? '')
    setNotes(plan?.notes ?? '')
    setMonths(opening)
    setNameMembers(true)
    setWeekends(true)
    setHolidays(true)
  }

  useEffect(() => {
    if (plan && owner) reset()
  }, [plan?.id, owner?.id])

  const [email, setEmail] = useState<RenderedEmail | null>(null)
  const [rendering, setRendering] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  /*
   * The preview follows the fields, a beat behind. Every keystroke in a sentence is a
   * sentence on the way to another one, and asking on each of them would spend a
   * request a letter to draw messages nobody wanted to read.
   */
  useEffect(() => {
    if (!plan || months === null) return
    if (months.length === 0) {
      // Nothing to ask for, and a message rendered from no months would be a greeting
      // and a sign-off with a hole between them.
      setEmail(null)
      setProblem(null)
      setRendering(false)
      return
    }
    setRendering(true)
    const timer = setTimeout(() => {
      plansApi
        .renderEmail(plan.id, {
          greeting,
          subject,
          intro,
          notes,
          months,
          nameMembers,
          weekends,
          holidays
        })
        .then((rendered) => {
          setEmail(rendered)
          setProblem(null)
        })
        .catch((e) => {
          setEmail(null)
          setProblem(errorText(e))
        })
        .finally(() => setRendering(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [plan?.id, greeting, subject, intro, notes, months, nameMembers, weekends, holidays])

  /*
   * Nothing chosen is a state the picker can be in and the message cannot: there is
   * nothing to preview and nothing to copy, and one click on any month is the way
   * back out. The picker itself cannot produce it — a run always has two ends — but
   * REPOR on a plan wholly in the past can, and the message has to hold either way.
   */

  /** Both formats at once: Outlook takes the grid, anything else takes the lines. */
  async function copyEmail() {
    if (!email) return
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([email.html], { type: 'text/html' }),
          'text/plain': new Blob([email.text], { type: 'text/plain' })
        })
      ])
      toast.success('Email copiado. Cole no Outlook.')
    } catch {
      // Clipboard access can be refused, and a silent no-op would look like a bug.
      toast.error('Não foi possível copiar. Verifique as permissões do browser.')
    }
  }

  /** Apart from the body, because that is how a mail window asks for it. */
  async function copySubject() {
    if (!email) return
    try {
      await navigator.clipboard.writeText(email.subject)
      toast.success('Assunto copiado.')
    } catch {
      toast.error('Não foi possível copiar. Verifique as permissões do browser.')
    }
  }

  return (
    <Shell
      title={
        <>
          <button
            type="button"
            onClick={() => navigate('/plano')}
            aria-label="Voltar ao plano"
            className="-ml-1 rounded p-1 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
          </button>
          {/* The page is named by the line it is composing, not by the kind of thing
              it is: "Email do plano" is true of every one of them, and the subject is
              the one sentence that says which plan, which months and to whom. */}
          <span className="truncate" title={email?.subject}>
            {email?.subject ?? 'Email do plano'}
          </span>
          {plan && (
            <span className="shrink-0 font-mono text-[11px] font-normal text-fg-muted">
              {ptDate(plan.periodStart)} — {ptDate(plan.periodEnd)}
            </span>
          )}
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button onClick={copySubject} disabled={!email}>
            <Copy size={14} strokeWidth={1.6} />
            COPIAR ASSUNTO
          </Button>
          <Button onClick={copyEmail} disabled={!email}>
            <Copy size={14} strokeWidth={1.6} />
            COPIAR EMAIL
          </Button>
          {/* The plan is meant to go out on its own one day — generated and sent
              without anybody opening this page. Nothing here sends: there is no mail
              in the API and no recipient on a team. What the button does now is hold
              the primary slot, so the day it works nothing else has to move. */}
          <Tooltip content="Ainda não envia daqui. Copie o email e cole no Outlook.">
            <span>
              <Button variant="default" disabled>
                <Send size={14} strokeWidth={1.6} />
                ENVIAR
              </Button>
            </span>
          </Tooltip>
        </div>
      }
    >
      {base.error && <Banner tone="danger">{base.error}</Banner>}
      {problem && <Banner tone="danger">{problem}</Banner>}

      {base.loading ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Skeleton className="min-h-[420px]" />
          <Skeleton className="min-h-[420px]" />
        </div>
      ) : !plan || !owner ? (
        <Card className="flex min-h-[320px] items-center justify-center">
          <Empty title="Sem plano para enviar." hint="Gere um plano primeiro." />
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* ---------------------------------------------------------- writing */}
          <div className="flex min-h-0 flex-col gap-4 overflow-auto">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-fg-strong">A mensagem</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1 font-mono text-[10px] tracking-[0.08em] text-fg hover:text-fg-strong"
                  >
                    <RotateCcw size={11} strokeWidth={1.8} />
                    REPOR
                  </button>
                  <Button size="sm" onClick={save} disabled={saving || !subject.trim() || !intro.trim()}>
                    <Save size={12} strokeWidth={1.6} />
                    GUARDAR
                  </Button>
                </div>
              </div>

              <Field label="PARA">
                <Tooltip content="Ainda não envia daqui. Copie o email e cole no Outlook.">
                  <span className="block">
                    <Input disabled value="" readOnly placeholder="Ainda não envia daqui" />
                  </span>
                </Tooltip>
              </Field>

              <Field label="SAUDAÇÃO">
                <Input
                  value={greeting}
                  maxLength={120}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder={GREETING}
                />
              </Field>

              {/* The tokens are the team's, and they go on working in the sender's
                  own line: a subject edited by hand still names the months it ended
                  up carrying. */}
              <Field label="ASSUNTO" hint="{meses} · {meses_ano}">
                <Input
                  value={subject}
                  maxLength={300}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={owner.emailSubject}
                />
              </Field>

              <Field label="INTRODUÇÃO" hint="{meses} · {meses_ano}">
                <textarea
                  rows={4}
                  value={intro}
                  maxLength={2000}
                  onChange={(e) => setIntro(e.target.value)}
                  placeholder={owner.emailIntro}
                  className={textarea}
                />
              </Field>

              <Field label="NOTAS" hint="uma linha por parágrafo">
                <textarea
                  rows={3}
                  value={notes}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  className={textarea}
                />
              </Field>

              <p className="mt-1 text-[11px] leading-[1.45] text-fg">
                GUARDAR fixa o assunto e a introdução como texto da equipa, e as notas no
                plano. A saudação e o que envia valem só para esta mensagem.
              </p>
            </Card>

          </div>

          {/* --------------------------------------------------------- the message */}
          <Card className="flex min-h-[520px] flex-col overflow-hidden">
            {/*
              * What is going, over what is going: the bar is the header of the thing
              * it filters.
              *
              * It used to be a second card under the writing, and the two together
              * were taller than the column they stood in — so the sentence being
              * typed and the months it would carry were never on screen at once, and
              * the column scrolled to reach either. A month is a filter on the
              * message, and a filter belongs on the edge of what it filters.
              */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft px-3.5 py-2">
              {/*
                * One button, whatever the plan is.
                *
                * The months were a connected run of segments, one per month, which
                * reads well at four and is a wall at sixteen: the AT plan runs into
                * the following year and drew twelve segments for a year nobody was
                * sending, wrapping the bar onto a second row to do it. What is going
                * is a sentence — "de setembro a dezembro 2026" — and the choice
                * behind it is a panel, not a row of switches.
                */}
              <Popover
                trigger={
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-[26px] items-center gap-1.5 rounded border border-line px-2.5',
                      'font-mono text-[10.5px] tracking-[0.04em] text-fg-strong transition-colors',
                      'hover:bg-[var(--hover2)]'
                    )}
                  >
                    {runLabel(chosen)}
                    <span className="text-fg-muted">·</span>
                    <span className="text-fg-muted">
                      {chosen.length} de {allMonths.length}
                    </span>
                    <ChevronDown size={12} strokeWidth={1.8} className="text-fg-muted" />
                  </button>
                }
              >
                <MonthRangePicker
                  all={allMonths}
                  from={chosen[0] ?? null}
                  to={chosen[chosen.length - 1] ?? null}
                  onChange={(first, last) =>
                    setMonths(allMonths.filter((month) => month >= first && month <= last))
                  }
                />
              </Popover>

              <span className="h-4 w-px shrink-0 bg-line" />

              {/* Short here, because a bar is read across rather than down. The
                  sentence each one used to carry is the thing it says on hover. */}
              <Tooltip content="Nomear os elementos, em vez de os contar">
                <span>
                  <Toggle checked={nameMembers} onChange={setNameMembers}>Nomes</Toggle>
                </span>
              </Tooltip>
              <Tooltip content="Incluir sábado e domingo na grelha">
                <span>
                  <Toggle checked={weekends} onChange={setWeekends}>Fim-de-semana</Toggle>
                </span>
              </Tooltip>
              <Tooltip content="Marcar os feriados pelo nome">
                <span>
                  <Toggle checked={holidays} onChange={setHolidays}>Feriados</Toggle>
                </span>
              </Tooltip>

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {rendering && <Orb state="composing" label="A compor a mensagem" />}
                <span className="font-mono text-[9.5px] font-semibold tracking-[0.13em] text-fg">
                  {rendering ? 'A COMPOR' : 'PRÉ-VISUALIZAÇÃO'}
                </span>
              </div>
            </div>

            {chosen.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <Empty title="Nenhum mês escolhido." hint="A mensagem leva pelo menos um." />
              </div>
            ) : email ? (
              /*
               * The frame is positioned rather than stretched, and that is a fix
               * rather than a preference.
               *
               * A flex child's box is only settled once flex has resolved, and a frame
               * lays its document out at whatever width the element had when `srcDoc`
               * loaded. On a plan long enough to wrap the bar above onto a second row,
               * the frame loaded before it had one: the message came out at about a
               * character per line, and stayed that way, because nothing told the
               * document inside to lay itself out again. Resizing the window fixed it,
               * which is the whole diagnosis. Absolutely positioned, it takes its size
               * from the containing block, which is definite before the load.
               */
              <div className="relative min-h-0 flex-1">
                <iframe
                  title="Pré-visualização do email"
                  srcDoc={framed(email.html)}
                  // Nothing in the message needs to run, and it is not this page's to
                  // reach into: the frame is here to draw it, not to host it.
                  sandbox=""
                  className="absolute inset-0 h-full w-full bg-white"
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
            )}
          </Card>
        </div>
      )}
    </Shell>
  )
}
