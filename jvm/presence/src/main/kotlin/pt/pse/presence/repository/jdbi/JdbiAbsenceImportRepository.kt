package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import org.jdbi.v3.core.mapper.RowMapper
import org.jdbi.v3.core.statement.StatementContext
import pt.pse.presence.domain.objects.AbsenceImport
import pt.pse.presence.domain.objects.ImportStatus
import pt.pse.presence.repository.AbsenceImportRepository
import pt.pse.presence.repository.jdbi.mapper.UserMapper
import pt.pse.presence.repository.jdbi.model.AbsenceDbModel
import pt.pse.presence.repository.jdbi.model.AbsenceImportDbModel
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import java.sql.ResultSet
import java.time.OffsetDateTime

private class AbsenceImportMapper : RowMapper<AbsenceImport> {
    private val userMapper = UserMapper()
    override fun map(rs: ResultSet, ctx: StatementContext) = AbsenceImport(
        id = rs.getInt(AbsenceImportDbModel.id()),
        filename = rs.getString(AbsenceImportDbModel.filename()),
        uploadedBy = userMapper.map(rs, ctx),
        uploadedAt = rs.getObject(AbsenceImportDbModel.uploadedAt(), OffsetDateTime::class.java),
        rowCount = rs.getInt(AbsenceImportDbModel.rowCount()),
        status = ImportStatus.valueOf(rs.getString(AbsenceImportDbModel.status()))
    )
}

class JdbiAbsenceImportRepository(private val handle: Handle) : AbsenceImportRepository {

    private fun selectWithUser() = """
        SELECT i.${AbsenceImportDbModel.id()}, i.${AbsenceImportDbModel.filename()},
               i.${AbsenceImportDbModel.uploadedAt()}, i.${AbsenceImportDbModel.rowCount()},
               i.${AbsenceImportDbModel.status()},
               u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
               u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()}
        FROM ${AbsenceImportDbModel.table()} i
        JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = i.${AbsenceImportDbModel.uploadedBy()}
    """.trimIndent()

    override fun create(filename: String, uploadedBy: Int, rowCount: Int): Int =
        handle.createUpdate(
            """
            INSERT INTO ${AbsenceImportDbModel.table()}
                (${AbsenceImportDbModel.filename()}, ${AbsenceImportDbModel.uploadedBy()},
                 ${AbsenceImportDbModel.rowCount()})
            VALUES (:filename, :uploadedBy, :rowCount)
            """.trimIndent()
        )
            .bind("filename", filename)
            .bind("uploadedBy", uploadedBy)
            .bind("rowCount", rowCount)
            .executeAndReturnGeneratedKeys(AbsenceImportDbModel.id())
            .mapTo(Int::class.java)
            .one()

    override fun findById(importId: Int): AbsenceImport? =
        handle.createQuery("${selectWithUser()} WHERE i.${AbsenceImportDbModel.id()} = :importId")
            .bind("importId", importId)
            .map(AbsenceImportMapper())
            .findOne()
            .orElse(null)

    override fun findAll(): List<AbsenceImport> =
        handle.createQuery("${selectWithUser()} ORDER BY i.${AbsenceImportDbModel.uploadedAt()} DESC")
            .map(AbsenceImportMapper())
            .list()

    override fun setStatus(importId: Int, status: ImportStatus, rowCount: Int?): Boolean =
        handle.createUpdate(
            """
            UPDATE ${AbsenceImportDbModel.table()}
            SET ${AbsenceImportDbModel.status()} = :status,
                ${AbsenceImportDbModel.rowCount()} =
                    COALESCE(CAST(:rowCount AS INT), ${AbsenceImportDbModel.rowCount()})
            WHERE ${AbsenceImportDbModel.id()} = :importId
            """.trimIndent()
        )
            .bind("importId", importId)
            .bind("status", status.name)
            .bind("rowCount", rowCount)
            .execute() == 1

    override fun deleteUneditedRowsOf(importId: Int): Int =
        handle.createUpdate(
            """
            DELETE FROM ${AbsenceDbModel.table()}
            WHERE ${AbsenceDbModel.importId()} = :importId
              AND ${AbsenceDbModel.manuallyEdited()} = FALSE
            """.trimIndent()
        )
            .bind("importId", importId)
            .execute()
}
