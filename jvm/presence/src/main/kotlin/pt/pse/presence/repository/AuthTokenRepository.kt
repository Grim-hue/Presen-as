package pt.pse.presence.repository

import pt.pse.presence.domain.objects.User
import java.time.Duration

interface AuthTokenRepository {

    fun insert(tokenHash: String, userId: Int)

    /** Returns the user only when the token exists, is inside [idleTtl], and is active. */
    fun findUserByTokenHash(tokenHash: String, idleTtl: Duration): User?

    fun touch(tokenHash: String)

    fun delete(tokenHash: String)

    /** Drops a user's oldest sessions, keeping the [keep] most recently used. */
    fun deleteOldestBeyond(userId: Int, keep: Int)
}
