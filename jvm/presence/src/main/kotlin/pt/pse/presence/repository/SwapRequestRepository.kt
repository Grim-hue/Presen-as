package pt.pse.presence.repository

import pt.pse.presence.domain.objects.SwapRequest
import pt.pse.presence.domain.objects.SwapStatus
import java.time.OffsetDateTime

interface SwapRequestRepository {

    fun create(
        requesterId: Int,
        targetId: Int,
        requesterPlanDayId: Int,
        targetPlanDayId: Int,
        note: String?
    ): Int

    fun findById(swapRequestId: Int): SwapRequest?

    /**
     * Everything addressed to or raised by [userId], in one list, so the bell is one
     * request rather than two.
     *
     * Resolved rows older than [resolvedSince] are left out, and so is any pending row
     * whose days have already passed: nobody can act on those, and they would sit in
     * the bell for good behind a button that can only fail.
     */
    fun findForUser(userId: Int, resolvedSince: OffsetDateTime): List<SwapRequest>

    fun hasPending(requesterPlanDayId: Int, targetPlanDayId: Int): Boolean

    /**
     * Moves a PENDING row to [status], stamping `resolved_at`. False when it was
     * already resolved, which is what makes a double click harmless.
     */
    fun resolve(swapRequestId: Int, status: SwapStatus): Boolean
}
