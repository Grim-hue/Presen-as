package pt.pse.presence.http.pipeline

import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import pt.pse.presence.config.AuthProperties
import java.time.Duration

/**
 * The session cookie, in one place because two things now write it.
 *
 * The token in the database expires on idleness rather than on age: every
 * authenticated request touches it, so a session stays alive for as long as it is
 * being used. The cookie has to be told the same story, and when the two disagree the
 * browser is the one that wins. Written once at login with a fixed Max-Age, it was
 * dropped exactly that long after signing in however much work was going on, and the
 * rolling window behind it was never reached: the eight hour idle timeout was in
 * practice an eight hour session. [AuthenticationInterceptor] writes it again on every
 * authenticated request, which is what makes the window actually roll.
 */
@Component
class SessionCookie(private val authProperties: AuthProperties) {

    fun issue(token: String): ResponseCookie = base(token)
        .maxAge(authProperties.token.idleTtl)
        .build()

    fun expire(): ResponseCookie = base("")
        .maxAge(Duration.ZERO)
        .build()

    /**
     * HttpOnly so script cannot read the token, and SameSite=Strict so a third-party
     * page cannot make the browser send it.
     */
    private fun base(value: String): ResponseCookie.ResponseCookieBuilder =
        ResponseCookie.from(authProperties.cookie.name, value)
            .httpOnly(true)
            .secure(authProperties.cookie.secure)
            .sameSite(authProperties.cookie.sameSite)
            .path("/")
}
