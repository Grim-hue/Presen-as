package pt.pse.presence.domain.plan

import pt.pse.presence.domain.objects.Plan
import pt.pse.presence.domain.objects.PlanDay
import pt.pse.presence.domain.objects.PlanStatus
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.User
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PlanEmailRendererTests {

    private val renderer = PlanEmailRenderer()
    private val andre = User(1, "André", "Freitas", "andre.freitas@pse.pt", "andre.freitas", true)
    private val tiago = User(2, "Tiago", "Sousa", "tiago.sousa@pse.pt", "tiago.sousa", false)
    private val joao = User(3, "João", "Vieira", "joao.vieira@pse.pt", "joao.vieira", false)

    private fun d(s: String) = LocalDate.parse(s)

    private val pse = Team(
        1, "Development Team", DayOfWeek.MONDAY, 2, d("2026-09-07"),
        emailSubject = "Plano de trabalho presencial {meses_ano}",
        emailIntro = "Venho por este meio enviar o plano de trabalho para o mês de {meses} " +
            "com as datas em que os elementos da development team devem trabalhar presencialmente " +
            "na sede da PSE.",
        active = true
    )

    private val at = Team(
        2, "AT — SPS", DayOfWeek.WEDNESDAY, 6, d("2026-08-05"),
        emailSubject = "AT - SPS: Plano de presenças físicas nas instalações da AT ({meses})",
        emailIntro = "Venho por este meio enviar o plano de trabalho para o mês de {meses} " +
            "com as datas em que os elementos da PSE devem trabalhar presencialmente na AT.",
        active = true
    )

    private fun plan(days: List<PlanDay>, notes: String? = null) = Plan(
        1, 1, d("2026-09-07"), d("2026-11-01"), PlanStatus.DRAFT,
        OffsetDateTime.now(), andre, null, notes, days
    )

    private val sample = plan(
        listOf(
            PlanDay(1, d("2026-09-07"), false, null, 2, false, listOf(andre, tiago)),
            PlanDay(2, d("2026-10-05"), true, "Implantação da República", 0, false, emptyList()),
            PlanDay(3, d("2026-10-12"), false, null, 1, true, listOf(andre))
        )
    )

    @Test
    fun `follows the template the team lead already uses`() {
        val email = renderer.render(sample, pse)
        assertTrue(email.text.startsWith("Bom dia,"), "opens as the template does")
        assertTrue(email.text.contains("trabalhar presencialmente na sede da PSE"))
        assertTrue(email.text.trimEnd().endsWith("Com os melhores cumprimentos,"))
    }

    @Test
    fun `names the months it covers, in Portuguese`() {
        val email = renderer.render(sample, pse)
        assertTrue(email.text.contains("Setembro 2026"), email.text)
        assertTrue(email.text.contains("Outubro 2026"))
        // One year, said once: "setembro 2026 e outubro 2026" announces it twice.
        assertEquals("Plano de trabalho presencial setembro e outubro 2026", email.subject)
    }

    @Test
    fun `a holiday is named rather than left blank`() {
        val email = renderer.render(sample, pse)
        assertTrue(email.text.contains("Feriado (Implantação da República)"))
    }

    @Test
    fun `members are named, not merely counted, and read as a sentence`() {
        // "2 elementos" alone sends the reader to another message to find out who,
        // and the template the lead already sends writes the list out in full.
        val email = renderer.render(sample, pse)
        assertTrue(email.text.contains("André Freitas e Tiago Sousa"), email.text)
        assertFalse(email.text.contains("2 elementos"), email.text)
    }

    @Test
    fun `the html grid is a seven column week starting on Monday`() {
        val html = renderer.render(sample, pse).html
        val header = html.substring(html.indexOf("<th"), html.indexOf("</tr>", html.indexOf("<th")))
        listOf("Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado", "Domingo")
            .forEach { assertTrue(header.contains(it), "missing $it") }
        assertTrue(header.indexOf("Segunda-Feira") < header.indexOf("Domingo"), "Monday must come first")
    }

    @Test
    fun `a week with nothing written in it is a line, not a calendar square`() {
        // September 2026 opens on a Tuesday, so the first row is mostly August and the
        // commitment is the Monday after it: one bare week, one week with a name in it.
        val email = renderer.render(
            plan(listOf(PlanDay(1, d("2026-09-07"), false, null, 1, false, listOf(andre)))),
            pse
        )
        val rows = Regex("<tr>.*?</tr>").findAll(email.html).map { it.value }.toList()
        val written = rows.filter { it.contains("André Freitas") }
        val bare = rows.filter { it.contains("<td") && !it.contains("André Freitas") }
        assertTrue(written.isNotEmpty() && bare.isNotEmpty(), email.html)
        assertTrue(written.all { it.contains("height:120px") }, "a week with people in it lost its height")
        assertTrue(bare.none { it.contains("height:120px") }, "an empty week is still a calendar square")
    }

    @Test
    fun `every part of the message names its own colour`() {
        // A mail client keeps no stylesheet, so whatever is left unstyled is coloured
        // by whoever draws it: unstyled, this arrived in a reader on dark mode as
        // white text on black.
        val html = renderer.render(sample, pse).html
        val tags = Regex("<(?:p|th|td)\\b[^>]*>").findAll(html).map { it.value }.toList()
        assertTrue(tags.isNotEmpty(), html)
        tags.forEach { assertTrue(it.contains("style=\""), "carries no style: $it") }
        Regex("<(?:th|td)\\b[^>]*>").findAll(html).forEach {
            assertTrue(it.value.contains("background-color:"), "stands on nothing: ${it.value}")
            // Word reads the attribute where it ignores the property, and Outlook on
            // dark mode reverses whatever it finds no ground under.
            assertTrue(it.value.contains("bgcolor="), "no bgcolor for Word: ${it.value}")
        }
    }

    @Test
    fun `an unbroken run of months is a range, said once`() {
        val long = plan(
            listOf(
                PlanDay(1, d("2026-09-07"), false, null, 1, false, listOf(andre)),
                PlanDay(2, d("2026-10-05"), false, null, 1, false, listOf(andre)),
                PlanDay(3, d("2026-11-02"), false, null, 1, false, listOf(andre)),
                PlanDay(4, d("2026-12-07"), false, null, 1, false, listOf(andre))
            )
        )
        assertEquals(
            "Plano de trabalho presencial de setembro a dezembro 2026",
            renderer.render(long, pse).subject
        )
        // And the sentence that already brought a "de" does not get a second one.
        assertTrue(
            renderer.render(long, pse).text.contains("para o mês de setembro a dezembro com as datas"),
            renderer.render(long, pse).text
        )
    }

    @Test
    fun `months with a gap between them stay a list, however many there are`() {
        val scattered = plan(
            listOf(
                PlanDay(1, d("2026-09-07"), false, null, 1, false, listOf(andre)),
                PlanDay(2, d("2026-11-02"), false, null, 1, false, listOf(andre)),
                PlanDay(3, d("2026-12-07"), false, null, 1, false, listOf(andre))
            )
        )
        val email = renderer.render(scattered, at)
        // A range here would promise October, which the plan does not cover.
        assertTrue(email.subject.contains("(setembro, novembro e dezembro)"), email.subject)
    }

    @Test
    fun `a run that crosses new year carries the year on both ends`() {
        val over = plan(
            listOf(
                PlanDay(1, d("2026-11-02"), false, null, 1, false, listOf(andre)),
                PlanDay(2, d("2026-12-07"), false, null, 1, false, listOf(andre)),
                PlanDay(3, d("2027-01-04"), false, null, 1, false, listOf(andre))
            )
        )
        assertEquals(
            "Plano de trabalho presencial de novembro 2026 a janeiro 2027",
            renderer.render(over, pse).subject
        )
    }

    @Test
    fun `and so is a list of people`() {
        val three = plan(
            listOf(PlanDay(1, d("2026-09-07"), false, null, 3, false, listOf(andre, tiago, joao)))
        )
        val email = renderer.render(three, pse)
        assertTrue(email.text.contains("André Freitas, Tiago Sousa e João Vieira"), email.text)
    }

    @Test
    fun `the grid takes a share of the width rather than as much as its contents want`() {
        // Sized by its contents, seven columns of weekday name over a list of names
        // each ran wider than the window and put the weekend off the right edge.
        val html = renderer.render(sample, pse).html
        assertTrue(html.contains("table-layout:fixed"), html)
        assertTrue(html.contains("width:100%"), html)
    }

    @Test
    fun `an understaffed day still names who is going`() {
        val email = renderer.render(sample, pse)
        assertTrue(email.text.contains("2026-10-12 Segunda-Feira: André Freitas"), email.text)
    }

    @Test
    fun `a roster that only counts is the exception, and counts in the right number`() {
        // What goes outside the company sometimes says how many rather than who.
        val counted = PlanEmailRenderer.Options(nameMembers = false)
        val email = renderer.render(sample, at, counted)
        assertTrue(email.text.contains("2 elementos"), email.text)
        assertTrue(email.text.contains("1 elemento:").not(), email.text)
        assertFalse(email.text.contains("1 elementos"), "singular must not be written as plural")
        assertFalse(email.text.contains("André Freitas"), "counted means nobody is named")
    }

    @Test
    fun `one month of a two month plan goes out on its own, subject included`() {
        val september = PlanEmailRenderer.Options(months = setOf(YearMonth.of(2026, 9)))
        val email = renderer.render(sample, pse, september)
        assertEquals("Plano de trabalho presencial setembro 2026", email.subject)
        assertTrue(email.text.contains("Setembro 2026"), email.text)
        assertFalse(email.text.contains("Outubro"), "October was not sent")
        assertFalse(email.html.contains("Outubro"), email.html)
    }

    @Test
    fun `the weekend can be left off, and the month keeps its dates when it is`() {
        val weekdaysOnly = PlanEmailRenderer.Options(weekends = false)
        val html = renderer.render(sample, pse, weekdaysOnly).html
        val header = html.substring(html.indexOf("<th"), html.indexOf("</tr>", html.indexOf("<th")))
        assertFalse(header.contains("Sábado"), header)
        assertFalse(header.contains("Domingo"), header)
        // 7 September is a Monday, and dropping the weekend must not have moved it.
        assertTrue(html.contains("2 elementos").not(), html)
        assertTrue(html.contains("André Freitas e Tiago Sousa"), html)
    }

    @Test
    fun `the sender opens the message in their own words`() {
        val afternoon = PlanEmailRenderer.Options(greeting = "Boa tarde,")
        val email = renderer.render(sample, pse, afternoon)
        assertTrue(email.text.startsWith("Boa tarde,"), email.text)
        assertTrue(email.html.contains("Boa tarde,"), email.html)
        assertFalse(email.html.contains("Bom dia,"), email.html)
    }

    @Test
    fun `the subject and the opening paragraph are a default, not a rule`() {
        val mine = PlanEmailRenderer.Options(
            subject = "Presenças de {meses_ano}",
            intro = "Segue o plano para {meses}."
        )
        val email = renderer.render(sample, pse, mine)
        assertEquals("Presenças de setembro e outubro 2026", email.subject)
        assertTrue(email.text.contains("Segue o plano para setembro e outubro."), email.text)
        assertFalse(email.text.contains("sede da PSE"), "the team default was replaced")
    }

    @Test
    fun `the wording comes from the team, so the AT plan is not sent in the PSE words`() {
        val email = renderer.render(sample, at)
        assertEquals(
            "AT - SPS: Plano de presenças físicas nas instalações da AT (setembro e outubro)",
            email.subject
        )
        assertTrue(email.text.contains("trabalhar presencialmente na AT"), email.text)
        assertFalse(email.text.contains("sede da PSE"), "the PSE wording must not leak into the AT email")
    }

    @Test
    fun `notes are carried into the message, one paragraph per line`() {
        val email = renderer.render(
            plan(
                sample.days,
                notes = "Nota 1: nos dias 12 e 26 a escala contempla apenas cinco colaboradores.\n" +
                    "\n" +
                    "Nota 2: dia 12 pode não existir trabalho presencial na AT."
            ),
            at
        )
        assertTrue(email.text.contains("Nota 1: nos dias 12 e 26"), email.text)
        assertTrue(email.text.contains("Nota 2: dia 12 pode não existir"), email.text)
        assertEquals(2, Regex("Nota \\d").findAll(email.html).count(), "a blank line is not a paragraph")
        // The notes belong between the intro and the first grid, as in the message
        // this reproduces.
        assertTrue(email.html.indexOf("Nota 1") < email.html.indexOf("Segunda-Feira"), email.html)
    }

    @Test
    fun `a day with nobody available says so instead of looking empty`() {
        val email = renderer.render(
            plan(listOf(PlanDay(1, d("2026-09-07"), false, null, 0, true, emptyList()))),
            pse
        )
        assertTrue(email.text.contains("Sem elementos disponíveis"), email.text)
    }
}
