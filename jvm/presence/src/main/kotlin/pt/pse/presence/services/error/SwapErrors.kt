package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class SwapError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object NotFound : SwapError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("troca-inexistente", "Pedido inexistente", 404, "O pedido de troca não existe.")
    )

    data object NotTheTarget : SwapError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of(
            "sem-permissao", "Sem permissão", 403,
            "Só quem recebeu o pedido o pode aceitar ou recusar."
        )
    )

    data object NotTheRequester : SwapError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of("sem-permissao", "Sem permissão", 403, "Só quem fez o pedido o pode cancelar.")
    )

    data object NotPending : SwapError(
        HttpStatus.CONFLICT,
        ProblemDetails.of("troca-resolvida", "Pedido já resolvido", 409, "Este pedido já foi resolvido.")
    )

    data object Duplicate : SwapError(
        HttpStatus.CONFLICT,
        ProblemDetails.of(
            "troca-duplicada", "Pedido duplicado", 409,
            "Já existe um pedido pendente para estes dois dias."
        )
    )

    data object DayNotFound : SwapError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("dia-inexistente", "Dia inexistente", 404, "O dia indicado não existe.")
    )

    data object UserNotFound : SwapError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("elemento-inexistente", "Elemento inexistente", 404, "O elemento indicado não existe.")
    )

    data object SamePerson : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("troca-consigo", "Troca inválida", 400, "Escolha outro elemento.")
    )

    data object SameDay : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("dias-iguais", "Dias iguais", 400, "Escolha dois dias diferentes.")
    )

    data object DifferentTeams : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "equipas-diferentes", "Equipas diferentes", 400,
            "Os dois dias têm de ser da mesma equipa."
        )
    )

    /**
     * Drafts overlap by design, so a date does not identify a day, and a regenerated
     * draft would discard the agreement without telling anybody.
     */
    data object NotPublished : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "plano-nao-publicado", "Plano não publicado", 400,
            "Só pode trocar dias de um plano publicado."
        )
    )

    data object InThePast : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("dia-passado", "Dia passado", 400, "Só pode trocar dias futuros.")
    )

    data object RequesterNotAssigned : SwapError(
        HttpStatus.CONFLICT,
        ProblemDetails.of(
            "sem-atribuicao", "Sem atribuição", 409,
            "Já não está atribuído a esse dia."
        )
    )

    data object TargetNotAssigned : SwapError(
        HttpStatus.CONFLICT,
        ProblemDetails.of(
            "sem-atribuicao", "Sem atribuição", 409,
            "O outro elemento já não está atribuído a esse dia."
        )
    )

    data object AlreadyAssigned : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "ja-atribuido", "Já atribuído", 400,
            "Um dos dois já está atribuído ao outro dia."
        )
    )

    data object NotATeamMember : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "nao-pertence-a-equipa", "Elemento fora da equipa", 400,
            "Um dos dois não pertence à equipa nessa data."
        )
    )

    /**
     * The ledger only accrues an expected share for members who were available, so a
     * day taken on while away credits an assignment that can never be balanced back.
     */
    data object Absent : SwapError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "elemento-ausente", "Elemento ausente", 400,
            "Um dos dois está ausente no dia que ficaria a seu cargo."
        )
    )

    data object DatabaseError : SwapError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of("erro-base-de-dados", "Erro de base de dados", 500, "Não foi possível concluir a operação.")
    )
}
