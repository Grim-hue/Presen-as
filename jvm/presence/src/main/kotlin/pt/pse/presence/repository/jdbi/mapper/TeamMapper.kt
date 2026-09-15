package pt.pse.presence.repository.jdbi.mapper

import org.jdbi.v3.core.mapper.RowMapper
import org.jdbi.v3.core.statement.StatementContext
import pt.pse.presence.domain.objects.Holiday
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.repository.jdbi.model.HolidayDbModel
import pt.pse.presence.repository.jdbi.model.TeamDbModel
import pt.pse.presence.repository.jdbi.model.TeamMemberDbModel
import java.sql.ResultSet
import java.time.DayOfWeek

class TeamMapper : RowMapper<Team> {
    override fun map(rs: ResultSet, ctx: StatementContext): Team = Team(
        id = rs.getInt(TeamDbModel.id()),
        name = rs.getString(TeamDbModel.name()),
        onSiteWeekday = DayOfWeek.of(rs.getInt(TeamDbModel.onSiteWeekday())),
        requiredOnSite = rs.getInt(TeamDbModel.requiredOnSite()),
        fairnessSince = rs.getObject(TeamDbModel.fairnessSince(), java.time.LocalDate::class.java),
        emailSubject = rs.getString(TeamDbModel.emailSubject()),
        emailIntro = rs.getString(TeamDbModel.emailIntro()),
        active = rs.getBoolean(TeamDbModel.active())
    )
}

class TeamMemberMapper : RowMapper<TeamMember> {
    private val userMapper = UserMapper()

    override fun map(rs: ResultSet, ctx: StatementContext): TeamMember = TeamMember(
        user = userMapper.map(rs, ctx),
        joinedAt = rs.getObject(TeamMemberDbModel.joinedAt(), java.time.LocalDate::class.java),
        leftAt = rs.getObject(TeamMemberDbModel.leftAt(), java.time.LocalDate::class.java)
    )
}

class HolidayMapper : RowMapper<Holiday> {
    override fun map(rs: ResultSet, ctx: StatementContext): Holiday = Holiday(
        id = rs.getInt(HolidayDbModel.id()),
        date = rs.getObject(HolidayDbModel.date(), java.time.LocalDate::class.java),
        name = rs.getString(HolidayDbModel.name()),
        national = rs.getBoolean(HolidayDbModel.national())
    )
}
