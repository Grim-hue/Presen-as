package pt.pse.presence.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "auth")
data class AuthProperties(
    /** Selects the AuthProvider implementation. */
    val provider: String = "local",
    val cookie: Cookie = Cookie(),
    val token: Token = Token()
) {
    data class Cookie(
        val name: String = "authToken",
        /** False for local http development, true everywhere else. */
        val secure: Boolean = false,
        val sameSite: String = "Strict"
    )

    data class Token(
        /** Idle expiry: a token unused for this long stops working. */
        val idleTtl: Duration = Duration.ofHours(24),
        /** Older sessions beyond this count are dropped when a user logs in again. */
        val maxPerUser: Int = 3
    )
}
