package pt.pse.presence.config

import org.springframework.context.annotation.Configuration
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import pt.pse.presence.http.pipeline.AuthenticatedUserArgumentResolver
import pt.pse.presence.http.pipeline.AuthenticationInterceptor

@Configuration
class PipelineConfigurer(
    private val authenticationInterceptor: AuthenticationInterceptor,
    private val authenticatedUserArgumentResolver: AuthenticatedUserArgumentResolver
) : WebMvcConfigurer {

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(authenticationInterceptor)
    }

    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers.add(authenticatedUserArgumentResolver)
    }
}
