package pt.pse.presence.services

import org.springframework.stereotype.Service
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.domain.objects.User
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.TeamError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.guarded
import pt.pse.presence.utils.loggerFor
import pt.pse.presence.utils.success
import java.time.LocalDate

@Service
class TeamService(private val transactionManager: TransactionManager) {

    private val log = loggerFor<TeamService>()

    fun list(): Either<TeamError, List<Team>> = guarded(log, "TeamService.list", TeamError.DatabaseError) {
        transactionManager.run { ctx -> success(ctx.teamRepository.findAllActive()) }
    }

    fun get(teamId: Int): Either<TeamError, Team> = guarded(log, "TeamService.get", TeamError.DatabaseError) {
        transactionManager.run { ctx ->
            ctx.teamRepository.findById(teamId)
                ?.let { success(it) }
                ?: failure(TeamError.NotFound)
        }
    }

    fun members(teamId: Int): Either<TeamError, List<TeamMember>> = guarded(log, "TeamService.members", TeamError.DatabaseError) {
        transactionManager.run { ctx ->
            ctx.teamRepository.findById(teamId) ?: return@run failure(TeamError.NotFound)
            success(ctx.teamRepository.findMembers(teamId))
        }
    }

    /** Active users not currently on the team, for the add-member picker. */
    fun candidates(teamId: Int): Either<TeamError, List<User>> =
        guarded(log, "TeamService.candidates", TeamError.DatabaseError) {
            transactionManager.run { ctx ->
                ctx.teamRepository.findById(teamId) ?: return@run failure(TeamError.NotFound)
                success(ctx.teamRepository.findCandidates(teamId))
            }
        }

    /**
     * A new commitment: its rule, and the wording of the message it sends. It starts
     * with nobody on it, so the required count is not checked against the roster here
     * the way [updateRule] checks it — there is no roster yet, and a team that cannot
     * be created until it has members cannot be created at all.
     */
    fun create(
        caller: AuthenticatedUser,
        name: String,
        onSiteWeekday: Int,
        requiredOnSite: Int,
        fairnessSince: LocalDate,
        emailSubject: String,
        emailIntro: String
    ): Either<TeamError, Team> = guarded(log, "TeamService.create", TeamError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(TeamError.NotAdmin)
        if (onSiteWeekday !in 1..7) return@guarded failure(TeamError.InvalidWeekday)
        if (requiredOnSite < 1) return@guarded failure(TeamError.InvalidRequiredCount)

        transactionManager.run { ctx ->
            // Checked rather than left to the unique index, so a duplicate name is a
            // sentence about the name and not a 500.
            if (ctx.teamRepository.findByName(name.trim()) != null) return@run failure(TeamError.NameTaken)

            val teamId = ctx.teamRepository.create(
                name.trim(), onSiteWeekday, requiredOnSite, fairnessSince,
                emailSubject.trim(), emailIntro.trim()
            )
            ctx.teamRepository.findById(teamId)?.let { success(it) } ?: failure(TeamError.DatabaseError)
        }
    }

    /**
     * Puts someone on the roster from [joinedAt]. A member who had left comes back on
     * the same row with their join date moved, which is what psepre_team_member is
     * shaped for; the fairness ledger then accrues for them from the new date only.
     */
    fun addMember(
        caller: AuthenticatedUser,
        teamId: Int,
        userId: Int,
        joinedAt: LocalDate
    ): Either<TeamError, List<TeamMember>> = guarded(log, "TeamService.addMember", TeamError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(TeamError.NotAdmin)

        transactionManager.run { ctx ->
            ctx.teamRepository.findById(teamId) ?: return@run failure(TeamError.NotFound)
            ctx.appUserRepository.findById(userId) ?: return@run failure(TeamError.UserNotFound)

            val existing = ctx.teamRepository.findMember(teamId, userId)
            if (existing != null && existing.leftAt == null) return@run failure(TeamError.AlreadyMember)

            if (!ctx.teamRepository.addMember(teamId, userId, joinedAt)) {
                return@run failure(TeamError.DatabaseError)
            }
            success(ctx.teamRepository.findMembers(teamId))
        }
    }

    /**
     * Takes someone off the roster from [leftAt], exclusive, keeping the history the
     * ledger replays. Refused when it would leave the team unable to meet its own
     * rule: every future day would come out understaffed, which is a setting mistake
     * rather than a schedule.
     */
    fun removeMember(
        caller: AuthenticatedUser,
        teamId: Int,
        userId: Int,
        leftAt: LocalDate
    ): Either<TeamError, List<TeamMember>> = guarded(log, "TeamService.removeMember", TeamError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(TeamError.NotAdmin)

        transactionManager.run { ctx ->
            val team = ctx.teamRepository.findById(teamId) ?: return@run failure(TeamError.NotFound)
            val member = ctx.teamRepository.findMember(teamId, userId) ?: return@run failure(TeamError.NotAMember)
            if (member.leftAt != null) return@run failure(TeamError.NotAMember)

            val remaining = ctx.teamRepository.findMembers(teamId).count { it.leftAt == null } - 1
            if (team.requiredOnSite > remaining) return@run failure(TeamError.RequiredExceedsTeam)

            // A membership that never covered a day leaves no history to keep, and the
            // table's period check will not store a left_at that is not after joined_at.
            val ended = if (leftAt.isAfter(member.joinedAt)) {
                ctx.teamRepository.endMembership(teamId, userId, leftAt)
            } else {
                ctx.teamRepository.deleteMembership(teamId, userId)
            }
            if (!ended) return@run failure(TeamError.DatabaseError)
            success(ctx.teamRepository.findMembers(teamId))
        }
    }

