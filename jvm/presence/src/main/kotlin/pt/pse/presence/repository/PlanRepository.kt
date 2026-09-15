package pt.pse.presence.repository

import pt.pse.presence.domain.objects.GeneratedDay
import pt.pse.presence.domain.objects.HistoricDay
import pt.pse.presence.domain.objects.Plan
import pt.pse.presence.domain.objects.PlanConflict
import pt.pse.presence.domain.objects.PlanDayContext
import java.time.LocalDate

interface PlanRepository {

    fun create(teamId: Int, periodStart: LocalDate, periodEnd: LocalDate, generatedBy: Int): Int

    fun insertDays(planId: Int, days: List<GeneratedDay>)

    fun findById(planId: Int): Plan?

    /** Summaries, without days. */
    fun findByTeam(teamId: Int, year: Int?): List<Plan>

    fun publish(planId: Int): Boolean

    /** Replaces the free text carried into the generated email. Null clears it. */
    fun updateNotes(planId: Int, notes: String?): Boolean

    fun delete(planId: Int): Boolean

    /**
     * Published days from [from] up to but excluding [before], for the fairness
     * replay. Only published plans count: a draft is a proposal, not history.
     */
    fun findPublishedHistory(teamId: Int, from: LocalDate, before: LocalDate): List<HistoricDay>

    /**
     * Published assignments held by [userIds] between [from] and [to], both
     * inclusive, as candidates for the import commit's conflict report.
     *
     * Candidates, not verdicts: whether a date is actually covered by an absence
     * the commit leaves behind is a domain rule, not a join. The window is here
     * only to keep the candidate set small.
     */
    fun findPublishedAssignments(userIds: Set<Int>, from: LocalDate, to: LocalDate): List<PlanConflict>

    fun findDayId(planId: Int, date: LocalDate): Int?

    fun replaceAssignments(planDayId: Int, userIds: List<Int>, requiredCount: Int, understaffed: Boolean)

    /** One day with its assignments, plus the plan and team it belongs to. */
    fun findDayContext(planDayId: Int): PlanDayContext?

    /**
     * Moves one assignment from [fromUserId] to [toUserId] on one day.
     *
     * Deliberately not [replaceAssignments], which recomputes `required_count` from
     * the list it is handed. A swap must leave `required_count` and `understaffed`
     * exactly as they were, or the fairness replay would derive a different expected
     * share for everybody on that day.
     *
     * False when the day no longer carries [fromUserId] or already carries
     * [toUserId], so a concurrent edit is a refusal rather than a constraint
     * violation.
     */
    fun reassign(planDayId: Int, fromUserId: Int, toUserId: Int): Boolean
}
