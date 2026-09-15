package pt.pse.presence.domain.plan

import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.PlanStatus
import pt.pse.presence.domain.objects.SwapSide
import pt.pse.presence.domain.objects.TeamMember
import java.time.LocalDate

/** Why an exchange cannot happen. Null means it can. */
enum class SwapRefusal {
    SAME_PERSON,
    SAME_DAY,
    DIFFERENT_TEAMS,
    NOT_PUBLISHED,
    IN_THE_PAST,
    REQUESTER_NOT_ASSIGNED,
    TARGET_NOT_ASSIGNED,
    ALREADY_ASSIGNED,
    NOT_A_MEMBER,
    ABSENT
}

/**
 * Whether two members may exchange the two on-site days they hold.
 *
 * Pure: no repositories, no clock. The caller supplies today, so the same inputs
 * always give the same answer and every rule below is testable without a database.
 *
 * **Two of these rules protect the ledger rather than the people.** The balances are
 * replayed from published days, and [PlanGenerator.replay] only accrues an expected
 * share for members who were eligible: in the team on that date, and not away. A
 * member who takes on a day they are absent for would therefore be credited an
 * assignment with no matching accrual, and their debt would fall by one with nothing
 * in any future plan able to give it back. Same for somebody who has left the team.
 * That is why [NOT_A_MEMBER] and [ABSENT] are refusals and not warnings.
 *
 * The checks run cheapest first, and the order decides which sentence the user is
 * shown when more than one applies.
 */
@Component
class SwapValidator {

    fun check(
        requester: SwapSide,
        target: SwapSide,
        members: List<TeamMember>,
        absences: List<Absence>,
        today: LocalDate
    ): SwapRefusal? {
        if (requester.user.id == target.user.id) return SwapRefusal.SAME_PERSON
        // By date as well as by id: two published plans of one team cannot cover the
        // same day, but two rows for the same date are still worth refusing by name
        // rather than leaving to a later rule.
        if (requester.day.id == target.day.id || requester.day.date == target.day.date) {
            return SwapRefusal.SAME_DAY
        }
        if (requester.teamId != target.teamId) return SwapRefusal.DIFFERENT_TEAMS

        // Drafts may overlap by design, so a date does not identify a day for a team
        // and there is nothing settled to trade yet.
        if (requester.planStatus != PlanStatus.PUBLISHED || target.planStatus != PlanStatus.PUBLISHED) {
            return SwapRefusal.NOT_PUBLISHED
        }
        if (!requester.day.date.isAfter(today) || !target.day.date.isAfter(today)) {
            return SwapRefusal.IN_THE_PAST
        }

        // A holiday carries no assignments, so this also refuses one without naming it.
        if (requester.day.assigned.none { it.id == requester.user.id }) {
            return SwapRefusal.REQUESTER_NOT_ASSIGNED
        }
        if (target.day.assigned.none { it.id == target.user.id }) {
            return SwapRefusal.TARGET_NOT_ASSIGNED
        }
        if (target.day.assigned.any { it.id == requester.user.id } ||
            requester.day.assigned.any { it.id == target.user.id }
        ) {
            return SwapRefusal.ALREADY_ASSIGNED
        }

        // Only the taking direction is checked. That each is currently assigned to the
        // day they are giving up has already been established above.
        if (!isMemberOn(members, target.user.id, requester.day.date) ||
            !isMemberOn(members, requester.user.id, target.day.date)
        ) {
            return SwapRefusal.NOT_A_MEMBER
        }
        if (isAway(absences, target.user.id, requester.day.date) ||
            isAway(absences, requester.user.id, target.day.date)
        ) {
            return SwapRefusal.ABSENT
        }

        return null
    }

    private fun isMemberOn(members: List<TeamMember>, userId: Int, date: LocalDate): Boolean =
        members.any { it.user.id == userId && it.isActiveOn(date) }

    private fun isAway(absences: List<Absence>, userId: Int, date: LocalDate): Boolean =
        absences.any { it.user.id == userId && it.covers(date) }
}
