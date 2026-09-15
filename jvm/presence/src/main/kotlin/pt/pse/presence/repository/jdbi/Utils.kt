package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Jdbi
import org.jdbi.v3.core.kotlin.KotlinPlugin
import org.jdbi.v3.postgres.PostgresPlugin

/**
 * Installs the plugins every query depends on, in one place.
 *
 * KotlinPlugin maps rows onto data classes by constructor parameter name.
 * PostgresPlugin teaches JDBI the java.time types, so a DATE column round-trips as a
 * LocalDate instead of going through java.sql.Date and picking up a timezone on the
 * way. That matters here: a vacation day is a date, not an instant.
 */
fun Jdbi.configureForPresence(): Jdbi = this
    .installPlugin(KotlinPlugin())
    .installPlugin(PostgresPlugin())
