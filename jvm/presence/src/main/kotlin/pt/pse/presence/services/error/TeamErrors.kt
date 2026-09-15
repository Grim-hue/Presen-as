package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class TeamError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object NotFound : TeamError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("equipa-inexistente", "Equipa inexistente", 404, "A equipa pedida não existe.")
    )

    data object NotAdmin : TeamError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of("sem-permissao", "Sem permissão", 403, "Só um administrador pode alterar a regra de presença.")
    )

    data object InvalidWeekday : TeamError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("dia-invalido", "Dia inválido", 400, "O dia presencial tem de ser entre segunda-feira e domingo.")
    )

    data object InvalidRequiredCount : TeamError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("numero-invalido", "Número inválido", 400, "São precisos pelo menos 1 elemento presencial.")
    )

    /**
     * Asking for more members than the team has would mark every single day
     * understaffed, which is a setting mistake rather than a schedule to publish.
     */
    data object RequiredExceedsTeam : TeamError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "numero-superior-a-equipa", "Número superior à equipa", 400,
            "A equipa não tem elementos suficientes para o número pedido."
        )
    )

    /** Saving the covering note over nothing would leave the next plan with no words. */
    data object EmptyEmailTemplate : TeamError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "texto-do-email-vazio", "Texto do email vazio", 400,
            "O assunto e a introdução do email não podem ficar em branco."
        )
    )

    data object InvalidMembershipPeriod : TeamError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "periodo-invalido", "Período inválido", 400,
            "A data de entrada tem de ser anterior à data de saída."
        )
    )

    data object EmptyName : TeamError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("nome-vazio", "Nome vazio", 400, "A escala tem de ter um nome.")
    )

    data object NameTaken : TeamError(
        HttpStatus.CONFLICT,
        ProblemDetails.of("nome-ja-usado", "Nome já usado", 409, "Já existe uma equipa com esse nome.")
    )

    data object AlreadyMember : TeamError(
        HttpStatus.CONFLICT,
        ProblemDetails.of("ja-pertence", "Já pertence à equipa", 409, "Este elemento já faz parte da equipa.")
    )

    data object NotAMember : TeamError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("nao-pertence", "Não pertence à equipa", 404, "Este elemento não faz parte da equipa.")
    )

    data object UserNotFound : TeamError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("utilizador-inexistente", "Utilizador inexistente", 404, "O utilizador indicado não existe.")
    )

    /**
     * A join date on or after the day the member is being taken off would leave a
     * membership the period check cannot store, and a fairness ledger with a
     * negative-length membership in it.
     */
    data object LeftBeforeJoined : TeamError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "datas-invalidas", "Datas inválidas", 400,
            "A data de saída tem de ser posterior à de entrada."
        )
    )

    data object DatabaseError : TeamError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of("erro-base-de-dados", "Erro de base de dados", 500, "Não foi possível concluir a operação.")
    )
}
