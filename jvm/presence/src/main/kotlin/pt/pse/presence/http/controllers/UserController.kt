package pt.pse.presence.http.controllers

import jakarta.validation.Valid
import org.springframework.http.CacheControl
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.concurrent.TimeUnit
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.auth.UpdateUserInputModel
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.services.UserService
import pt.pse.presence.utils.Either

@RestController
@RequestMapping("/api/v1/users")
class UserController(private val userService: UserService) {

    @GetMapping
    fun list(caller: AuthenticatedUser): ResponseEntity<*> =
        when (val result = userService.list()) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponseBuilder.ofList(result.value.map(UserOutputMapper::toDto)))

            is Either.Failure -> ResponseEntity.status(result.value.status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(result.value.problem)
        }

    @PatchMapping("/{userId}")
    fun update(
        caller: AuthenticatedUser,
        @PathVariable userId: Int,
        @Valid @RequestBody body: UpdateUserInputModel
    ): ResponseEntity<*> =
        when (val result = userService.update(
            caller, userId, body.forename, body.surname, body.email, body.isAdmin
        )) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponseBuilder.of(UserOutputMapper.toDto(result.value)))

            is Either.Failure -> ResponseEntity.status(result.value.status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(result.value.problem)
        }

    /**
     * The picture itself, as an image rather than as an envelope.
     *
     * The only route in the application that answers with something other than the
     * ApiResponse envelope, because the thing on the other end is an `<img>` and not a
     * reader of JSON. A failure still answers as ProblemDetails does everywhere else.
     *
     * Cached hard and immutably: the address carries the instant the picture last
     * changed, so a replaced one is a different address and this one can never go
     * stale.
     */
    @GetMapping("/{userId}/avatar")
    fun avatar(caller: AuthenticatedUser, @PathVariable userId: Int): ResponseEntity<*> =
        when (val result = userService.avatar(userId)) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.value.contentType))
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePrivate().immutable())
                .body(result.value.bytes)

            is Either.Failure -> ResponseEntity.status(result.value.status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(result.value.problem)
        }

    @PostMapping("/{userId}/avatar")
    fun setAvatar(
        caller: AuthenticatedUser,
        @PathVariable userId: Int,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<*> =
        respond(userService.setAvatar(caller, userId, file.contentType, file.bytes)) { version ->
            ApiResponseBuilder.of(mapOf("avatarVersion" to version))
        }

    @DeleteMapping("/{userId}/avatar")
    fun removeAvatar(caller: AuthenticatedUser, @PathVariable userId: Int): ResponseEntity<*> =
        respond(userService.removeAvatar(caller, userId)) { removed ->
            ApiResponseBuilder.of(mapOf("removed" to removed))
        }

    private inline fun <T> respond(
        result: Either<pt.pse.presence.services.error.UserError, T>,
        body: (T) -> Any
    ): ResponseEntity<*> = when (result) {
        is Either.Success -> ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body(body(result.value))

        is Either.Failure -> ResponseEntity.status(result.value.status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .body(result.value.problem)
    }
}
