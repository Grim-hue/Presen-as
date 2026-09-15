package pt.pse.presence.infrastructure.security

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Guards the invariants the session model rests on. These are cheap to break by
 * accident and expensive to notice in production.
 */
class TokenFactoryTests {

    private val factory = TokenFactory()

    @Test
    fun `issued tokens are unique`() {
        val issued = (1..1000).map { factory.issue() }.toSet()
        assertEquals(1000, issued.size, "SecureRandom produced a collision, which should not happen")
    }

    @Test
    fun `the stored hash is never the token`() {
        val token = factory.issue()
        assertNotEquals(token, factory.hash(token), "the raw token must not be what lands in the database")
    }

    @Test
    fun `hashing is stable, so a returning cookie still resolves`() {
        val token = factory.issue()
        assertEquals(factory.hash(token), factory.hash(token))
    }

    @Test
    fun `a one character change produces a different hash`() {
        val token = factory.issue()
        val tampered = token.dropLast(1) + if (token.last() == 'A') 'B' else 'A'
        assertNotEquals(factory.hash(token), factory.hash(tampered))
    }

    @Test
    fun `the hash fits the column`() {
        // psepre_auth_token.token_validation_info is VARCHAR(256).
        assertEquals(64, factory.hash(factory.issue()).length, "SHA-256 as hex is 64 characters")
    }

    @Test
    fun `the shape check accepts issued tokens and rejects junk`() {
        repeat(100) { assertTrue(factory.couldBeToken(factory.issue())) }

        assertFalse(factory.couldBeToken(""))
        assertFalse(factory.couldBeToken("nonsense"))
        assertFalse(factory.couldBeToken("a".repeat(42)), "too short")
        assertFalse(factory.couldBeToken("a".repeat(44)), "too long")
        assertFalse(factory.couldBeToken("a".repeat(42) + "'"), "SQL quote must not pass the shape check")
        assertFalse(factory.couldBeToken("a".repeat(42) + "="), "padding is stripped, so = is not valid")
    }
}
