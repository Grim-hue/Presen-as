package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import pt.pse.presence.domain.objects.PlanDay
import pt.pse.presence.domain.objects.PlanStatus
import pt.pse.presence.domain.objects.SwapRequest
import pt.pse.presence.domain.objects.SwapSide
import pt.pse.presence.domain.objects.SwapStatus
import pt.pse.presence.domain.objects.User
import pt.pse.presence.repository.SwapRequestRepository
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import pt.pse.presence.repository.jdbi.model.PlanAssignmentDbModel
import pt.pse.presence.repository.jdbi.model.PlanDayDbModel
import pt.pse.presence.repository.jdbi.model.PlanDbModel
import pt.pse.presence.repository.jdbi.model.SwapRequestDbModel
import java.sql.ResultSet
import java.time.LocalDate
import java.time.OffsetDateTime

/**
 * Reading a swap means reading two of everything: two members, two days, two plans.
 * The user table and the day table therefore appear twice in every query here, so the
 * columns are aliased and read by alias. [UserMapper] and the other row mappers cannot
 * be reused for the same reason: their column names would collide with themselves.
 */
class JdbiSwapRequestRepository(private val handle: Handle) : SwapRequestRepository {

    override fun create(
        requesterId: Int,
        targetId: Int,
        requesterPlanDayId: Int,
        targetPlanDayId: Int,
        note: String?
    ): Int =
        handle.createUpdate(
            """
            INSERT INTO ${SwapRequestDbModel.table()}
                (${SwapRequestDbModel.requesterId()}, ${SwapRequestDbModel.targetId()},
                 ${SwapRequestDbModel.requesterPlanDayId()}, ${SwapRequestDbModel.targetPlanDayId()},
                 ${SwapRequestDbModel.note()})
            VALUES (:requesterId, :targetId, :requesterPlanDayId, :targetPlanDayId, :note)
            """.trimIndent()
        )
            .bind("requesterId", requesterId)
            .bind("targetId", targetId)
            .bind("requesterPlanDayId", requesterPlanDayId)
            .bind("targetPlanDayId", targetPlanDayId)
            .bind("note", note)
            .executeAndReturnGeneratedKeys(SwapRequestDbModel.id())
            .mapTo(Int::class.java)
            .one()

    override fun findById(swapRequestId: Int): SwapRequest? {
        val request = handle.createQuery(
            """
            $SELECT_REQUEST
            WHERE sr.${SwapRequestDbModel.id()} = :swapRequestId
            """.trimIndent()
        ).bind("swapRequestId", swapRequestId).map(::requestRow).findOne().orElse(null) ?: return null

        return withAssignments(listOf(request)).first()
    }

    override fun findForUser(userId: Int, resolvedSince: OffsetDateTime): List<SwapRequest> {
        val requests = handle.createQuery(
            """
            $SELECT_REQUEST
            WHERE (sr.${SwapRequestDbModel.requesterId()} = :userId
                   OR sr.${SwapRequestDbModel.targetId()} = :userId)
              AND (sr.${SwapRequestDbModel.status()} = 'PENDING'
                   OR sr.${SwapRequestDbModel.resolvedAt()} > :resolvedSince)
              AND (sr.${SwapRequestDbModel.status()} <> 'PENDING'
                   OR (rd.${PlanDayDbModel.dayDate()} > CURRENT_DATE
                       AND td.${PlanDayDbModel.dayDate()} > CURRENT_DATE))
            ORDER BY sr.${SwapRequestDbModel.createdAt()} DESC
            """.trimIndent()
        )
            .bind("userId", userId)
            .bind("resolvedSince", resolvedSince)
            .map(::requestRow)
            .list()

        return withAssignments(requests)
    }

