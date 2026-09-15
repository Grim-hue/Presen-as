package pt.pse.presence.domain.plan

import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.PlanConflict
import pt.pse.presence.domain.objects.PreviewRow
import java.time.LocalDate

/**
 * Which published days an import leaves contradicting the férias it committed.
 *
 * Pure: the caller hands over the rows the commit applied and the published
 * assignments those people hold, so the rule can be tested without a database or a
 * spreadsheet. The repository query that gathers the assignments is deliberately
 * dumb — a person, a date, a plan — because whether a date is really covered by an
 * absence this commit leaves behind is a rule, and rules live here.
 *
 * Every row with a user counts, whatever its outcome. An UNCHANGED row leaves the
 * same absence in place a NEW one does, and a plan contradicting it is worth
 * reporting on every import that mentions the person, not only the one that first
 * created the problem. The report clears itself the same way: once the day is
 * edited, the assignment is gone and nothing is found.
 */
@Component
class PlanConflictFinder {

    fun conflicts(rows: List<PreviewRow>, assignments: List<PlanConflict>): List<PlanConflict> {
        val periodsByUser = rows
            .filter { it.userId != null }
            .groupBy({ it.userId!! }, { it.startDate to it.endDate })

        return assignments
            .filter { assignment ->
                periodsByUser[assignment.userId].orEmpty().any { (start, end) ->
                    covers(assignment.date, start, end)
                }
            }
            .distinct()
            .sortedWith(compareBy({ it.date }, { it.planId }, { it.userId }))
    }

    /** The same inclusive reading as [pt.pse.presence.domain.objects.Absence.covers]. */
    private fun covers(date: LocalDate, start: LocalDate, end: LocalDate): Boolean =
        !date.isBefore(start) && !date.isAfter(end)
}
