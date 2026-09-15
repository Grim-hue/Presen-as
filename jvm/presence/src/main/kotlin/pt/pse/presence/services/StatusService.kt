package pt.pse.presence.services

import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.info.BuildProperties
import org.springframework.stereotype.Service
import pt.pse.presence.repository.TransactionManager
import pt.pse.presence.services.error.StatusError
import pt.pse.presence.utils.Either
import pt.pse.presence.utils.failure
import pt.pse.presence.utils.success

data class AppStatus(val version: String, val databaseReachable: Boolean)

@Service
class StatusService(
    private val transactionManager: TransactionManager,
    // Read from META-INF/build-info.properties, produced by springBoot { buildInfo() }.
    // A properties placeholder would not do: Gradle, unlike Maven, does not expand
    // @version@ in application.properties, so the API would report the literal token.
    // ObjectProvider because the file is absent when classes are run without the
    // Gradle build having produced it.
    private val buildProperties: ObjectProvider<BuildProperties>
) {

    /**
     * Proves the API can actually reach the database, rather than only that the
     * process is alive. A container that boots but cannot query is the failure worth
     * catching here.
     */
    fun check(): Either<StatusError, AppStatus> =
        try {
            transactionManager.run { ctx ->
                ctx.ping()
                success(AppStatus(version(), databaseReachable = true))
            }
        } catch (e: Exception) {
            failure(StatusError.DatabaseUnreachable)
        }

    private fun version(): String = buildProperties.getIfAvailable()?.version ?: "unknown"
}
