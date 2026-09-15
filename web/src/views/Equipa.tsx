import { CalendarPlus, ImageOff, ImagePlus, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Shell } from '@/components/layout/Shell'
import { TeamSwitcher } from '@/components/layout/TeamSwitcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { SkeletonRows } from '@/components/ui/skeleton'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useTeam } from '@/context/TeamContext'
import { comboText } from '@/lib/hotkey'
import { errorText, useAsync } from '@/lib/useAsync'
import { ptDate, todayIso, WEEKDAYS_LONG } from '@/lib/utils'
import { teams as teamsApi, users as usersApi } from '@/services'
import type { TeamMember } from '@/services/types'

export function Equipa() {
  const { user } = useAuth()
  const { team, setTeam, reload: reloadTeams } = useTeam()
  const { data, loading, error, reload } = useAsync(async () => {
    if (!team) return null
    const [members, candidates] = await Promise.all([
      teamsApi.members(team.id),
      teamsApi.candidates(team.id)
    ])
    return { team, members, candidates }
  }, [team?.id])

  const [name, setName] = useState('')
  const [weekday, setWeekday] = useState(1)
  const [required, setRequired] = useState(2)
  const [since, setSince] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const candidates = data?.candidates ?? []
  const [joinedAt, setJoinedAt] = useState(todayIso())
  const [removing, setRemoving] = useState<TeamMember | null>(null)
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

  async function save() {
    if (!data) return
    setBusy(true)
    try {
      await teamsApi.updateRule(data.team.id, {
        name: name.trim(),
        onSiteWeekday: weekday,
        requiredOnSite: required,
        fairnessSince: since
      })
      toast.success('Escala atualizada.')
      // The name is on the switcher and on every page that says which team this is,
      // so the list it comes from is reloaded and not only this page's copy.
      reloadTeams()
      reload()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  /*
   * The three dialogs' primary actions, written once each because two things reach
   * them: the button in the footer, and mod+Enter through the dialog's onSubmit.
   * Each carries its own guards, so whichever way it is pressed, it can never do
   * more than the button beside it allows.
   */
  function addPicked() {
    if (busy || !data || picked === null) return
    act(async () => {
      await teamsApi.addMember(data.team.id, { userId: picked, joinedAt })
      setAdding(false)
    }, 'Elemento adicionado.')
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
    >
      {error && <Badge tone="danger">{error}</Badge>}

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="text-[13.5px] font-semibold text-fg-strong">A escala</div>
          {user?.isAdmin && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <CalendarPlus size={13} strokeWidth={1.6} />
              NOVA ESCALA
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3.5">
          <div className="min-w-[190px] flex-1">
            <Label htmlFor="team-name">NOME</Label>
            <Input
              id="team-name"
              maxLength={64}
              disabled={!user?.isAdmin}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-[36px]"
            />
          </div>
          <div className="min-w-[190px] flex-1">
            <Label htmlFor="weekday">DIA PRESENCIAL</Label>
            <Select
              id="weekday"
              value={weekday}
              disabled={!user?.isAdmin}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="h-[36px] w-full"
            >
              {WEEKDAYS_LONG.map((label, index) => (
                <option key={label} value={index + 1}>{label}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[190px] flex-1">
            <Label htmlFor="required">ELEMENTOS NECESSÁRIOS</Label>
            <Input
              id="required"
              type="number"
              min={1}
              max={50}
              disabled={!user?.isAdmin}
              value={required}
              onChange={(e) => setRequired(Number(e.target.value))}
              className="h-[36px]"
            />
          </div>
          <div className="min-w-[190px] flex-1">
            <Label htmlFor="since">SALDO CONTADO DESDE</Label>
            <Input
              id="since"
              type="date"
              disabled={!user?.isAdmin}
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="h-[36px]"
            />
          </div>
          {user?.isAdmin && (
            <Button variant="default" disabled={!changed || !name.trim() || busy} onClick={save}>
              GUARDAR
            </Button>
          )}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {user?.isAdmin && (
          <div className="flex items-center justify-between border-b border-line-soft px-3.5 py-2.5">
            <span className="font-mono text-[10.5px] tracking-[0.08em] text-fg-soft">
              {(data?.members ?? []).filter((m) => !m.leftAt).length} NA ESCALA
            </span>
            <Button
              size="sm"
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
              <UserPlus size={13} strokeWidth={1.6} />
              ADICIONAR
            </Button>
          </div>
        )}
        <Table className="table-fixed" minWidth={840}>
          <colgroup>
            <col className="w-[240px]" />
            <col />
            <col className="w-[130px]" />
            <col className="w-[120px]" />
            <col className="w-[160px]" />
            <col className="w-[56px]" />
          </colgroup>
          <thead>
            <tr>
              <Th>ELEMENTO</Th>
              <Th>EMAIL</Th>
              <Th>ENTRADA</Th>
              <Th>SAÍDA</Th>
              <Th>PERFIL</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={3} cols={6} />}
            {!loading &&
              data?.members.map((member) => (
                <Tr key={member.user.id}>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar user={member.user} className="h-[18px] w-[18px] text-[8px]" />
                      {member.user.displayName}
                    </span>
                  </Td>
                  <Td className="truncate font-mono text-fg-muted">{member.user.email}</Td>
                  <Td className="font-mono">{ptDate(member.joinedAt)}</Td>
                  <Td className="text-fg-faint">{member.leftAt ? ptDate(member.leftAt) : '—'}</Td>
                  <Td>
                    <Badge tone={member.user.isAdmin ? 'accent' : 'muted'}>
                      {member.user.isAdmin ? 'ADMINISTRADOR' : 'ELEMENTO'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {/* Their own picture, or anybody's for an administrator, which is
                        the same rule the API enforces. Nothing here is a form: the
                        file dialog is the whole interaction, so there is no modal to
                        open and nothing to confirm. */}
                    {(user?.isAdmin || user?.id === member.user.id) && !member.leftAt && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title={member.user.avatarUrl ? 'Mudar fotografia' : 'Adicionar fotografia'}
                        aria-label={`Mudar a fotografia de ${member.user.displayName}`}
                        disabled={busy}
                        onClick={() => {
                          setUploading(member)
                          filePicker.current?.click()
                        }}
                      >
                        <ImagePlus size={14} strokeWidth={1.6} />
                      </Button>
                    )}
                    {/* Only offered to somebody who has one. The API allows it under
                        the same rule as the upload, and a picture put on by mistake
                        used to be replaceable and not removable. */}
                    {(user?.isAdmin || user?.id === member.user.id) &&
                      !member.leftAt &&
                      member.user.avatarUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remover fotografia"
                          aria-label={`Remover a fotografia de ${member.user.displayName}`}
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              await usersApi.removeAvatar(member.user.id)
                            }, 'Fotografia removida.')
                          }
                        >
                          <ImageOff size={14} strokeWidth={1.6} />
                        </Button>
                      )}
                    {user?.isAdmin && !member.leftAt && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Tirar da escala"
                        aria-label={`Tirar ${member.user.displayName} da escala`}
                        disabled={busy}
                        onClick={() => setRemoving(member)}
                      >
                        <Trash2 size={14} strokeWidth={1.6} />
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
          </tbody>
        </Table>
      </Card>

      {/*
        * One picker for the whole table rather than one per row.
        *
        * A file input cannot be opened from script unless it is in the document, and
        * forty of them would be forty hidden inputs to keep in step. It is told whose
        * picture it is about by the button that opens it, and it is emptied after
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
              // The key that presses this button, said in the tooltip rather than
              // on the button: a chip beside it spent the footer's line for news
              // the person already has.
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

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        width={560}
        title="Nova escala"
        description="Um compromisso e a sua regra: que dia, quantos elementos, e o que diz o email que envia."
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
            <Label htmlFor="nome">NOME</Label>
            <Input
              id="nome"
              value={draft.name}
              placeholder="AT — SPS"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="dia">DIA PRESENCIAL</Label>
              <Select
                id="dia"
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
              <Label htmlFor="quantos">ELEMENTOS</Label>
              <Input
                id="quantos"
                type="number"
                min={1}
                max={50}
                value={draft.requiredOnSite}
                onChange={(e) => setDraft((d) => ({ ...d, requiredOnSite: Number(e.target.value) }))}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="desde">SALDO DESDE</Label>
              <Input
                id="desde"
                type="date"
                value={draft.fairnessSince}
                onChange={(e) => setDraft((d) => ({ ...d, fairnessSince: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="assunto">ASSUNTO DO EMAIL</Label>
            <Input
              id="assunto"
              value={draft.emailSubject}
              onChange={(e) => setDraft((d) => ({ ...d, emailSubject: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="intro">PRIMEIRO PARÁGRAFO</Label>
            <textarea
              id="intro"
              rows={3}
              value={draft.emailIntro}
              onChange={(e) => setDraft((d) => ({ ...d, emailIntro: e.target.value }))}
              className="w-full rounded border border-line bg-field px-3 py-2 text-[13px] text-fg-strong"
            />
          </div>
          {/* The tokens are the only thing about these two fields that is not plain
              Portuguese, so they are named where they are typed. */}
          <p className="font-mono text-[10.5px] text-fg-muted">
            {'{meses}'} é substituído por "agosto", {'{meses_ano}'} por "agosto 2026". Uma
            mensagem que leva três meses seguidos diz-se "de agosto a outubro 2026".
          </p>
        </div>
      </Dialog>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Tirar da escala"
        description="A entrada fica no histórico e o saldo já acumulado mantém-se. A partir de hoje deixa de ser escalado."
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
        <p className="text-[12.5px] text-fg-muted">
          {removing?.user.displayName}, na escala desde {removing && ptDate(removing.joinedAt)}.
        </p>
      </Dialog>
    </Shell>
  )
}
