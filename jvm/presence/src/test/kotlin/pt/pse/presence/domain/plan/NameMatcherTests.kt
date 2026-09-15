package pt.pse.presence.domain.plan

import pt.pse.presence.domain.objects.User
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class NameMatcherTests {

    private val matcher = NameMatcher()
    private val andre = User(1, "André", "Freitas", "andre.freitas@pse.pt", "andre.freitas", true)
    private val tiago = User(2, "Tiago", "Sousa", "tiago.sousa@pse.pt", "tiago.sousa", false)
    private val users = listOf(andre, tiago)

    @Test
    fun `matches the obvious spellings`() {
        listOf(
            "André Freitas", "andre freitas", "ANDRE FREITAS", "  André   Freitas  ",
            "Freitas, André", "Freitas André", "andre.freitas", "andre.freitas@pse.pt"
        ).forEach { assertEquals(andre, matcher.match(it, users), "failed on \"$it\"") }
    }

    @Test
    fun `matches a name carrying a middle name`() {
        assertEquals(andre, matcher.match("André M. Freitas", users))
    }

    @Test
    fun `refuses to guess`() {
        listOf("", "   ", "Maria Silva", "de", "da Silva").forEach {
            assertNull(matcher.match(it, users), "should not have matched \"$it\"")
        }
    }

    @Test
    fun `a single name resolves while it is unique`() {
        // A sheet that writes only the given name is common, and one token is safe
        // precisely because it must still be unique. Ambiguity is covered below.
        assertEquals(andre, matcher.match("André", users))
        assertEquals(tiago, matcher.match("Sousa", users))
    }

    @Test
    fun `an ambiguous surname matches nobody`() {
        val other = User(3, "Rui", "Freitas", "rui.freitas@pse.pt", "rui.freitas", false)
        assertNull(matcher.match("Freitas", listOf(andre, other)))
    }
}
