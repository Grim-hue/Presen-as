package pt.pse.presence.repository.jdbi.model

object TeamDbModel {
    fun table() = "psepre_team"
    fun id() = "team_id"
    fun name() = "name"
    fun onSiteWeekday() = "on_site_weekday"
    fun requiredOnSite() = "required_on_site"
    fun fairnessSince() = "fairness_since"
    fun emailSubject() = "email_subject"
    fun emailIntro() = "email_intro"
    fun active() = "active"
    fun updatedAt() = "updated_at"
}

object TeamMemberDbModel {
    fun table() = "psepre_team_member"
    fun teamId() = "team_id"
    fun userId() = "user_id"
    fun joinedAt() = "joined_at"
    fun leftAt() = "left_at"
}

object HolidayDbModel {
    fun table() = "psepre_holiday"
    fun id() = "holiday_id"
    fun date() = "holiday_date"
    fun name() = "name"
    fun national() = "national"
}
