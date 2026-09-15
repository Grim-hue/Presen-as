package pt.pse.presence.utils

/**
 * RFC 7807 problem details, the body of every failure response.
 *
 * [detail] is written in Portuguese because it is shown to the user, and it states
 * the fact and the fix rather than apologising. See the writing rules in AGENTS.md.
 */
data class ProblemDetails(
    val type: String,
    val title: String,
    val status: Int,
    val detail: String
) {
    companion object {
        private const val BASE = "https://pse.pt/presence/problems"

        fun of(slug: String, title: String, status: Int, detail: String) =
            ProblemDetails("$BASE/$slug", title, status, detail)
    }
}
