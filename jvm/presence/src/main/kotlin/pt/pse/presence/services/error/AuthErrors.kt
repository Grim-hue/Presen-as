package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class AuthError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    /**
     * One error for both an unknown user and a wrong password, on purpose. Telling
     * them apart would let anyone confirm which usernames exist.
     */
    data object InvalidCredentials : AuthError(
        HttpStatus.UNAUTHORIZED,
        ProblemDetails.of(
            slug = "credenciais-invalidas",
            title = "Credenciais inválidas",
            status = 401,
            detail = "Utilizador ou palavra-passe incorretos."
        )
    )

    data object NotAuthenticated : AuthError(
        HttpStatus.UNAUTHORIZED,
        ProblemDetails.of(
            slug = "sessao-invalida",
            title = "Sessão inválida",
            status = 401,
            detail = "A sessão expirou. Inicie sessão novamente."
        )
    )

    data object DatabaseError : AuthError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of(
            slug = "erro-base-de-dados",
            title = "Erro de base de dados",
            status = 500,
            detail = "Não foi possível concluir a operação."
        )
    )
}
