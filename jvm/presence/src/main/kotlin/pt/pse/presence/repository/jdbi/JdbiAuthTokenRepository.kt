package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import pt.pse.presence.domain.objects.User
import pt.pse.presence.repository.AuthTokenRepository
import pt.pse.presence.repository.jdbi.mapper.UserMapper
import pt.pse.presence.repository.jdbi.mapper.AVATAR_VERSION
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import pt.pse.presence.repository.jdbi.model.UserAvatarDbModel
import pt.pse.presence.repository.jdbi.model.AuthTokenDbModel
import java.time.Duration

class JdbiAuthTokenRepository(private val handle: Handle) : AuthTokenRepository {

    override fun insert(tokenHash: String, userId: Int) {
        handle.createUpdate(
            """
            INSERT INTO ${AuthTokenDbModel.table()}
                (${AuthTokenDbModel.tokenValidationInfo()}, ${AuthTokenDbModel.userId()})
            VALUES (:tokenHash, :userId)
            """.trimIndent()
        )
            .bind("tokenHash", tokenHash)
            .bind("userId", userId)
            .execute()
    }

    override fun findUserByTokenHash(tokenHash: String, idleTtl: Duration): User? =
        handle.createQuery(
            """
            SELECT u.${AppUserDbModel.id()}, u.${AppUserDbModel.forename()}, u.${AppUserDbModel.surname()},
                   u.${AppUserDbModel.email()}, u.${AppUserDbModel.username()}, u.${AppUserDbModel.isAdmin()},
                   a.${UserAvatarDbModel.updatedAt()} AS $AVATAR_VERSION
            FROM ${AuthTokenDbModel.table()} t
            JOIN ${AppUserDbModel.table()} u ON u.${AppUserDbModel.id()} = t.${AuthTokenDbModel.userId()}
            LEFT JOIN ${UserAvatarDbModel.table()} a ON a.${UserAvatarDbModel.userId()} = u.${AppUserDbModel.id()}
            WHERE t.${AuthTokenDbModel.tokenValidationInfo()} = :tokenHash
              AND u.${AppUserDbModel.active()} = TRUE
              AND t.${AuthTokenDbModel.lastUsedAt()} > CURRENT_TIMESTAMP - make_interval(secs => :ttlSeconds)
            """.trimIndent()
        )
            .bind("tokenHash", tokenHash)
            .bind("ttlSeconds", idleTtl.toSeconds().toDouble())
            .map(UserMapper())
            .findOne()
            .orElse(null)

    override fun touch(tokenHash: String) {
        handle.createUpdate(
            """
            UPDATE ${AuthTokenDbModel.table()}
            SET ${AuthTokenDbModel.lastUsedAt()} = CURRENT_TIMESTAMP
            WHERE ${AuthTokenDbModel.tokenValidationInfo()} = :tokenHash
            """.trimIndent()
        )
            .bind("tokenHash", tokenHash)
            .execute()
    }

    override fun delete(tokenHash: String) {
        handle.createUpdate(
            """
            DELETE FROM ${AuthTokenDbModel.table()}
            WHERE ${AuthTokenDbModel.tokenValidationInfo()} = :tokenHash
            """.trimIndent()
        )
            .bind("tokenHash", tokenHash)
            .execute()
    }

    override fun deleteOldestBeyond(userId: Int, keep: Int) {
        handle.createUpdate(
            """
            DELETE FROM ${AuthTokenDbModel.table()}
            WHERE ${AuthTokenDbModel.tokenValidationInfo()} IN (
                SELECT ${AuthTokenDbModel.tokenValidationInfo()}
                FROM ${AuthTokenDbModel.table()}
                WHERE ${AuthTokenDbModel.userId()} = :userId
                ORDER BY ${AuthTokenDbModel.lastUsedAt()} DESC
                OFFSET :keep
            )
            """.trimIndent()
        )
            .bind("userId", userId)
            .bind("keep", keep)
            .execute()
    }
}
