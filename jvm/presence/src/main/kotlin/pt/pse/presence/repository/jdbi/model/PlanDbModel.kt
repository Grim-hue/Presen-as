package pt.pse.presence.repository.jdbi.model

object PlanDbModel {
    fun table() = "psepre_plan"
    fun id() = "plan_id"
    fun teamId() = "team_id"
    fun periodStart() = "period_start"
    fun periodEnd() = "period_end"
    fun status() = "status"
    fun generatedAt() = "generated_at"
    fun generatedBy() = "generated_by"
    fun publishedAt() = "published_at"
    fun notes() = "notes"
}

object PlanDayDbModel {
    fun table() = "psepre_plan_day"
    fun id() = "plan_day_id"
    fun planId() = "plan_id"
    fun dayDate() = "day_date"
    fun isHoliday() = "is_holiday"
    fun holidayName() = "holiday_name"
    fun requiredCount() = "required_count"
    fun understaffed() = "understaffed"
}

object PlanAssignmentDbModel {
    fun table() = "psepre_plan_assignment"
    fun planDayId() = "plan_day_id"
    fun userId() = "user_id"
}
