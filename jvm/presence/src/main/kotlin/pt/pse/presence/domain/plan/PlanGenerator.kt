package pt.pse.presence.domain.plan

import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.Balance
import pt.pse.presence.domain.objects.GeneratedDay
import pt.pse.presence.domain.objects.GenerationResult
import pt.pse.presence.domain.objects.HistoricDay
import pt.pse.presence.domain.objects.Holiday
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import java.time.LocalDate
import kotlin.math.abs

/**
 * Builds the on-site schedule for a period.
 *
 * Pure: no repositories, no clock, no randomness. The same inputs always produce the
 * same plan, which matters because a published plan is a snapshot that outlives the
 * absences it was generated against: an import committed later can leave it putting
 * somebody on a day their férias now cover, and the answer is to report the day and
 * edit the plan, never to quietly reshuffle it — a rotation that moved under the
 * team's feet would be impossible to trust.
 *
 * **Members are picked by debt, not by count.** Every member who was actually
 * available on a day accrues a claim of `required / eligible` on it, and being
 * assigned pays one off. The member owed the most goes next.
 *
 * Counting assignments and picking the lowest, the obvious alternative, is wrong in
 * two ordinary situations. Someone joining in June would show a permanently lower
 * count and be picked every week until they had caught up on days they were not even
 * employed for. Someone back from three weeks of holiday would be punished the same
 * way. Under the debt rule an absent member accrues nothing, so being away is
 * neither penalised nor repaid, and a new member starts at zero debt.
 */
@Component
class PlanGenerator {

    fun generate(
        team: Team,
        members: List<TeamMember>,
        holidays: List<Holiday>,
        absences: List<Absence>,
        from: LocalDate,
        to: LocalDate,
        openingBalance: Map<Int, Balance> = emptyMap(),
        /**
         * Members who take a slot on every day of this plan.
         *
         * They stay inside the ledger: they accrue their share like everybody else
         * and pay it off by being assigned, which is what keeps this from needing a
         * second accrual rule. The consequence is deliberate and worth stating —
         * being on every day earns far more than the share it pays for, so a pinned
         * member's saldo runs negative for as long as they are pinned and everyone
         * else's runs positive, because they are sharing fewer free slots between the
         * same accrual. Pin somebody for a quarter and the Balanço says so.
         */
        pinned: Set<Int> = emptySet(),
        /**
         * Members this plan does not schedule, without taking them off the team.
         *
         * They stay eligible, so they go on accruing and are simply never chosen:
         * missing a turn leaves them owed it, and the next plan gives it back. That
         * is the one reading that keeps [generate] and [replay] agreeing, because
         * replay has no idea a plan excluded anybody — it sees a member who was
         * available and was not assigned, which is exactly what this is.
         *
         * For somebody who is genuinely unavailable — a secondment, a long course —
         * an absence of kind OTHER is the right tool instead, and the only one that
         * stops the days accruing at all. Both halves already honour it.
         */
        excluded: Set<Int> = emptySet()
    ): GenerationResult {
        val holidayByDate = holidays.associateBy { it.date }
        val absencesByUser = absences.groupBy { it.user.id }

        val expected = HashMap<Int, Double>()
        val assigned = HashMap<Int, Int>()
        openingBalance.forEach { (userId, balance) ->
            expected[userId] = balance.expected
            assigned[userId] = balance.assigned
        }
        // Day index of each member's most recent assignment, so that among members
        // owed the same amount the one who has been away longest goes first.
        val lastAssignedAt = HashMap<Int, Int>()

        val days = mutableListOf<GeneratedDay>()
        var dayIndex = 0
        var date = from

        while (!date.isAfter(to)) {
            if (date.dayOfWeek != team.onSiteWeekday) {
                date = date.plusDays(1)
                continue
            }
            dayIndex++

            val holiday = holidayByDate[date]
            if (holiday != null) {
                // No obligation accrues on a day nobody could have attended.
                days += GeneratedDay(date, true, holiday.name, 0, false, emptyList())
                date = date.plusDays(1)
                continue
            }

            val eligible = members
                .filter { it.isActiveOn(date) }
                .filterNot { member ->
                    absencesByUser[member.user.id].orEmpty().any { it.covers(date) }
                }

            if (eligible.isEmpty()) {
                days += GeneratedDay(date, false, null, 0, true, emptyList())
                date = date.plusDays(1)
                continue
            }

            val required = minOf(team.requiredOnSite, eligible.size)
            val share = required.toDouble() / eligible.size
            eligible.forEach { expected.merge(it.user.id, share, Double::plus) }

            // Whoever is pinned takes their slot first, and the debt rule fills what
            // is left. Capped at the day's requirement: pinning more people than the
            // day has room for cannot put more of them in it.
            val fixed = eligible.filter { it.user.id in pinned }.take(required)
            val byDebt = eligible
                .filterNot { it.user.id in pinned || it.user.id in excluded }
                .sortedWith(
                    compareByDescending<TeamMember> { debtOf(it.user.id, expected, assigned) }
                        .thenBy { assigned[it.user.id] ?: 0 }
                        .thenBy { lastAssignedAt[it.user.id] ?: 0 }
                        .thenBy { it.user.id }
                )
                .take(required - fixed.size)
            val chosen = fixed + byDebt

            chosen.forEach {
                assigned.merge(it.user.id, 1, Int::plus)
                lastAssignedAt[it.user.id] = dayIndex
            }

            days += GeneratedDay(
                date = date,
                isHoliday = false,
                holidayName = null,
                requiredCount = required,
                // Short of the rule counts as short however it happened, including
                // when excluding people is what left the day without enough takers.
                understaffed = chosen.size < team.requiredOnSite,
                assignedUserIds = chosen.map { it.user.id }
            )
            date = date.plusDays(1)
        }

        val touched = (expected.keys + assigned.keys + members.map { it.user.id }).toSet()
        val balances = touched.associateWith { userId ->
            Balance(userId, expected[userId] ?: 0.0, assigned[userId] ?: 0)
        }
        return GenerationResult(days, balances)
    }

