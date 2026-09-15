import {
  ArrowDown, ArrowUp, CalendarPlus, CalendarRange, ImageOff, ImagePlus, Pencil, Search,
  Trash2, Undo2, UserPlus
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Banner, Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { TeamSwitcher } from '@/components/layout/TeamSwitcher'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu'
import { SkeletonRows } from '@/components/ui/skeleton'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useTeam } from '@/context/TeamContext'
import { comboText } from '@/lib/hotkey'
import { errorText, useAsync } from '@/lib/useAsync'
import { cn, ptDate, todayIso, WEEKDAYS_LONG } from '@/lib/utils'
import { teams as teamsApi, users as usersApi } from '@/services'
import type { TeamMember } from '@/services/types'

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}`

/** What the table is ordered by. The saldo is the reason anybody sorts it at all. */
type SortKey = 'name' | 'joined' | 'debt'

function SortTh({ label, sort, mine, onSort }: {
  label: string
  sort: { key: SortKey; dir: 1 | -1 }
  mine: SortKey
  onSort: (key: SortKey) => void
}) {
  const active = sort.key === mine
  const Arrow = sort.dir === 1 ? ArrowUp : ArrowDown
  return (
    <Th>
      <button
        type="button"
        onClick={() => onSort(mine)}
        className={cn(
          'inline-flex items-center gap-1 font-mono uppercase tracking-[0.08em]',
          active ? 'text-fg-strong' : 'hover:text-fg-strong'
        )}
      >
        {label}
        <Arrow size={10} strokeWidth={2.4} className={cn(!active && 'opacity-0')} />
      </button>
    </Th>
  )
}

/**
 * Who is on a commitment, and what it asks of them.
 *
 * The page is two things and says so: one strip for the rule, which is four fields and
 * a button, and the rest for the people, which is what anybody came here to read.
 *
 * The roster has to work at forty, so it has what a list of forty needs — a search, an
 * order, and the saldo beside the name, which is the number that decides who goes next
 * and used to live a page away in Balanço. Past members are behind a switch rather than
 * mixed into the same table with an empty column, and they come back from their own row
 * instead of through the picker that treats them as strangers.
 *
 * Every row ends in one menu rather than a row of icons. It was five actions once
 * editing arrived, three of which only apply to some rows, and a column that is a
 * different width of nothing on every line is one nobody can aim at.
 */
export function Equipa() {
  const { user } = useAuth()
  const { team, setTeam, reload: reloadTeams } = useTeam()
  const { data, loading, error, reload } = useAsync(async () => {
    if (!team) return null
    const [members, candidates, balances] = await Promise.all([
      teamsApi.members(team.id),
      teamsApi.candidates(team.id),
      // Context rather than content: if the saldo cannot be fetched the roster is
      // still the roster, so it fails to a dash instead of to an empty page.
      teamsApi.balance(team.id).catch(() => [])
    ])
    return { team, members, candidates, balances }
  }, [team?.id])

  const admin = Boolean(user?.isAdmin)
  const candidates = data?.candidates ?? []
  const teamId = data?.team.id ?? null

  // ------------------------------------------------------------------ the rule
  const [name, setName] = useState('')
  const [weekday, setWeekday] = useState(1)
  const [required, setRequired] = useState(2)
  const [since, setSince] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data) return
    setName(data.team.name)
    setWeekday(data.team.onSiteWeekday)
    setRequired(data.team.requiredOnSite)
    setSince(data.team.fairnessSince)
  }, [data])

  const changed =
    data &&
    (name.trim() !== data.team.name ||
      weekday !== data.team.onSiteWeekday ||
      required !== data.team.requiredOnSite ||
      since !== data.team.fairnessSince)

  // --------------------------------------------------------------- the roster
  const [query, setQuery] = useState('')
  const [showLeft, setShowLeft] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })

  /** Clicking the column you are already on turns it around. */
  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))
  }

  const debtOf = useMemo(() => {
    const byUser = new Map((data?.balances ?? []).map((b) => [b.user.id, b.debt]))
    return (id: number) => byUser.get(id)
  }, [data])

  const onTeam = (data?.members ?? []).filter((m) => !m.leftAt).length
  const gone = (data?.members ?? []).length - onTeam

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const kept = (data?.members ?? []).filter((m) => {
      if (m.leftAt && !showLeft) return false
      if (!needle) return true
      return (
        m.user.displayName.toLowerCase().includes(needle) ||
        m.user.email.toLowerCase().includes(needle)
      )
    })
    const order = {
      name: (a: TeamMember, b: TeamMember) => a.user.displayName.localeCompare(b.user.displayName),
      joined: (a: TeamMember, b: TeamMember) => a.joinedAt.localeCompare(b.joinedAt),
      // Somebody with no saldo yet sorts below everybody who has one, either way up:
      // an unknown is not a zero and must not sit in the middle of the order.
      debt: (a: TeamMember, b: TeamMember) =>
        (debtOf(a.user.id) ?? -Infinity) - (debtOf(b.user.id) ?? -Infinity)
    }[sort.key]
    return [...kept].sort((a, b) => order(a, b) * sort.dir)
  }, [data, query, showLeft, sort, debtOf])

  // --------------------------------------------------------------- the writes
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [joinedAt, setJoinedAt] = useState(todayIso())
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  /** Whose entry date is being corrected, and to what. */
  const [dating, setDating] = useState<TeamMember | null>(null)
  const [dateDraft, setDateDraft] = useState(todayIso())
  /** Whose details are being edited, and the draft of them. */
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [person, setPerson] = useState({ forename: '', surname: '', email: '', isAdmin: false })
  /** Whose picture is being changed, while the file dialog is open. */
  const [uploading, setUploading] = useState<TeamMember | null>(null)
  const filePicker = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    onSiteWeekday: 1,
    requiredOnSite: 2,
    fairnessSince: todayIso(),
    emailSubject: 'Plano de trabalho presencial {meses_ano}',
    emailIntro:
      'Venho por este meio enviar o plano de trabalho para o mês de {meses} com as datas em ' +
      'que os elementos devem trabalhar presencialmente.'
  })

  /** Everything that writes: one shape, so every failure reaches the same toast. */
  async function act(work: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await work()
      toast.success(done)
      reload()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function saveRule() {
    if (busy || !data || !name.trim()) return
    act(async () => {
      await teamsApi.updateRule(data.team.id, {
        name: name.trim(),
        onSiteWeekday: weekday,
        requiredOnSite: required,
        fairnessSince: since
      })
      // The name is on the switcher and on every page that says which team this is,
      // so the list it comes from is reloaded and not only this page's copy.
      reloadTeams()
    }, 'Escala atualizada.')
  }

  /*
   * Each dialog's primary action, written once, because two things reach it: the
   * button in the footer and mod+Enter through the dialog. Each carries its own
   * guards, so whichever way it is pressed it can never do more than the button.
   */
  function addPicked() {
    if (busy || !data || picked === null) return
    act(async () => {
      await teamsApi.addMember(data.team.id, { userId: picked, joinedAt })
      setAdding(false)
    }, 'Elemento adicionado.')
  }

  function savePerson() {
    if (busy || !editing) return
    if (!person.forename.trim() || !person.surname.trim() || !person.email.trim()) return
    act(async () => {
      await usersApi.update(editing.user.id, {
        forename: person.forename.trim(),
        surname: person.surname.trim(),
        email: person.email.trim(),
        isAdmin: person.isAdmin
      })
      setEditing(null)
    }, 'Dados atualizados.')
  }

  function saveDate() {
    if (busy || !data || !dating) return
    act(async () => {
      await teamsApi.updateMembership(data.team.id, dating.user.id, dateDraft)
      setDating(null)
    }, 'Data de entrada corrigida.')
  }

  function createDraft() {
    if (busy || !draft.name.trim()) return
    act(async () => {
      const created = await teamsApi.create(draft)
      reloadTeams()
      setTeam(created.id)
      setCreating(false)
    }, 'Escala criada.')
  }

  function removePicked() {
    if (busy || !data || !removing) return
    act(async () => {
      await teamsApi.removeMember(data.team.id, removing.user.id, todayIso())
      setRemoving(null)
    }, 'Elemento retirado.')
  }

  return (
    <Shell
      title={
        <>
          Equipa
          <TeamSwitcher />
        </>
      }
      actions={
        admin && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreating(true)}>
              <CalendarPlus size={14} strokeWidth={1.6} />
              NOVA ESCALA
            </Button>
            <Button
              variant="default"
              disabled={busy || !data || candidates.length === 0}
              title={
                candidates.length === 0
                  ? 'Todos os utilizadores já fazem parte desta escala'
                  : undefined
              }
              onClick={() => {
                setPicked(candidates[0]?.id ?? null)
                setJoinedAt(todayIso())
                setAdding(true)
              }}
            >
              <UserPlus size={14} strokeWidth={1.6} />
              ADICIONAR
            </Button>
          </div>
        )
      }
    >
      {error && <Banner tone="danger">{error}</Banner>}

      {/* The rule is four fields and reads as one line. It stands above the roster
          because the roster is read against it: "seis elementos à quarta-feira" is
          what makes a short day short. */}
      <Card className="px-4 py-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-[1.4]">
            <Label htmlFor="team-name">NOME</Label>
            <Input
              id="team-name"
              maxLength={64}
              disabled={!admin}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-[34px]"
            />
          </div>
          <div className="min-w-[170px] flex-1">
            <Label htmlFor="weekday">DIA PRESENCIAL</Label>
            <Select
              id="weekday"
              value={weekday}
              disabled={!admin}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="h-[34px] w-full"
            >
              {WEEKDAYS_LONG.map((label, index) => (
                <option key={label} value={index + 1}>{label}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[120px] flex-1">
            <Label htmlFor="required">ELEMENTOS</Label>
            <Input
              id="required"
              type="number"
              min={1}
              max={50}
              disabled={!admin}
              value={required}
              onChange={(e) => setRequired(Number(e.target.value))}
              className="h-[34px]"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="since">SALDO DESDE</Label>
            <Input
              id="since"
              type="date"
              disabled={!admin}
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="h-[34px]"
            />
          </div>
          {admin && (
            <Button variant="default" disabled={!changed || !name.trim() || busy} onClick={saveRule}>
              GUARDAR
            </Button>
          )}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3.5 py-2.5">
          <div className="relative min-w-[190px] flex-1 sm:max-w-[280px]">
            <Search
              size={13}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar por nome ou email"
              aria-label="Procurar na escala"
              className="h-[28px] pl-[30px] text-[12px]"
            />
          </div>
          {/* Past members are history rather than roster, so they are off by default,
              and counted on the switch rather than hidden without a trace. */}
          {gone > 0 && (
            <button
              type="button"
              onClick={() => setShowLeft((v) => !v)}
              aria-pressed={showLeft}
              className={cn(
                'inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded border px-2',
                'font-mono text-[10.5px] tracking-[0.02em] transition-colors',
                showLeft
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-line text-fg-muted hover:text-fg-strong'
              )}
            >
              QUEM SAIU {gone}
            </button>
          )}
          <span className="ml-auto shrink-0 font-mono text-[10.5px] tracking-[0.08em] text-fg-soft">
            {query || showLeft ? `${rows.length} DE ${(data?.members ?? []).length}` : `${onTeam} NA ESCALA`}
          </span>
        </div>

        <Table className="table-fixed" minWidth={900}>
          <colgroup>
            <col className="w-[230px]" />
            <col />
            <col className="w-[120px]" />
            <col className="w-[110px]" />
            <col className="w-[150px]" />
            <col className="w-[52px]" />
          </colgroup>
          <thead>
            <tr>
              <SortTh label="ELEMENTO" sort={sort} mine="name" onSort={onSort} />
              <Th>EMAIL</Th>
              <SortTh label="ENTRADA" sort={sort} mine="joined" onSort={onSort} />
              <SortTh label="SALDO" sort={sort} mine="debt" onSort={onSort} />
              <Th>PERFIL</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={3} cols={6} />}
            {!loading &&
              rows.map((member) => {
                const debt = debtOf(member.user.id)
                const left = Boolean(member.leftAt)
                const self = user?.id === member.user.id
                return (
                  <Tr key={member.user.id}>
                    <Td className={cn(left && 'text-fg-soft')}>
                      <span className="flex items-center gap-1.5">
                        <Avatar
                          user={member.user}
                          className={cn('h-[18px] w-[18px] shrink-0 text-[8px]', left && 'opacity-40')}
                        />
                        <span className="truncate">{member.user.displayName}</span>
                        {left && (
                          <span className="shrink-0 font-mono text-[9.5px] tracking-[0.08em] text-fg-faint">
                            SAIU {ptDate(member.leftAt!)}
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td className="truncate font-mono text-fg-muted">{member.user.email}</Td>
                    <Td className="font-mono">{ptDate(member.joinedAt)}</Td>
                    <Td>
                      {debt === undefined ? (
                        <span className="text-fg-faint">—</span>
                      ) : (
                        <Badge tone={debt > 0 ? 'accent' : 'muted'}>{signed(debt)}</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={member.user.isAdmin ? 'accent' : 'muted'}>
                        {member.user.isAdmin ? 'ADMINISTRADOR' : 'ELEMENTO'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      {/* Their own picture, or anybody's for an administrator, which
                          is the rule the API enforces. Everything else on this menu
                          is an administrator's. */}
                      {(admin || self) && (
                        <Menu label={`Ações para ${member.user.displayName}`}>
                          {admin && (
                            <MenuItem
                              onSelect={() => {
                                setPerson({
                                  forename: member.user.forename,
                                  surname: member.user.surname,
                                  email: member.user.email,
                                  isAdmin: member.user.isAdmin
                                })
                                setEditing(member)
                              }}
                            >
                              <Pencil size={13} strokeWidth={1.6} />
                              Editar dados
                            </MenuItem>
                          )}
                          <MenuItem
                            onSelect={() => {
                              setUploading(member)
                              filePicker.current?.click()
                            }}
                          >
                            <ImagePlus size={13} strokeWidth={1.6} />
                            {member.user.avatarUrl ? 'Mudar fotografia' : 'Adicionar fotografia'}
                          </MenuItem>
                          {member.user.avatarUrl && (
                            <MenuItem
                              onSelect={() =>
                                act(() => usersApi.removeAvatar(member.user.id), 'Fotografia removida.')
                              }
                            >
                              <ImageOff size={13} strokeWidth={1.6} />
                              Remover fotografia
                            </MenuItem>
                          )}
                          {admin && teamId !== null && (
                            <>
                              <MenuItem
                                onSelect={() => {
                                  setDateDraft(member.joinedAt)
                                  setDating(member)
                                }}
                              >
                                <CalendarRange size={13} strokeWidth={1.6} />
                                Corrigir entrada
                              </MenuItem>
                              <MenuSeparator />
                              {left ? (
                                <MenuItem
                                  onSelect={() =>
                                    act(
                                      () =>
                                        teamsApi.addMember(teamId, {
                                          userId: member.user.id,
                                          joinedAt: todayIso()
                                        }),
                                      'Elemento readmitido.'
                                    )
                                  }
                                >
                                  <Undo2 size={13} strokeWidth={1.6} />
                                  Readmitir hoje
                                </MenuItem>
                              ) : (
                                <MenuItem danger onSelect={() => setRemoving(member)}>
                                  <Trash2 size={13} strokeWidth={1.6} />
                                  Tirar da escala
                                </MenuItem>
                              )}
                            </>
                          )}
                        </Menu>
                      )}
                    </Td>
                  </Tr>
                )
              })}
          </tbody>
        </Table>

        {!loading && rows.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-10">
            <Empty
              title={query ? 'Ninguém com esse nome.' : 'Escala sem elementos.'}
              hint={query ? 'Procure por outro nome ou email.' : 'Adicione quem trabalha nela.'}
            />
          </div>
        )}
      </Card>

      {/*
        * One picker for the whole table rather than one per row.
        *
        * A file input cannot be opened from script unless it is in the document, and
        * forty of them would be forty hidden inputs to keep in step. It is told whose
        * picture it is about by the menu item that opens it, and it is emptied after
        * every choice so that choosing the same file twice still counts as a change.
        */}
      <input
        ref={filePicker}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          const member = uploading
          e.target.value = ''
          setUploading(null)
          if (!file || !member) return
          await act(
            () => usersApi.setAvatar(member.user.id, file),
            `Fotografia de ${member.user.forename} atualizada.`
          )
        }}
      />

      <Dialog
        open={adding}
        onOpenChange={setAdding}
        title="Adicionar à escala"
        description="A partir da data de entrada, e só dessa data em diante, o elemento passa a acumular saldo."
        onSubmit={addPicked}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>CANCELAR</Button>
            <Button
              variant="default"
              disabled={busy || picked === null}
              onClick={addPicked}
              title={comboText('mod+enter')}
            >
              <UserPlus size={14} strokeWidth={1.6} />
              ADICIONAR
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="quem">ELEMENTO</Label>
            <Select
              id="quem"
              className="h-[34px] w-full"
              value={picked ?? ''}
              onChange={(e) => setPicked(Number(e.target.value))}
            >
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.displayName}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="entrada">ENTRADA</Label>
            <Input
              id="entrada"
              type="date"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
            />
          </div>
        </div>
      </Dialog>

      {/* The person, not the membership: this row is the same person everywhere in the
          application, so what is edited here is edited for all of it. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Editar dados"
        description="O nome e o email são como toda a gente o identifica nos planos. O utilizador e a palavra-passe pertencem à autenticação e não se alteram aqui."
        width={520}
        onSubmit={savePerson}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>CANCELAR</Button>
            <Button
              variant="default"
              disabled={
                busy || !person.forename.trim() || !person.surname.trim() || !person.email.trim()
              }
              onClick={savePerson}
              title={comboText('mod+enter')}
            >
              GUARDAR
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="forename">NOME</Label>
              <Input
                id="forename"
                maxLength={32}
                value={person.forename}
                onChange={(e) => setPerson((p) => ({ ...p, forename: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="surname">APELIDO</Label>
              <Input
                id="surname"
                maxLength={32}
                value={person.surname}
                onChange={(e) => setPerson((p) => ({ ...p, surname: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="person-email">EMAIL</Label>
            <Input
              id="person-email"
              type="email"
              maxLength={128}
              value={person.email}
              onChange={(e) => setPerson((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-fg">
            <input
              type="checkbox"
              checked={person.isAdmin}
              // Taking your own flag off closes the screen that would put it back, so
              // the API refuses it and so does this.
              disabled={editing?.user.id === user?.id}
              onChange={(e) => setPerson((p) => ({ ...p, isAdmin: e.target.checked }))}
              className="h-4 w-4 accent-[var(--acc)]"
            />
            Administra a aplicação
            {editing?.user.id === user?.id && (
              <span className="text-[11px] text-fg-faint">— peça a outro administrador</span>
            )}
          </label>
        </div>
      </Dialog>

      <Dialog
        open={dating !== null}
        onOpenChange={(open) => !open && setDating(null)}
        title="Corrigir entrada"
        description="Move a data a partir da qual o elemento acumula saldo. Quem saiu continua fora da escala."
        onSubmit={saveDate}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDating(null)}>CANCELAR</Button>
            <Button variant="default" disabled={busy} onClick={saveDate} title={comboText('mod+enter')}>
              GUARDAR
            </Button>
          </>
        }
      >
        <Label htmlFor="entrada-nova">ENTRADA</Label>
        <Input
          id="entrada-nova"
          type="date"
          value={dateDraft}
          onChange={(e) => setDateDraft(e.target.value)}
        />
      </Dialog>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nova escala"
        description="Um compromisso e a sua regra: que dia, quantos elementos, e o que diz o email que envia."
        width={560}
        onSubmit={createDraft}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>CANCELAR</Button>
            <Button
              variant="default"
              disabled={busy || !draft.name.trim()}
              onClick={createDraft}
              title={comboText('mod+enter')}
            >
              <CalendarPlus size={14} strokeWidth={1.6} />
              CRIAR
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="nova-nome">NOME</Label>
            <Input
              id="nova-nome"
              maxLength={64}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="AT — SPS"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="nova-dia">DIA PRESENCIAL</Label>
              <Select
                id="nova-dia"
                className="h-[34px] w-full"
                value={draft.onSiteWeekday}
                onChange={(e) => setDraft((d) => ({ ...d, onSiteWeekday: Number(e.target.value) }))}
              >
                {WEEKDAYS_LONG.map((label, index) => (
                  <option key={label} value={index + 1}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="nova-elementos">ELEMENTOS</Label>
              <Input
                id="nova-elementos"
                type="number"
                min={1}
                max={50}
                value={draft.requiredOnSite}
                onChange={(e) => setDraft((d) => ({ ...d, requiredOnSite: Number(e.target.value) }))}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="nova-desde">SALDO DESDE</Label>
              <Input
                id="nova-desde"
                type="date"
                value={draft.fairnessSince}
                onChange={(e) => setDraft((d) => ({ ...d, fairnessSince: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="nova-assunto">ASSUNTO DO EMAIL</Label>
            <Input
              id="nova-assunto"
              value={draft.emailSubject}
              onChange={(e) => setDraft((d) => ({ ...d, emailSubject: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="nova-intro">INTRODUÇÃO DO EMAIL</Label>
            <textarea
              id="nova-intro"
              rows={3}
              value={draft.emailIntro}
              onChange={(e) => setDraft((d) => ({ ...d, emailIntro: e.target.value }))}
              className="w-full rounded border border-line bg-field px-3 py-2 text-[13px] text-fg-strong"
            />
          </div>
          <p className="text-[11px] leading-[1.45] text-fg-faint">
            {'{meses} e {meses_ano} são substituídos pelos meses do plano. O texto pode ser alterado depois, na página do email.'}
          </p>
        </div>
      </Dialog>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Tirar da escala"
        description="A partir de hoje deixa de acumular saldo e de entrar em planos novos. Os planos já publicados não mudam."
        onSubmit={removePicked}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>CANCELAR</Button>
            <Button variant="danger" disabled={busy} onClick={removePicked} title={comboText('mod+enter')}>
              <Trash2 size={13} strokeWidth={1.6} />
              TIRAR
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] text-fg-muted">{removing?.user.displayName}</p>
      </Dialog>
    </Shell>
  )
}
