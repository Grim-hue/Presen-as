package pt.pse.presence.repository

/**
 * Runs a block inside a database transaction.
 *
 * This is the only transaction mechanism in the application. There is no
 * `@Transactional` anywhere, so the boundary is always visible in the code that
 * needs it rather than inferred from an annotation on a proxy.
 */
interface TransactionManager {

    fun <R> run(block: (Transaction) -> R): R
}
