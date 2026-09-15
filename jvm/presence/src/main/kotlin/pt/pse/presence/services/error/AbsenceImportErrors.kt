package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class AbsenceImportError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object NotAdmin : AbsenceImportError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of("sem-permissao", "Sem permissão", 403, "Só um administrador pode importar ausências.")
    )

    data object NotFound : AbsenceImportError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("importacao-inexistente", "Importação inexistente", 404, "A importação pedida não existe.")
    )

    data object AlreadyResolved : AbsenceImportError(
        HttpStatus.CONFLICT,
        ProblemDetails.of(
            "importacao-ja-concluida", "Importação já concluída", 409,
            "Esta importação já foi aplicada ou descartada. Carregue o ficheiro outra vez."
        )
    )

    data object EmptyFile : AbsenceImportError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("ficheiro-vazio", "Ficheiro vazio", 400, "O ficheiro não tem linhas para importar.")
    )

    /** Carries the parser's own reason, which names the missing column or bad row. */
    class Unreadable(detail: String) : AbsenceImportError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of("ficheiro-ilegivel", "Ficheiro ilegível", 400, detail)
    )

    data object DatabaseError : AbsenceImportError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of("erro-base-de-dados", "Erro de base de dados", 500, "Não foi possível concluir a operação.")
    )
}