    override fun hasPending(requesterPlanDayId: Int, targetPlanDayId: Int): Boolean =
        handle.createQuery(
            """
            SELECT COUNT(*) FROM ${SwapRequestDbModel.table()}
            WHERE ${SwapRequestDbModel.requesterPlanDayId()} = :requesterPlanDayId
              AND ${SwapRequestDbModel.targetPlanDayId()} = :targetPlanDayId
              AND ${SwapRequestDbModel.status()} = 'PENDING'
            """.trimIndent()
        )
            .bind("requesterPlanDayId", requesterPlanDayId)
            .bind("targetPlanDayId", targetPlanDayId)
            .mapTo(Int::class.java)
            .one() > 0

    override fun resolve(swapRequestId: Int, status: SwapStatus): Boolean =
        handle.createUpdate(
            """
            UPDATE ${SwapRequestDbModel.table()}
            SET ${SwapRequestDbModel.status()} = :status,
                ${SwapRequestDbModel.resolvedAt()} = CURRENT_TIMESTAMP
            WHERE ${SwapRequestDbModel.id()} = :swapRequestId
              AND ${SwapRequestDbModel.status()} = 'PENDING'
            """.trimIndent()
        )
            .bind("swapRequestId", swapRequestId)
            .bind("status", status.name)
            .execute() == 1

    /**
     * Fills in who else is on each of the days mentioned.
     *
     * A second query rather than more joins: pulling both days' assignments into the
     * row above would multiply them by each other. This list is what the bell shows;
     * the decision to apply a swap re-reads the days through
     * [pt.pse.presence.repository.PlanRepository.findDayContext].
     */
    private fun withAssignments(requests: List<SwapRequest>): List<SwapRequest> {
        if (requests.isEmpty()) return requests
        val dayIds = requests.flatMap { listOf(it.requester.day.id, it.target.day.id) }.distinct()

        val byDay = handle.createQuery(
            """
            SELECT a.${PlanAssignmentDbModel.planDayId()},
                   u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()}
            FROM ${PlanAssignmentDbModel.table()} a
            JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = a.${PlanAssignmentDbModel.userId()}
            WHERE a.${PlanAssignmentDbModel.planDayId()} IN (<dayIds>)
            ORDER BY u.${AppUserDbModel.forename()}
            """.trimIndent()
        )
            .bindList("dayIds", dayIds)
            .map { rs, _ ->
                rs.getInt(PlanAssignmentDbModel.planDayId()) to User(
                    id = rs.getInt(AppUserDbModel.id()),
                    forename = rs.getString(AppUserDbModel.forename()),
                    surname = rs.getString(AppUserDbModel.surname()),
                    email = rs.getString(AppUserDbModel.email()),
                    username = rs.getString(AppUserDbModel.username()) ?: "",
                    isAdmin = rs.getBoolean(AppUserDbModel.isAdmin())
                )
            }
            .list()
            .groupBy({ it.first }, { it.second })

        return requests.map { request ->
            request.copy(
                requester = request.requester.withAssigned(byDay[request.requester.day.id].orEmpty()),
                target = request.target.withAssigned(byDay[request.target.day.id].orEmpty())
            )
        }
    }

    private fun SwapSide.withAssigned(assigned: List<User>) = copy(day = day.copy(assigned = assigned))

    private fun requestRow(rs: ResultSet, ctx: org.jdbi.v3.core.statement.StatementContext) = SwapRequest(
        id = rs.getInt(SwapRequestDbModel.id()),
        requester = side(rs, "req"),
        target = side(rs, "tgt"),
        status = SwapStatus.valueOf(rs.getString(SwapRequestDbModel.status())),
        note = rs.getString(SwapRequestDbModel.note()),
        createdAt = rs.getObject(SwapRequestDbModel.createdAt(), OffsetDateTime::class.java),
        resolvedAt = rs.getObject(SwapRequestDbModel.resolvedAt(), OffsetDateTime::class.java)
    )

