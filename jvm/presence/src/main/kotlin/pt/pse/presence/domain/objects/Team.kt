package pt.pse.presence.domain.objects

import java.time.DayOfWeek
import java.time.LocalDate

data class Team(
    val id: Int,
    val name: String,
    /** Held as [DayOfWeek] so the ISO value in the database and the code agree by construction. */
    val onSiteWeekday: DayOfWeek,
    val requiredOnSite: Int,
    val fairnessSince: LocalDate,
    /**
     * Subject and opening paragraph of the generated email, as templates over
     * `{meses}` and `{meses_ano}`. Held on the team because the wording is what
     * differs between commitments: the internal plan and the client-facing AT
     * roster share a format and share nothing else.
     */
    val emailSubject: String,
    val emailIntro: String,
    val active: Boolean
)

data class TeamMember(
    val user: User,
    val joinedAt: LocalDate,
    /** Exclusive. Null while the member is still in the team. */
    val leftAt: LocalDate?
) {
    /** Whether this member counts towards the rule on [date]. */
    fun isActiveOn(date: LocalDate): Boolean =
        !date.isBefore(joinedAt) && (leftAt == null || date.isBefore(leftAt))
}
