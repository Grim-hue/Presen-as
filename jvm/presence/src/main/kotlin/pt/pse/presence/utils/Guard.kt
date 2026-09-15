package pt.pse.presence.utils

import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Runs a service body, turning an unexpected exception into a domain failure.
 *
 * The logging is the point. A bare `catch (e: Exception) { failure(...) }` reports a
 * clean 500 to the caller and leaves nothing behind to debug, so the first time
 * something breaks in production there is no cause to look at.
 */
inline fun <E : BaseError, T> guarded(
    logger: Logger,
    operation: String,
    onFailure: E,
    block: () -> Either<E, T>
): Either<E, T> =
    try {
        block()
    } catch (e: Exception) {
        logger.error("{} failed", operation, e)
        failure(onFailure)
    }

/** `private val log = loggerFor<MyService>()` at the top of a service. */
inline fun <reified T> loggerFor(): Logger = LoggerFactory.getLogger(T::class.java)
