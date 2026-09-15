package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class StatusError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object DatabaseUnreachable : StatusError(
        HttpStatus.SERVICE_UNAVAILABLE,
        ProblemDetails.of(
            slug = "base-de-dados-indisponivel",
            title = "Base de dados indisponível",
            status = 503,
            detail = "Não foi possível contactar a base de dados. Verifique se o container está a correr."
        )
    )
}
