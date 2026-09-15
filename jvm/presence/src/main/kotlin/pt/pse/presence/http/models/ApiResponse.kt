package pt.pse.presence.http.models

import java.time.OffsetDateTime

/**
 * Envelope around every successful response.
 *
 * A single value is returned as a one-element [data] list rather than as a bare
 * object, so a client never has to branch on whether an endpoint returns one thing
 * or many, and adding a second result later is not a breaking change.
 */
data class ApiResponse<T>(
    val data: List<T>,
    val date: OffsetDateTime
)

object ApiResponseBuilder {

    fun <T> of(value: T): ApiResponse<T> = ApiResponse(listOf(value), OffsetDateTime.now())

    fun <T> ofList(values: List<T>): ApiResponse<T> = ApiResponse(values, OffsetDateTime.now())
}
