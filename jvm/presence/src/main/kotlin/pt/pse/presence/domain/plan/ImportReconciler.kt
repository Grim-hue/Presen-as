package pt.pse.presence.domain.plan

import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.domain.objects.ParsedRow
import pt.pse.presence.domain.objects.PreviewRow
import pt.pse.presence.domain.objects.RowOutcome
import pt.pse.presence.domain.objects.User

/**
 * Decides what an import would do to what is already stored.
 *
 * Pure logic, so the rules can be tested without a database or a spreadsheet. The
 * rules exist because the file has no stable identifier for a row: the same person's
 * vacation can come back with different dates, and the only honest way to tell "this
 * is the same absence, moved" from "this is a new absence" is to look at overlap.
 */
@Component
class ImportReconciler(private val nameMatcher: NameMatcher) {

    data class Reconciliation(val rows: List<PreviewRow>, val missing: List<Absence>)

    fun reconcile(
        parsed: List<ParsedRow>,
        users: List<User>,
        existing: List<Absence>,
        /** Line number to user, supplied by the person resolving unmatched names. */
        manualMappings: Map<Int, Int> = emptyMap()
    ): Reconciliation {
        val importedByUser = existing
            .filter { it.source == AbsenceSource.IMPORT }
            .groupBy { it.user.id }

        val consumed = mutableSetOf<Int>()

        val rows = parsed.map { row ->
            val user = manualMappings[row.line]?.let { id -> users.firstOrNull { it.id == id } }
                ?: nameMatcher.match(row.name, users)

            if (user == null) return@map preview(row, RowOutcome.UNMATCHED, null, null)

            val candidates = importedByUser[user.id].orEmpty().filterNot { it.id in consumed }

            val identical = candidates.firstOrNull {
                it.startDate == row.startDate && it.endDate == row.endDate
            }
            if (identical != null) {
                consumed += identical.id
                return@map preview(row, RowOutcome.UNCHANGED, user, identical)
            }

            // Same person, overlapping period, different dates: the same absence with
            // its dates changed, not a second one.
            val moved = candidates.firstOrNull {
                it.startDate <= row.endDate && it.endDate >= row.startDate
            }
            if (moved != null) {
                consumed += moved.id
                val outcome = if (moved.manuallyEdited) RowOutcome.CONFLICT else RowOutcome.UPDATE
                return@map preview(row, outcome, user, moved)
            }

            preview(row, RowOutcome.NEW, user, null)
        }

        // Imported rows for people named in this file that the file no longer mentions.
        // Reported, never deleted: the file being incomplete is at least as likely as
        // the absence having been cancelled.
        val touchedUsers = rows.mapNotNull { it.userId }.toSet()
        val missing = existing.filter {
            it.source == AbsenceSource.IMPORT && it.user.id in touchedUsers && it.id !in consumed
        }

        return Reconciliation(rows, missing)
    }

    private fun preview(row: ParsedRow, outcome: RowOutcome, user: User?, existing: Absence?) = PreviewRow(
        line = row.line,
        name = row.name,
        startDate = row.startDate,
        endDate = row.endDate,
        outcome = outcome,
        userId = user?.id,
        existingAbsenceId = existing?.id,
        existingStartDate = existing?.startDate,
        existingEndDate = existing?.endDate
    )
}
