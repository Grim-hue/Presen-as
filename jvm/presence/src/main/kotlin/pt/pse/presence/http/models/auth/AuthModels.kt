package pt.pse.presence.http.models.auth

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import pt.pse.presence.domain.objects.User

data class LoginInputModel(
    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 64, message = "demasiado longo")
    val username: String,

    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 128, message = "demasiado longo")
    val password: String
)

/**
 * Everything about a person that this application owns. The username and the password
 * are not here: they belong to whatever authenticates, which is a local hash today and
 * Active Directory later.
 */
data class UpdateUserInputModel(
    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 32, message = "no máximo 32 caracteres")
    val forename: String,

    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 32, message = "no máximo 32 caracteres")
    val surname: String,

    @field:NotBlank(message = "obrigatório")
    @field:Email(message = "email inválido")
    @field:Size(max = 128, message = "no máximo 128 caracteres")
    val email: String,

    val isAdmin: Boolean
)

data class UserOutputModel(
    val id: Int,
    val forename: String,
    val surname: String,
    val displayName: String,
    val email: String,
    val username: String,
    val isAdmin: Boolean,
    /**
     * Where to fetch their picture, or null when they have none.
     *
     * Built here rather than stored: the address is this application's own route plus
     * the instant the picture last changed, so replacing a picture changes the address
     * and no cache anywhere can go on serving the old one.
     */
    val avatarUrl: String?
)

object UserOutputMapper {
    fun toDto(user: User) = UserOutputModel(
        id = user.id,
        forename = user.forename,
        surname = user.surname,
        displayName = user.displayName,
        email = user.email,
        username = user.username,
        isAdmin = user.isAdmin,
        avatarUrl = user.avatarVersion?.let { "/api/v1/users/${user.id}/avatar?v=$it" }
    )
}