    /**
     * Authorization lives here rather than in the HTTP layer, next to the rule it
     * protects. See AGENTS.md section 6.1.
     */
    /**
     * The wording every message for this team starts from.
     *
     * Kept apart from the rule above because it is a different kind of change: the
     * rule decides who has to be somewhere and is checked against the team, and this
     * only decides what the covering note says. It is saved from the page that writes
     * the message, which is the only place anybody has both the words and a reason to
     * keep them.
     */
    fun updateEmail(
        caller: AuthenticatedUser,
        teamId: Int,
        emailSubject: String,
        emailIntro: String
    ): Either<TeamError, Team> = guarded(log, "TeamService.updateEmail", TeamError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(TeamError.NotAdmin)
        val subject = emailSubject.trim()
        val intro = emailIntro.trim()
        if (subject.isEmpty() || intro.isEmpty()) return@guarded failure(TeamError.EmptyEmailTemplate)

        transactionManager.run { ctx ->
            ctx.teamRepository.findById(teamId) ?: return@run failure(TeamError.NotFound)
            if (!ctx.teamRepository.updateEmail(teamId, subject, intro)) {
                return@run failure(TeamError.DatabaseError)
            }
            ctx.teamRepository.findById(teamId)
                ?.let { success(it) }
                ?: failure(TeamError.DatabaseError)
        }
    }

    /**
     * Moves the date a membership started.
     *
     * A correction, not a return: somebody who has left stays left. The period check
     * on the table refuses a start on or after the end, so it is refused here first,
     * with a sentence instead of a constraint violation.
     */
    fun updateMembership(
        caller: AuthenticatedUser,
        teamId: Int,
        userId: Int,
        joinedAt: LocalDate
    ): Either<TeamError, List<TeamMember>> =
        guarded(log, "TeamService.updateMembership", TeamError.DatabaseError) {
            if (!caller.user.isAdmin) return@guarded failure(TeamError.NotAdmin)

            transactionManager.run { ctx ->
                ctx.teamRepository.findById(teamId) ?: return@run failure(TeamError.NotFound)
                val member = ctx.teamRepository.findMember(teamId, userId)
                    ?: return@run failure(TeamError.NotAMember)
                val left = member.leftAt
                if (left != null && !joinedAt.isBefore(left)) {
                    return@run failure(TeamError.InvalidMembershipPeriod)
                }
                if (!ctx.teamRepository.updateMembership(teamId, userId, joinedAt)) {
                    return@run failure(TeamError.DatabaseError)
                }
                success(ctx.teamRepository.findMembers(teamId))
            }
        }

    /**
     * What the team is called and what it asks of the people in it.
     *
     * [name] is optional and the three rule fields are not, because the page that
     * sends this shows all four and a rule is three answers that are read together.
     * A rename travels with them rather than through a route of its own: it is the
     * same form, saved by the same button.
     */
    fun updateRule(
        caller: AuthenticatedUser,
        teamId: Int,
        onSiteWeekday: Int,
        requiredOnSite: Int,
        fairnessSince: LocalDate,
        name: String? = null
    ): Either<TeamError, Team> = guarded(log, "TeamService.updateRule", TeamError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(TeamError.NotAdmin)
        if (onSiteWeekday !in 1..7) return@guarded failure(TeamError.InvalidWeekday)
        if (requiredOnSite < 1) return@guarded failure(TeamError.InvalidRequiredCount)
        val renamed = name?.trim()
        if (renamed != null && renamed.isEmpty()) return@guarded failure(TeamError.EmptyName)

        transactionManager.run { ctx ->
            val current = ctx.teamRepository.findById(teamId) ?: return@run failure(TeamError.NotFound)

            // The name is the one thing here another team can already be holding.
            if (renamed != null && !renamed.equals(current.name, ignoreCase = true)) {
                if (ctx.teamRepository.findByName(renamed) != null) {
                    return@run failure(TeamError.NameTaken)
                }
                if (!ctx.teamRepository.rename(teamId, renamed)) {
                    return@run failure(TeamError.DatabaseError)
                }
            }

            // Counted against members who have not left: a rule the team can never
            // satisfy would mark every future day understaffed.
            val onTeam = ctx.teamRepository.findMembers(teamId).count { it.leftAt == null }
            if (requiredOnSite > onTeam) return@run failure(TeamError.RequiredExceedsTeam)

            if (!ctx.teamRepository.updateRule(teamId, onSiteWeekday, requiredOnSite, fairnessSince)) {
                return@run failure(TeamError.DatabaseError)
            }
            ctx.teamRepository.findById(teamId)
                ?.let { success(it) }
                ?: failure(TeamError.DatabaseError)
        }
    }


}
