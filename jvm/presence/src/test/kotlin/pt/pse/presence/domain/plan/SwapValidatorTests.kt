package pt.pse.presence.domain.plan

import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.domain.objects.PlanDay
import pt.pse.presence.domain.objects.PlanStatus
import pt.pse.presence.domain.objects.SwapSide
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.domain.objects.User
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SwapValidatorTests {

    private val validator = SwapValidator()

    private val andre = User(1, "André", "Freitas", "andre.freitas@pse.pt", "andre.freitas", false)
    private val tiago = User(2, "Tiago", "Sousa", "tiago.sousa@pse.pt", "tiago.sousa", false)
    private val joao = User(3, "João", "Vieira", "joao.vieira@pse.pt", "joao.vieira", false)

    private val today = d("2026-09-07")

    private fun d(s: String) = LocalDate.parse(s)

    private fun member(user: User, joined: String = "2026-01-01", left: String? = null) =
        TeamMember(user, d(joined), left?.let(::d))

    private fun absence(user: User, start: String, end: String) =
        Absence(0, user, d(start), d(end), AbsenceKind.VACATION, AbsenceSource.MANUAL, null, null, false)

    private fun day(
        id: Int,
        date: String,
        assigned: List<User>,
        isHoliday: Boolean = false,
        required: Int = 2,
        understaffed: Boolean = false
    ) = PlanDay(id, d(date), isHoliday, if (isHoliday) "Feriado" else null, required, understaffed, assigned)

    private fun side(
        user: User,
        day: PlanDay,
        teamId: Int = 1,
        planId: Int = 1,
        status: PlanStatus = PlanStatus.PUBLISHED
    ) = SwapSide(user, teamId, planId, status, day)

    private val everyone = listOf(member(andre), member(tiago), member(joao))

    /** André holds the 14th, Tiago the 21st, and the two want to trade. */
    private val andreDay = day(10, "2026-09-14", listOf(andre, joao))
    private val tiagoDay = day(11, "2026-09-21", listOf(tiago, joao))

    private fun check(
        requester: SwapSide = side(andre, andreDay),
        target: SwapSide = side(tiago, tiagoDay),
        members: List<TeamMember> = everyone,
        absences: List<Absence> = emptyList()
    ) = validator.check(requester, target, members, absences, today)

    // -------------------------------------------------------------- acceptance

    @Test
    fun `accepts a swap between two published future days of the same team`() {
        assertNull(check(), "two assigned members trading future published days is the whole feature")
    }

    @Test
    fun `accepts a swap on an understaffed day`() {
        val short = day(12, "2026-09-21", listOf(tiago), understaffed = true)
        assertNull(
            check(target = side(tiago, short)),
            "a short day is a warning about the plan, not a reason to refuse a trade"
        )
    }

    // -------------------------------------------------------------- refusals

    @Test
    fun `refuses a swap with yourself`() {
        assertEquals(
            SwapRefusal.SAME_PERSON,
            check(target = side(andre, day(11, "2026-09-21", listOf(andre))))
        )
    }

    @Test
    fun `refuses the same day offered on both sides`() {
        assertEquals(SwapRefusal.SAME_DAY, check(target = side(tiago, andreDay)))
    }

    @Test
    fun `refuses two different rows that fall on the same date`() {
        val sameDate = day(99, "2026-09-14", listOf(tiago))
        assertEquals(SwapRefusal.SAME_DAY, check(target = side(tiago, sameDate)))
    }

    @Test
    fun `refuses two days from different teams`() {
        assertEquals(
            SwapRefusal.DIFFERENT_TEAMS,
            check(target = side(tiago, tiagoDay, teamId = 2, planId = 2))
        )
    }

    @Test
    fun `refuses a day from a draft, which nobody has committed to yet`() {
        assertEquals(
            SwapRefusal.NOT_PUBLISHED,
            check(target = side(tiago, tiagoDay, status = PlanStatus.DRAFT))
        )
    }

    @Test
    fun `refuses a day that has already passed`() {
        val past = day(9, "2026-09-01", listOf(andre))
        assertEquals(SwapRefusal.IN_THE_PAST, check(requester = side(andre, past)))
    }

    @Test
    fun `refuses today, which is too late to arrange`() {
        val now = day(9, "2026-09-07", listOf(andre))
        assertEquals(SwapRefusal.IN_THE_PAST, check(requester = side(andre, now)))
    }

    @Test
    fun `refuses a day the requester is not assigned to`() {
        val notMine = day(10, "2026-09-14", listOf(joao))
        assertEquals(SwapRefusal.REQUESTER_NOT_ASSIGNED, check(requester = side(andre, notMine)))
    }

    @Test
    fun `refuses a day the target is not assigned to`() {
        val notTheirs = day(11, "2026-09-21", listOf(joao))
        assertEquals(SwapRefusal.TARGET_NOT_ASSIGNED, check(target = side(tiago, notTheirs)))
    }

    @Test
    fun `refuses a holiday, which carries nobody at all`() {
        val holiday = day(11, "2026-09-21", emptyList(), isHoliday = true, required = 0)
        assertEquals(SwapRefusal.TARGET_NOT_ASSIGNED, check(target = side(tiago, holiday)))
    }

    @Test
    fun `refuses a swap that would put the target on a day they already hold`() {
        val bothOfUs = day(10, "2026-09-14", listOf(andre, tiago))
        assertEquals(SwapRefusal.ALREADY_ASSIGNED, check(requester = side(andre, bothOfUs)))
    }

    @Test
    fun `refuses a taker who had not joined the team on that date`() {
        val newcomer = listOf(member(andre), member(tiago, joined = "2026-09-16"), member(joao))
        assertEquals(SwapRefusal.NOT_A_MEMBER, check(members = newcomer))
    }

    @Test
    fun `refuses a taker who had already left the team on that date`() {
        val leaver = listOf(member(andre), member(tiago, left = "2026-09-10"), member(joao))
        assertEquals(SwapRefusal.NOT_A_MEMBER, check(members = leaver))
    }

    @Test
    fun `refuses a taker who is away on the day they would take on`() {
        assertEquals(
            SwapRefusal.ABSENT,
            check(absences = listOf(absence(tiago, "2026-09-14", "2026-09-18"))),
            "the ledger would credit a day they cannot work and never balance it back"
        )
    }

    @Test
    fun `refuses the requester being away on the day they would take on`() {
        assertEquals(
            SwapRefusal.ABSENT,
            check(absences = listOf(absence(andre, "2026-09-21", "2026-09-25")))
        )
    }

    @Test
    fun `allows a member to give away a day they are about to be away for`() {
        assertNull(
            check(absences = listOf(absence(andre, "2026-09-14", "2026-09-14"))),
            "handing off a day you cannot work is the reason to ask for a swap"
        )
    }
}
