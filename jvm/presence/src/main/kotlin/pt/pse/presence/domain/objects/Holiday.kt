package pt.pse.presence.domain.objects

import java.time.LocalDate

data class Holiday(
    val id: Int,
    val date: LocalDate,
    val name: String,
    val national: Boolean
)

/** A holiday not yet persisted, as produced by HolidayDomain for a whole year. */
data class NewHoliday(
    val date: LocalDate,
    val name: String,
    val national: Boolean
)
