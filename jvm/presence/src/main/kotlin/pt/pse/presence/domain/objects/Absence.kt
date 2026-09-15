package pt.pse.presence.domain.objects

import java.time.LocalDate

enum class AbsenceKind { VACATION, OTHER }

/** Where the row came from. Drives what a re-import is allowed to do to it. */
enum class AbsenceSource { IMPORT, MANUAL }

data class Absence(
    val id: Int,
    val user: User,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val kind: AbsenceKind,
    val source: AbsenceSource,
    val importId: Int?,
    val note: String?,
    /** True once an imported row was edited by hand. A re-import must not overwrite it. */
    val manuallyEdited: Boolean
) {
    /** Both dates are inclusive, so a single day absence has start == end. */
    fun covers(date: LocalDate): Boolean =
        !date.isBefore(startDate) && !date.isAfter(endDate)
}
