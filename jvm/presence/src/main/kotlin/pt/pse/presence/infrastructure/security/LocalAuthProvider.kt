package pt.pse.presence.infrastructure.security

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.Credentials

/**
 * Checks the password against the BCrypt hash in psepre_app_user.
 *
 * Active by default. Setting `auth.provider=ldap` will select the Active Directory
 * provider instead, once it exists.
 */
@Component
@ConditionalOnProperty(name = ["auth.provider"], havingValue = "local", matchIfMissing = true)
class LocalAuthProvider : AuthProvider {

    override val name = "local"

    private val encoder = BCryptPasswordEncoder()

    override fun verify(credentials: Credentials): Boolean {
        val hash = credentials.storedHash
        if (hash.isNullOrBlank()) {
            // No local password set, which is not the same as a wrong password: this
            // user authenticates elsewhere. Still run a comparison so the response
            // time does not reveal which of the two it was.
            encoder.matches(credentials.password, DUMMY_HASH)
            return false
        }
        return encoder.matches(credentials.password, hash)
    }

    private companion object {
        /** A real BCrypt hash of a value nobody knows, used only to burn equivalent time. */
        const val DUMMY_HASH = "\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
    }
}
