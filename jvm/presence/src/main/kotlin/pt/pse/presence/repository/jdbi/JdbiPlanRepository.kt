package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import pt.pse.presence.domain.objects.GeneratedDay
import pt.pse.presence.domain.objects.HistoricDay
import pt.pse.presence.domain.objects.Plan
import pt.pse.presence.domain.objects.PlanConflict
import pt.pse.presence.domain.objects.PlanDay
import pt.pse.presence.domain.objects.PlanDayContext
import pt.pse.presence.domain.objects.PlanStatus
import pt.pse.presence.domain.objects.User
import pt.pse.presence.repository.PlanRepository
import pt.pse.presence.repository.jdbi.mapper.AVATAR_VERSION
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import pt.pse.presence.repository.jdbi.model.UserAvatarDbModel
import pt.pse.presence.repository.jdbi.model.PlanAssignmentDbModel
import pt.pse.presence.repository.jdbi.model.PlanDayDbModel
import pt.pse.presence.repository.jdbi.model.PlanDbModel
import java.time.LocalDate
import java.time.OffsetDateTime

class JdbiPlanRepository(private val handle: Handle) : PlanRepository {

    override fun create(teamId: Int, periodStart: LocalDate, periodEnd: LocalDate, generatedBy: Int): Int =
        handle.createUpdate(
            """
            INSERT INTO ${PlanDbModel.table()}
                (${PlanDbModel.teamId()}, ${PlanDbModel.periodStart()}, ${PlanDbModel.periodEnd()},
                 ${PlanDbModel.generatedBy()})
            VALUES (:teamId, :periodStart, :periodEnd, :generatedBy)
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("periodStart", periodStart)
            .bind("periodEnd", periodEnd)
            .bind("generatedBy", generatedBy)
            .executeAndReturnGeneratedKeys(PlanDbModel.id())
            .mapTo(Int::class.java)
            .one()

    override fun insertDays(planId: Int, days: List<GeneratedDay>) {
        days.forEach { day ->
            val dayId = handle.createUpdate(
                """
                INSERT INTO ${PlanDayDbModel.table()}
                    (${PlanDayDbModel.planId()}, ${PlanDayDbModel.dayDate()}, ${PlanDayDbModel.isHoliday()},
                     ${PlanDayDbModel.holidayName()}, ${PlanDayDbModel.requiredCount()},
                     ${PlanDayDbModel.understaffed()})
                VALUES (:planId, :dayDate, :isHoliday, :holidayName, :requiredCount, :understaffed)
                """.trimIndent()
            )
                .bind("planId", planId)
                .bind("dayDate", day.date)
                .bind("isHoliday", day.isHoliday)
                .bind("holidayName", day.holidayName)
                .bind("requiredCount", day.requiredCount)
                .bind("understaffed", day.understaffed)
                .executeAndReturnGeneratedKeys(PlanDayDbModel.id())
                .mapTo(Int::class.java)
                .one()

            insertAssignments(dayId, day.assignedUserIds)
        }
    }

    private fun insertAssignments(planDayId: Int, userIds: List<Int>) {
        if (userIds.isEmpty()) return
        val batch = handle.prepareBatch(
            """
            INSERT INTO ${PlanAssignmentDbModel.table()}
                (${PlanAssignmentDbModel.planDayId()}, ${PlanAssignmentDbModel.userId()})
            VALUES (:planDayId, :userId)
            """.trimIndent()
        )
        userIds.forEach { batch.bind("planDayId", planDayId).bind("userId", it).add() }
        batch.execute()
    }

    override fun findById(planId: Int): Plan? {
        val plan = handle.createQuery(
            """
            SELECT p.${PlanDbModel.id()}, p.${PlanDbModel.teamId()}, p.${PlanDbModel.periodStart()},
                   p.${PlanDbModel.periodEnd()}, p.${PlanDbModel.status()}, p.${PlanDbModel.generatedAt()},
                   p.${PlanDbModel.publishedAt()}, p.${PlanDbModel.notes()},
                   u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()}
            FROM ${PlanDbModel.table()} p
            JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = p.${PlanDbModel.generatedBy()}
            WHERE p.${PlanDbModel.id()} = :planId
            """.trimIndent()
        ).bind("planId", planId).map(::planRow).findOne().orElse(null) ?: return null

        return plan.copy(days = findDays(planId))
    }

    private fun findDays(planId: Int): List<PlanDay> {
        // One flat query, grouped afterwards. Two queries would be simpler to read
        // but would let a concurrent edit slip between them.
        val rows = handle.createQuery(
            """
            SELECT d.${PlanDayDbModel.id()}, d.${PlanDayDbModel.dayDate()}, d.${PlanDayDbModel.isHoliday()},
                   d.${PlanDayDbModel.holidayName()}, d.${PlanDayDbModel.requiredCount()},
                   d.${PlanDayDbModel.understaffed()},
                   u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
                   av.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
            FROM ${PlanDayDbModel.table()} d
            LEFT JOIN ${PlanAssignmentDbModel.table()} a
                   ON a.${PlanAssignmentDbModel.planDayId()} = d.${PlanDayDbModel.id()}
            LEFT JOIN ${AppUserDbModel.table()} u
                   ON u.${AppUserDbModel.id()} = a.${PlanAssignmentDbModel.userId()}
            LEFT JOIN ${UserAvatarDbModel.table()} av
                   ON av.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
            WHERE d.${PlanDayDbModel.planId()} = :planId
            ORDER BY d.${PlanDayDbModel.dayDate()}, u.${AppUserDbModel.forename()}
            """.trimIndent()
        ).bind("planId", planId).map { rs, _ ->
            val userId = rs.getInt(AppUserDbModel.id())
            val user = if (rs.wasNull()) null else User(
                id = userId,
                forename = rs.getString(AppUserDbModel.forename()),
                surname = rs.getString(AppUserDbModel.surname()),
                email = rs.getString(AppUserDbModel.email()),
                username = rs.getString(AppUserDbModel.username()) ?: "",
                isAdmin = rs.getBoolean(AppUserDbModel.isAdmin()),
                avatarVersion = rs.getTimestamp(AVATAR_VERSION)?.time
            )
            PlanDay(
                id = rs.getInt(PlanDayDbModel.id()),
                date = rs.getObject(PlanDayDbModel.dayDate(), LocalDate::class.java),
                isHoliday = rs.getBoolean(PlanDayDbModel.isHoliday()),
                holidayName = rs.getString(PlanDayDbModel.holidayName()),
                requiredCount = rs.getInt(PlanDayDbModel.requiredCount()),
                understaffed = rs.getBoolean(PlanDayDbModel.understaffed()),
                assigned = listOfNotNull(user)
            )
        }.list()

        return rows.groupBy { it.id }
            .map { (_, group) -> group.first().copy(assigned = group.flatMap { it.assigned }) }
            .sortedBy { it.date }
    }

    override fun findByTeam(teamId: Int, year: Int?): List<Plan> =
        handle.createQuery(
            """
            SELECT p.${PlanDbModel.id()}, p.${PlanDbModel.teamId()}, p.${PlanDbModel.periodStart()},
                   p.${PlanDbModel.periodEnd()}, p.${PlanDbModel.status()}, p.${PlanDbModel.generatedAt()},
                   p.${PlanDbModel.publishedAt()}, p.${PlanDbModel.notes()},
                   u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()}
            FROM ${PlanDbModel.table()} p
            JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = p.${PlanDbModel.generatedBy()}
            WHERE p.${PlanDbModel.teamId()} = :teamId
              AND (CAST(:year AS INT) IS NULL
                   OR EXTRACT(YEAR FROM p.${PlanDbModel.periodStart()}) = CAST(:year AS INT)
                   OR EXTRACT(YEAR FROM p.${PlanDbModel.periodEnd()}) = CAST(:year AS INT))
            ORDER BY p.${PlanDbModel.periodStart()} DESC
            """.trimIndent()
        ).bind("teamId", teamId).bind("year", year).map(::planRow).list()

    override fun publish(planId: Int): Boolean =
        handle.createUpdate(
            """
            UPDATE ${PlanDbModel.table()}
            SET ${PlanDbModel.status()} = 'PUBLISHED', ${PlanDbModel.publishedAt()} = CURRENT_TIMESTAMP
            WHERE ${PlanDbModel.id()} = :planId AND ${PlanDbModel.status()} = 'DRAFT'
            """.trimIndent()
        ).bind("planId", planId).execute() == 1

    override fun updateNotes(planId: Int, notes: String?): Boolean =
        handle.createUpdate(
            """
            UPDATE ${PlanDbModel.table()}
            SET ${PlanDbModel.notes()} = :notes
            WHERE ${PlanDbModel.id()} = :planId
            """.trimIndent()
        )
            .bind("planId", planId)
            .bind("notes", notes)
            .execute() == 1

    override fun delete(planId: Int): Boolean =
        handle.createUpdate("DELETE FROM ${PlanDbModel.table()} WHERE ${PlanDbModel.id()} = :planId")
            .bind("planId", planId).execute() == 1

    override fun findPublishedHistory(teamId: Int, from: LocalDate, before: LocalDate): List<HistoricDay> {
        val rows = handle.createQuery(
            """
            SELECT d.${PlanDayDbModel.id()}, d.${PlanDayDbModel.dayDate()}, d.${PlanDayDbModel.isHoliday()},
                   d.${PlanDayDbModel.requiredCount()}, a.${PlanAssignmentDbModel.userId()}
            FROM ${PlanDayDbModel.table()} d
            JOIN ${PlanDbModel.table()} p ON p.${PlanDbModel.id()} = d.${PlanDayDbModel.planId()}
            LEFT JOIN ${PlanAssignmentDbModel.table()} a
                   ON a.${PlanAssignmentDbModel.planDayId()} = d.${PlanDayDbModel.id()}
            WHERE p.${PlanDbModel.teamId()} = :teamId
              AND p.${PlanDbModel.status()} = 'PUBLISHED'
              AND d.${PlanDayDbModel.dayDate()} >= :from
              AND d.${PlanDayDbModel.dayDate()} < :before
            ORDER BY d.${PlanDayDbModel.dayDate()}
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("from", from)
            .bind("before", before)
            .map { rs, _ ->
                val userId = rs.getInt(PlanAssignmentDbModel.userId()).takeUnless { rs.wasNull() }
                Triple(
                    rs.getInt(PlanDayDbModel.id()),
                    HistoricDay(
                        rs.getObject(PlanDayDbModel.dayDate(), LocalDate::class.java),
                        rs.getBoolean(PlanDayDbModel.isHoliday()),
                        rs.getInt(PlanDayDbModel.requiredCount()),
                        emptyList()
                    ),
                    userId
                )
            }.list()

        return rows.groupBy { it.first }
            .map { (_, group) ->
                group.first().second.copy(assignedUserIds = group.mapNotNull { it.third })
            }
            .sortedBy { it.date }
    }

    override fun findDayId(planId: Int, date: LocalDate): Int? =
        handle.createQuery(
            """
            SELECT ${PlanDayDbModel.id()} FROM ${PlanDayDbModel.table()}
            WHERE ${PlanDayDbModel.planId()} = :planId AND ${PlanDayDbModel.dayDate()} = :date
            """.trimIndent()
        ).bind("planId", planId).bind("date", date).mapTo(Int::class.java).findOne().orElse(null)

    override fun findPublishedAssignments(userIds: Set<Int>, from: LocalDate, to: LocalDate): List<PlanConflict> {
        if (userIds.isEmpty()) return emptyList()
        return handle.createQuery(
            """
            SELECT p.${PlanDbModel.id()}, p.${PlanDbModel.teamId()},
                   d.${PlanDayDbModel.dayDate()}, a.${PlanAssignmentDbModel.userId()}
            FROM ${PlanAssignmentDbModel.table()} a
            JOIN ${PlanDayDbModel.table()} d ON d.${PlanDayDbModel.id()} = a.${PlanAssignmentDbModel.planDayId()}
            JOIN ${PlanDbModel.table()} p ON p.${PlanDbModel.id()} = d.${PlanDayDbModel.planId()}
            WHERE p.${PlanDbModel.status()} = 'PUBLISHED'
              AND d.${PlanDayDbModel.isHoliday()} = FALSE
              AND d.${PlanDayDbModel.dayDate()} BETWEEN :from AND :to
              AND a.${PlanAssignmentDbModel.userId()} IN (<userIds>)
            ORDER BY d.${PlanDayDbModel.dayDate()}, a.${PlanAssignmentDbModel.userId()}
            """.trimIndent()
        )
            .bindList("userIds", userIds)
            .bind("from", from)
            .bind("to", to)
            .map { rs, _ ->
                PlanConflict(
                    planId = rs.getInt(PlanDbModel.id()),
                    teamId = rs.getInt(PlanDbModel.teamId()),
                    date = rs.getObject(PlanDayDbModel.dayDate(), LocalDate::class.java),
                    userId = rs.getInt(PlanAssignmentDbModel.userId())
                )
            }
            .list()
    }

    override fun replaceAssignments(
        planDayId: Int,
        userIds: List<Int>,
        requiredCount: Int,
        understaffed: Boolean
    ) {
        handle.createUpdate(
            "DELETE FROM ${PlanAssignmentDbModel.table()} WHERE ${PlanAssignmentDbModel.planDayId()} = :dayId"
        ).bind("dayId", planDayId).execute()
        insertAssignments(planDayId, userIds)
        handle.createUpdate(
            """
            UPDATE ${PlanDayDbModel.table()}
            SET ${PlanDayDbModel.requiredCount()} = :requiredCount,
                ${PlanDayDbModel.understaffed()} = :understaffed
            WHERE ${PlanDayDbModel.id()} = :dayId
            """.trimIndent()
        )
            .bind("dayId", planDayId)
            .bind("requiredCount", requiredCount)
            .bind("understaffed", understaffed)
            .execute()
    }

    override fun findDayContext(planDayId: Int): PlanDayContext? {
        // Flat, and grouped afterwards, for the same reason findDays is: the day and
        // the people on it must come from one read of the database.
        val rows = handle.createQuery(
            """
            SELECT d.${PlanDayDbModel.id()}, d.${PlanDayDbModel.dayDate()}, d.${PlanDayDbModel.isHoliday()},
                   d.${PlanDayDbModel.holidayName()}, d.${PlanDayDbModel.requiredCount()},
                   d.${PlanDayDbModel.understaffed()},
                   p.${PlanDbModel.id()}, p.${PlanDbModel.teamId()}, p.${PlanDbModel.status()},
                   u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()}
            FROM ${PlanDayDbModel.table()} d
            JOIN ${PlanDbModel.table()} p ON p.${PlanDbModel.id()} = d.${PlanDayDbModel.planId()}
            LEFT JOIN ${PlanAssignmentDbModel.table()} a
                   ON a.${PlanAssignmentDbModel.planDayId()} = d.${PlanDayDbModel.id()}
            LEFT JOIN ${AppUserDbModel.table()} u
                   ON u.${AppUserDbModel.id()} = a.${PlanAssignmentDbModel.userId()}
            WHERE d.${PlanDayDbModel.id()} = :planDayId
            ORDER BY u.${AppUserDbModel.forename()}
            """.trimIndent()
        ).bind("planDayId", planDayId).map { rs, _ ->
            val userId = rs.getInt(AppUserDbModel.id())
            val user = if (rs.wasNull()) null else User(
                id = userId,
                forename = rs.getString(AppUserDbModel.forename()),
                surname = rs.getString(AppUserDbModel.surname()),
                email = rs.getString(AppUserDbModel.email()),
                username = rs.getString(AppUserDbModel.username()) ?: "",
                isAdmin = rs.getBoolean(AppUserDbModel.isAdmin())
            )
            PlanDayContext(
                planId = rs.getInt(PlanDbModel.id()),
                teamId = rs.getInt(PlanDbModel.teamId()),
                planStatus = PlanStatus.valueOf(rs.getString(PlanDbModel.status())),
                day = PlanDay(
                    id = rs.getInt(PlanDayDbModel.id()),
                    date = rs.getObject(PlanDayDbModel.dayDate(), LocalDate::class.java),
                    isHoliday = rs.getBoolean(PlanDayDbModel.isHoliday()),
                    holidayName = rs.getString(PlanDayDbModel.holidayName()),
                    requiredCount = rs.getInt(PlanDayDbModel.requiredCount()),
                    understaffed = rs.getBoolean(PlanDayDbModel.understaffed()),
                    assigned = listOfNotNull(user)
                )
            )
        }.list()

        if (rows.isEmpty()) return null
        return rows.first().let { first ->
            first.copy(day = first.day.copy(assigned = rows.flatMap { it.day.assigned }))
        }
    }

    override fun reassign(planDayId: Int, fromUserId: Int, toUserId: Int): Boolean =
        handle.createUpdate(
            """
            UPDATE ${PlanAssignmentDbModel.table()}
            SET ${PlanAssignmentDbModel.userId()} = :toUserId
            WHERE ${PlanAssignmentDbModel.planDayId()} = :planDayId
              AND ${PlanAssignmentDbModel.userId()} = :fromUserId
              AND NOT EXISTS (
                  SELECT 1 FROM ${PlanAssignmentDbModel.table()} other
                  WHERE other.${PlanAssignmentDbModel.planDayId()} = :planDayId
                    AND other.${PlanAssignmentDbModel.userId()} = :toUserId
              )
            """.trimIndent()
        )
            .bind("planDayId", planDayId)
            .bind("fromUserId", fromUserId)
            .bind("toUserId", toUserId)
            .execute() == 1

    private fun planRow(rs: java.sql.ResultSet, ctx: org.jdbi.v3.core.statement.StatementContext) = Plan(
        id = rs.getInt(PlanDbModel.id()),
        teamId = rs.getInt(PlanDbModel.teamId()),
        periodStart = rs.getObject(PlanDbModel.periodStart(), LocalDate::class.java),
        periodEnd = rs.getObject(PlanDbModel.periodEnd(), LocalDate::class.java),
        status = PlanStatus.valueOf(rs.getString(PlanDbModel.status())),
        generatedAt = rs.getObject(PlanDbModel.generatedAt(), OffsetDateTime::class.java),
        generatedBy = User(
            id = rs.getInt(AppUserDbModel.id()),
            forename = rs.getString(AppUserDbModel.forename()),
            surname = rs.getString(AppUserDbModel.surname()),
            email = rs.getString(AppUserDbModel.email()),
            username = rs.getString(AppUserDbModel.username()) ?: "",
            isAdmin = rs.getBoolean(AppUserDbModel.isAdmin())
        ),
        publishedAt = rs.getObject(PlanDbModel.publishedAt(), OffsetDateTime::class.java),
        notes = rs.getString(PlanDbModel.notes()),
        days = emptyList()
    )
}