    /** Reads one half of the row, by the alias prefix the query gave it. */
    private fun side(rs: ResultSet, prefix: String) = SwapSide(
        user = User(
            id = rs.getInt("${prefix}_user_id"),
            forename = rs.getString("${prefix}_forename"),
            surname = rs.getString("${prefix}_surname"),
            email = rs.getString("${prefix}_email"),
            username = rs.getString("${prefix}_username") ?: "",
            isAdmin = rs.getBoolean("${prefix}_is_admin")
        ),
        teamId = rs.getInt("${prefix}_team_id"),
        planId = rs.getInt("${prefix}_plan_id"),
        planStatus = PlanStatus.valueOf(rs.getString("${prefix}_plan_status")),
        day = PlanDay(
            id = rs.getInt("${prefix}_day_id"),
            date = rs.getObject("${prefix}_day_date", LocalDate::class.java),
            isHoliday = rs.getBoolean("${prefix}_is_holiday"),
            holidayName = rs.getString("${prefix}_holiday_name"),
            requiredCount = rs.getInt("${prefix}_required_count"),
            understaffed = rs.getBoolean("${prefix}_understaffed"),
            assigned = emptyList()
        )
    )

    private companion object {
        /** The two halves, aliased req_ and tgt_, and joined identically. */
        val SELECT_REQUEST = """
            SELECT sr.${SwapRequestDbModel.id()}, sr.${SwapRequestDbModel.status()},
                   sr.${SwapRequestDbModel.note()}, sr.${SwapRequestDbModel.createdAt()},
                   sr.${SwapRequestDbModel.resolvedAt()},
                   ${userColumns("ru", "req")},
                   ${userColumns("tu", "tgt")},
                   ${dayColumns("rd", "rp", "req")},
                   ${dayColumns("td", "tp", "tgt")}
            FROM ${SwapRequestDbModel.table()} sr
            JOIN ${AppUserDbModel.table()} ru
                 ON ru.${AppUserDbModel.id()} = sr.${SwapRequestDbModel.requesterId()}
            JOIN ${AppUserDbModel.table()} tu
                 ON tu.${AppUserDbModel.id()} = sr.${SwapRequestDbModel.targetId()}
            JOIN ${PlanDayDbModel.table()} rd
                 ON rd.${PlanDayDbModel.id()} = sr.${SwapRequestDbModel.requesterPlanDayId()}
            JOIN ${PlanDayDbModel.table()} td
                 ON td.${PlanDayDbModel.id()} = sr.${SwapRequestDbModel.targetPlanDayId()}
            JOIN ${PlanDbModel.table()} rp ON rp.${PlanDbModel.id()} = rd.${PlanDayDbModel.planId()}
            JOIN ${PlanDbModel.table()} tp ON tp.${PlanDbModel.id()} = td.${PlanDayDbModel.planId()}
        """.trimIndent()

        fun userColumns(table: String, prefix: String) = listOf(
            AppUserDbModel.id() to "user_id",
            AppUserDbModel.forename() to "forename",
            AppUserDbModel.surname() to "surname",
            AppUserDbModel.email() to "email",
            AppUserDbModel.username() to "username",
            AppUserDbModel.isAdmin() to "is_admin"
        ).joinToString(", ") { (column, alias) -> "$table.$column AS ${prefix}_$alias" }

        fun dayColumns(dayTable: String, planTable: String, prefix: String) = listOf(
            "$dayTable.${PlanDayDbModel.id()}" to "day_id",
            "$dayTable.${PlanDayDbModel.dayDate()}" to "day_date",
            "$dayTable.${PlanDayDbModel.isHoliday()}" to "is_holiday",
            "$dayTable.${PlanDayDbModel.holidayName()}" to "holiday_name",
            "$dayTable.${PlanDayDbModel.requiredCount()}" to "required_count",
            "$dayTable.${PlanDayDbModel.understaffed()}" to "understaffed",
            "$planTable.${PlanDbModel.id()}" to "plan_id",
            "$planTable.${PlanDbModel.teamId()}" to "team_id",
            "$planTable.${PlanDbModel.status()}" to "plan_status"
        ).joinToString(", ") { (column, alias) -> "$column AS ${prefix}_$alias" }
    }
}
