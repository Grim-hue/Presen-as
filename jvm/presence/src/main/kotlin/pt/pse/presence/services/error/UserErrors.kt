package pt.pse.presence.services.error

import org.springframework.http.HttpStatus
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.ProblemDetails

sealed class UserError(status: HttpStatus, problem: ProblemDetails) : BaseError(status, problem) {

    data object NotFound : UserError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("utilizador-inexistente", "Utilizador inexistente", 404, "O utilizador pedido não existe.")
    )

    data object NoAvatar : UserError(
        HttpStatus.NOT_FOUND,
        ProblemDetails.of("sem-fotografia", "Sem fotografia", 404, "Este utilizador não tem fotografia.")
    )

    /**
     * Your own picture, or anybody's if you administer the application. Nobody else
     * decides what somebody's colleagues see of them.
     */
    data object NotAllowed : UserError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of(
            "sem-permissao", "Sem permissão", 403,
            "Só pode alterar a sua própria fotografia."
        )
    )

    /** Only an administrator edits somebody's name, address or role. */
    data object NotAdmin : UserError(
        HttpStatus.FORBIDDEN,
        ProblemDetails.of(
            "sem-permissao", "Sem permissão", 403,
            "Só um administrador pode alterar os dados de um utilizador."
        )
    )

    data object EmptyField : UserError(
        HttpStatus.BAD_REQUEST,
        ProblemDetails.of(
            "campo-vazio", "Campo vazio", 400,
            "O nome, o apelido e o email são obrigatórios."
        )
    )

    data object EmailTaken : UserError(
        HttpStatus.CONFLICT,
        ProblemDetails.of("email-ja-usado", "Email já usado", 409, "Já existe um utilizador com esse email.")
    )

    /**
     * Taking your own administrator flag off is the one edit that cannot be undone by
     * the person making it: the screen that would put it back is the one it closes.
     */
    data object CannotDemoteSelf : UserError(
        HttpStatus.CONFLICT,
        ProblemDetails.of(
            "nao-pode-despromover-se", "Não se pode despromover", 409,
            "Peça a outro administrador para lhe retirar a permissão."
        )
    )

    data object UnsupportedImage : UserError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        ProblemDetails.of(
            "formato-nao-suportado", "Formato não suportado", 415,
            "A fotografia tem de ser PNG, JPEG ou WebP."
        )
    )

    data object ImageTooLarge : UserError(
        HttpStatus.PAYLOAD_TOO_LARGE,
        ProblemDetails.of(
            "fotografia-demasiado-grande", "Fotografia demasiado grande", 413,
            "A fotografia não pode passar de 2 MB."
        )
    )

    data object DatabaseError : UserError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ProblemDetails.of("erro-base-de-dados", "Erro de base de dados", 500, "Não foi possível concluir a operação.")
    )
}
