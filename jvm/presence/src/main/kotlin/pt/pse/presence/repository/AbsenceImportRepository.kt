package pt.pse.presence.repository

import pt.pse.presence.domain.objects.AbsenceImport
import pt.pse.presence.domain.objects.ImportStatus

interface AbsenceImportRepository {

    fun create(filename: String, uploadedBy: Int, rowCount: Int): Int

    fun findById(importId: Int): AbsenceImport?

    fun findAll(): List<AbsenceImport>

    fun setStatus(importId: Int, status: ImportStatus, rowCount: Int? = null): Boolean

    /**
     * Removes rows this import created that nobody has edited since.
     *
     * A hand-edited row survives a discard: the correction is a person's work and
     * outlives the file it came from.
     */
    fun deleteUneditedRowsOf(importId: Int): Int
}
