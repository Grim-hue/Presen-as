package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class AbsenceError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object NotFound : AbsenceError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("ausencia-inexistente", "Ausência inexistente", 404, "A ausência pedida não existe.")
    )

    data object UserNotFound : AbsenceError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("elemento-inexistente", "Elemento inexistente", 400, "O elemento indicado não existe.")
    )

    /** A member manages their own absences; an administrator manages anyone's. */
    data object NotAllowed : AbsenceError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of(
            "sem-permissao", "Sem permissão", 403,
            "Só pode gerir as suas próprias ausências."
        )
    )

    data object EndBeforeStart : AbsenceError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("datas-invalidas", "Datas inválidas", 400, "A data de fim é anterior à de início.")
    )

    data object TooLong : AbsenceError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "periodo-demasiado-longo", "Período demasiado longo", 400,
            "Uma ausência não pode durar mais de um ano."
        )
    )

    data object DatabaseError : AbsenceError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of("erro-base-de-dados", "Erro de base de dados", 500, "Não foi possível concluir a operação.")
    )
}
