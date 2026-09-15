package pt.pse.presence.repository

import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.domain.objects.User
import java.time.LocalDate

interface TeamRepository {

    fun findAllActive(): List<Team>

    fun findById(teamId: Int): Team?

    /**
     * Every member ever in the team, including those who have left. The generator
     * needs the leavers too: a plan for a past period has to know who was in the team
     * then, not who is in it now.
     */
    fun findMembers(teamId: Int): List<TeamMember>

    fun updateRule(teamId: Int, onSiteWeekday: Int, requiredOnSite: Int, fairnessSince: LocalDate): Boolean

    /** The subject and opening paragraph every message for this team starts from. */
    fun updateEmail(teamId: Int, emailSubject: String, emailIntro: String): Boolean

    /** What the team is called. Separate from the rule, which is what it does. */
    fun rename(teamId: Int, name: String): Boolean

    fun findByName(name: String): Team?

    fun create(
        name: String,
        onSiteWeekday: Int,
        requiredOnSite: Int,
        fairnessSince: LocalDate,
        emailSubject: String,
        emailIntro: String
    ): Int

    fun findMember(teamId: Int, userId: Int): TeamMember?

    /**
     * Adds a member, or moves a returning one back in. One row exists per user per
     * team, so a return updates [joined_at] rather than adding a second row; see the
     * comment on psepre_team_member.
     */
    fun addMember(teamId: Int, userId: Int, joinedAt: LocalDate): Boolean

    /**
     * Moves the date a membership started, and nothing else.
     *
     * Apart from [addMember], which also clears [left_at] because it is what a return
     * is: correcting the entry date of somebody who has left must not quietly put them
     * back on the team.
     */
    fun updateMembership(teamId: Int, userId: Int, joinedAt: LocalDate): Boolean

    /** Ends a membership at [leftAt], exclusive. [leftAt] must be after joined_at. */
    fun endMembership(teamId: Int, userId: Int, leftAt: LocalDate): Boolean

    /**
     * Removes the membership row outright, for one that never covered a day. The
     * table's period check rejects a left_at that is not after joined_at, and there
     * is no history worth keeping for a member who was added and taken off again
     * before their first on-site day.
     */
    fun deleteMembership(teamId: Int, userId: Int): Boolean

    /** Active users who are not currently on the team, for the add-member picker. */
    fun findCandidates(teamId: Int): List<User>
}
