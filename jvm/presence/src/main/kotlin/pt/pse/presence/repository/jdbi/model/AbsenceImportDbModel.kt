package pt.pse.presence.repository.jdbi.model

object AbsenceImportDbModel {
    fun table() = "psepre_absence_import"
    fun id() = "import_id"
    fun filename() = "filename"
    fun uploadedBy() = "uploaded_by"
    fun uploadedAt() = "uploaded_at"
    fun rowCount() = "row_count"
    fun status() = "status"
}
