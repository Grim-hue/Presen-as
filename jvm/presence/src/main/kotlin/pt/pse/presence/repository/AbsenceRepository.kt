package pt.pse.presence.repository

import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import java.time.LocalDate

interface AbsenceRepository {

    fun find(userId: Int?, from: LocalDate?, to: LocalDate?, source: AbsenceSource?): List<Absence>

    fun findById(absenceId: Int): Absence?

    /**
     * Every absence overlapping the window, for the generator.
     *
     * Overlap, not containment: a vacation starting in August and ending in
     * September must be found when planning September.
     */
    fun findOverlapping(from: LocalDate, to: LocalDate): List<Absence>

    fun insert(
        userId: Int,
        startDate: LocalDate,
        endDate: LocalDate,
        kind: AbsenceKind,
        source: AbsenceSource,
        importId: Int?,
        note: String?
    ): Int

    /** Always marks the row manually edited, which is the point of calling it. */
    fun update(absenceId: Int, startDate: LocalDate, endDate: LocalDate, kind: AbsenceKind, note: String?): Boolean

    /**
     * Moves an imported row's dates without marking it hand edited.
     *
     * Separate from [update] on purpose: if an import reused that method it would
     * stamp every row it touched as manually edited, and the next import would then
     * refuse to update any of them.
     *
     * Deliberately leaves `import_id` alone. It records which import *created* the
     * row, and reassigning it to whichever import last moved the dates would make a
     * later discard delete a row an earlier file was responsible for.
     */
    fun updateFromImport(absenceId: Int, startDate: LocalDate, endDate: LocalDate): Boolean

    fun delete(absenceId: Int): Boolean
}
