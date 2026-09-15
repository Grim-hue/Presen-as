package pt.pse.presence.domain.objects

/** A user as the rest of the application sees them. Carries no secret. */
data class User(
    val id: Int,
    val forename: String,
    val surname: String,
    val email: String,
    val username: String,
    val isAdmin: Boolean,
    /**
     * When their picture last changed, or null when they have none.
     *
     * The instant rather than the image: it is what tells a caller whether to ask for
     * one at all, and it goes in the address they ask at, so replacing a picture
     * changes the address and the old one stops being served from the cache.
     */
    val avatarVersion: Long? = null
) {
    val displayName: String get() = "$forename $surname"
}

/** A picture, on its way in or out. The bytes travel no further than they must. */
data class UserAvatar(val contentType: String, val bytes: ByteArray) {
    /**
     * Data classes compare arrays by identity, which would make two reads of the same
     * picture unequal. Written out so equality means the same picture.
     */
    override fun equals(other: Any?): Boolean =
        this === other ||
            (other is UserAvatar && contentType == other.contentType && bytes.contentEquals(other.bytes))

    override fun hashCode(): Int = 31 * contentType.hashCode() + bytes.contentHashCode()
}

/**
 * A user together with their stored password hash.
 *
 * Deliberately a separate type from [User] rather than a nullable field on it: the
 * hash can only travel where the type says so, and no response mapper can reach it
 * by accident.
 */
data class UserWithSecret(val user: User, val passwordHash: String?)

/** The authenticated caller, injected into any controller method that declares it. */
data class AuthenticatedUser(val user: User, val token: String)

/** What an [pt.pse.presence.infrastructure.security.AuthProvider] is asked to verify. */
data class Credentials(
    val username: String,
    val password: String,
    /** Null when the user has no local password. External providers ignore this. */
    val storedHash: String?
)
