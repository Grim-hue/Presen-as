package pt.pse.presence.http.controllers

import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.auth.LoginInputModel
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.pipeline.SessionCookie
import pt.pse.presence.services.AuthService
import pt.pse.presence.utils.Either

@RestController
@RequestMapping("/api/v1/auth")
@Validated
class AuthController(
    private val authService: AuthService,
    private val sessionCookie: SessionCookie
) {

    @PostMapping("/login")
    fun login(@Valid @RequestBody body: LoginInputModel): ResponseEntity<*> =
        when (val result = authService.login(body.username, body.password)) {
            is Either.Success -> ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie.issue(result.value.token).toString())
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponseBuilder.of(UserOutputMapper.toDto(result.value.user)))

            is Either.Failure -> ResponseEntity.status(result.value.status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(result.value.problem)
        }

    @PostMapping("/logout")
    fun logout(caller: AuthenticatedUser): ResponseEntity<*> =
        when (val result = authService.logout(caller.token)) {
            is Either.Success -> ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookie.expire().toString())
                .build<Unit>()

            is Either.Failure -> ResponseEntity.status(result.value.status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(result.value.problem)
        }

    @GetMapping("/me")
    fun me(caller: AuthenticatedUser): ResponseEntity<*> = ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_JSON)
        .body(ApiResponseBuilder.of(UserOutputMapper.toDto(caller.user)))
}
