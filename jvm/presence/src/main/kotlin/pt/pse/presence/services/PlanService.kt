package pt.pse.presence.services

import org.jdbi.v3.core.statement.UnableToExecuteStatementException
import org.postgresql.util.PSQLException
import org.springframework.stereotype.Service
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.domain.objects.GenerationResult
import pt.pse.presence.domain.objects.Balance
import pt.pse.presence.domain.objects.Plan
import pt.pse.presence.domain.objects.PlanStatus
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.domain.plan.PlanEmailRenderer
import pt.pse.presence.domain.plan.PlanGenerator
import pt.pse.presence.repository.Transaction
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.PlanError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.guarded
import pt.pse.presence.utils.loggerFor
import pt.pse.presence.utils.success
import java.time.LocalDate
import java.time.temporal.ChronoUnit

data class MemberBalance(val member: TeamMember, val balance: Balance)

@Service
class PlanService(
    private val transactionManager: TransactionManager,
    private val generator: PlanGenerator,
    private val emailRenderer: PlanEmailRenderer
) {

    private val log = loggerFor<PlanService>()

    fun list(teamId: Int, year: Int?): Either<PlanError, List<Plan>> =
        guarded(log, "PlanService.list", PlanError.DatabaseError) {
            transactionManager.run { ctx -> success(ctx.planRepository.findByTeam(teamId, year)) }
        }

    fun get(planId: Int): Either<PlanError, Plan> =
        guarded(log, "PlanService.get", PlanError.DatabaseError) {
            transactionManager.run { ctx ->
                ctx.planRepository.findById(planId)?.let { success(it) } ?: failure(PlanError.NotFound)
            }
        }

    /**
     * What [generate] would produce, without producing it.
     *
     * The same generator on the same inputs, so a preview cannot disagree with what
     * follows: anything else would be a second implementation of the rule §6 exists to
     * keep single. It writes nothing at all, so it is safe to run on every keystroke.
     */
    fun preview(
        caller: AuthenticatedUser,
        teamId: Int,
        from: LocalDate,
        to: LocalDate,
        pinned: Set<Int> = emptySet(),
        excluded: Set<Int> = emptySet()
    ): Either<PlanError, Pair<GenerationResult, List<TeamMember>>> =
        guarded(log, "PlanService.preview", PlanError.DatabaseError) {
            if (!caller.user.isAdmin) return@guarded failure(PlanError.NotAdmin)
            if (to.isBefore(from)) return@guarded failure(PlanError.EndBeforeStart)
            if (ChronoUnit.DAYS.between(from, to) > MAX_PERIOD_DAYS) {
                return@guarded failure(PlanError.PeriodTooLong)
            }
            if (pinned.intersect(excluded).isNotEmpty()) return@guarded failure(PlanError.PinnedAndExcluded)

            transactionManager.run { ctx ->
                val team = ctx.teamRepository.findById(teamId) ?: return@run failure(PlanError.TeamNotFound)
                val members = ctx.teamRepository.findMembers(teamId)
                val result = generator.generate(
                    team = team,
                    members = members,
                    holidays = ctx.holidayRepository.findBetween(from, to),
                    absences = ctx.absenceRepository.findOverlapping(from, to),
                    from = from,
                    to = to,
                    openingBalance = openingBalance(ctx, team, members, from),
                    pinned = pinned,
                    excluded = excluded
                )
                if (result.days.isEmpty()) return@run failure(PlanError.NoDaysInPeriod)
                success(result to members)
            }
        }

    fun generate(
        caller: AuthenticatedUser,
        teamId: Int,
        from: LocalDate,
        to: LocalDate,
        pinned: Set<Int> = emptySet(),
        excluded: Set<Int> = emptySet()
    ): Either<PlanError, Plan> = guarded(log, "PlanService.generate", PlanError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(PlanError.NotAdmin)
        if (to.isBefore(from)) return@guarded failure(PlanError.EndBeforeStart)
        if (ChronoUnit.DAYS.between(from, to) > MAX_PERIOD_DAYS) return@guarded failure(PlanError.PeriodTooLong)
        // Asking for somebody on every day and on no day at once has no reading, and
        // silently letting one win would make the plan depend on which.
        if (pinned.intersect(excluded).isNotEmpty()) return@guarded failure(PlanError.PinnedAndExcluded)

        transactionManager.run { ctx ->
            val team = ctx.teamRepository.findById(teamId) ?: return@run failure(PlanError.TeamNotFound)
            val members = ctx.teamRepository.findMembers(teamId)

            val result = generator.generate(
                team = team,
                members = members,
                holidays = ctx.holidayRepository.findBetween(from, to),
                absences = ctx.absenceRepository.findOverlapping(from, to),
                from = from,
                to = to,
                openingBalance = openingBalance(ctx, team, members, from),
                pinned = pinned,
                excluded = excluded
            )
            if (result.days.isEmpty()) return@run failure(PlanError.NoDaysInPeriod)

            val planId = ctx.planRepository.create(teamId, from, to, caller.user.id)
            ctx.planRepository.insertDays(planId, result.days)
            ctx.planRepository.findById(planId)?.let { success(it) } ?: failure(PlanError.DatabaseError)
        }
    }

    fun publish(caller: AuthenticatedUser, planId: Int): Either<PlanError, Plan> =
        guarded(log, "PlanService.publish", PlanError.DatabaseError) {
            if (!caller.user.isAdmin) return@guarded failure(PlanError.NotAdmin)
            try {
                transactionManager.run { ctx ->
                    val plan = ctx.planRepository.findById(planId) ?: return@run failure(PlanError.NotFound)
                    if (plan.status == PlanStatus.PUBLISHED) return@run failure(PlanError.AlreadyPublished)
                    if (!ctx.planRepository.publish(planId)) return@run failure(PlanError.DatabaseError)
                    ctx.planRepository.findById(planId)?.let { success(it) } ?: failure(PlanError.DatabaseError)
                }
            } catch (e: UnableToExecuteStatementException) {
                // The exclusion constraint on psepre_plan refused an overlapping
                // published period. That is a rule, not a fault, so it gets a sentence
                // rather than a 500.
                if (isExclusionViolation(e)) failure(PlanError.OverlapsPublished) else throw e
            }
        }

    fun delete(caller: AuthenticatedUser, planId: Int): Either<PlanError, Unit> =
        guarded(log, "PlanService.delete", PlanError.DatabaseError) {
            if (!caller.user.isAdmin) return@guarded failure(PlanError.NotAdmin)
            transactionManager.run { ctx ->
                ctx.planRepository.findById(planId) ?: return@run failure(PlanError.NotFound)
                if (ctx.planRepository.delete(planId)) success(Unit) else failure(PlanError.DatabaseError)
            }
        }

    /** Replaces the people on one day, for a swap the team agreed among themselves. */
    fun setDayAssignments(
        caller: AuthenticatedUser,
        planId: Int,
        date: LocalDate,
        userIds: List<Int>
    ): Either<PlanError, Plan> = guarded(log, "PlanService.setDayAssignments", PlanError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(PlanError.NotAdmin)

        transactionManager.run { ctx ->
            val plan = ctx.planRepository.findById(planId) ?: return@run failure(PlanError.NotFound)
            val dayId = ctx.planRepository.findDayId(planId, date) ?: return@run failure(PlanError.DayNotFound)
            val team = ctx.teamRepository.findById(plan.teamId) ?: return@run failure(PlanError.TeamNotFound)

            val eligibleIds = ctx.teamRepository.findMembers(plan.teamId)
                .filter { it.isActiveOn(date) }
                .map { it.user.id }
                .toSet()
            val distinct = userIds.distinct()
            if (!eligibleIds.containsAll(distinct)) return@run failure(PlanError.NotATeamMember)

            ctx.planRepository.replaceAssignments(
                planDayId = dayId,
                userIds = distinct,
                requiredCount = distinct.size,
                understaffed = distinct.size < team.requiredOnSite
            )
            ctx.planRepository.findById(planId)?.let { success(it) } ?: failure(PlanError.DatabaseError)
        }
    }

    /** The ledger as it stands, from published plans only. */
    fun balance(teamId: Int, upTo: LocalDate?): Either<PlanError, List<MemberBalance>> =
        guarded(log, "PlanService.balance", PlanError.DatabaseError) {
            transactionManager.run { ctx ->
                val team = ctx.teamRepository.findById(teamId) ?: return@run failure(PlanError.TeamNotFound)
                val members = ctx.teamRepository.findMembers(teamId)
                val end = upTo ?: LocalDate.of(9999, 12, 31)
                val balances = generator.replay(
                    members = members,
                    absences = ctx.absenceRepository.findOverlapping(team.fairnessSince, end),
                    history = ctx.planRepository.findPublishedHistory(teamId, team.fairnessSince, end)
                )
                success(
                    members
                        .filter { it.leftAt == null }
                        .map { MemberBalance(it, balances[it.user.id] ?: Balance(it.user.id, 0.0, 0)) }
                        .sortedByDescending { it.balance.debt }
                )
            }
        }

    /**
     * The notes that go out with the plan: that a day is off because the client has
     * no on-site work, or why a head count is short. Blank clears them, so the
     * absence of a note is expressed by an empty field rather than by a second verb.
     */
    fun updateNotes(
        caller: AuthenticatedUser,
        planId: Int,
        notes: String?
    ): Either<PlanError, Plan> = guarded(log, "PlanService.updateNotes", PlanError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(PlanError.NotAdmin)

        transactionManager.run { ctx ->
            ctx.planRepository.findById(planId) ?: return@run failure(PlanError.NotFound)
            val trimmed = notes?.trim()?.ifEmpty { null }
            if (!ctx.planRepository.updateNotes(planId, trimmed)) return@run failure(PlanError.DatabaseError)
            ctx.planRepository.findById(planId)?.let { success(it) } ?: failure(PlanError.DatabaseError)
        }
    }

    /**
     * The message for a plan. [options] is one send's departure from the team's
     * template and from the whole plan; the default is both, which is the ordinary
     * case and the one the GET answers.
     */
    fun email(
        planId: Int,
        options: PlanEmailRenderer.Options = PlanEmailRenderer.Options()
    ): Either<PlanError, PlanEmailRenderer.RenderedEmail> =
        guarded(log, "PlanService.email", PlanError.DatabaseError) {
            transactionManager.run { ctx ->
                val plan = ctx.planRepository.findById(planId) ?: return@run failure(PlanError.NotFound)
                // The wording belongs to the team, so the message cannot be rendered
                // without it: an AT plan sent in the PSE words would go to the client.
                val team = ctx.teamRepository.findById(plan.teamId)
                    ?: return@run failure(PlanError.TeamNotFound)
                success(emailRenderer.render(plan, team, options))
            }
        }

    private fun openingBalance(
        ctx: Transaction,
        team: Team,
        members: List<TeamMember>,
        from: LocalDate
    ): Map<Int, Balance> {
        if (!team.fairnessSince.isBefore(from)) return emptyMap()
        return generator.replay(
            members = members,
            absences = ctx.absenceRepository.findOverlapping(team.fairnessSince, from),
            history = ctx.planRepository.findPublishedHistory(team.id, team.fairnessSince, from)
        )
    }

    private fun isExclusionViolation(e: Exception): Boolean =
        generateSequence(e as Throwable?) { it.cause }
            .filterIsInstance<PSQLException>()
            .any { it.sqlState == EXCLUSION_VIOLATION }

    private companion object {
        const val MAX_PERIOD_DAYS = 366L * 2
        /** Postgres SQLSTATE for an exclusion constraint violation. */
        const val EXCLUSION_VIOLATION = "23P01"
    }
}
