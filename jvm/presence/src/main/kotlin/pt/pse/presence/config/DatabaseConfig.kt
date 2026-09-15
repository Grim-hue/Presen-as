package pt.pse.presence.config

import org.jdbi.v3.core.Jdbi
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import pt.pse.presence.repository.jdbi.configureForPresence
import javax.sql.DataSource

@Configuration
class DatabaseConfig {

    /**
     * Built on the Spring-managed [DataSource], so JDBI draws from the same pooled
     * connections Spring Boot configured from `spring.datasource.*` rather than
     * opening a second pool of its own.
     */
    @Bean
    fun jdbi(dataSource: DataSource): Jdbi = Jdbi.create(dataSource).configureForPresence()
}
