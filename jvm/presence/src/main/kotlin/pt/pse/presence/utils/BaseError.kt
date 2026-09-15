package pt.pse.presence.utils

import org.springframework.http.HttpStatus

/**
 * Base of every sealed error hierarchy. One file per service under `services/error`,
 * so an error is always found next to the service that can return it.
 */
abstract class BaseError(val status: HttpStatus, val problem: ProblemDetails)
