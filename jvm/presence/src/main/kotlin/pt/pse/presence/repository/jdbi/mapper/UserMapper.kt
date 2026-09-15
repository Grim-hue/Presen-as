package pt.pse.presence.repository.jdbi.mapper

import org.jdbi.v3.core.mapper.RowMapper
import org.jdbi.v3.core.statement.StatementContext
import pt.pse.presence.domain.objects.User
import pt.pse.presence.domain.objects.UserWithSecret
import pt.pse.presence.repository.jdbi.model.AppUserDbModel
import java.sql.ResultSet

/**
 * The alias a user query gives the picture's timestamp when it asks for one.
 *
 * Optional on purpose. Seven queries build a [User] — logging in, checking a session
 * on every request, listing a roster, reading an absence, reading an import — and
 * only some of them have any use for a picture. Requiring the column made the mapper
 * refuse every row that came from the other queries, which took the whole application
 * down and not just the avatars: a session cannot be checked, so nothing can be
 * fetched at all.
 *
 * So the mapper reads it where a query supplies it and treats it as absent otherwise,
 * which is the same answer as having no picture.
 */
const val AVATAR_VERSION = "avatar_version"

/**
 * Whether this row carries [label] at all, as opposed to carrying it null.
 *
 * Asked of the metadata rather than discovered by catching the exception that reading
 * a missing column throws: an absent column is an ordinary shape for a row here, not a
 * failure, and control flow through exceptions would hide the real ones.
 */
private fun ResultSet.hasColumn(label: String): Boolean {
    val meta = metaData
    for (i in 1..meta.columnCount) {
        if (meta.getColumnLabel(i).equals(label, ignoreCase = true)) return true
    }
    return false
}

/** Hand-written, reading by column name. No reflection, no bean mapping. */
class UserMapper : RowMapper<User> {
    override fun map(rs: ResultSet, ctx: StatementContext): User = User(
        id = rs.getInt(AppUserDbModel.id()),
        forename = rs.getString(AppUserDbModel.forename()),
        surname = rs.getString(AppUserDbModel.surname()),
        email = rs.getString(AppUserDbModel.email()),
        username = rs.getString(AppUserDbModel.username()) ?: "",
        isAdmin = rs.getBoolean(AppUserDbModel.isAdmin()),
        avatarVersion = if (rs.hasColumn(AVATAR_VERSION)) rs.getTimestamp(AVATAR_VERSION)?.time else null
    )
}

class UserWithSecretMapper : RowMapper<UserWithSecret> {
    private val userMapper = UserMapper()

    override fun map(rs: ResultSet, ctx: StatementContext): UserWithSecret = UserWithSecret(
        user = userMapper.map(rs, ctx),
        passwordHash = rs.getString(AppUserDbModel.passwordHash())
    )
}
