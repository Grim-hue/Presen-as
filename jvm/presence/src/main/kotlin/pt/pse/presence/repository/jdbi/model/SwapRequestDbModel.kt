package pt.pse.presence.repository.jdbi.model

object SwapRequestDbModel {
    fun table() = "psepre_swap_request"
    fun id() = "swap_request_id"
    fun requesterId() = "requester_id"
    fun targetId() = "target_id"
    fun requesterPlanDayId() = "requester_plan_day_id"
    fun targetPlanDayId() = "target_plan_day_id"
    fun status() = "status"
    fun note() = "note"
    fun createdAt() = "created_at"
    fun resolvedAt() = "resolved_at"
}
