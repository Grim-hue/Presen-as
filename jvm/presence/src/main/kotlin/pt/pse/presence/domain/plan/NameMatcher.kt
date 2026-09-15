package pt.pse.presence.domain.plan

import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.User
import java.text.Normalizer

/**
 * Matches a name written in a spreadsheet to a user.
 *
 * Deliberately conservative: it only accepts an unambiguous match. A near miss is
 * reported as unmatched so a person resolves it, because guessing here would attach
 * someone else's vacation to the wrong member and silently corrupt the schedule.
 */
@Component
class NameMatcher {

    fun match(name: String, users: List<User>): User? {
        val target = normalise(name)
        if (target.isBlank()) return null

        val exact = users.filter { user -> candidatesFor(user).any { it == target } }
        if (exact.size == 1) return exact.single()
        if (exact.size > 1) return null

        // Fall back to every token of the written name appearing in the user's name,
        // which catches "Freitas, André" and "André M. Freitas".
        //
        // A single token is allowed, so a sheet that writes only "André" or only
        // "Sousa" still resolves. That is safe because of the singleOrNull below: the
        // match must be unique against the current user list, and the moment a second
        // André exists the same input degrades to unmatched rather than silently
        // picking one. Tokens under three characters are dropped so particles like
        // "de" and "da" cannot carry a match on their own.
        val targetTokens = target.split(" ").filter { it.length >= 3 }.toSet()
        if (targetTokens.isEmpty()) return null

        val partial = users.filter { user ->
            val userTokens = normalise("${user.forename} ${user.surname}").split(" ").toSet()
            targetTokens.isNotEmpty() && userTokens.containsAll(targetTokens)
        }
        return partial.singleOrNull()
    }

    private fun candidatesFor(user: User): List<String> = listOf(
        normalise("${user.forename} ${user.surname}"),
        normalise("${user.surname} ${user.forename}"),
        normalise(user.username),
        normalise(user.email.substringBefore('@').replace('.', ' ')),
        normalise(user.email)
    )

    /** Lowercase, accents stripped, punctuation to spaces, runs of space collapsed. */
    private fun normalise(value: String): String =
        Normalizer.normalize(value.trim().lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
            .replace(Regex("[,;._]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
}
