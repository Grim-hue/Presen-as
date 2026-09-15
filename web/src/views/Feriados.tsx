import { ChevronLeft, ChevronRight, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SkeletonRows } from '@/components/ui/skeleton'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useTeam } from '@/context/TeamContext'
import { errorText, useAsync } from '@/lib/useAsync'
import { comboText, useHotkey } from '@/lib/hotkey'
import { stagger } from '@/lib/motion'
import { cn, ptDate, WEEKDAYS_LONG } from '@/lib/utils'
import { holidays as holidaysApi } from '@/services'

export function Feriados() {
  const { user } = useAuth()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [busy, setBusy] = useState(false)

  // The stepper's keys: a year at a time here, where the stepper is a year.
  useHotkey('arrowleft', () => setYear((y) => y - 1))
  useHotkey('arrowright', () => setYear((y) => y + 1))

  // The national calendar is nobody's in particular, so no commitment is selected
  // here. They are all read anyway, to say which holidays land on a day somebody owes.
  const { teams } = useTeam()
  const { data, loading, error, reload } = useAsync(
    async () => ({ list: await holidaysApi.byYear(year) }),
    [year]
  )

  const onSiteWeekdays = new Set(teams.map((t) => t.onSiteWeekday))
  const colliding = (data?.list ?? []).filter((h) => onSiteWeekdays.has(h.weekday))

  async function act<T>(work: () => Promise<T>, done: (result: T) => string) {
    setBusy(true)
    try {
      toast.success(done(await work()))
      reload()
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
          Feriados
          {colliding.length > 0 && (
            <Badge tone="accent">
              {colliding.length} {colliding.length === 1 ? 'CAI' : 'CAEM'} EM DIA PRESENCIAL
            </Badge>
          )}
        </>
      }
      actions={
        <>
          <div className="flex h-[31px] items-center rounded border border-line">
            <button
              onClick={() => setYear((y) => y - 1)}
              aria-label="Ano anterior"
              title={`Ano anterior · ${comboText('arrowleft')}`}
              className="flex h-full items-center px-2.5 text-fg-muted hover:text-fg-strong"
            >
              <ChevronLeft size={15} strokeWidth={1.6} />
            </button>
            <span className="border-x border-line px-3 font-mono text-[12.5px] font-semibold leading-[29px] text-fg-strong">
              {year}
            </span>
            <button
              onClick={() => setYear((y) => y + 1)}
              aria-label="Ano seguinte"
              title={`Ano seguinte · ${comboText('arrowright')}`}
              className="flex h-full items-center px-2.5 text-fg-muted hover:text-fg-strong"
            >
              <ChevronRight size={15} strokeWidth={1.6} />
            </button>
          </div>
          {user?.isAdmin && (
            <Button
              disabled={busy}
              onClick={() =>
                act(
                  () => holidaysApi.generate(year),
                  (r) => (r.added === 0 ? `${year} já estava completo.` : `${r.added} feriados adicionados.`)
                )
              }
            >
              <Sparkles size={14} strokeWidth={1.6} />
              GERAR ANO
            </Button>
          )}
        </>
      }
    >
      {error && <Badge tone="danger">{error}</Badge>}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Table className="table-fixed" minWidth={700}>
          <colgroup>
            <col className="w-[130px]" />
            <col className="w-[180px]" />
            <col />
            <col className="w-[150px]" />
            <col className="w-[60px]" />
          </colgroup>
          <thead>
            <tr>
              <Th>DATA</Th>
              <Th>DIA</Th>
              <Th>NOME</Th>
              <Th>ÂMBITO</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={8} cols={5} />}
            {!loading && !data?.list.length && (
              <tr>
                <td colSpan={5}>
                  <Empty
                    title={`Sem feriados para ${year}.`}
                    hint={user?.isAdmin ? 'Carregue em Gerar ano.' : 'Peça a um administrador para gerar o ano.'}
                  />
                </td>
              </tr>
            )}
            {!loading &&
              data?.list.map((holiday, index) => {
                const collides = onSiteWeekdays.has(holiday.weekday)
                return (
                  <Tr key={holiday.id} className={cn('animate-rise', collides && 'bg-accent-wash')} style={stagger(index)}>
                    <Td className={cn('font-mono', collides ? 'font-medium text-fg-strong' : 'text-fg')}>
                      {ptDate(holiday.date)}
                    </Td>
                    <Td className={collides ? 'text-fg-strong' : 'text-fg-muted'}>
                      {WEEKDAYS_LONG[holiday.weekday - 1]}
                    </Td>
                    <Td className="text-fg-strong">{holiday.name}</Td>
                    <Td>
                      <Badge tone={holiday.national ? 'muted' : 'info'}>
                        {holiday.national ? 'NACIONAL' : 'MUNICIPAL'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      {user?.isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover ${holiday.name}`}
                          disabled={busy}
                          onClick={() => act(() => holidaysApi.remove(holiday.id), () => 'Feriado removido.')}
                        >
                          <Trash2 size={14} strokeWidth={1.6} />
                        </Button>
                      )}
                    </Td>
                  </Tr>
                )
              })}
          </tbody>
        </Table>

      </Card>
    </Shell>
  )
}
