import { Select } from '@/components/ui/input'
import { useTeam } from '@/context/TeamContext'

/**
 * Which commitment the page is about.
 *
 * Only on the pages where it changes anything: planning, the fairness ledger and the
 * roster belong to one commitment, while people, their holidays and the national
 * calendar do not. A control on those pages would be a question with no consequence.
 *
 * With a single commitment there is nothing to choose, so it renders as the name and
 * the application looks as it did before there were two.
 */
export function TeamSwitcher() {
  const { teams, team, setTeam } = useTeam()
  if (!team) return null

  if (teams.length < 2) {
    return <span className="font-mono text-[11.5px] font-normal text-fg-soft">{team.name}</span>
  }

  return (
    <Select
      aria-label="Escala"
      value={team.id}
      onChange={(e) => setTeam(Number(e.target.value))}
      className="h-[26px] font-medium"
    >
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  )
}
