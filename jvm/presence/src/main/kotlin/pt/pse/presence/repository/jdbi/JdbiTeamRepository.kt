package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.domain.objects.User
import pt.pse.presence.repository.TeamRepository
import pt.pse.presence.repository.jdbi.mapper.TeamMapper
import pt.pse.presence.repository.jdbi.mapper.TeamMemberMapper
import pt.pse.presence.repository.jdbi.mapper.UserMapper
import pt.pse.presence.repository.jdbi.mapper.AVATAR_VERSION
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import pt.pse.presence.repository.jdbi.model.UserAvatarDbModel
import pt.pse.presence.repository.jdbi.model.TeamDbModel
import pt.pse.presence.repository.jdbi.model.TeamMemberDbModel
import java.time.LocalDate

class JdbiTeamRepository(private val handle: Handle) : TeamRepository {

    private fun columns() = """
        ${TeamDbModel.id()}, ${TeamDbModel.name()}, ${TeamDbModel.onSiteWeekday()},
        ${TeamDbModel.requiredOnSite()}, ${TeamDbModel.fairnessSince()},
        ${TeamDbModel.emailSubject()}, ${TeamDbModel.emailIntro()}, ${TeamDbModel.active()}
    """.trimIndent()

    override fun findAllActive(): List<Team> =
        handle.createQuery(
            """
            SELECT ${columns()}
            FROM ${TeamDbModel.table()}
            WHERE ${TeamDbModel.active()} = TRUE
            ORDER BY ${TeamDbModel.name()}
            """.trimIndent()
        ).map(TeamMapper()).list()

    override fun findById(teamId: Int): Team? =
        handle.createQuery(
            """
            SELECT ${columns()}
            FROM ${TeamDbModel.table()}
            WHERE ${TeamDbModel.id()} = :teamId
            """.trimIndent()
        ).bind("teamId", teamId).map(TeamMapper()).findOne().orElse(null)

    override fun findMembers(teamId: Int): List<TeamMember> =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
                   m.${TeamMemberDbModel.joinedAt()}, m.${TeamMemberDbModel.leftAt()},
                   av.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
            FROM ${TeamMemberDbModel.table()} m
            JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = m.${TeamMemberDbModel.userId()}
            LEFT JOIN ${UserAvatarDbModel.table()} av
                   ON av.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
            WHERE m.${TeamMemberDbModel.teamId()} = :teamId
            ORDER BY m.${TeamMemberDbModel.joinedAt()}, u.${AppUserDbModel.forename()}
            """.trimIndent()
        ).bind("teamId", teamId).map(TeamMemberMapper()).list()

    override fun findByName(name: String): Team? =
        handle.createQuery(
            """
            SELECT ${columns()}
            FROM ${TeamDbModel.table()}
            WHERE lower(${TeamDbModel.name()}) = lower(:name)
            """.trimIndent()
        ).bind("name", name).map(TeamMapper()).findOne().orElse(null)

    override fun create(
        name: String,
        onSiteWeekday: Int,
        requiredOnSite: Int,
        fairnessSince: LocalDate,
        emailSubject: String,
        emailIntro: String
    ): Int =
        handle.createUpdate(
            """
            INSERT INTO ${TeamDbModel.table()}
                (${TeamDbModel.name()}, ${TeamDbModel.onSiteWeekday()}, ${TeamDbModel.requiredOnSite()},
                 ${TeamDbModel.fairnessSince()}, ${TeamDbModel.emailSubject()}, ${TeamDbModel.emailIntro()})
            VALUES (:name, :weekday, :required, :fairnessSince, :emailSubject, :emailIntro)
            """.trimIndent()
        )
            .bind("name", name)
            .bind("weekday", onSiteWeekday)
            .bind("required", requiredOnSite)
            .bind("fairnessSince", fairnessSince)
            .bind("emailSubject", emailSubject)
            .bind("emailIntro", emailIntro)
            .executeAndReturnGeneratedKeys(TeamDbModel.id())
            .mapTo(Int::class.java)
            .one()

    override fun findMember(teamId: Int, userId: Int): TeamMember? =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
                   m.${TeamMemberDbModel.joinedAt()}, m.${TeamMemberDbModel.leftAt()}
            FROM ${TeamMemberDbModel.table()} m
            JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = m.${TeamMemberDbModel.userId()}
            WHERE m.${TeamMemberDbModel.teamId()} = :teamId AND m.${TeamMemberDbModel.userId()} = :userId
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("userId", userId)
            .map(TeamMemberMapper())
            .findOne()
            .orElse(null)

    override fun addMember(teamId: Int, userId: Int, joinedAt: LocalDate): Boolean =
        handle.createUpdate(
            """
            INSERT INTO ${TeamMemberDbModel.table()}
                (${TeamMemberDbModel.teamId()}, ${TeamMemberDbModel.userId()}, ${TeamMemberDbModel.joinedAt()})
            VALUES (:teamId, :userId, :joinedAt)
            ON CONFLICT (${TeamMemberDbModel.teamId()}, ${TeamMemberDbModel.userId()})
            DO UPDATE SET ${TeamMemberDbModel.joinedAt()} = :joinedAt,
                          ${TeamMemberDbModel.leftAt()} = NULL
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("userId", userId)
            .bind("joinedAt", joinedAt)
            .execute() == 1

