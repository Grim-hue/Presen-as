package pt.pse.presence.domain.plan

import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.domain.objects.ParsedRow
import pt.pse.presence.domain.objects.RowOutcome
import pt.pse.presence.domain.objects.User
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ImportReconcilerTests {

    private val matcher = NameMatcher()
    private val reconciler = ImportReconciler(matcher)

    private val andre = User(1, "André", "Freitas", "andre.freitas@pse.pt", "andre.freitas", true)
    private val tiago = User(2, "Tiago", "Sousa", "tiago.sousa@pse.pt", "tiago.sousa", false)
    private val joao = User(3, "João", "Vieira", "joao.vieira@pse.pt", "joao.vieira", false)
    private val users = listOf(andre, tiago, joao)

    private fun d(s: String) = LocalDate.parse(s)

    private fun absence(
        id: Int,
        user: User,
        start: String,
        end: String,
        source: AbsenceSource = AbsenceSource.IMPORT,
        edited: Boolean = false
    ) = Absence(id, user, d(start), d(end), AbsenceKind.VACATION, source, 1, null, edited)

    private fun row(line: Int, name: String, start: String, end: String) =
        ParsedRow(line, name, d(start), d(end))

    @Test
    fun `an unseen period is new`() {
        val result = reconciler.reconcile(
            listOf(row(2, "André Freitas", "2026-08-03", "2026-08-21")), users, emptyList()
        )
        assertEquals(RowOutcome.NEW, result.rows.single().outcome)
        assertEquals(andre.id, result.rows.single().userId)
    }

    @Test
    fun `an identical period is unchanged, not a duplicate insert`() {
        val existing = listOf(absence(10, andre, "2026-08-03", "2026-08-21"))
        val result = reconciler.reconcile(
            listOf(row(2, "André Freitas", "2026-08-03", "2026-08-21")), users, existing
        )
        assertEquals(RowOutcome.UNCHANGED, result.rows.single().outcome)
        assertEquals(10, result.rows.single().existingAbsenceId)
        assertTrue(result.missing.isEmpty(), "an unchanged row must not be reported as missing")
    }

    @Test
    fun `shifted dates update the same absence rather than adding a second`() {
        val existing = listOf(absence(10, andre, "2026-08-03", "2026-08-21"))
        val result = reconciler.reconcile(
            listOf(row(2, "André Freitas", "2026-08-05", "2026-08-25")), users, existing
        )
        val only = result.rows.single()
        assertEquals(RowOutcome.UPDATE, only.outcome)
        assertEquals(10, only.existingAbsenceId)
        assertEquals(d("2026-08-03"), only.existingStartDate)
    }

    @Test
    fun `a hand edited row becomes a conflict instead of being overwritten`() {
        val existing = listOf(absence(10, andre, "2026-08-03", "2026-08-21", edited = true))
        val result = reconciler.reconcile(
            listOf(row(2, "André Freitas", "2026-08-05", "2026-08-25")), users, existing
        )
        assertEquals(RowOutcome.CONFLICT, result.rows.single().outcome)
    }

    @Test
    fun `a non overlapping second period is a new absence, not a move`() {
        val existing = listOf(absence(10, andre, "2026-08-03", "2026-08-21"))
        val result = reconciler.reconcile(
            listOf(row(2, "André Freitas", "2026-12-20", "2026-12-31")), users, existing
        )
        assertEquals(RowOutcome.NEW, result.rows.single().outcome)
        assertEquals(listOf(10), result.missing.map { it.id }, "the August row is no longer in the file")
    }

    @Test
    fun `an unknown name is reported rather than guessed`() {
        val result = reconciler.reconcile(
            listOf(row(2, "Maria Silva", "2026-08-03", "2026-08-21")), users, emptyList()
        )
        assertEquals(RowOutcome.UNMATCHED, result.rows.single().outcome)
        assertNull(result.rows.single().userId)
    }

    @Test
    fun `a manual mapping resolves an unmatched name`() {
        val result = reconciler.reconcile(
            listOf(row(2, "Maria Silva", "2026-08-03", "2026-08-21")),
            users, emptyList(), manualMappings = mapOf(2 to tiago.id)
        )
        assertEquals(RowOutcome.NEW, result.rows.single().outcome)
        assertEquals(tiago.id, result.rows.single().userId)
    }

    @Test
    fun `a manually entered absence is never touched by an import`() {
        val existing = listOf(absence(10, andre, "2026-08-03", "2026-08-21", source = AbsenceSource.MANUAL))
        val result = reconciler.reconcile(
            listOf(row(2, "André Freitas", "2026-08-05", "2026-08-25")), users, existing
        )
        assertEquals(RowOutcome.NEW, result.rows.single().outcome, "a manual row is not import-owned")
        assertTrue(result.missing.isEmpty(), "a manual row can never go missing from a file")
    }

    @Test
    fun `two periods for one person are matched one to one, not both to the same row`() {
        val existing = listOf(
            absence(10, andre, "2026-08-03", "2026-08-21"),
            absence(11, andre, "2026-12-20", "2026-12-31")
        )
        val result = reconciler.reconcile(
            listOf(
                row(2, "André Freitas", "2026-08-03", "2026-08-21"),
                row(3, "André Freitas", "2026-12-20", "2026-12-31")
            ),
            users, existing
        )
        assertEquals(listOf(RowOutcome.UNCHANGED, RowOutcome.UNCHANGED), result.rows.map { it.outcome })
        assertEquals(listOf(10, 11), result.rows.mapNotNull { it.existingAbsenceId })
        assertTrue(result.missing.isEmpty())
    }

    @Test
    fun `another person's absence is not reported missing just because they are not in the file`() {
        val existing = listOf(absence(11, tiago, "2026-07-01", "2026-07-15"))
        val result = reconciler.reconcile(
            listOf(row(2, "André Freitas", "2026-08-03", "2026-08-21")), users, existing
        )
        assertTrue(result.missing.isEmpty(), "Tiago was never mentioned, so nothing of his is missing")
    }
}
