package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Jdbi
import org.springframework.stereotype.Component
import pt.pse.presence.repository.Transaction
import pt.pse.presence.repository.TransactionManager

@Component
class JdbiTransactionManager(private val jdbi: Jdbi) : TransactionManager {

    override fun <R> run(block: (Transaction) -> R): R =
        jdbi.inTransaction<R, Exception> { handle -> block(JdbiTransaction(handle)) }
}
