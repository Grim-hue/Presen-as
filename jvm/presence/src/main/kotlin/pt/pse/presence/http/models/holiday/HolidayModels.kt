package pt.pse.presence.http.models.holiday

import pt.pse.presence.domain.objects.Holiday
import java.time.LocalDate

data class HolidayOutputModel(
    val id: Int,
    val date: LocalDate,
    val name: String,
    val national: Boolean,
    /** ISO weekday, so the UI can flag the ones that collide with the on-site day. */
    val weekday: Int
)

data class GeneratedYearOutputModel(
    val year: Int,
    val added: Int,
    val holidays: List<HolidayOutputModel>
)

object HolidayOutputMapper {
    fun toDto(holiday: Holiday) = HolidayOutputModel(
        id = holiday.id,
        date = holiday.date,
        name = holiday.name,
        national = holiday.national,
        weekday = holiday.date.dayOfWeek.value
    )
}
