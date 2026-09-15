package pt.pse.presence.http.exception

import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.servlet.resource.NoResourceFoundException
import pt.pse.presence.utils.ProblemDetails

/**
 * Framework and transport faults only.
 *
 * Business failures never reach here: a service returns an [pt.pse.presence.utils.Either]
 * failure and the controller turns it into a response itself. Adding a handler for a
 * business error would split the same decision across two places.
 */
@RestControllerAdvice
class ExceptionHandlerControllerAdvice {

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleUnreadableBody(e: HttpMessageNotReadableException) = problem(
        slug = "corpo-invalido",
        title = "Pedido inválido",
        status = HttpStatus.BAD_REQUEST,
        detail = "O corpo do pedido não tem o formato esperado."
    )

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleInvalidArgument(e: MethodArgumentNotValidException) = problem(
        slug = "campos-invalidos",
        title = "Campos inválidos",
        status = HttpStatus.BAD_REQUEST,
        detail = e.bindingResult.fieldErrors
            .joinToString(" ") { "${it.field}: ${it.defaultMessage ?: "valor inválido"}." }
            .ifBlank { "Um ou mais campos têm valores inválidos." }
    )

    @ExceptionHandler(MissingServletRequestParameterException::class)
    fun handleMissingParameter(e: MissingServletRequestParameterException) = problem(
        slug = "parametro-em-falta",
        title = "Parâmetro em falta",
        status = HttpStatus.BAD_REQUEST,
        detail = "Falta o parâmetro ${e.parameterName}."
    )

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun handleTypeMismatch(e: MethodArgumentTypeMismatchException) = problem(
        slug = "parametro-invalido",
        title = "Parâmetro inválido",
        status = HttpStatus.BAD_REQUEST,
        detail = "O parâmetro ${e.name} não tem o formato esperado."
    )

    /**
     * A wrong URL is a client mistake, not a server fault. Without this the catch-all
     * below would report it as a 500 and send whoever is debugging to the wrong place.
     */
    @ExceptionHandler(NoResourceFoundException::class)
    fun handleUnknownPath(e: NoResourceFoundException) = problem(
        slug = "recurso-inexistente",
        title = "Recurso inexistente",
        status = HttpStatus.NOT_FOUND,
        detail = "O endereço pedido não existe."
    )

    @ExceptionHandler(HttpRequestMethodNotSupportedException::class)
    fun handleWrongMethod(e: HttpRequestMethodNotSupportedException) = problem(
        slug = "metodo-nao-suportado",
        title = "Método não suportado",
        status = HttpStatus.METHOD_NOT_ALLOWED,
        detail = "O método ${e.method} não é aceite neste endereço."
    )

    /** Last resort. Anything reaching here is a genuine fault worth investigating. */
    @ExceptionHandler(Exception::class)
    fun handleUnexpected(e: Exception) = problem(
        slug = "erro-interno",
        title = "Erro interno",
        status = HttpStatus.INTERNAL_SERVER_ERROR,
        detail = "Ocorreu um erro inesperado no servidor."
    )

    private fun problem(slug: String, title: String, status: HttpStatus, detail: String) =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .body(ProblemDetails.of(slug, title, status.value(), detail))
}
