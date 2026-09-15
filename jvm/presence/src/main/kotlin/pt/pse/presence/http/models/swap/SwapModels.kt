package pt.pse.presence.http.models.swap

import jakarta.validation.constraints.Size
import pt.pse.presence.domain.objects.SwapRequest
import pt.pse.presence.domain.objects.SwapSide
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.models.auth.UserOutputModel
import java.time.LocalDate
import java.time.OffsetDateTime

/**
 * [targetUserId] is not implied by [targetPlanDayId]: a day carries everybody on it,
 * and the request is against one of them.
 */
data class CreateSwapInputModel(
    val myPlanDayId: Int,
    val targetPlanDayId: Int,
    val targetUserId: Int,
    @field:Size(max = 256, message = "no máximo 256 caracteres")
    val note: String? = null
)

data class SwapSideOutputModel(
    val user: UserOutputModel,
    val planDayId: Int,
    val planId: Int,
    val teamId: Int,
    val date: LocalDate,
    /** Everybody on that day, so the browser can name who else is affected. */
    val assigned: List<UserOutputModel>
)

data class SwapRequestOutputModel(
    val id: Int,
    val requester: SwapSideOutputModel,
    val target: SwapSideOutputModel,
    val status: String,
    val note: String?,
    val createdAt: OffsetDateTime,
    val resolvedAt: OffsetDateTime?
)

object SwapOutputMapper {

    fun toDto(side: SwapSide) = SwapSideOutputModel(
        user = UserOutputMapper.toDto(side.user),
        planDayId = side.day.id,
        planId = side.planId,
        teamId = side.teamId,
        date = side.day.date,
        assigned = side.day.assigned.map(UserOutputMapper::toDto)
    )

    fun toDto(request: SwapRequest) = SwapRequestOutputModel(
        id = request.id,
        requester = toDto(request.requester),
        target = toDto(request.target),
        status = request.status.name,
        note = request.note,
        createdAt = request.createdAt,
        resolvedAt = request.resolvedAt
    )
}
