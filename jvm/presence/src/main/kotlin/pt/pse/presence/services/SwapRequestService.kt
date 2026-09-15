package pt.pse.presence.services

import org.springframework.stereotype.Service
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.domain.objects.SwapRequest
import pt.pse.presence.domain.objects.SwapSide
import pt.pse.presence.domain.objects.SwapStatus
import pt.pse.presence.domain.plan.SwapRefusal
import pt.pse.presence.domain.plan.SwapValidator
import pt.pse.presence.repository.Transaction
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.SwapError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.guarded
import pt.pse.presence.utils.loggerFor
import pt.pse.presence.utils.success
import java.time.LocalDate
import java.time.OffsetDateTime

/**
 * Exchanges of on-site days, arranged between two members without an administrator.
 *
 * Nothing here checks `isAdmin`: the people doing the swap are the people the plan is
 * about. What replaces that check is consent, and the only person who can give it is
 * the one being asked.
 */
@Service
class SwapRequestService(
    private val transactionManager: TransactionManager,
    private val validator: SwapValidator
) {

    private val log = loggerFor<SwapRequestService>()

    fun list(caller: AuthenticatedUser): Either<SwapError, List<SwapRequest>> =
        guarded(log, "SwapRequestService.list", SwapError.DatabaseError) {
            transactionManager.run { ctx ->
                success(
                    ctx.swapRequestRepository.findForUser(
                        caller.user.id,
                        OffsetDateTime.now().minusDays(RESOLVED_HISTORY_DAYS)
                    )
                )
            }
        }

    fun create(
        caller: AuthenticatedUser,
        myPlanDayId: Int,
        targetPlanDayId: Int,
        targetUserId: Int,
        note: String?
    ): Either<SwapError, SwapRequest> = guarded(log, "SwapRequestService.create", SwapError.DatabaseError) {
        transactionManager.run { ctx ->
            if (ctx.swapRequestRepository.hasPending(myPlanDayId, targetPlanDayId)) {
                return@run failure(SwapError.Duplicate)
            }
            // The requester is the caller, never a field of the request body.
            when (val sides = sides(ctx, caller.user.id, myPlanDayId, targetUserId, targetPlanDayId)) {
                is Either.Failure -> sides
                is Either.Success -> {
                    val id = ctx.swapRequestRepository.create(
                        requesterId = caller.user.id,
                        targetId = targetUserId,
                        requesterPlanDayId = myPlanDayId,
                        targetPlanDayId = targetPlanDayId,
                        note = note?.trim()?.ifEmpty { null }
                    )
                    ctx.swapRequestRepository.findById(id)?.let { success(it) }
                        ?: failure(SwapError.DatabaseError)
                }
            }
        }
    }

    /**
     * Applies the exchange, if it is still possible.
     *
     * Everything is re-checked here rather than trusted from the moment the request
     * was raised. The case that actually happens: an administrator edits one of the
     * two days through `PATCH /plans/{id}/days/{date}`, which replaces the
     * assignments without touching the day itself, so a pending request outlives the
     * assignment it describes.
     */
    fun approve(caller: AuthenticatedUser, swapRequestId: Int): Either<SwapError, SwapRequest> =
        guarded(log, "SwapRequestService.approve", SwapError.DatabaseError) {
            transactionManager.run { ctx ->
                val request = ctx.swapRequestRepository.findById(swapRequestId)
                    ?: return@run failure(SwapError.NotFound)
                if (request.status != SwapStatus.PENDING) return@run failure(SwapError.NotPending)
                if (request.target.user.id != caller.user.id) return@run failure(SwapError.NotTheTarget)

                val check = sides(
                    ctx,
                    request.requester.user.id, request.requester.day.id,
                    request.target.user.id, request.target.day.id
                )
                if (check is Either.Failure) return@run check

                if (!ctx.swapRequestRepository.resolve(swapRequestId, SwapStatus.APPROVED)) {
                    return@run failure(SwapError.NotPending)
                }

                // Both writes are already validated, so a false here means somebody
                // changed the day underneath this transaction. It has to throw:
                // transactionManager.run is jdbi.inTransaction, which rolls back on an
                // exception and on nothing else, so returning a failure between the two
                // updates would commit half a swap and leave one person on both days.
                val moved = ctx.planRepository.reassign(
                    request.requester.day.id, request.requester.user.id, request.target.user.id
                ) && ctx.planRepository.reassign(
                    request.target.day.id, request.target.user.id, request.requester.user.id
                )
                if (!moved) error("swap $swapRequestId lost a race against a concurrent edit")

                ctx.swapRequestRepository.findById(swapRequestId)?.let { success(it) }
                    ?: failure(SwapError.DatabaseError)
            }
        }

    fun reject(caller: AuthenticatedUser, swapRequestId: Int): Either<SwapError, SwapRequest> =
        guarded(log, "SwapRequestService.reject", SwapError.DatabaseError) {
            transactionManager.run { ctx ->
                val request = ctx.swapRequestRepository.findById(swapRequestId)
                    ?: return@run failure(SwapError.NotFound)
                if (request.status != SwapStatus.PENDING) return@run failure(SwapError.NotPending)
                if (request.target.user.id != caller.user.id) return@run failure(SwapError.NotTheTarget)

                if (!ctx.swapRequestRepository.resolve(swapRequestId, SwapStatus.REJECTED)) {
                    return@run failure(SwapError.NotPending)
                }
                ctx.swapRequestRepository.findById(swapRequestId)?.let { success(it) }
                    ?: failure(SwapError.DatabaseError)
            }
        }

    /** Withdrawn by whoever asked, or by an administrator, who owns the plan. */
    fun cancel(caller: AuthenticatedUser, swapRequestId: Int): Either<SwapError, Unit> =
        guarded(log, "SwapRequestService.cancel", SwapError.DatabaseError) {
            transactionManager.run { ctx ->
                val request = ctx.swapRequestRepository.findById(swapRequestId)
                    ?: return@run failure(SwapError.NotFound)
                if (request.status != SwapStatus.PENDING) return@run failure(SwapError.NotPending)
                if (request.requester.user.id != caller.user.id && !caller.user.isAdmin) {
                    return@run failure(SwapError.NotTheRequester)
                }

                if (ctx.swapRequestRepository.resolve(swapRequestId, SwapStatus.CANCELLED)) {
                    success(Unit)
                } else {
                    failure(SwapError.NotPending)
                }
            }
        }

    /**
     * Loads both halves and runs the rules over them.
     *
     * One function called from both [create] and [approve], so the rules cannot drift
     * apart between proposing an exchange and applying it.
     */
    private fun sides(
        ctx: Transaction,
        requesterId: Int,
        requesterPlanDayId: Int,
        targetId: Int,
        targetPlanDayId: Int
    ): Either<SwapError, Pair<SwapSide, SwapSide>> {
        // findById filters inactive users, which findMembers does not: a soft deleted
        // person still has their team membership row.
        val requester = ctx.appUserRepository.findById(requesterId)
            ?: return failure(SwapError.UserNotFound)
        val target = ctx.appUserRepository.findById(targetId)
            ?: return failure(SwapError.UserNotFound)

        val mine = ctx.planRepository.findDayContext(requesterPlanDayId)
            ?: return failure(SwapError.DayNotFound)
        val theirs = ctx.planRepository.findDayContext(targetPlanDayId)
            ?: return failure(SwapError.DayNotFound)

        val requesterSide = SwapSide(requester, mine.teamId, mine.planId, mine.planStatus, mine.day)
        val targetSide = SwapSide(target, theirs.teamId, theirs.planId, theirs.planStatus, theirs.day)

        val from = minOf(mine.day.date, theirs.day.date)
        val to = maxOf(mine.day.date, theirs.day.date)
        val refusal = validator.check(
            requester = requesterSide,
            target = targetSide,
            members = ctx.teamRepository.findMembers(mine.teamId),
            absences = ctx.absenceRepository.findOverlapping(from, to),
            today = LocalDate.now()
        )

        return refusal?.let { failure(it.toError()) } ?: success(requesterSide to targetSide)
    }

    private fun SwapRefusal.toError(): SwapError = when (this) {
        SwapRefusal.SAME_PERSON -> SwapError.SamePerson
        SwapRefusal.SAME_DAY -> SwapError.SameDay
        SwapRefusal.DIFFERENT_TEAMS -> SwapError.DifferentTeams
        SwapRefusal.NOT_PUBLISHED -> SwapError.NotPublished
        SwapRefusal.IN_THE_PAST -> SwapError.InThePast
        SwapRefusal.REQUESTER_NOT_ASSIGNED -> SwapError.RequesterNotAssigned
        SwapRefusal.TARGET_NOT_ASSIGNED -> SwapError.TargetNotAssigned
        SwapRefusal.ALREADY_ASSIGNED -> SwapError.AlreadyAssigned
        SwapRefusal.NOT_A_MEMBER -> SwapError.NotATeamMember
        SwapRefusal.ABSENT -> SwapError.Absent
    }

    private companion object {
        /** How long a resolved request stays in the bell before it ages out by itself. */
        const val RESOLVED_HISTORY_DAYS = 14L
    }
}
