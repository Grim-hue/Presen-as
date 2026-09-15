package pt.pse.presence.infrastructure.security

import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * Issues session tokens and reduces them to the value stored in the database.
 *
 * The database holds only the SHA-256 of the token, never the token itself, so a
 * database leak does not hand over live sessions. SHA-256 without a salt is the right
 * choice here and BCrypt would be wrong: the input is 256 bits of cryptographic
 * randomness rather than a guessable password, so there is nothing to brute force,
 * and lookup has to be a single indexed query per request.
 */
@Component
class TokenFactory {

    private val random = SecureRandom()

    /** Returns the token handed to the client. Never stored. */
    fun issue(): String {
        val bytes = ByteArray(TOKEN_BYTES).also(random::nextBytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun hash(token: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(token.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    /** Cheap shape check, so a malformed cookie never reaches the database. */
    fun couldBeToken(value: String): Boolean =
        value.length == TOKEN_LENGTH && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }

    private companion object {
        const val TOKEN_BYTES = 32
        /** 32 bytes in unpadded Base64URL. */
        const val TOKEN_LENGTH = 43
    }
}
