package pt.pse.presence.http.controllers

import jakarta.validation.Valid
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.models.team.TeamOutputMapper
import pt.pse.presence.http.models.team.AddMemberInputModel
import pt.pse.presence.http.models.team.CreateTeamInputModel
import pt.pse.presence.http.models.team.UpdateMembershipInputModel
import pt.pse.presence.http.models.team.UpdateTeamEmailInputModel
import pt.pse.presence.http.models.team.UpdateTeamRuleInputModel
import pt.pse.presence.http.models.plan.PlanOutputMapper
import pt.pse.presence.services.PlanService
import pt.pse.presence.services.TeamService
import pt.pse.presence.utils.Either

@RestController
@RequestMapping("/api/v1/teams")
@Validated
class TeamController(
    private val teamService: TeamService,
    private val planService: PlanService
) {

    @GetMapping
    fun list(caller: AuthenticatedUser): ResponseEntity<*> =
        respond(teamService.list()) { teams -> ApiResponseBuilder.ofList(teams.map(TeamOutputMapper::toDto)) }

    @GetMapping("/{teamId}")
    fun get(caller: AuthenticatedUser, @PathVariable teamId: Int): ResponseEntity<*> =
        respond(teamService.get(teamId)) { ApiResponseBuilder.of(TeamOutputMapper.toDto(it)) }

    @GetMapping("/{teamId}/members")
    fun members(caller: AuthenticatedUser, @PathVariable teamId: Int): ResponseEntity<*> =
        respond(teamService.members(teamId)) { members ->
            ApiResponseBuilder.ofList(members.map(TeamOutputMapper::toDto))
        }

    @GetMapping("/{teamId}/candidates")
    fun candidates(caller: AuthenticatedUser, @PathVariable teamId: Int): ResponseEntity<*> =
        respond(teamService.candidates(teamId)) { users ->
            ApiResponseBuilder.ofList(users.map(UserOutputMapper::toDto))
        }

    @PostMapping
    fun create(caller: AuthenticatedUser, @Valid @RequestBody body: CreateTeamInputModel): ResponseEntity<*> =
        respond(
            teamService.create(
                caller, body.name, body.onSiteWeekday, body.requiredOnSite,
                body.fairnessSince, body.emailSubject, body.emailIntro
            )
        ) { ApiResponseBuilder.of(TeamOutputMapper.toDto(it)) }

    @PostMapping("/{teamId}/members")
    fun addMember(
        caller: AuthenticatedUser,
        @PathVariable teamId: Int,
        @Valid @RequestBody body: AddMemberInputModel
    ): ResponseEntity<*> = respond(teamService.addMember(caller, teamId, body.userId, body.joinedAt)) { members ->
        ApiResponseBuilder.ofList(members.map(TeamOutputMapper::toDto))
    }

    @DeleteMapping("/{teamId}/members/{userId}")
    fun removeMember(
        caller: AuthenticatedUser,
        @PathVariable teamId: Int,
        @PathVariable userId: Int,
        @RequestParam(required = false)
        @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
        leftAt: java.time.LocalDate?
    ): ResponseEntity<*> =
        respond(teamService.removeMember(caller, teamId, userId, leftAt ?: java.time.LocalDate.now())) { members ->
            ApiResponseBuilder.ofList(members.map(TeamOutputMapper::toDto))
        }

    @GetMapping("/{teamId}/balance")
    fun balance(
        caller: AuthenticatedUser,
        @PathVariable teamId: Int,
        @RequestParam(required = false)
        @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
        upTo: java.time.LocalDate?
    ): ResponseEntity<*> = respond(planService.balance(teamId, upTo)) { entries ->
        ApiResponseBuilder.ofList(entries.map(PlanOutputMapper::toDto))
    }

    @PatchMapping("/{teamId}")
    fun updateRule(
        caller: AuthenticatedUser,
        @PathVariable teamId: Int,
        @Valid @RequestBody body: UpdateTeamRuleInputModel
    ): ResponseEntity<*> = respond(
        teamService.updateRule(
            caller, teamId, body.onSiteWeekday, body.requiredOnSite, body.fairnessSince, body.name
        )
    ) { ApiResponseBuilder.of(TeamOutputMapper.toDto(it)) }

    @PatchMapping("/{teamId}/members/{userId}")
    fun updateMembership(
        caller: AuthenticatedUser,
        @PathVariable teamId: Int,
        @PathVariable userId: Int,
        @Valid @RequestBody body: UpdateMembershipInputModel
    ): ResponseEntity<*> = respond(
        teamService.updateMembership(caller, teamId, userId, body.joinedAt)
    ) { members -> ApiResponseBuilder.ofList(members.map(TeamOutputMapper::toDto)) }

    @PatchMapping("/{teamId}/email")
    fun updateEmail(
        caller: AuthenticatedUser,
        @PathVariable teamId: Int,
        @Valid @RequestBody body: UpdateTeamEmailInputModel
    ): ResponseEntity<*> = respond(
        teamService.updateEmail(caller, teamId, body.emailSubject, body.emailIntro)
    ) { ApiResponseBuilder.of(TeamOutputMapper.toDto(it)) }

    private inline fun <E : pt.pse.presence.utils.BaseError, T> respond(
        result: Either<E, T>,
        body: (T) -> Any
    ): ResponseEntity<*> = when (result) {
        is Either.Success -> ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body(body(result.value))

        is Either.Failure -> ResponseEntity.status(result.value.status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .body(result.value.problem)
    }
}
