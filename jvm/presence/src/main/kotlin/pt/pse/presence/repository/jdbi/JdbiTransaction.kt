package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import org.jdbi.v3.core.kotlin.mapTo
import pt.pse.presence.repository.AppUserRepository
import pt.pse.presence.repository.AbsenceImportRepository
import pt.pse.presence.repository.AbsenceRepository
import pt.pse.presence.repository.PlanRepository
import pt.pse.presence.repository.AuthTokenRepository
import pt.pse.presence.repository.HolidayRepository
import pt.pse.presence.repository.SwapRequestRepository
import pt.pse.presence.repository.TeamRepository
import pt.pse.presence.repository.Transaction

/**
 * A transaction backed by one JDBI [Handle]. Every repository built here shares that
 * handle, which is what makes the whole block atomic.
 */
class JdbiTransaction(private val handle: Handle) : Transaction {

    override val appUserRepository: AppUserRepository by lazy { JdbiAppUserRepository(handle) }

    override val authTokenRepository: AuthTokenRepository by lazy { JdbiAuthTokenRepository(handle) }

    override val teamRepository: TeamRepository by lazy { JdbiTeamRepository(handle) }

    override val holidayRepository: HolidayRepository by lazy { JdbiHolidayRepository(handle) }

    override val absenceRepository: AbsenceRepository by lazy { JdbiAbsenceRepository(handle) }

    override val absenceImportRepository: AbsenceImportRepository by lazy { JdbiAbsenceImportRepository(handle) }

    override val planRepository: PlanRepository by lazy { JdbiPlanRepository(handle) }

    override val swapRequestRepository: SwapRequestRepository by lazy { JdbiSwapRequestRepository(handle) }

    override fun ping(): Int =
        handle.createQuery("SELECT 1").mapTo<Int>().one()
}
