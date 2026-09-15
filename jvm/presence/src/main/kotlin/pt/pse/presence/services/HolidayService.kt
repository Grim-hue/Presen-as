package pt.pse.presence.services

import org.springframework.stereotype.Service
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.domain.objects.Holiday
import pt.pse.presence.domain.plan.HolidayDomain
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.HolidayError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.guarded
import pt.pse.presence.utils.loggerFor
import pt.pse.presence.utils.success
import java.time.LocalDate

data class GeneratedYear(val year: Int, val added: Int, val holidays: List<Holiday>)

@Service
class HolidayService(
    private val transactionManager: TransactionManager,
    private val holidayDomain: HolidayDomain
) {

    private val log = loggerFor<HolidayService>()

    fun listByYear(year: Int): Either<HolidayError, List<Holiday>> = guarded(log, "HolidayService.listByYear", HolidayError.DatabaseError) {
        if (year !in MIN_YEAR..MAX_YEAR) return@guarded failure(HolidayError.InvalidYear)
        transactionManager.run { ctx ->
            success(ctx.holidayRepository.findBetween(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)))
        }
    }

    /**
     * Idempotent: existing rows are left alone, so running it twice adds nothing and
     * a holiday somebody corrected by hand is never reverted.
     */
    fun generateYear(caller: AuthenticatedUser, year: Int): Either<HolidayError, GeneratedYear> = guarded(log, "HolidayService.generateYear", HolidayError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(HolidayError.NotAdmin)
        if (year !in MIN_YEAR..MAX_YEAR) return@guarded failure(HolidayError.InvalidYear)

        transactionManager.run { ctx ->
            val added = ctx.holidayRepository.insertIgnoringExisting(holidayDomain.forYear(year))
            val all = ctx.holidayRepository.findBetween(
                LocalDate.of(year, 1, 1),
                LocalDate.of(year, 12, 31)
            )
            success(GeneratedYear(year, added, all))
        }
    }

    fun delete(caller: AuthenticatedUser, holidayId: Int): Either<HolidayError, Unit> = guarded(log, "HolidayService.delete", HolidayError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(HolidayError.NotAdmin)
        transactionManager.run { ctx ->
            if (ctx.holidayRepository.delete(holidayId)) success(Unit) else failure(HolidayError.NotFound)
        }
    }


    private companion object {
        const val MIN_YEAR = 2000
        const val MAX_YEAR = 2100
    }

}
