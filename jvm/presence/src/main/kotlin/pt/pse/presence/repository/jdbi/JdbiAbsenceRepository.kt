package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.repository.AbsenceRepository
import pt.pse.presence.repository.jdbi.mapper.AbsenceMapper
import pt.pse.presence.repository.jdbi.model.AbsenceDbModel
import pt.pse.presence.repository.jdbi.mapper.AVATAR_VERSION
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import pt.pse.presence.repository.jdbi.model.UserAvatarDbModel
import java.time.LocalDate

class JdbiAbsenceRepository(private val handle: Handle) : AbsenceRepository {

    private fun selectWithUser() = """
        SELECT a.${AbsenceDbModel.id()}, a.${AbsenceDbModel.startDate()}, a.${AbsenceDbModel.endDate()},
               a.${AbsenceDbModel.kind()}, a.${AbsenceDbModel.source()}, a.${AbsenceDbModel.importId()},
               a.${AbsenceDbModel.note()}, a.${AbsenceDbModel.manuallyEdited()},
               u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
               u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
               av.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
        FROM ${AbsenceDbModel.table()} a
        JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = a.${AbsenceDbModel.userId()}
        LEFT JOIN ${UserAvatarDbModel.table()} av ON av.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
    """.trimIndent()

    override fun find(userId: Int?, from: LocalDate?, to: LocalDate?, source: AbsenceSource?): List<Absence> =
        handle.createQuery(
            """
            ${selectWithUser()}
            -- Every optional filter is cast explicitly. Postgres cannot infer the type
            -- of a null parameter that only ever appears in `IS NULL`, and fails the
            -- whole statement with "could not determine data type of parameter".
            WHERE (CAST(:userId AS INT) IS NULL OR a.${AbsenceDbModel.userId()} = CAST(:userId AS INT))
              AND (CAST(:from AS DATE) IS NULL OR a.${AbsenceDbModel.endDate()} >= CAST(:from AS DATE))
              AND (CAST(:to AS DATE) IS NULL OR a.${AbsenceDbModel.startDate()} <= CAST(:to AS DATE))
              AND (CAST(:source AS VARCHAR) IS NULL OR a.${AbsenceDbModel.source()} = CAST(:source AS VARCHAR))
            ORDER BY a.${AbsenceDbModel.startDate()} DESC, u.${AppUserDbModel.forename()}
            """.trimIndent()
        )
            .bind("userId", userId)
            .bind("from", from)
            .bind("to", to)
            .bind("source", source?.name)
            .map(AbsenceMapper())
            .list()

    override fun findById(absenceId: Int): Absence? =
        handle.createQuery("${selectWithUser()} WHERE a.${AbsenceDbModel.id()} = :absenceId")
            .bind("absenceId", absenceId)
            .map(AbsenceMapper())
            .findOne()
            .orElse(null)

    override fun findOverlapping(from: LocalDate, to: LocalDate): List<Absence> =
        handle.createQuery(
            """
            ${selectWithUser()}
            WHERE a.${AbsenceDbModel.startDate()} <= :to
              AND a.${AbsenceDbModel.endDate()} >= :from
            ORDER BY a.${AbsenceDbModel.startDate()}
            """.trimIndent()
        )
            .bind("from", from)
            .bind("to", to)
            .map(AbsenceMapper())
            .list()

    override fun insert(
        userId: Int,
        startDate: LocalDate,
        endDate: LocalDate,
        kind: AbsenceKind,
        source: AbsenceSource,
        importId: Int?,
        note: String?
    ): Int =
        handle.createUpdate(
            """
            INSERT INTO ${AbsenceDbModel.table()}
                (${AbsenceDbModel.userId()}, ${AbsenceDbModel.startDate()}, ${AbsenceDbModel.endDate()},
                 ${AbsenceDbModel.kind()}, ${AbsenceDbModel.source()}, ${AbsenceDbModel.importId()},
                 ${AbsenceDbModel.note()})
            VALUES (:userId, :startDate, :endDate, :kind, :source, :importId, :note)
            """.trimIndent()
        )
            .bind("userId", userId)
            .bind("startDate", startDate)
            .bind("endDate", endDate)
            .bind("kind", kind.name)
            .bind("source", source.name)
            .bind("importId", importId)
            .bind("note", note)
            .executeAndReturnGeneratedKeys(AbsenceDbModel.id())
            .mapTo(Int::class.java)
            .one()

    override fun update(
        absenceId: Int,
        startDate: LocalDate,
        endDate: LocalDate,
        kind: AbsenceKind,
        note: String?
    ): Boolean =
        handle.createUpdate(
            """
            UPDATE ${AbsenceDbModel.table()}
            SET ${AbsenceDbModel.startDate()} = :startDate,
                ${AbsenceDbModel.endDate()} = :endDate,
                ${AbsenceDbModel.kind()} = :kind,
                ${AbsenceDbModel.note()} = :note,
                ${AbsenceDbModel.manuallyEdited()} = TRUE,
                ${AbsenceDbModel.updatedAt()} = CURRENT_TIMESTAMP
            WHERE ${AbsenceDbModel.id()} = :absenceId
            """.trimIndent()
        )
            .bind("absenceId", absenceId)
            .bind("startDate", startDate)
            .bind("endDate", endDate)
            .bind("kind", kind.name)
            .bind("note", note)
            .execute() == 1

    override fun updateFromImport(absenceId: Int, startDate: LocalDate, endDate: LocalDate): Boolean =
        handle.createUpdate(
            """
            UPDATE ${AbsenceDbModel.table()}
            SET ${AbsenceDbModel.startDate()} = :startDate,
                ${AbsenceDbModel.endDate()} = :endDate,
                ${AbsenceDbModel.updatedAt()} = CURRENT_TIMESTAMP
            WHERE ${AbsenceDbModel.id()} = :absenceId
            """.trimIndent()
        )
            .bind("absenceId", absenceId)
            .bind("startDate", startDate)
            .bind("endDate", endDate)
            .execute() == 1

    override fun delete(absenceId: Int): Boolean =
        handle.createUpdate("DELETE FROM ${AbsenceDbModel.table()} WHERE ${AbsenceDbModel.id()} = :absenceId")
            .bind("absenceId", absenceId)
            .execute() == 1
}
