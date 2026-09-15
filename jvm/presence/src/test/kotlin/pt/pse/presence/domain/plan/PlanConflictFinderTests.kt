package pt.pse.presence.domain.plan

import pt.pse.presence.domain.objects.PlanConflict
import pt.pse.presence.domain.objects.PreviewRow
import pt.pse.presence.domain.objects.RowOutcome
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PlanConflictFinderTests {

    private val finder = PlanConflictFinder()

    private fun d(s: String) = LocalDate.parse(s)

    private fun row(line: Int, userId: Int?, start: String, end: String) = PreviewRow(
        line = line,
        name = "name $line",
        startDate = d(start),
        endDate = d(end),
        outcome = RowOutcome.NEW,
        userId = userId,
        existingAbsenceId = null,
        existingStartDate = null,
        existingEndDate = null
    )

    private fun assignment(date: String, userId: Int, planId: Int = 1, teamId: Int = 1) =
        PlanConflict(planId, teamId, d(date), userId)

    @Test
    fun `an assignment inside a committed absence is a conflict`() {
        val rows = listOf(row(2, 1, "2026-09-28", "2026-10-02"))
        val assignments = listOf(assignment("2026-09-28", 1), assignment("2026-10-12", 1))

        val conflicts = finder.conflicts(rows, assignments)

        assertEquals(listOf(assignment("2026-09-28", 1)), conflicts)
    }

    @Test
    fun `the bounds of the absence count as covered, because both are inclusive`() {
        val rows = listOf(row(2, 1, "2026-09-28", "2026-10-02"))
        val assignments = listOf(
            assignment("2026-09-28", 1),
            assignment("2026-10-02", 1)
        )

        assertEquals(2, finder.conflicts(rows, assignments).size)
    }

    @Test
    fun `an assignment of somebody else is not this absence's conflict`() {
        val rows = listOf(row(2, 1, "2026-09-28", "2026-10-02"))
        val assignments = listOf(assignment("2026-09-28", 2))

        assertTrue(finder.conflicts(rows, assignments).isEmpty())
    }

    @Test
    fun `an unchanged row reports its conflicts too`() {
        // A re-import that changes nothing still leaves the plan contradicting the
        // férias it confirms, and the person reading the report is the one holding it.
        val rows = listOf(row(2, 1, "2026-09-28", "2026-10-02").copy(outcome = RowOutcome.UNCHANGED))
        val assignments = listOf(assignment("2026-09-28", 1))

        assertEquals(1, finder.conflicts(rows, assignments).size)
    }

    @Test
    fun `an unmatched row has nobody to conflict with`() {
        val rows = listOf(row(2, null, "2026-09-28", "2026-10-02"))
        val assignments = listOf(assignment("2026-09-28", 1))

        assertTrue(finder.conflicts(rows, assignments).isEmpty())
    }

    @Test
    fun `two adjacent rows covering one day report it once`() {
        val rows = listOf(
            row(2, 1, "2026-09-21", "2026-09-25"),
            row(3, 1, "2026-09-26", "2026-09-30")
        )
        val assignments = listOf(assignment("2026-09-28", 1))

        assertEquals(1, finder.conflicts(rows, assignments).size)
    }
}
