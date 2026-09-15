package pt.pse.presence.services

import org.springframework.stereotype.Service
import pt.pse.presence.config.AuthProperties
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.domain.objects.Credentials
import pt.pse.presence.domain.objects.User
import pt.pse.presence.infrastructure.security.AuthProvider
import pt.pse.presence.infrastructure.security.TokenFactory
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.AuthError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.success

/** A successful login: the user, plus the token to put in the cookie. */
data class Session(val user: User, val token: String)

@Service
class AuthService(
    private val transactionManager: TransactionManager,
    private val authProvider: AuthProvider,
    private val tokenFactory: TokenFactory,
    private val authProperties: AuthProperties
) {

    fun login(username: String, password: String): Either<AuthError, Session> =
        try {
            transactionManager.run { ctx ->
                val found = ctx.appUserRepository.findByUsernameWithSecret(username.trim())
                    ?: return@run failure(AuthError.InvalidCredentials)

                val credentials = Credentials(found.user.username, password, found.passwordHash)
                if (!authProvider.verify(credentials)) {
                    return@run failure(AuthError.InvalidCredentials)
                }

                val token = tokenFactory.issue()
                ctx.authTokenRepository.insert(tokenFactory.hash(token), found.user.id)
                // Insert first, then prune, so the session just issued is among the
                // most recently used and can never be the one dropped.
                ctx.authTokenRepository.deleteOldestBeyond(
                    found.user.id,
                    authProperties.token.maxPerUser
                )
                success(Session(found.user, token))
            }
        } catch (e: Exception) {
            failure(AuthError.DatabaseError)
        }

    /**
     * Resolves the cookie value to a caller. Called on every authenticated request,
     * so it does the cheap shape check before touching the database.
     */
    fun authenticate(token: String): Either<AuthError, AuthenticatedUser> =
        if (!tokenFactory.couldBeToken(token)) {
            failure(AuthError.NotAuthenticated)
        } else {
            try {
                transactionManager.run { ctx ->
                    val hash = tokenFactory.hash(token)
                    val user = ctx.authTokenRepository.findUserByTokenHash(
                        hash,
                        authProperties.token.idleTtl
                    ) ?: return@run failure(AuthError.NotAuthenticated)

                    ctx.authTokenRepository.touch(hash)
                    success(AuthenticatedUser(user, token))
                }
            } catch (e: Exception) {
                failure(AuthError.DatabaseError)
            }
        }

    fun logout(token: String): Either<AuthError, Unit> =
        try {
            transactionManager.run { ctx ->
                ctx.authTokenRepository.delete(tokenFactory.hash(token))
                success(Unit)
            }
        } catch (e: Exception) {
            failure(AuthError.DatabaseError)
        }
}
