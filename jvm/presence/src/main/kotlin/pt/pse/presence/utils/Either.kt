package pt.pse.presence.utils

/**
 * The result of a service call.
 *
 * Services never throw business exceptions: they return a [Failure] carrying a
 * [BaseError] the controller can turn into a response, or a [Success] carrying the
 * value. Exceptions are reserved for genuine faults, which the advice in
 * `http/exception` handles.
 */
sealed class Either<out L, out R> {
    data class Failure<out L>(val value: L) : Either<L, Nothing>()
    data class Success<out R>(val value: R) : Either<Nothing, R>()
}

fun <R> success(value: R): Either<Nothing, R> = Either.Success(value)

fun <L> failure(error: L): Either<L, Nothing> = Either.Failure(error)
