package pt.pse.presence.domain.objects

import java.time.LocalDate
import java.time.OffsetDateTime

enum class ImportStatus { PENDING, COMMITTED, DISCARDED }

data class AbsenceImport(
    val id: Int,
    val filename: String,
    val uploadedBy: User,
    val uploadedAt: OffsetDateTime,
    val rowCount: Int,
    val status: ImportStatus
)

/** One absence period read out of the spreadsheet, before it is matched to a user. */
data class ParsedRow(
    /** Line number in the sheet, so a problem can be pointed at. */
    val line: Int,
    val name: String,
    val startDate: LocalDate,
    val endDate: LocalDate
)

/** A row the parser could not use, kept so the upload can explain itself. */
data class RejectedRow(val line: Int, val reason: String)

data class ParsedSheet(
    val rows: List<ParsedRow>,
    val rejected: List<RejectedRow>
)

/** What a parsed row will do if the import is committed. */
enum class RowOutcome {
    /** No matching row exists; it will be inserted. */
    NEW,

    /** An identical row already exists; nothing will change. */
    UNCHANGED,

    /** An imported row for this person changed dates; it will be updated. */
    UPDATE,

    /** Changed, but the existing row was edited by hand. Left alone unless chosen. */
    CONFLICT,

    /** The name did not match any user. Needs a mapping before it can be committed. */
    UNMATCHED
}

data class PreviewRow(
    val line: Int,
    val name: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val outcome: RowOutcome,
    val userId: Int?,
    /** The absence this row would touch, when there is one. */
    val existingAbsenceId: Int?,
    val existingStartDate: LocalDate?,
    val existingEndDate: LocalDate?
)

data class ImportPreview(
    val importId: Int,
    val filename: String,
    val rows: List<PreviewRow>,
    val rejected: List<RejectedRow>,
    /** Rows from earlier imports that this file no longer mentions. Never auto-deleted. */
    val missing: List<Absence>
)

data class CommitReport(
    val importId: Int,
    val inserted: Int,
    val updated: Int,
    val unchanged: Int,
    val skipped: Int,
    /**
     * Published days this import leaves assigning somebody to a date their férias
     * now cover. Empty is the ordinary case; a list is the plan needing a hand,
     * not the import having failed.
     */
    val conflicts: List<PlanConflict>
)
