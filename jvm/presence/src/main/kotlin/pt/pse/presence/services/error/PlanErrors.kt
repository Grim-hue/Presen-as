package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class PlanError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object NotAdmin : PlanError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of("sem-permissao", "Sem permissão", 403, "Só um administrador pode gerar ou publicar planos.")
    )

    data object NotFound : PlanError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("plano-inexistente", "Plano inexistente", 404, "O plano pedido não existe.")
    )

    data object TeamNotFound : PlanError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("equipa-inexistente", "Equipa inexistente", 404, "A equipa pedida não existe.")
    )

    data object PinnedAndExcluded : PlanError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "fixo-e-excluido", "Elemento fixo e excluído", 400,
            "Um elemento não pode ser fixo e excluído no mesmo plano."
        )
    )

    data object EndBeforeStart : PlanError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("datas-invalidas", "Datas inválidas", 400, "A data de fim é anterior à de início.")
    )

    data object PeriodTooLong : PlanError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("periodo-demasiado-longo", "Período demasiado longo", 400, "Gere no máximo dois anos de cada vez.")
    )

    data object NoDaysInPeriod : PlanError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "sem-dias", "Sem dias no período", 400,
            "Não há nenhum dia presencial neste intervalo."
        )
    )

    /**
     * Publishing is what feeds the fairness ledger, so two published plans may never
     * cover the same day. The database enforces it; this turns that into a sentence.
     */
    data object OverlapsPublished : PlanError(
        HttpStatus.CONFLICT,
        ProblemDetails.of(
            "sobreposicao", "Sobreposição de planos", 409,
            "Já existe um plano publicado que cobre parte deste período."
        )
    )

    data object AlreadyPublished : PlanError(
        HttpStatus.CONFLICT,
        ProblemDetails.of("ja-publicado", "Plano já publicado", 409, "Este plano já foi publicado.")
    )

    data object DayNotFound : PlanError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("dia-inexistente", "Dia inexistente", 404, "O dia indicado não faz parte do plano.")
    )

    data object NotATeamMember : PlanError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "nao-pertence-a-equipa", "Elemento fora da equipa", 400,
            "Só pode escolher elementos da equipa nessa data."
        )
    )

    data object DatabaseError : PlanError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of("erro-base-de-dados", "Erro de base de dados", 500, "Não foi possível concluir a operação.")
    )
}
