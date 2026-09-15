import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Empty } from '@/components/layout/Feedback'
import { Avatar } from '@/components/ui/avatar'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { useSearch } from '@/context/SearchContext'
import { comboText, useHotkey } from '@/lib/hotkey'
import { errorText } from '@/lib/useAsync'
import { users as usersApi } from '@/services'
import type { User } from '@/services/types'

/**
 * The one shortcut the interface says out loud. Every other key is a tooltip on the
 * button it presses; this one is written on its own trigger, because a search box
 * is the one control people look for before they have found anything to click.
 *
 * mod+K both opens and closes, so the key that got you in is also the one that
 * gets you out.
 */
export function PeopleSearch() {
  const { isOpen, open, close } = useSearch()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useHotkey('mod+k', () => (isOpen ? close() : open()))

  /*
   * The directory is read on the first opening and kept: a search is about
   * reaching a person, not auditing the roster, and a name that was there a
   * moment ago is there still.
   */
  useEffect(() => {
    if (!isOpen || people) return
    usersApi
      .list()
      .then(setPeople)
      .catch((e) => setError(errorText(e)))
  }, [isOpen, people])

  // Every opening starts from nothing, so the box never answers a question that
  // was left in it last time.
  useEffect(() => {
    if (isOpen) setQuery('')
  }, [isOpen])

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!people || !q) return []
    return people.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [people, q])

  /**
   * What choosing somebody does: their email, on the clipboard. The email is the
   * one thing this application knows about a person that is useful outside it —
   * the plan ends up in one — and a search that only looked would be a list.
   */
  async function choose(person: User) {
    close()
    try {
      await navigator.clipboard.writeText(person.email)
      toast.success(`Email de ${person.forename} copiado.`)
    } catch {
      // Clipboard access can be refused, and a silent no-op would look like a bug.
      toast.error('Não foi possível copiar. Verifique as permissões do browser.')
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => !next && close()}
      title="Procurar"
      description="Escreva um nome; escolher copia o email."
      width={480}
    >
      <div className="relative">
        <Input
          // Radix moves the focus into the dialog when it opens; the box is what
          // it is opened for, so it takes the focus the dialog receives.
          autoFocus
          className="w-full pr-14"
          placeholder="Pessoa"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) choose(matches[0])
          }}
        />
        {/* The key that opened this box, written where the typing happens, so the
            next time it is a hand movement rather than a hunt through the header. */}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          <Kbd combo="mod+k" />
        </span>
      </div>

      <div className="mt-3 flex max-h-[320px] flex-col overflow-y-auto">
        {error && <p className="text-xs text-danger">{error}</p>}
        {!error && !q && (
          <p className="py-1 text-xs text-fg-faint">Escreva para procurar alguém.</p>
        )}
        {!error && q && people && matches.length === 0 && (
          <Empty title="Ninguém encontrado." hint="Procure por nome ou email." />
        )}
        {matches.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => choose(person)}
            className="flex items-center gap-2.5 rounded px-1.5 py-2 text-left hover:bg-[var(--hover2)]"
          >
            <Avatar user={person} className="h-[22px] w-[22px] text-[9px]" />
            <span className="shrink-0 text-[12.5px] text-fg-strong">{person.displayName}</span>
            <span className="ml-auto truncate font-mono text-[11px] text-fg-muted">
              {person.email}
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}

/**
 * The header's way in, and the one place outside the box itself that shows a key.
 */
export function SearchButton() {
  const { open } = useSearch()
  return (
    <button
      type="button"
      onClick={open}
      title={`Procurar (${comboText('mod+k')})`}
      aria-label="Procurar"
      className="flex items-center gap-1.5 rounded p-1.5 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
    >
      <Search size={15} strokeWidth={1.6} />
      <Kbd combo="mod+k" />
    </button>
  )
}
