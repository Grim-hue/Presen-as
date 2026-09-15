package pt.pse.presence.repository

import pt.pse.presence.domain.objects.Holiday
import pt.pse.presence.domain.objects.NewHoliday
import java.time.LocalDate

interface HolidayRepository {

    fun findBetween(from: LocalDate, to: LocalDate): List<Holiday>

    /** Returns how many rows were new. Existing ones are left untouched, not replaced. */
    fun insertIgnoringExisting(holidays: List<NewHoliday>): Int

    fun delete(holidayId: Int): Boolean
}
