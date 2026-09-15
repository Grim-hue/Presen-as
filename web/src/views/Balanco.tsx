import { Banner, Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { TeamSwitcher } from '@/components/layout/TeamSwitcher'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { useTeam } from '@/context/TeamContext'
import { useAsync } from '@/lib/useAsync'
import { stagger } from '@/lib/motion'
import { Bar } from '@/components/ui/bar'
import { Counter } from '@/components/ui/counter'
import { memberColour, ptDate } from '@/lib/utils'
import { teams as teamsApi } from '@/services'

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}`

/**
 * How many people get a card before the table takes over.
 *
 * Six is two rows of the widest grid, which is about as far down the page as a card
 * can sit and still be compared with the one at the top of it.
 */
const LEDGER_CARDS = 6

export function Balanco() {
  const { team } = useTeam()
  const { data, loading, error } = useAsync(async () => {
    if (!team) return null
    return { team, balances: await teamsApi.balance(team.id) }
  }, [team?.id])

  const most = Math.max(1, ...(data?.balances ?? []).map((b) => b.assigned))
  const next = data?.balances[0]
  /**
   * The ledger only counts published plans, so a team whose plans are all drafts
   * reads as a wall of zeros. Left unexplained that looks like a broken page rather
   * than an empty one.
   */
  const nothingPublished =
    Boolean(data?.balances.length) && data!.balances.every((b) => b.assigned === 0 && b.expected === 0)
  /*
   * The front of the queue gets a card; the table underneath has everybody.
   *
   * Everyone used to get one, so that reading the saldo for one person meant being
   * able to compare them against all the others. At forty that stopped being a
   * comparison: the cards ran to two and a half screens and the two people you
   * wanted to weigh against each other were never on the same one. The list is
   * ordered by who is owed most, so the cards are the answer to "who is next" and
   * the table is the answer to "what about everyone".
   */
  const cards = (data?.balances ?? []).slice(0, LEDGER_CARDS)
  const uncarded = (data?.balances.length ?? 0) - cards.length

  return (
    <Shell
      title={
        <>
          Balanço
          <TeamSwitcher />
          {data && <Badge>DESDE {ptDate(data.team.fairnessSince)}</Badge>}
        </>
      }
    >
      {error && <Badge tone="danger">{error}</Badge>}

      {!loading && nothingPublished && (
        <Banner tone="info">
          <b className="font-semibold">Ainda não há nada publicado nesta escala.</b>{' '}
          O balanço conta apenas dias de planos publicados, por isso está tudo a zero.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading &&
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[130px]" style={{ animationDelay: `${i * 70}ms` }} />)}

        {!loading &&
          cards.map((entry, index) => (
            <Card
              key={entry.user.id}
              className="animate-rise px-4 py-4"
              style={stagger(index, 70)}
            >
              <div className="mb-3.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[13px] text-fg-strong">
                  <Avatar user={entry.user} className="h-[18px] w-[18px] text-[8px]" />
                  {entry.user.displayName}
                </span>
                {entry.user.id === next?.user.id && entry.debt > 0 && <Badge tone="accent">PRÓXIMO</Badge>}
              </div>

              <div className="mb-3 flex items-baseline gap-2">
                <Counter
                  value={entry.assigned}
                  className="font-mono text-[27px] leading-none text-fg-strong"
                />
                <span className="font-mono text-xs text-fg-soft">
                  / {entry.expected.toFixed(2).replace('.', ',')} esperadas
                </span>
              </div>

              <Bar
                className="mb-2.5"
                fraction={entry.assigned / most}
                colour={memberColour(entry.user.id)}
                delay={180 + Math.min(index, 12) * 90}
              />

              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-fg-soft">Desde {ptDate(entry.joinedAt)}</span>
                <Badge tone={entry.debt > 0 ? 'accent' : 'muted'}>SALDO {signed(entry.debt)}</Badge>
              </div>
            </Card>
          ))}
        {!loading && uncarded > 0 && (
          <div className="flex items-center px-1 font-mono text-[11px] text-fg-faint">
            e mais {uncarded} na tabela
          </div>
        )}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>ELEMENTO</Th>
              <Th>ENTRADA</Th>
              <Th className="text-right">PRESENÇAS</Th>
              <Th className="text-right">ESPERADAS</Th>
              <Th className="text-right">SALDO</Th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={3} cols={5} />}
            {!loading && !data?.balances.length && (
              <tr>
                <td colSpan={5}>
                  <Empty
                    title="Ainda não há planos publicados."
                    hint="O balanço só conta dias de planos publicados."
                  />
                </td>
              </tr>
            )}
            {!loading &&
              data?.balances.map((entry, index) => (
                <Tr key={entry.user.id} className="animate-rise" style={stagger(index, 60)}>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar user={entry.user} className="h-[18px] w-[18px] text-[8px]" />
                      {entry.user.displayName}
                    </span>
                  </Td>
                  <Td className="font-mono text-fg-muted">{ptDate(entry.joinedAt)}</Td>
                  <Td className="text-right font-mono text-fg-strong">
                    <Counter value={entry.assigned} />
                  </Td>
                  <Td className="text-right font-mono text-fg-muted">
                    <Counter value={entry.expected} decimals={2} />
                  </Td>
                  <Td className="text-right font-mono text-fg-muted">
                    <Counter value={entry.debt} decimals={2} signed />
                  </Td>
                </Tr>
              ))}
          </tbody>
        </Table>

      </Card>
    </Shell>
  )
}
