package pt.pse.presence.repository.jdbi.mapper

import org.jdbi.v3.core.mapper.RowMapper
import org.jdbi.v3.core.statement.StatementContext
import pt.pse.presence.domain.objects.Absence
import pt.pse.presence.domain.objects.AbsenceKind
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.repository.jdbi.model.AbsenceDbModel
import java.sql.ResultSet
import java.time.LocalDate

class AbsenceMapper : RowMapper<Absence> {
    private val userMapper = UserMapper()

    override fun map(rs: ResultSet, ctx: StatementContext): Absence = Absence(
        id = rs.getInt(AbsenceDbModel.id()),
        user = userMapper.map(rs, ctx),
        startDate = rs.getObject(AbsenceDbModel.startDate(), LocalDate::class.java),
        endDate = rs.getObject(AbsenceDbModel.endDate(), LocalDate::class.java),
        kind = AbsenceKind.valueOf(rs.getString(AbsenceDbModel.kind())),
        source = AbsenceSource.valueOf(rs.getString(AbsenceDbModel.source())),
        importId = rs.getObject(AbsenceDbModel.importId()) as? Int,
        note = rs.getString(AbsenceDbModel.note()),
        manuallyEdited = rs.getBoolean(AbsenceDbModel.manuallyEdited())
    )
}
