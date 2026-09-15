package pt.pse.presence.infrastructure.security

import pt.pse.presence.domain.objects.Credentials

/**
 * Verifies credentials, and nothing else.
 *
 * Looking the user up, issuing tokens and setting cookies stay in AuthService, so
 * swapping local passwords for Active Directory means adding one implementation of
 * this interface rather than touching the login flow. The provider is chosen by the
 * `auth.provider` property.
 */
interface AuthProvider {

    /** Identifier matching the `auth.provider` property value. */
    val name: String

    fun verify(credentials: Credentials): Boolean
}
