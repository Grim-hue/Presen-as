package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import pt.pse.presence.domain.objects.User
import pt.pse.presence.domain.objects.UserAvatar
import pt.pse.presence.domain.objects.UserWithSecret
import pt.pse.presence.repository.AppUserRepository
import pt.pse.presence.repository.jdbi.mapper.UserMapper
import pt.pse.presence.repository.jdbi.mapper.UserWithSecretMapper
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import pt.pse.presence.repository.jdbi.model.UserAvatarDbModel
import pt.pse.presence.repository.jdbi.mapper.AVATAR_VERSION
import java.sql.Timestamp

class JdbiAppUserRepository(private val handle: Handle) : AppUserRepository {

    override fun findByUsernameWithSecret(username: String): UserWithSecret? =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()},
                   u.${AppUserDbModel.passwordHash()}, u.${AppUserDbModel.isAdmin()},
                   a.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
            FROM ${AppUserDbModel.table()} u
            LEFT JOIN ${UserAvatarDbModel.table()} a
                   ON a.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
            WHERE lower(u.${AppUserDbModel.username()}) = lower(:username)
              AND u.${AppUserDbModel.active()} = TRUE
            """.trimIndent()
        )
            .bind("username", username)
            .map(UserWithSecretMapper())
            .findOne()
            .orElse(null)

    override fun findById(userId: Int): User? =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
                   a.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
            FROM ${AppUserDbModel.table()} u
            LEFT JOIN ${UserAvatarDbModel.table()} a
                   ON a.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
            WHERE u.${AppUserDbModel.id()} = :userId
              AND u.${AppUserDbModel.active()} = TRUE
            """.trimIndent()
        )
            .bind("userId", userId)
            .map(UserMapper())
            .findOne()
            .orElse(null)

    override fun findByEmail(email: String): User? =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
                   a.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
            FROM ${AppUserDbModel.table()} u
            LEFT JOIN ${UserAvatarDbModel.table()} a
                   ON a.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
            WHERE LOWER(u.${AppUserDbModel.email()}) = LOWER(:email)
            """.trimIndent()
        )
            .bind("email", email)
            .map(UserMapper())
            .findOne()
            .orElse(null)

    override fun update(
        userId: Int,
        forename: String,
        surname: String,
        email: String,
        isAdmin: Boolean
    ): Boolean =
        handle.createUpdate(
            """
            UPDATE ${AppUserDbModel.table()}
            SET ${AppUserDbModel.forename()} = :forename,
                ${AppUserDbModel.surname()} = :surname,
                ${AppUserDbModel.email()} = :email,
                ${AppUserDbModel.isAdmin()} = :isAdmin,
                ${AppUserDbModel.updatedAt()} = CURRENT_TIMESTAMP
            WHERE ${AppUserDbModel.id()} = :userId
            """.trimIndent()
        )
            .bind("userId", userId)
            .bind("forename", forename)
            .bind("surname", surname)
            .bind("email", email)
            .bind("isAdmin", isAdmin)
            .execute() == 1

    override fun findAllActive(): List<User> =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
                   a.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
            FROM ${AppUserDbModel.table()} u
            LEFT JOIN ${UserAvatarDbModel.table()} a
                   ON a.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
            WHERE u.${AppUserDbModel.active()} = TRUE
            ORDER BY u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()}
            """.trimIndent()
        )
            .map(UserMapper())
            .list()

    override fun findAvatar(userId: Int): UserAvatar? =
        handle.createQuery(
            """
            SELECT ${UserAvatarDbModel.contentType()}, ${UserAvatarDbModel.bytes()}
            FROM ${UserAvatarDbModel.table()}
            WHERE ${UserAvatarDbModel.userId()} = :userId
            """.trimIndent()
        )
            .bind("userId", userId)
            .map { rs, _ ->
                UserAvatar(
                    contentType = rs.getString(UserAvatarDbModel.contentType()),
                    bytes = rs.getBytes(UserAvatarDbModel.bytes())
                )
            }
            .findOne()
            .orElse(null)

    /**
     * One statement rather than a read and then a write: a person has one picture, so
     * replacing it is the same operation as setting the first one.
     */
    override fun saveAvatar(userId: Int, avatar: UserAvatar): Long =
        handle.createQuery(
            """
            INSERT INTO ${UserAvatarDbModel.table()}
                (${UserAvatarDbModel.userId()}, ${UserAvatarDbModel.contentType()},
                 ${UserAvatarDbModel.bytes()}, ${UserAvatarDbModel.updatedAt()})
            VALUES (:userId, :contentType, :bytes, CURRENT_TIMESTAMP)
            ON CONFLICT (${UserAvatarDbModel.userId()}) DO UPDATE
                SET ${UserAvatarDbModel.contentType()} = EXCLUDED.${UserAvatarDbModel.contentType()},
                    ${UserAvatarDbModel.bytes()} = EXCLUDED.${UserAvatarDbModel.bytes()},
                    ${UserAvatarDbModel.updatedAt()} = CURRENT_TIMESTAMP
            RETURNING ${UserAvatarDbModel.updatedAt()}
            """.trimIndent()
        )
            .bind("userId", userId)
            .bind("contentType", avatar.contentType)
            .bind("bytes", avatar.bytes)
            .mapTo(Timestamp::class.java)
            .one()
            .time

    override fun deleteAvatar(userId: Int): Boolean =
        handle.createUpdate(
            """
            DELETE FROM ${UserAvatarDbModel.table()}
            WHERE ${UserAvatarDbModel.userId()} = :userId
            """.trimIndent()
        )
            .bind("userId", userId)
            .execute() > 0
}
