package pt.pse.presence.http.models.plan

import jakarta.validation.constraints.Size
import pt.pse.presence.domain.objects.Plan
import pt.pse.presence.domain.objects.PlanDay
import pt.pse.presence.domain.plan.PlanEmailRenderer
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.models.auth.UserOutputModel
import pt.pse.presence.services.MemberBalance
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import kotlin.math.round

data class GeneratePlanInputModel(
    val teamId: Int,
    val from: LocalDate,
    val to: LocalDate,
    /** Members who take a slot on every day. Absent means nobody is fixed. */
    val pinnedUserIds: List<Int> = emptyList(),
    /** Members this plan does not schedule, without taking them off the team. */
    val excludedUserIds: List<Int> = emptyList()
)

data class SetDayAssignmentsInputModel(val userIds: List<Int>)

/**
 * A plan that was worked out and not written down.
 *
 * The same shape the real thing has, minus the identifiers a row would carry, because
 * nothing here is a row. It exists so the choice can be seen before it is made: the
 * balances are the part worth looking at, since fixing somebody moves their saldo and
 * a number is a better way to find that out than a published plan is.
 */
data class PlanPreviewOutputModel(
    val days: List<PreviewDayOutputModel>,
    val balances: List<PreviewBalanceOutputModel>
)

data class PreviewDayOutputModel(
    val date: LocalDate,
    val weekday: Int,
    val isHoliday: Boolean,
    val holidayName: String?,
    val requiredCount: Int,
    val understaffed: Boolean,
    val assigned: List<UserOutputModel>
)

data class PreviewBalanceOutputModel(
    val user: UserOutputModel,
    val expected: Double,
    val assigned: Int,
    val debt: Double
)

data class UpdatePlanNotesInputModel(
    @field:Size(max = 2000, message = "no máximo 2000 caracteres")
    val notes: String?
)

data class PlanDayOutputModel(
    /** Addresses the day itself, which is what a swap request is raised against. */
    val id: Int,
    val date: LocalDate,
    val weekday: Int,
    val isHoliday: Boolean,
    val holidayName: String?,
    val requiredCount: Int,
    val understaffed: Boolean,
    val assigned: List<UserOutputModel>
)

data class PlanOutputModel(
    val id: Int,
    val teamId: Int,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val status: String,
    val generatedAt: OffsetDateTime,
    val generatedBy: UserOutputModel,
    val publishedAt: OffsetDateTime?,
    val notes: String?,
    val understaffedDays: Int,
    val days: List<PlanDayOutputModel>
)

data class BalanceOutputModel(
    val user: UserOutputModel,
    val joinedAt: LocalDate,
    val assigned: Int,
    val expected: Double,
    val debt: Double
)

data class EmailOutputModel(val subject: String, val html: String, val text: String)

/**
 * One send's departures from the team's template, and how much of the plan goes with
 * it. Everything is optional and nothing is stored: the next message starts from the
 * team's wording again, which is what makes this a draft rather than a setting.
 */
data class RenderEmailInputModel(
    @field:Size(max = 120, message = "no máximo 120 caracteres")
    val greeting: String? = null,
    @field:Size(max = 300, message = "no máximo 300 caracteres")
    val subject: String? = null,
    @field:Size(max = 2000, message = "no máximo 2000 caracteres")
    val intro: String? = null,
    @field:Size(max = 2000, message = "no máximo 2000 caracteres")
    val notes: String? = null,
    /** `2026-09` each. Absent or empty is the whole plan. */
    val months: List<YearMonth>? = null,
    val nameMembers: Boolean = true,
    val weekends: Boolean = true,
    val holidays: Boolean = true
) {
    fun toOptions() = PlanEmailRenderer.Options(
        greeting = greeting,
        subject = subject,
        intro = intro,
        notes = notes,
        months = months?.takeIf { it.isNotEmpty() }?.toSet(),
        nameMembers = nameMembers,
        weekends = weekends,
        holidays = holidays
    )
}

object PlanOutputMapper {

    fun toDto(day: PlanDay) = PlanDayOutputModel(
        id = day.id,
        date = day.date,
        weekday = day.date.dayOfWeek.value,
        isHoliday = day.isHoliday,
        holidayName = day.holidayName,
        requiredCount = day.requiredCount,
        understaffed = day.understaffed,
        assigned = day.assigned.map(UserOutputMapper::toDto)
    )

    fun toDto(plan: Plan) = PlanOutputModel(
        id = plan.id,
        teamId = plan.teamId,
        periodStart = plan.periodStart,
        periodEnd = plan.periodEnd,
        status = plan.status.name,
        generatedAt = plan.generatedAt,
        generatedBy = UserOutputMapper.toDto(plan.generatedBy),
        publishedAt = plan.publishedAt,
        notes = plan.notes,
        understaffedDays = plan.days.count { it.understaffed },
        days = plan.days.map(::toDto)
    )

    fun toDto(entry: MemberBalance) = BalanceOutputModel(
        user = UserOutputMapper.toDto(entry.member.user),
        joinedAt = entry.member.joinedAt,
        assigned = entry.balance.assigned,
        // Rounded for display only. The ledger itself keeps full precision.
        expected = round(entry.balance.expected * 100) / 100,
        debt = round(entry.balance.debt * 100) / 100
    )

    fun toDto(email: PlanEmailRenderer.RenderedEmail) =
        EmailOutputModel(email.subject, email.html, email.text)
}
