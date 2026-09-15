package pt.pse.presence.http.pipeline

import org.springframework.core.MethodParameter
import org.springframework.stereotype.Component
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.context.request.RequestAttributes
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer
import pt.pse.presence.domain.objects.AuthenticatedUser

/**
 * Hands the controller the caller the interceptor already resolved.
 *
 * Never reached unless [AuthenticationInterceptor] let the request through, so the
 * attribute is always present here.
 */
@Component
class AuthenticatedUserArgumentResolver : HandlerMethodArgumentResolver {

    override fun supportsParameter(parameter: MethodParameter): Boolean =
        parameter.parameterType == AuthenticatedUser::class.java

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?
    ): Any = webRequest.getAttribute(
        AuthenticationInterceptor.AUTHENTICATED_USER,
        RequestAttributes.SCOPE_REQUEST
    ) ?: throw IllegalStateException(
        "AuthenticatedUser missing on an authenticated request. The interceptor is not registered."
    )
}
