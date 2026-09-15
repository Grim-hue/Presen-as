package pt.pse.presence.repository

import pt.pse.presence.domain.objects.User
import pt.pse.presence.domain.objects.UserAvatar
import pt.pse.presence.domain.objects.UserWithSecret

interface AppUserRepository {

    /** Only active users. An inactive user must not be able to authenticate. */
    fun findByUsernameWithSecret(username: String): UserWithSecret?

    fun findById(userId: Int): User?

    fun findAllActive(): List<User>

    /** For the one field that has to be unique across everybody. */
    fun findByEmail(email: String): User?

    /**
     * Name, email and whether they administer the application. Not the username or the
     * password: those belong to whatever authenticates, which is a local hash today
     * and Active Directory later.
     */
    fun update(userId: Int, forename: String, surname: String, email: String, isAdmin: Boolean): Boolean

    /** The picture itself, which only the route that serves it ever asks for. */
    fun findAvatar(userId: Int): UserAvatar?

    /** Writes the picture, replacing whatever was there. Returns when it changed. */
    fun saveAvatar(userId: Int, avatar: UserAvatar): Long

    /** Removes it. False when there was none to remove. */
    fun deleteAvatar(userId: Int): Boolean
}
