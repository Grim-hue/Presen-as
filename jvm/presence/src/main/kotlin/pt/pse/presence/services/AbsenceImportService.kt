package pt.pse.presence.services

import org.springframework.stereotype.Service
import pt.pse.presence.domain.objects.AbsenceImport
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.domain.objects.CommitReport
import pt.pse.presence.domain.objects.ImportPreview
import pt.pse.presence.domain.objects.ImportStatus
import pt.pse.presence.domain.objects.ParsedRow
import pt.pse.presence.domain.objects.RowOutcome
import pt.pse.presence.domain.plan.ImportReconciler
import pt.pse.presence.domain.plan.PlanConflictFinder
import pt.pse.presence.infrastructure.importer.AbsenceSheetParser
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.AbsenceImportError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.guarded
import pt.pse.presence.utils.loggerFor
import pt.pse.presence.utils.success
import java.io.InputStream
import java.time.LocalDate

/** One reviewed row, as the administrator resolved it in the preview. */
data class CommitRow(
    val line: Int,
    val name: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    /** Set by the administrator for a row the matcher could not resolve. */
    val userId: Int?,
    /** False leaves the row alone. Used to keep a hand-edited absence as it is. */
    val apply: Boolean
)

@Service
class AbsenceImportService(
    private val transactionManager: TransactionManager,
    private val parser: AbsenceSheetParser,
    private val reconciler: ImportReconciler,
    private val conflictFinder: PlanConflictFinder
) {

    private val log = loggerFor<AbsenceImportService>()

    fun history(): Either<AbsenceImportError, List<AbsenceImport>> =
        guarded(log, "AbsenceImportService.history", AbsenceImportError.DatabaseError) {
            transactionManager.run { ctx -> success(ctx.absenceImportRepository.findAll()) }
        }

    /**
     * Parses the file and reports what committing it would do. Writes a PENDING
     * import row but changes no absence, so an administrator can look before anything
     * moves.
     */
    fun preview(
        caller: AuthenticatedUser,
        filename: String,
        input: InputStream
    ): Either<AbsenceImportError, ImportPreview> =
        guarded(log, "AbsenceImportService.preview", AbsenceImportError.DatabaseError) {
            if (!caller.user.isAdmin) return@guarded failure(AbsenceImportError.NotAdmin)

            val sheet = try {
                parser.parse(input)
            } catch (e: AbsenceSheetParser.UnreadableSheet) {
                return@guarded failure(AbsenceImportError.Unreadable(e.message ?: "Ficheiro ilegível."))
            }
            if (sheet.rows.isEmpty() && sheet.rejected.isEmpty()) {
                return@guarded failure(AbsenceImportError.EmptyFile)
            }

            transactionManager.run { ctx ->
                val importId = ctx.absenceImportRepository.create(filename, caller.user.id, sheet.rows.size)
                val reconciliation = reconciler.reconcile(
                    parsed = sheet.rows,
                    users = ctx.appUserRepository.findAllActive(),
                    existing = ctx.absenceRepository.find(null, null, null, null)
                )
                success(
                    ImportPreview(
                        importId = importId,
                        filename = filename,
                        rows = reconciliation.rows,
                        rejected = sheet.rejected,
                        missing = reconciliation.missing
                    )
                )
            }
        }

    /**
     * Applies the reviewed rows.
     *
     * Outcomes are recomputed here against the database as it is now, rather than
     * trusting the ones the browser was shown: the preview may be minutes old, and
     * what it decided is a suggestion, not an instruction.
     *
     * The report also names the published days this import leaves contradicting
     * itself — somebody assigned to a date their férias now cover. The plan is not
     * touched: it was already sent, and rewriting it here would be a decision made
     * behind the administrator's back. Naming the day is as far as the code goes.
     */
    fun commit(
        caller: AuthenticatedUser,
        importId: Int,
        rows: List<CommitRow>
    ): Either<AbsenceImportError, CommitReport> =
        guarded(log, "AbsenceImportService.commit", AbsenceImportError.DatabaseError) {
            if (!caller.user.isAdmin) return@guarded failure(AbsenceImportError.NotAdmin)

            transactionManager.run { ctx ->
                val record = ctx.absenceImportRepository.findById(importId)
                    ?: return@run failure(AbsenceImportError.NotFound)
                if (record.status != ImportStatus.PENDING) {
                    return@run failure(AbsenceImportError.AlreadyResolved)
                }

                val applicable = rows.filter { it.apply }
                val reconciliation = reconciler.reconcile(
                    parsed = applicable.map { ParsedRow(it.line, it.name, it.startDate, it.endDate) },
                    users = ctx.appUserRepository.findAllActive(),
                    existing = ctx.absenceRepository.find(null, null, null, null),
                    manualMappings = applicable.mapNotNull { row -> row.userId?.let { row.line to it } }.toMap()
                )

                var inserted = 0
                var updated = 0
                var unchanged = 0
                var skipped = rows.count { !it.apply }

                reconciliation.rows.forEach { row ->
                    when (row.outcome) {
                        RowOutcome.NEW -> {
                            ctx.absenceRepository.insert(
                                userId = row.userId!!,
                                startDate = row.startDate,
                                endDate = row.endDate,
                                kind = AbsenceKind.VACATION,
                                source = AbsenceSource.IMPORT,
                                importId = importId,
                                note = null
                            )
                            inserted++
                        }
                        // A conflict reaching here was explicitly chosen by the
                        // administrator, so the file's version is applied.
                        RowOutcome.UPDATE, RowOutcome.CONFLICT -> {
                            ctx.absenceRepository.updateFromImport(
                                row.existingAbsenceId!!, row.startDate, row.endDate
                            )
                            updated++
                        }
                        RowOutcome.UNCHANGED -> unchanged++
                        RowOutcome.UNMATCHED -> skipped++
                    }
                }

                ctx.absenceImportRepository.setStatus(
                    importId, ImportStatus.COMMITTED, inserted + updated + unchanged
                )

                // What this commit leaves behind, not what it changed: a plan
                // contradicting an UNCHANGED row is as wrong as one contradicting a
                // NEW row, and the person resolving it is holding this report.
                val applied = reconciliation.rows.filter { it.userId != null }
                val conflicts = if (applied.isEmpty()) {
                    emptyList()
                } else {
                    val candidates = ctx.planRepository.findPublishedAssignments(
                        userIds = applied.map { it.userId!! }.toSet(),
                        from = applied.minOf { it.startDate },
                        to = applied.maxOf { it.endDate }
                    )
                    conflictFinder.conflicts(applied, candidates)
                }

                success(CommitReport(importId, inserted, updated, unchanged, skipped, conflicts))
            }
        }

    fun discard(caller: AuthenticatedUser, importId: Int): Either<AbsenceImportError, Int> =
        guarded(log, "AbsenceImportService.discard", AbsenceImportError.DatabaseError) {
            if (!caller.user.isAdmin) return@guarded failure(AbsenceImportError.NotAdmin)

            transactionManager.run { ctx ->
                val record = ctx.absenceImportRepository.findById(importId)
                    ?: return@run failure(AbsenceImportError.NotFound)
                if (record.status == ImportStatus.DISCARDED) {
                    return@run failure(AbsenceImportError.AlreadyResolved)
                }
                val removed = ctx.absenceImportRepository.deleteUneditedRowsOf(importId)
                ctx.absenceImportRepository.setStatus(importId, ImportStatus.DISCARDED)
                success(removed)
            }
        }
}
