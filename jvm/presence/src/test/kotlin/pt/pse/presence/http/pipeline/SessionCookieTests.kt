package pt.pse.presence.http.pipeline

import pt.pse.presence.config.AuthProperties
import java.time.Duration
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards the agreement between the cookie and the token behind it.
 *
 * These went out of step once already: the token expired on idleness and the cookie
 * on age, so the browser dropped a session the API still held. The window is one
 * value in one place now, and this is what says so.
 */
class SessionCookieTests {

    private val properties = AuthProperties(
        token = AuthProperties.Token(idleTtl = Duration.ofHours(24))
    )
    private val cookie = SessionCookie(properties)

    @Test
    fun `the cookie lives exactly as long as the token it carries`() {
        assertEquals(
            properties.token.idleTtl,
            cookie.issue("a-token").maxAge,
            "the browser would drop the cookie while the API still honoured the token"
        )
    }

    @Test
    fun `signing out expires the cookie rather than shortening it`() {
        assertEquals(Duration.ZERO, cookie.expire().maxAge)
        assertEquals("", cookie.expire().value, "the token must not survive in the browser")
    }

    @Test
    fun `the token is out of reach of script and of other sites`() {
        val issued = cookie.issue("a-token")
        assertTrue(issued.isHttpOnly, "script could read the session token")
        assertEquals("Strict", issued.sameSite, "another site could make the browser send it")
        assertEquals("/", issued.path)
    }
}
