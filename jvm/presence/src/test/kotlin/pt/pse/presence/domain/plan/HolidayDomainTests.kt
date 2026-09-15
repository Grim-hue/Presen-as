package pt.pse.presence.domain.plan

import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class HolidayDomainTests {

    private val domain = HolidayDomain()

    @Test
    fun `easter matches known dates`() {
        // Independently published Gregorian Easter dates, spanning a century boundary
        // and both the March and April branches of the algorithm.
        val known = mapOf(
            1997 to LocalDate.of(1997, 3, 30),
            2000 to LocalDate.of(2000, 4, 23),
            2001 to LocalDate.of(2001, 4, 15),
            2024 to LocalDate.of(2024, 3, 31),
            2025 to LocalDate.of(2025, 4, 20),
            2026 to LocalDate.of(2026, 4, 5),
            2027 to LocalDate.of(2027, 3, 28),
            2028 to LocalDate.of(2028, 4, 16),
            2029 to LocalDate.of(2029, 4, 1),
            2030 to LocalDate.of(2030, 4, 21),
            2038 to LocalDate.of(2038, 4, 25)
        )
        known.forEach { (year, expected) ->
            assertEquals(expected, domain.easterSunday(year), "Easter $year")
        }
    }

    @Test
    fun `easter is always a sunday`() {
        (1900..2200).forEach { year ->
            assertEquals(
                DayOfWeek.SUNDAY,
                domain.easterSunday(year).dayOfWeek,
                "Easter $year fell on a ${domain.easterSunday(year).dayOfWeek}"
            )
        }
    }

    @Test
    fun `easter always falls between 22 March and 25 April`() {
        (1900..2200).forEach { year ->
            val easter = domain.easterSunday(year)
            assertTrue(
                easter >= LocalDate.of(year, 3, 22) && easter <= LocalDate.of(year, 4, 25),
                "Easter $year was $easter, outside the only window it can occupy"
            )
        }
    }

    @Test
    fun `the generated year matches what was seeded by hand for 2026`() {
        val generated = domain.forYear(2026).map { it.date to it.name }
        val seeded = listOf(
            LocalDate.of(2026, 1, 1) to "Ano Novo",
            LocalDate.of(2026, 4, 3) to "Sexta-feira Santa",
            LocalDate.of(2026, 4, 5) to "Páscoa",
            LocalDate.of(2026, 4, 25) to "Dia da Liberdade",
            LocalDate.of(2026, 5, 1) to "Dia do Trabalhador",
            LocalDate.of(2026, 6, 4) to "Corpo de Deus",
            LocalDate.of(2026, 6, 10) to "Dia de Portugal",
            LocalDate.of(2026, 6, 13) to "Santo António",
            LocalDate.of(2026, 8, 15) to "Assunção de Nossa Senhora",
            LocalDate.of(2026, 10, 5) to "Implantação da República",
            LocalDate.of(2026, 11, 1) to "Todos os Santos",
            LocalDate.of(2026, 12, 1) to "Restauração da Independência",
            LocalDate.of(2026, 12, 8) to "Imaculada Conceição",
            LocalDate.of(2026, 12, 25) to "Natal"
        )
        assertEquals(seeded, generated, "generated 2026 disagrees with sql/003, one of them is wrong")
    }

    @Test
    fun `2027 agrees with the seed too`() {
        val generated = domain.forYear(2027).associate { it.name to it.date }
        assertEquals(LocalDate.of(2027, 3, 26), generated["Sexta-feira Santa"])
        assertEquals(LocalDate.of(2027, 3, 28), generated["Páscoa"])
        assertEquals(LocalDate.of(2027, 5, 27), generated["Corpo de Deus"])
    }

    @Test
    fun `corpus christi is always a thursday and good friday always a friday`() {
        (2020..2100).forEach { year ->
            val byName = domain.forYear(year).associate { it.name to it.date }
            assertEquals(DayOfWeek.THURSDAY, byName.getValue("Corpo de Deus").dayOfWeek, "Corpus Christi $year")
            assertEquals(DayOfWeek.FRIDAY, byName.getValue("Sexta-feira Santa").dayOfWeek, "Good Friday $year")
        }
    }

    @Test
    fun `only Santo Antonio is municipal`() {
        val municipal = domain.forYear(2026).filter { !it.national }
        assertEquals(1, municipal.size)
        assertEquals("Santo António", municipal.single().name)
    }

    @Test
    fun `2026 has exactly one holiday on a Monday, which is why the plan skips 5 October`() {
        val mondays = domain.forYear(2026).filter { it.date.dayOfWeek == DayOfWeek.MONDAY }
        assertEquals(1, mondays.size, "found ${mondays.map { it.date }}")
        assertEquals(LocalDate.of(2026, 10, 5), mondays.single().date)
    }
}
