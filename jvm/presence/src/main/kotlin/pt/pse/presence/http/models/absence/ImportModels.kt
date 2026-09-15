package pt.pse.presence.http.models.absence

import pt.pse.presence.domain.objects.AbsenceImport
import pt.pse.presence.domain.objects.CommitReport
import pt.pse.presence.domain.objects.ImportPreview
import pt.pse.presence.domain.objects.PreviewRow
import pt.pse.presence.domain.objects.RejectedRow
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.models.auth.UserOutputModel
import java.time.LocalDate
import java.time.OffsetDateTime

data class CommitRowInputModel(
    val line: Int,
    val name: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val userId: Int? = null,
    val apply: Boolean = true
)

data class CommitImportInputModel(val rows: List<CommitRowInputModel>)

data class PreviewRowOutputModel(
    val line: Int,
    val name: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val outcome: String,
    val userId: Int?,
    val existingAbsenceId: Int?,
    val existingStartDate: LocalDate?,
    val existingEndDate: LocalDate?
)

data class ImportPreviewOutputModel(
    val importId: Int,
    val filename: String,
    val rows: List<PreviewRowOutputModel>,
    val rejected: List<RejectedRow>,
    val missing: List<AbsenceOutputModel>,
    val summary: Map<String, Int>
)

data class ImportOutputModel(
    val id: Int,
    val filename: String,
    val uploadedBy: UserOutputModel,
    val uploadedAt: OffsetDateTime,
    val rowCount: Int,
    val status: String
)

data class PlanConflictOutputModel(
    val planId: Int,
    val teamId: Int,
    val date: LocalDate,
    val userId: Int
)

data class CommitReportOutputModel(
    val importId: Int,
    val inserted: Int,
    val updated: Int,
    val unchanged: Int,
    val skipped: Int,
    val conflicts: List<PlanConflictOutputModel>
)

object ImportOutputMapper {

    fun toDto(row: PreviewRow) = PreviewRowOutputModel(
        line = row.line,
        name = row.name,
        startDate = row.startDate,
        endDate = row.endDate,
        outcome = row.outcome.name,
        userId = row.userId,
        existingAbsenceId = row.existingAbsenceId,
        existingStartDate = row.existingStartDate,
        existingEndDate = row.existingEndDate
    )

    fun toDto(preview: ImportPreview) = ImportPreviewOutputModel(
        importId = preview.importId,
        filename = preview.filename,
        rows = preview.rows.map(::toDto),
        rejected = preview.rejected,
        missing = preview.missing.map(AbsenceOutputMapper::toDto),
        // Counted server side so the UI shows the same totals the service acted on.
        summary = preview.rows.groupingBy { it.outcome.name }.eachCount()
    )

    fun toDto(record: AbsenceImport) = ImportOutputModel(
        id = record.id,
        filename = record.filename,
        uploadedBy = UserOutputMapper.toDto(record.uploadedBy),
        uploadedAt = record.uploadedAt,
        rowCount = record.rowCount,
        status = record.status.name
    )

    fun toDto(report: CommitReport) = CommitReportOutputModel(
        importId = report.importId,
        inserted = report.inserted,
        updated = report.updated,
        unchanged = report.unchanged,
        skipped = report.skipped,
        conflicts = report.conflicts.map { conflict ->
            PlanConflictOutputModel(
                planId = conflict.planId,
                teamId = conflict.teamId,
                date = conflict.date,
                userId = conflict.userId
            )
        }
    )
}
