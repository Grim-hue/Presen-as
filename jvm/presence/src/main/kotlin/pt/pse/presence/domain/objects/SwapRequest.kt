package pt.pse.presence.domain.objects

import java.time.OffsetDateTime

enum class SwapStatus { PENDING, APPROVED, REJECTED, CANCELLED }

/**
 * One half of a proposed exchange: a member, the day they hold, and the plan that day
 * belongs to.
 *
 * The plan is carried rather than looked up again because both the team and the
 * publication status are rules the exchange turns on, and reading them from the same
 * row the day came from is what stops the two disagreeing.
 */
data class SwapSide(
    val user: User,
    val teamId: Int,
    val planId: Int,
    val planStatus: PlanStatus,
    val day: PlanDay
)

data class SwapRequest(
    val id: Int,
    val requester: SwapSide,
    val target: SwapSide,
    val status: SwapStatus,
    val note: String?,
    val createdAt: OffsetDateTime,
    /** Null exactly while the request is pending. */
    val resolvedAt: OffsetDateTime?
)
