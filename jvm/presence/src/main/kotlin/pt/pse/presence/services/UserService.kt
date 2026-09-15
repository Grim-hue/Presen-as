package pt.pse.presence.services

import org.springframework.stereotype.Service
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.domain.objects.User
import pt.pse.presence.domain.objects.UserAvatar
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.UserError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.guarded
import pt.pse.presence.utils.loggerFor
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.success
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO

@Service
class UserService(private val transactionManager: TransactionManager) {

    private val log = loggerFor<UserService>()

    /**
     * Everyone who can be scheduled or be absent, regardless of which commitments
     * they are on. Absences belong to a person rather than to a schedule, so the
     * views about people need the whole list and not one team's roster.
     *
     * Not restricted to administrators: this is the same set of names already visible
     * in every plan and roster, and the calendar cannot be drawn without it.
     */
    fun list(): Either<UserError, List<User>> = guarded(log, "UserService.list", UserError.DatabaseError) {
        transactionManager.run { ctx -> success(ctx.appUserRepository.findAllActive()) }
    }

    /**
     * Somebody's name, address and whether they administer the application.
     *
     * The first write in this service that is not a picture. Administrators only: a
     * name and an email are how everybody else identifies a person in a plan, and the
     * admin flag is the permission everything on this page is checked against. The
     * username and the password are not here and should not be — they belong to
     * whatever authenticates, which is a local hash today and Active Directory later.
     */
    fun update(
        caller: AuthenticatedUser,
        userId: Int,
        forename: String,
        surname: String,
        email: String,
        isAdmin: Boolean
    ): Either<UserError, User> = guarded(log, "UserService.update", UserError.DatabaseError) {
        if (!caller.user.isAdmin) return@guarded failure(UserError.NotAdmin)
        val first = forename.trim()
        val last = surname.trim()
        val address = email.trim()
        if (first.isEmpty() || last.isEmpty() || address.isEmpty()) {
            return@guarded failure(UserError.EmptyField)
        }
        // The screen that would put it back is the one this closes.
        if (caller.user.id == userId && !isAdmin) return@guarded failure(UserError.CannotDemoteSelf)

        transactionManager.run { ctx ->
            ctx.appUserRepository.findById(userId) ?: return@run failure(UserError.NotFound)

            val holder = ctx.appUserRepository.findByEmail(address)
            if (holder != null && holder.id != userId) return@run failure(UserError.EmailTaken)

            if (!ctx.appUserRepository.update(userId, first, last, address, isAdmin)) {
                return@run failure(UserError.DatabaseError)
            }
            ctx.appUserRepository.findById(userId)
                ?.let { success(it) }
                ?: failure(UserError.DatabaseError)
        }
    }

    /**
     * Somebody's picture, for the route that serves it.
     *
     * Not restricted: a picture is shown beside its owner's name on every screen that
     * already lists them, so guarding the bytes while the name is public would protect
     * nothing.
     */
    fun avatar(userId: Int): Either<UserError, UserAvatar> =
        guarded(log, "UserService.avatar", UserError.DatabaseError) {
            transactionManager.run { ctx ->
                val avatar = ctx.appUserRepository.findAvatar(userId)
                if (avatar == null) failure(UserError.NoAvatar) else success(avatar)
            }
        }

    /**
     * Sets or replaces somebody's picture.
     *
     * The type is read from the bytes rather than trusted from the request: a
     * multipart part carries whatever content type its sender chose, and this one ends
     * up in a Content-Type header the browser acts on. The first bytes of a file do
     * not lie about what it is.
     */
    fun setAvatar(
        caller: AuthenticatedUser,
        userId: Int,
        declaredType: String?,
        bytes: ByteArray
    ): Either<UserError, Long> = guarded(log, "UserService.setAvatar", UserError.DatabaseError) {
        transactionManager.run { ctx ->
            when {
                !caller.user.isAdmin && caller.user.id != userId -> failure(UserError.NotAllowed)
                ctx.appUserRepository.findById(userId) == null -> failure(UserError.NotFound)
                bytes.size > MAX_AVATAR_BYTES -> failure(UserError.ImageTooLarge)
                else -> {
                    val type = sniff(bytes) ?: return@run failure(UserError.UnsupportedImage)
                    if (declaredType != null && declaredType != type) {
                        log.warn("Avatar for {} declared {} but is {}", userId, declaredType, type)
                    }
                    val thumbnail = shrink(bytes) ?: return@run failure(UserError.UnsupportedImage)
                    success(ctx.appUserRepository.saveAvatar(userId, thumbnail))
                }
            }
        }
    }

