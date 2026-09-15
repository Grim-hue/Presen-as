package pt.pse.presence.http.models.absence

import jakarta.validation.constraints.Size
import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.models.auth.UserOutputModel
import java.time.LocalDate

data class CreateAbsenceInputModel(
    val userId: Int,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val kind: AbsenceKind = AbsenceKind.VACATION,
    @field:Size(max = 256, message = "no máximo 256 caracteres")
    val note: String? = null
)

data class UpdateAbsenceInputModel(
    val startDate: LocalDate,
    val endDate: LocalDate,
    val kind: AbsenceKind = AbsenceKind.VACATION,
    @field:Size(max = 256, message = "no máximo 256 caracteres")
    val note: String? = null
)

data class AbsenceOutputModel(
    val id: Int,
    val user: UserOutputModel,
    val startDate: LocalDate,
    val endDate: LocalDate,
    /** Inclusive of both ends, which is how the UI shows it and the generator reads it. */
    val days: Int,
    val kind: AbsenceKind,
    val source: String,
    val importId: Int?,
    val note: String?,
    val manuallyEdited: Boolean
)

object AbsenceOutputMapper {
    fun toDto(absence: Absence) = AbsenceOutputModel(
        id = absence.id,
        user = UserOutputMapper.toDto(absence.user),
        startDate = absence.startDate,
        endDate = absence.endDate,
        days = (absence.endDate.toEpochDay() - absence.startDate.toEpochDay() + 1).toInt(),
        kind = absence.kind,
        source = absence.source.name,
        importId = absence.importId,
        note = absence.note,
        manuallyEdited = absence.manuallyEdited
    )
}
