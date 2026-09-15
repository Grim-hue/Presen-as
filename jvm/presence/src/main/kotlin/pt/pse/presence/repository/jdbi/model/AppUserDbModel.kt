package pt.pse.presence.repository.jdbi.model

/**
 * Column and table names for psepre_app_user.
 *
 * Queries interpolate these instead of spelling names out, so renaming a column is a
 * compile error here rather than a runtime failure in whichever query was forgotten.
 */
object AppUserDbModel {
    fun table() = "psepre_app_user"
    fun id() = "user_id"
    fun forename() = "forename"
    fun surname() = "surname"
    fun email() = "email"
    fun username() = "username"
    fun passwordHash() = "password_hash"
    fun isAdmin() = "is_admin"
    fun active() = "active"
    fun createdAt() = "created_at"
    fun updatedAt() = "updated_at"
}

/** Column and table names for psepre_user_avatar. */
object UserAvatarDbModel {
    fun table() = "psepre_user_avatar"
    fun userId() = "user_id"
    fun contentType() = "content_type"
    fun bytes() = "bytes"
    fun updatedAt() = "updated_at"
}