    fun removeAvatar(caller: AuthenticatedUser, userId: Int): Either<UserError, Boolean> =
        guarded(log, "UserService.removeAvatar", UserError.DatabaseError) {
            transactionManager.run { ctx ->
                if (!caller.user.isAdmin && caller.user.id != userId) failure(UserError.NotAllowed)
                else success(ctx.appUserRepository.deleteAvatar(userId))
            }
        }

    private companion object {
        /**
         * Two megabytes, on the way in. Not what gets stored — [shrink] takes care of
         * that — but what stops an enormous file being decoded at all.
         */
        const val MAX_AVATAR_BYTES = 2 * 1024 * 1024

        /**
         * The longest side a stored picture may have.
         *
         * Four times the largest mark this interface draws, which is the twenty four
         * pixel one in the sidebar, so it is still sharp on a screen at twice the
         * density and no sharper than that. It matters because of where these are
         * drawn: the dashboard puts a mark beside every assigned person on every day
         * of a month, which is hundreds of them on one screen, and each one used to
         * be the whole file somebody uploaded. A photograph off a phone is several
         * megabytes; this is a few kilobytes.
         */
        const val MAX_AVATAR_EDGE = 128

        /**
         * The same picture, no larger than [MAX_AVATAR_EDGE] on its longest side, as
         * PNG. Null when the bytes will not decode.
         *
         * Always re-encoded, even when the picture is already small: it costs little,
         * and it means one format comes out of here regardless of what went in, so
         * the type stored is a fact rather than a claim. Aspect ratio is kept — the
         * interface crops to a square with `object-cover`, and cropping here would
         * decide for every size at once which half of somebody's face to keep.
         */
        fun shrink(bytes: ByteArray): UserAvatar? {
            val source = runCatching { ImageIO.read(ByteArrayInputStream(bytes)) }.getOrNull() ?: return null
            val scale = minOf(
                1.0,
                MAX_AVATAR_EDGE.toDouble() / maxOf(source.width, source.height).toDouble()
            )
            val width = maxOf(1, Math.round(source.width * scale).toInt())
            val height = maxOf(1, Math.round(source.height * scale).toInt())

            // TYPE_INT_RGB, not ARGB: the mark is drawn on the member's own colour, so
            // a transparent PNG would show that colour through the face rather than
            // behind it. Anything transparent lands on white instead.
            val target = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB)
            target.createGraphics().run {
                setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC)
                setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
                color = java.awt.Color.WHITE
                fillRect(0, 0, width, height)
                drawImage(source, 0, 0, width, height, null)
                dispose()
            }

            val out = ByteArrayOutputStream()
            if (!ImageIO.write(target, "png", out)) return null
            return UserAvatar("image/png", out.toByteArray())
        }

        /**
         * What the bytes actually are, by their magic number, or null for anything
         * this application will not serve.
         */
        fun sniff(b: ByteArray): String? = when {
            b.size < 12 -> null
            b[0] == 0x89.toByte() && b[1] == 'P'.code.toByte() &&
                b[2] == 'N'.code.toByte() && b[3] == 'G'.code.toByte() -> "image/png"
            b[0] == 0xFF.toByte() && b[1] == 0xD8.toByte() -> "image/jpeg"
            b[0] == 'R'.code.toByte() && b[1] == 'I'.code.toByte() &&
                b[2] == 'F'.code.toByte() && b[3] == 'F'.code.toByte() &&
                b[8] == 'W'.code.toByte() && b[9] == 'E'.code.toByte() &&
                b[10] == 'B'.code.toByte() && b[11] == 'P'.code.toByte() -> "image/webp"
            else -> null
        }
    }
}
