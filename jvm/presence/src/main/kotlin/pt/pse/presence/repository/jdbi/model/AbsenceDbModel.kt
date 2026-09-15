package pt.pse.presence.repository.jdbi.model

object AbsenceDbModel {
    fun table() = "psepre_absence"
    fun id() = "absence_id"
    fun userId() = "user_id"
    fun startDate() = "start_date"
    fun endDate() = "end_date"
    fun kind() = "kind"
    fun source() = "source"
    fun importId() = "import_id"
    fun note() = "note"
    fun manuallyEdited() = "manually_edited"
    fun updatedAt() = "updated_at"
}
