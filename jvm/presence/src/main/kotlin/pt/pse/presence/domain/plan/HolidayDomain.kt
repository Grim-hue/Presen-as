package pt.pse.presence.domain.plan

import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.NewHoliday
import java.time.LocalDate

/**
 * Derives the Portuguese holiday calendar for any year.
 *
 * Pure logic: no repositories, no Either, no exceptions. Seeding a new year is
 * computed rather than typed, because the moveable feasts move and a hand-typed list
 * is a silent error waiting for the one year nobody rechecked.
 */
@Component
class HolidayDomain {

    fun forYear(year: Int): List<NewHoliday> {
        val easter = easterSunday(year)
        return buildList {
            add(NewHoliday(LocalDate.of(year, 1, 1), "Ano Novo", true))
            add(NewHoliday(easter.minusDays(2), "Sexta-feira Santa", true))
            add(NewHoliday(easter, "Páscoa", true))
            add(NewHoliday(LocalDate.of(year, 4, 25), "Dia da Liberdade", true))
            add(NewHoliday(LocalDate.of(year, 5, 1), "Dia do Trabalhador", true))
            add(NewHoliday(easter.plusDays(CORPUS_CHRISTI_OFFSET), "Corpo de Deus", true))
            add(NewHoliday(LocalDate.of(year, 6, 10), "Dia de Portugal", true))
            add(NewHoliday(LocalDate.of(year, 6, 13), "Santo António", false))
            add(NewHoliday(LocalDate.of(year, 8, 15), "Assunção de Nossa Senhora", true))
            add(NewHoliday(LocalDate.of(year, 10, 5), "Implantação da República", true))
            add(NewHoliday(LocalDate.of(year, 11, 1), "Todos os Santos", true))
            add(NewHoliday(LocalDate.of(year, 12, 1), "Restauração da Independência", true))
            add(NewHoliday(LocalDate.of(year, 12, 8), "Imaculada Conceição", true))
            add(NewHoliday(LocalDate.of(year, 12, 25), "Natal", true))
        }.sortedBy { it.date }
    }

    /**
     * Easter Sunday in the Gregorian calendar, by the anonymous Gregorian algorithm
     * (Meeus, Jones, Butcher). Everything else moveable hangs off this date.
     */
    fun easterSunday(year: Int): LocalDate {
        val a = year % 19
        val b = year / 100
        val c = year % 100
        val d = b / 4
        val e = b % 4
        val f = (b + 8) / 25
        val g = (b - f + 1) / 3
        val h = (19 * a + b - d - g + 15) % 30
        val i = c / 4
        val k = c % 4
        val l = (32 + 2 * e + 2 * i - h - k) % 7
        val m = (a + 11 * h + 22 * l) / 451
        val month = (h + l - 7 * m + 114) / 31
        val day = ((h + l - 7 * m + 114) % 31) + 1
        return LocalDate.of(year, month, day)
    }

    private companion object {
        /** Corpus Christi is the Thursday sixty days after Easter. */
        const val CORPUS_CHRISTI_OFFSET = 60L
    }
}
