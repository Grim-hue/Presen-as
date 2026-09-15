package pt.pse.presence.http.models.team

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import pt.pse.presence.domain.objects.Team
import pt.pse.presence.domain.objects.TeamMember
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.models.auth.UserOutputModel
import java.time.LocalDate

data class UpdateTeamRuleInputModel(
    /** Absent leaves the name alone, which is what every caller before it did. */
    @field:Size(max = 64, message = "no máximo 64 caracteres")
    val name: String? = null,

    @field:Min(1, message = "entre 1 e 7")
    @field:Max(7, message = "entre 1 e 7")
    val onSiteWeekday: Int,

    @field:Min(1, message = "pelo menos 1")
    @field:Max(50, message = "no máximo 50")
    val requiredOnSite: Int,

    val fairnessSince: LocalDate
)

/** The wording every message for this team starts from, saved from the email page. */
data class UpdateTeamEmailInputModel(
    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 300, message = "no máximo 300 caracteres")
    val emailSubject: String,

    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 2000, message = "no máximo 2000 caracteres")
    val emailIntro: String
)

data class CreateTeamInputModel(
    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 64, message = "no máximo 64 caracteres")
    val name: String,

    @field:Min(1, message = "entre 1 e 7")
    @field:Max(7, message = "entre 1 e 7")
    val onSiteWeekday: Int,

    @field:Min(1, message = "pelo menos 1")
    @field:Max(50, message = "no máximo 50")
    val requiredOnSite: Int,

    val fairnessSince: LocalDate,

    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 160, message = "no máximo 160 caracteres")
    val emailSubject: String,

    @field:NotBlank(message = "obrigatório")
    @field:Size(max = 512, message = "no máximo 512 caracteres")
    val emailIntro: String
)

data class AddMemberInputModel(val userId: Int, val joinedAt: LocalDate)

/** A correction to when a membership started. A return is [AddMemberInputModel]. */
data class UpdateMembershipInputModel(val joinedAt: LocalDate)

data class TeamOutputModel(
    val id: Int,
    val name: String,
    val onSiteWeekday: Int,
    val requiredOnSite: Int,
    val fairnessSince: LocalDate,
    val emailSubject: String,
    val emailIntro: String,
    val active: Boolean
)

data class TeamMemberOutputModel(
    val user: UserOutputModel,
    val joinedAt: LocalDate,
    val leftAt: LocalDate?
)

object TeamOutputMapper {
    fun toDto(team: Team) = TeamOutputModel(
        id = team.id,
        name = team.name,
        // Sent as the ISO integer, which is what the database holds and what
        // JavaScript can compare without parsing a locale-dependent name.
        onSiteWeekday = team.onSiteWeekday.value,
        requiredOnSite = team.requiredOnSite,
        fairnessSince = team.fairnessSince,
        emailSubject = team.emailSubject,
        emailIntro = team.emailIntro,
        active = team.active
    )

    fun toDto(member: TeamMember) = TeamMemberOutputModel(
        user = UserOutputMapper.toDto(member.user),
        joinedAt = member.joinedAt,
        leftAt = member.leftAt
    )
}
