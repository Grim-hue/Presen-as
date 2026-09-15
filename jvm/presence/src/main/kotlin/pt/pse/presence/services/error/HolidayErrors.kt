package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class HolidayError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object NotAdmin : HolidayError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of("sem-permissao", "Sem permissão", 403, "Só um administrador pode gerar ou remover feriados.")
    )

    data object InvalidYear : HolidayError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("ano-invalido", "Ano inválido", 400, "Indique um ano entre 2000 e 2100.")
    )

    data object NotFound : HolidayError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("feriado-inexistente", "Feriado inexistente", 404, "O feriado pedido não existe.")
    )

    data object DatabaseError : HolidayError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of("erro-base-de-dados", "Erro de base de dados", 500, "Não foi possível concluir a operação.")
    )
}
