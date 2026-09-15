package pt.pse.presence.repository.jdbi.model

object AuthTokenDbModel {
    fun table() = "psepre_auth_token"
    fun tokenValidationInfo() = "token_validation_info"
    fun userId() = "user_id"
    fun createdAt() = "created_at"
    fun lastUsedAt() = "last_used_at"
}