    /**
     * Rebuilds balances from plans already published.
     *
     * Shares the accrual rule with [generate] by construction: if the two drifted
     * apart, a plan generated with a carried balance would disagree with the ledger
     * the team is shown, and neither would obviously be the wrong one.
     *
     * Eligibility is recomputed from membership and absences as they stand now,
     * while requiredCount comes from the stored day. Retroactively deleting an old
     * absence therefore shifts historic shares slightly. For a team of this size
     * that is noise, and the alternative, snapshotting balances per plan, reintroduces
     * exactly the drift this design avoids.
     */
    fun replay(
        members: List<TeamMember>,
        absences: List<Absence>,
        history: List<HistoricDay>
    ): Map<Int, Balance> {
        val absencesByUser = absences.groupBy { it.user.id }
        val expected = HashMap<Int, Double>()
        val assigned = HashMap<Int, Int>()

        history.sortedBy { it.date }.forEach { day ->
            if (day.isHoliday || day.requiredCount == 0) return@forEach

            val eligible = members
                .filter { it.isActiveOn(day.date) }
                .filterNot { member -> absencesByUser[member.user.id].orEmpty().any { it.covers(day.date) } }
            if (eligible.isEmpty()) return@forEach

            val share = day.requiredCount.toDouble() / eligible.size
            eligible.forEach { expected.merge(it.user.id, share, Double::plus) }
            day.assignedUserIds.forEach { assigned.merge(it, 1, Int::plus) }
        }

        val touched = (expected.keys + assigned.keys + members.map { it.user.id }).toSet()
        return touched.associateWith { Balance(it, expected[it] ?: 0.0, assigned[it] ?: 0) }
    }

    /**
     * Rounded before comparison. Shares like two thirds cannot be held exactly in a
     * double, and without this two members who are mathematically level could order
     * differently from one run to the next, which would break reproducibility.
     */
    private fun debtOf(userId: Int, expected: Map<Int, Double>, assigned: Map<Int, Int>): Double {
        val raw = (expected[userId] ?: 0.0) - (assigned[userId] ?: 0)
        return if (abs(raw) < EPSILON) 0.0 else Math.round(raw * SCALE) / SCALE
    }

    private companion object {
        const val SCALE = 1_000_000.0
        const val EPSILON = 1e-9
    }
}
