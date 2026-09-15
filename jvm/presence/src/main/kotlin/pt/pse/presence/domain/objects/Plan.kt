package pt.pse.presence.domain.objects

import java.time.LocalDate
import java.time.OffsetDateTime

enum class PlanStatus { DRAFT, PUBLISHED }

/**
 * How much on-site duty a member has done against how much they owed.
 *
 * [expected] is fractional on purpose: on a day when three members are eligible for
 * two places, each of them takes on two thirds of a day of obligation.
 */
data class Balance(val userId: Int, val expected: Double, val assigned: Int) {
    /** Positive means owed: this member is due to be picked before the others. */
    val debt: Double get() = expected - assigned
}

data class GeneratedDay(
    val date: LocalDate,
    val isHoliday: Boolean,
    val holidayName: String?,
    val requiredCount: Int,
    val understaffed: Boolean,
    val assignedUserIds: List<Int>
)

/**
 * A day that already happened, read back from a published plan.
 *
 * Carries the requiredCount that was in force then rather than the team's current
 * rule, so changing the rule does not rewrite history when balances are replayed.
 */
data class HistoricDay(
    val date: LocalDate,
    val isHoliday: Boolean,
    val requiredCount: Int,
    val assignedUserIds: List<Int>
)

data class GenerationResult(
    val days: List<GeneratedDay>,
    val balances: Map<Int, Balance>
)

data class PlanDay(
    val id: Int,
    val date: LocalDate,
    val isHoliday: Boolean,
    val holidayName: String?,
    val requiredCount: Int,
    val understaffed: Boolean,
    val assigned: List<User>
)

/**
 * One day with enough of its plan to judge it by.
 *
 * A swap turns on the team and the publication status as much as on the day itself,
 * and reading all three from the same row is what stops them disagreeing.
 */
data class PlanDayContext(
    val planId: Int,
    val teamId: Int,
    val planStatus: PlanStatus,
    val day: PlanDay
)

/**
 * A published plan day that puts somebody on a date an absence now covers.
 *
 * Plans are frozen at generation, so an absence committed afterwards — an import,
 * most often — can leave a published day saying the opposite of the férias the
 * sheet asserts. Reported, never repaired: a published plan was already sent, and
 * rewriting it behind the administrator's back is a decision nobody gave the code.
 */
data class PlanConflict(
    val planId: Int,
    val teamId: Int,
    val date: LocalDate,
    val userId: Int
)

data class Plan(
    val id: Int,
    val teamId: Int,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val status: PlanStatus,
    val generatedAt: OffsetDateTime,
    val generatedBy: User,
    val publishedAt: OffsetDateTime?,
    /** Free text for the email, one paragraph per line. Null when there is nothing to add. */
    val notes: String?,
    val days: List<PlanDay>
)
