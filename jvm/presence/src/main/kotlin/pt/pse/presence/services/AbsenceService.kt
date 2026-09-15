package pt.pse.presence.services

import org.springframework.stereotype.Service
import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.AbsenceError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.guarded
import pt.pse.presence.utils.loggerFor
import pt.pse.presence.utils.success
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@Service
class AbsenceService(private val transactionManager: TransactionManager) {

    private val log = loggerFor<AbsenceService>()

    fun list(
        userId: Int?,
        from: LocalDate?,
        to: LocalDate?,
        source: AbsenceSource?
    ): Either<AbsenceError, List<Absence>> = guarded(log, "AbsenceService.list", AbsenceError.DatabaseError) {
        transactionManager.run { ctx -> success(ctx.absenceRepository.find(userId, from, to, source)) }
    }

    fun create(
        caller: AuthenticatedUser,
        userId: Int,
        startDate: LocalDate,
        endDate: LocalDate,
        kind: AbsenceKind,
        note: String?
    ): Either<AbsenceError, Absence> = guarded(log, "AbsenceService.create", AbsenceError.DatabaseError) {
        if (!caller.user.isAdmin && caller.user.id != userId) return@guarded failure(AbsenceError.NotAllowed)
        validatePeriod(startDate, endDate)?.let { return@guarded failure(it) }

        transactionManager.run { ctx ->
            ctx.appUserRepository.findById(userId) ?: return@run failure(AbsenceError.UserNotFound)

            val id = ctx.absenceRepository.insert(
                userId = userId,
                startDate = startDate,
                endDate = endDate,
                kind = kind,
                source = AbsenceSource.MANUAL,
                importId = null,
                note = note
            )
            ctx.absenceRepository.findById(id)
                ?.let { success(it) }
                ?: failure(AbsenceError.DatabaseError)
        }
    }

    /**
     * Editing marks the row manually edited, which is what makes a later import
     * report it as a conflict instead of overwriting the correction.
     */
    fun update(
        caller: AuthenticatedUser,
        absenceId: Int,
        startDate: LocalDate,
        endDate: LocalDate,
        kind: AbsenceKind,
        note: String?
    ): Either<AbsenceError, Absence> = guarded(log, "AbsenceService.update", AbsenceError.DatabaseError) {
        validatePeriod(startDate, endDate)?.let { return@guarded failure(it) }

        transactionManager.run { ctx ->
            val existing = ctx.absenceRepository.findById(absenceId)
                ?: return@run failure(AbsenceError.NotFound)
            if (!caller.user.isAdmin && caller.user.id != existing.user.id) {
                return@run failure(AbsenceError.NotAllowed)
            }
            if (!ctx.absenceRepository.update(absenceId, startDate, endDate, kind, note)) {
                return@run failure(AbsenceError.DatabaseError)
            }
            ctx.absenceRepository.findById(absenceId)
                ?.let { success(it) }
                ?: failure(AbsenceError.DatabaseError)
        }
    }

    fun delete(caller: AuthenticatedUser, absenceId: Int): Either<AbsenceError, Unit> = guarded(log, "AbsenceService.delete", AbsenceError.DatabaseError) {
        transactionManager.run { ctx ->
            val existing = ctx.absenceRepository.findById(absenceId)
                ?: return@run failure(AbsenceError.NotFound)
            if (!caller.user.isAdmin && caller.user.id != existing.user.id) {
                return@run failure(AbsenceError.NotAllowed)
            }
            if (ctx.absenceRepository.delete(absenceId)) success(Unit) else failure(AbsenceError.DatabaseError)
        }
    }

    private fun validatePeriod(startDate: LocalDate, endDate: LocalDate): AbsenceError? = when {
        endDate.isBefore(startDate) -> AbsenceError.EndBeforeStart
        // A range longer than a year is a typo in the year field, not a real absence.
        // Left unbounded it would silently remove someone from every plan.
        ChronoUnit.DAYS.between(startDate, endDate) > MAX_DAYS -> AbsenceError.TooLong
        else -> null
    }


    private companion object {
        const val MAX_DAYS = 366L
    }

}
