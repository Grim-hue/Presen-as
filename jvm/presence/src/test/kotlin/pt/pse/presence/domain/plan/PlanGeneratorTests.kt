package pt.pse.presence.domain.plan

import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.domain.objects.HistoricDay
import pt.pse.presence.domain.objects.Holiday
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.domain.objects.User
import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PlanGeneratorTests {

    private val generator = PlanGenerator()
    private val holidayDomain = HolidayDomain()

    private val andre = User(1, "André", "Freitas", "andre.freitas@pse.pt", "andre.freitas", true)
    private val tiago = User(2, "Tiago", "Sousa", "tiago.sousa@pse.pt", "tiago.sousa", false)
    private val joao = User(3, "João", "Vieira", "joao.vieira@pse.pt", "joao.vieira", false)

    private fun d(s: String) = LocalDate.parse(s)

    private fun team(required: Int = 2, weekday: DayOfWeek = DayOfWeek.MONDAY) =
        Team(
            1, "Development Team", weekday, required, d("2026-09-07"),
            // The generator never reads the wording; it is here only because a Team
            // carries it. PlanEmailRendererTests is where it is exercised.
            emailSubject = "Plano de trabalho presencial {meses_ano}",
            emailIntro = "Plano de {meses}.",
            active = true
        )

    private fun member(user: User, joined: String = "2026-01-01", left: String? = null) =
        TeamMember(user, d(joined), left?.let(::d))

    private fun absence(user: User, start: String, end: String) =
        Absence(0, user, d(start), d(end), AbsenceKind.VACATION, AbsenceSource.MANUAL, null, null, false)

    private fun holidaysOf(vararg years: Int): List<Holiday> =
        years.flatMap { holidayDomain.forYear(it) }
            .mapIndexed { i, h -> Holiday(i + 1, h.date, h.name, h.national) }

    private val everyone = listOf(member(andre), member(tiago), member(joao))

    // -------------------------------------------------------------- acceptance

    @Test
    fun `reproduces the schedule the team lead sent by hand`() {
        val result = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-09-07"), d("2026-11-01")
        )

        assertEquals(
            listOf("2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
                   "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26").map(::d),
            result.days.map { it.date },
            "the plan must cover exactly the Mondays in the period"
        )

        val holiday = result.days.single { it.isHoliday }
        assertEquals(d("2026-10-05"), holiday.date)
        assertEquals("Implantação da República", holiday.holidayName)
        assertTrue(holiday.assignedUserIds.isEmpty(), "a holiday carries nobody")
        assertFalse(holiday.understaffed, "a holiday is not a staffing problem")

        result.days.filterNot { it.isHoliday }.forEach {
            assertEquals(2, it.assignedUserIds.size, "${it.date} should have two members")
            assertFalse(it.understaffed)
        }
    }

    // ------------------------------------------------------------- absences

    @Test
    fun `an absent member is not assigned`() {
        val result = generator.generate(
            team(), everyone, emptyList(), listOf(absence(andre, "2026-09-01", "2026-09-30")),
            d("2026-09-07"), d("2026-09-28")
        )
        assertTrue(result.days.none { andre.id in it.assignedUserIds }, "André was away all month")
        result.days.forEach { assertEquals(2, it.assignedUserIds.size) }
    }

    @Test
    fun `two away leaves one on site and flags the day, rather than failing`() {
        val result = generator.generate(
            team(), everyone, emptyList(),
            listOf(absence(andre, "2026-09-07", "2026-09-07"), absence(tiago, "2026-09-07", "2026-09-07")),
            d("2026-09-07"), d("2026-09-07")
        )
        val day = result.days.single()
        assertEquals(listOf(joao.id), day.assignedUserIds)
        assertEquals(1, day.requiredCount)
        assertTrue(day.understaffed)
    }

    @Test
    fun `everyone away leaves the day empty and flagged`() {
        val result = generator.generate(
            team(), everyone, emptyList(),
            listOf(andre, tiago, joao).map { absence(it, "2026-09-07", "2026-09-07") },
            d("2026-09-07"), d("2026-09-07")
        )
        val day = result.days.single()
        assertTrue(day.assignedUserIds.isEmpty())
        assertTrue(day.understaffed)
    }

    @Test
    fun `being away neither earns nor costs duty`() {
        // André is away for the first two Mondays. He must not be made to "catch up"
        // afterwards, and must not be credited for the days he missed either.
        val result = generator.generate(
            team(), everyone, emptyList(), listOf(absence(andre, "2026-09-01", "2026-09-15")),
            d("2026-09-07"), d("2026-12-28")
        )
        assertBalanced(result.balances.values.map { it.debt }, tolerance = 1.0)
    }

    // ------------------------------------------------------------- fairness

    @Test
    fun `a full year leaves everyone within a day of level`() {
        val result = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-12-31")
        )
        val counts = listOf(andre, tiago, joao).map { u -> result.balances.getValue(u.id).assigned }
        assertTrue(counts.max() - counts.min() <= 1, "assignments were $counts")
        assertBalanced(result.balances.values.map { it.debt })
    }

    @Test
    fun `a member joining in June never owes the months before they joined`() {
        val members = listOf(member(andre), member(tiago), member(joao, joined = "2026-06-01"))
        val result = generator.generate(
            team(), members, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-12-31")
        )

        val joaoBalance = result.balances.getValue(joao.id)
        assertTrue(
            joaoBalance.assigned < result.balances.getValue(andre.id).assigned,
            "the June joiner should have fewer days in absolute terms"
        )
        // The point of the debt rule: fewer days, but square with the others.
        assertBalanced(result.balances.values.map { it.debt })

        val beforeJune = result.days.filter { it.date < d("2026-06-01") }
        assertTrue(
            beforeJune.none { joao.id in it.assignedUserIds },
            "assigned before joining"
        )
    }

    @Test
    fun `a member who leaves stops being assigned`() {
        val members = listOf(member(andre), member(tiago), member(joao, left = "2026-07-01"))
        val result = generator.generate(
            team(), members, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-12-31")
        )
        assertTrue(
            result.days.filter { it.date >= d("2026-07-01") }.none { joao.id in it.assignedUserIds },
            "assigned after leaving"
        )
    }

    @Test
    fun `a fourth member changes the share without any other change`() {
        val rui = User(4, "Rui", "Almeida", "rui.almeida@pse.pt", "rui.almeida", false)
        val result = generator.generate(
            team(), everyone + member(rui), holidaysOf(2026), emptyList(),
            d("2026-01-01"), d("2026-12-31")
        )
        val counts = listOf(andre, tiago, joao, rui).map { result.balances.getValue(it.id).assigned }
        assertTrue(counts.max() - counts.min() <= 1, "assignments were $counts")
        assertBalanced(result.balances.values.map { it.debt })
    }

    @Test
    fun `the opening balance carries a rotation across a period boundary`() {
        val whole = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-12-31")
        )
        val firstHalf = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-06-30")
        )
        val secondHalf = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-07-01"), d("2026-12-31"),
            openingBalance = firstHalf.balances
        )
        assertEquals(
            whole.days.map { it.date to it.assignedUserIds },
            (firstHalf.days + secondHalf.days).map { it.date to it.assignedUserIds },
            "generating in two halves with a carried balance must match generating in one go"
        )
    }

    @Test
    fun `regenerating the same period gives the same plan`() {
        val args = { generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-09-07"), d("2026-12-28")
        ) }
        assertEquals(
            args().days.map { it.date to it.assignedUserIds },
            args().days.map { it.date to it.assignedUserIds }
        )
    }

    // ------------------------------------------------------------- shape

    @Test
    fun `only the team weekday appears, and changing it changes the plan`() {
        val wednesdays = generator.generate(
            team(weekday = DayOfWeek.WEDNESDAY), everyone, emptyList(), emptyList(),
            d("2026-09-01"), d("2026-09-30")
        )
        assertTrue(wednesdays.days.all { it.date.dayOfWeek == DayOfWeek.WEDNESDAY })
        assertEquals(5, wednesdays.days.size, "September 2026 has five Wednesdays")
    }

    @Test
    fun `an empty period produces an empty plan rather than an error`() {
        val result = generator.generate(
            team(), everyone, emptyList(), emptyList(), d("2026-09-08"), d("2026-09-13")
        )
        assertTrue(result.days.isEmpty(), "no Monday falls in that window")
    }

    @Test
    fun `nobody is assigned twice on one day`() {
        val result = generator.generate(
            team(required = 3), everyone, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-12-31")
        )
        result.days.filterNot { it.isHoliday }.forEach {
            assertEquals(it.assignedUserIds.size, it.assignedUserIds.toSet().size, "duplicate on ${it.date}")
        }
    }

    // ------------------------------------------------------------- replay

    @Test
    fun `replaying a published plan reproduces the balance it ended with`() {
        val generated = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-06-30")
        )
        val history = generated.days.map {
            pt.pse.presence.domain.objects.HistoricDay(
                it.date, it.isHoliday, it.requiredCount, it.assignedUserIds
            )
        }
        val replayed = generator.replay(everyone, emptyList(), history)

        listOf(andre, tiago, joao).forEach { user ->
            val fromGeneration = generated.balances.getValue(user.id)
            val fromReplay = replayed.getValue(user.id)
            assertEquals(fromGeneration.assigned, fromReplay.assigned, "assigned for ${user.forename}")
            assertTrue(
                abs(fromGeneration.expected - fromReplay.expected) < 1e-6,
                "expected for ${user.forename}: ${fromGeneration.expected} vs ${fromReplay.expected}"
            )
        }
    }

    @Test
    fun `a replayed balance drives the next period exactly as a carried one would`() {
        val first = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-06-30")
        )
        val history = first.days.map {
            pt.pse.presence.domain.objects.HistoricDay(it.date, it.isHoliday, it.requiredCount, it.assignedUserIds)
        }
        val viaCarry = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-07-01"), d("2026-12-31"),
            openingBalance = first.balances
        )
        val viaReplay = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(), d("2026-07-01"), d("2026-12-31"),
            openingBalance = generator.replay(everyone, emptyList(), history)
        )
        assertEquals(
            viaCarry.days.map { it.date to it.assignedUserIds },
            viaReplay.days.map { it.date to it.assignedUserIds }
        )
    }

    // ------------------------------------------------------------- swaps

    @Test
    fun `swapping two assignments moves one day of debt and nothing else`() {
        val history = generator
            .generate(team(), everyone, holidaysOf(2026), emptyList(), d("2026-01-01"), d("2026-06-30"))
            .days
            .map { HistoricDay(it.date, it.isHoliday, it.requiredCount, it.assignedUserIds) }

        // Two working days, and one member on each that the other is not on: exactly
        // what a swap trades.
        val working = history.filter { !it.isHoliday && it.requiredCount > 0 }
        val mine = working.first { it.assignedUserIds.contains(andre.id) && !it.assignedUserIds.contains(tiago.id) }
        val theirs = working.first { it.assignedUserIds.contains(tiago.id) && !it.assignedUserIds.contains(andre.id) }

        val swapped = history.map { day ->
            when (day.date) {
                mine.date -> day.copy(assignedUserIds = day.assignedUserIds.map { if (it == andre.id) tiago.id else it })
                theirs.date -> day.copy(assignedUserIds = day.assignedUserIds.map { if (it == tiago.id) andre.id else it })
                else -> day
            }
        }

        val before = generator.replay(everyone, emptyList(), history)
        val after = generator.replay(everyone, emptyList(), swapped)

        everyone.forEach { member ->
            assertEquals(
                before.getValue(member.user.id).expected,
                after.getValue(member.user.id).expected,
                "a swap must not touch what anybody was expected to do"
            )
            assertEquals(
                before.getValue(member.user.id).assigned,
                after.getValue(member.user.id).assigned,
                "trading one day each leaves both counts where they were"
            )
        }
    }

    @Test
    fun `a day taken on while away can never be balanced back`() {
        val date = d("2026-09-14")
        val day = HistoricDay(date, false, 2, listOf(andre.id, tiago.id))
        val away = listOf(absence(tiago, "2026-09-14", "2026-09-18"))

        val balances = generator.replay(everyone, away, listOf(day))
        val tiagoBalance = balances.getValue(tiago.id)

        assertEquals(1, tiagoBalance.assigned, "the day was still worked on paper")
        assertEquals(0.0, tiagoBalance.expected, "an absent member accrues nothing that day")
        assertTrue(
            tiagoBalance.debt < 0,
            "credit with no accrual is a debt no future plan can repay, which is why " +
                "SwapValidator refuses to hand somebody a day they are away for"
        )
    }

    // ------------------------------------------------------- pinning and excluding

    @Test
    fun `a pinned member is on every day of the plan`() {
        val result = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-11-01"), pinned = setOf(andre.id)
        )

        val working = result.days.filterNot { it.isHoliday }
        assertTrue(working.isNotEmpty())
        assertTrue(working.all { andre.id in it.assignedUserIds }, "André missed a day he was pinned to")
    }

    @Test
    fun `pinning still fills the rest of the day by debt`() {
        val result = generator.generate(
            team(required = 2), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-11-01"), pinned = setOf(andre.id)
        )

        val working = result.days.filterNot { it.isHoliday }
        assertTrue(working.all { it.assignedUserIds.size == 2 }, "a day was not filled")

        // The other two share the remaining slot, so they stay level with each other
        // even though the pinned member does not.
        val others = listOf(tiago.id, joao.id).map { result.balances.getValue(it).assigned }
        assertTrue(abs(others[0] - others[1]) <= 1, "the unpinned pair drifted apart: $others")
    }

    /**
     * The consequence of keeping a pinned member inside the ledger, written down as a
     * test so it is a decision rather than a surprise: being on every day earns far
     * more than the share it pays for, so the saldo goes and stays negative.
     */
    @Test
    fun `a pinned member runs a negative saldo, and the others positive`() {
        val result = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-12-31"), pinned = setOf(andre.id)
        )

        val pinnedDebt = result.balances.getValue(andre.id).debt
        assertTrue(pinnedDebt < 0, "a pinned member should be in credit, was $pinnedDebt")
        listOf(tiago.id, joao.id).forEach {
            assertTrue(result.balances.getValue(it).debt > 0, "the others should be owed days")
        }
    }

    @Test
    fun `pinning more people than the day holds fills it with them and no more`() {
        val result = generator.generate(
            team(required = 2), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-11-01"),
            pinned = setOf(andre.id, tiago.id, joao.id)
        )

        assertTrue(result.days.filterNot { it.isHoliday }.all { it.assignedUserIds.size == 2 })
    }

    @Test
    fun `an excluded member is never assigned`() {
        val result = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-11-01"), excluded = setOf(joao.id)
        )

        assertTrue(result.days.none { joao.id in it.assignedUserIds })
    }

    /**
     * Excluding somebody leaves them owed the turn rather than erasing it, which is
     * what keeps `generate` and `replay` agreeing: replay cannot know a plan excluded
     * anybody, and what it sees — available, not assigned — is exactly this.
     */
    @Test
    fun `an excluded member is owed the days they missed`() {
        val result = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-11-01"), excluded = setOf(joao.id)
        )

        assertEquals(0, result.balances.getValue(joao.id).assigned)
        assertTrue(
            result.balances.getValue(joao.id).debt > 0,
            "an excluded member should still be owed what they did not get"
        )
    }

    @Test
    fun `excluding enough people flags the day as understaffed`() {
        val result = generator.generate(
            team(required = 2), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-11-01"),
            excluded = setOf(tiago.id, joao.id)
        )

        val working = result.days.filterNot { it.isHoliday }
        assertTrue(working.all { it.assignedUserIds == listOf(andre.id) })
        assertTrue(working.all { it.understaffed }, "a day one short should say so")
    }

    @Test
    fun `neither option makes the plan stop being repeatable`() {
        fun run() = generator.generate(
            team(), everyone, holidaysOf(2026), emptyList(),
            d("2026-09-07"), d("2026-12-31"),
            pinned = setOf(andre.id), excluded = setOf(joao.id)
        ).days.map { it.date to it.assignedUserIds }

        assertEquals(run(), run())
    }

    private fun assertBalanced(debts: Collection<Double>, tolerance: Double = 1.0) {
        val worst = debts.maxOf { abs(it) }
        assertTrue(worst <= tolerance, "someone is off by $worst, debts were ${debts.map { "%.2f".format(it) }}")
    }
}