    override fun updateMembership(teamId: Int, userId: Int, joinedAt: LocalDate): Boolean =
        handle.createUpdate(
            """
            UPDATE ${TeamMemberDbModel.table()}
            SET ${TeamMemberDbModel.joinedAt()} = :joinedAt
            WHERE ${TeamMemberDbModel.teamId()} = :teamId
              AND ${TeamMemberDbModel.userId()} = :userId
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("userId", userId)
            .bind("joinedAt", joinedAt)
            .execute() == 1

    override fun endMembership(teamId: Int, userId: Int, leftAt: LocalDate): Boolean =
        handle.createUpdate(
            """
            UPDATE ${TeamMemberDbModel.table()}
            SET ${TeamMemberDbModel.leftAt()} = :leftAt
            WHERE ${TeamMemberDbModel.teamId()} = :teamId
              AND ${TeamMemberDbModel.userId()} = :userId
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("userId", userId)
            .bind("leftAt", leftAt)
            .execute() == 1

    override fun deleteMembership(teamId: Int, userId: Int): Boolean =
        handle.createUpdate(
            """
            DELETE FROM ${TeamMemberDbModel.table()}
            WHERE ${TeamMemberDbModel.teamId()} = :teamId
              AND ${TeamMemberDbModel.userId()} = :userId
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("userId", userId)
            .execute() == 1

    override fun findCandidates(teamId: Int): List<User> =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()}
            FROM ${AppUserDbModel.table()} u
            WHERE u.${AppUserDbModel.active()} = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM ${TeamMemberDbModel.table()} m
                  WHERE m.${TeamMemberDbModel.teamId()} = :teamId
                    AND m.${TeamMemberDbModel.userId()} = u.${AppUserDbModel.id()}
                    AND m.${TeamMemberDbModel.leftAt()} IS NULL
              )
            ORDER BY u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()}
            """.trimIndent()
        ).bind("teamId", teamId).map(UserMapper()).list()

    override fun updateRule(
        teamId: Int,
        onSiteWeekday: Int,
        requiredOnSite: Int,
        fairnessSince: LocalDate
    ): Boolean =
        handle.createUpdate(
            """
            UPDATE ${TeamDbModel.table()}
            SET ${TeamDbModel.onSiteWeekday()} = :weekday,
                ${TeamDbModel.requiredOnSite()} = :required,
                ${TeamDbModel.fairnessSince()} = :fairnessSince,
                ${TeamDbModel.updatedAt()} = CURRENT_TIMESTAMP
            WHERE ${TeamDbModel.id()} = :teamId
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("weekday", onSiteWeekday)
            .bind("required", requiredOnSite)
            .bind("fairnessSince", fairnessSince)
            .execute() == 1

    override fun rename(teamId: Int, name: String): Boolean =
        handle.createUpdate(
            """
            UPDATE ${TeamDbModel.table()}
            SET ${TeamDbModel.name()} = :name,
                ${TeamDbModel.updatedAt()} = CURRENT_TIMESTAMP
            WHERE ${TeamDbModel.id()} = :teamId
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("name", name)
            .execute() == 1

    override fun updateEmail(teamId: Int, emailSubject: String, emailIntro: String): Boolean =
        handle.createUpdate(
            """
            UPDATE ${TeamDbModel.table()}
            SET ${TeamDbModel.emailSubject()} = :subject,
                ${TeamDbModel.emailIntro()} = :intro,
                ${TeamDbModel.updatedAt()} = CURRENT_TIMESTAMP
            WHERE ${TeamDbModel.id()} = :teamId
            """.trimIndent()
        )
            .bind("teamId", teamId)
            .bind("subject", emailSubject)
            .bind("intro", emailIntro)
            .execute() == 1
}
