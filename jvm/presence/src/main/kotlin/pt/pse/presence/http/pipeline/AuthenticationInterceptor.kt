package pt.pse.presence.http.pipeline

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.method.HandlerMethod
import org.springframework.web.servlet.HandlerInterceptor
import pt.pse.presence.config.AuthProperties
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.services.AuthService
import pt.pse.presence.services.error.AuthError
import pt.pse.presence.utils.Either
import tools.jackson.databind.ObjectMapper

/**
 * Authenticates a request, but only when the handler actually asks for a caller by
 * declaring an [AuthenticatedUser] parameter.
 *
 * Making the parameter the trigger means a route can never be left unprotected by
 * forgetting to add it to a path list: if the handler wants to know who is calling,
 * it is authenticated, and if it does not, there is nothing to protect.
 */
@Component
class AuthenticationInterceptor(
    private val authService: AuthService,
    private val authProperties: AuthProperties,
    private val sessionCookie: SessionCookie,
    private val objectMapper: ObjectMapper
) : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        if (handler !is HandlerMethod) return true
        if (handler.methodParameters.none { it.parameterType == AuthenticatedUser::class.java }) return true

        val token = request.cookies
            ?.firstOrNull { it.name == authProperties.cookie.name }
            ?.value

        if (token.isNullOrBlank()) return reject(response)

        return when (val result = authService.authenticate(token)) {
            is Either.Success -> {
                request.setAttribute(AUTHENTICATED_USER, result.value)
                // The database token was just touched, so its idle window restarted.
                // The cookie is given the same window here, or the browser would drop
                // it at a fixed time after login and end a session the API still
                // considers live. Written before the handler runs, because a REST
                // handler has already committed the response by the time postHandle
                // is reached and headers can no longer be added.
                //
                // Logout writes its own deletion afterwards. Two Set-Cookie headers of
                // the same name arrive in order and the later one is the one the
                // browser keeps, so the deletion still wins.
                response.addHeader(
                    HttpHeaders.SET_COOKIE,
                    sessionCookie.issue(result.value.token).toString()
                )
                true
            }
            is Either.Failure -> reject(response, result.value)
        }
    }

    private fun reject(response: HttpServletResponse, error: AuthError = AuthError.NotAuthenticated): Boolean {
        response.status = error.status.value()
        response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        response.writer.write(objectMapper.writeValueAsString(error.problem))
        return false
    }

    companion object {
        const val AUTHENTICATED_USER = "authenticatedUser"
    }
}
