package pt.pse.presence.repository

/**
 * The repositories available inside one transaction, all sharing a single connection.
 *
 * Repositories are added here as they are introduced. They are deliberately not
 * Spring beans: they are constructed per transaction so that no code can reach a
 * repository without being inside one.
 */
interface Transaction {

    val appUserRepository: AppUserRepository

    val authTokenRepository: AuthTokenRepository

    val teamRepository: TeamRepository

    val holidayRepository: HolidayRepository

    val absenceRepository: AbsenceRepository

    val absenceImportRepository: AbsenceImportRepository

    val planRepository: PlanRepository

    val swapRequestRepository: SwapRequestRepository

    /** Round-trips a trivial query, so the status endpoint can prove the pool works. */
    fun ping(): Int
}
