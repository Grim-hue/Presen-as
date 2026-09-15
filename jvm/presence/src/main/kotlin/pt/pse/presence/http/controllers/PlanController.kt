package pt.pse.presence.http.controllers

import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.auth.UserOutputMapper
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.plan.GeneratePlanInputModel
import pt.pse.presence.http.models.plan.PlanOutputMapper
import pt.pse.presence.http.models.plan.PlanPreviewOutputModel
import pt.pse.presence.http.models.plan.PreviewBalanceOutputModel
import pt.pse.presence.http.models.plan.PreviewDayOutputModel
import pt.pse.presence.http.models.plan.RenderEmailInputModel
import pt.pse.presence.http.models.plan.SetDayAssignmentsInputModel
import pt.pse.presence.http.models.plan.UpdatePlanNotesInputModel
import pt.pse.presence.services.PlanService
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.Either
import java.time.LocalDate

@RestController
@RequestMapping("/api/v1/plans")
@Validated
class PlanController(private val planService: PlanService) {

    @GetMapping
    fun list(
        caller: AuthenticatedUser,
        @RequestParam teamId: Int,
        @RequestParam(required = false) year: Int?
    ): ResponseEntity<*> = respond(planService.list(teamId, year)) { plans ->
        ApiResponseBuilder.ofList(plans.map(PlanOutputMapper::toDto))
    }

    @GetMapping("/{planId}")
    fun get(caller: AuthenticatedUser, @PathVariable planId: Int): ResponseEntity<*> =
        respond(planService.get(planId)) { ApiResponseBuilder.of(PlanOutputMapper.toDto(it)) }

    @PostMapping("/generate")
    fun generate(caller: AuthenticatedUser, @Valid @RequestBody body: GeneratePlanInputModel): ResponseEntity<*> =
        respond(planService.generate(
            caller, body.teamId, body.from, body.to,
            body.pinnedUserIds.toSet(), body.excludedUserIds.toSet()
        )) {
            ApiResponseBuilder.of(PlanOutputMapper.toDto(it))
        }

    /**
     * The same generation, answered instead of stored. Writes nothing, so the page
     * that composes a plan can ask on every change.
     */
    @PostMapping("/preview")
    fun preview(caller: AuthenticatedUser, @Valid @RequestBody body: GeneratePlanInputModel): ResponseEntity<*> =
        respond(
            planService.preview(
                caller, body.teamId, body.from, body.to,
                body.pinnedUserIds.toSet(), body.excludedUserIds.toSet()
            )
        ) { (result, members) ->
            val byId = members.associate { it.user.id to it.user }
            ApiResponseBuilder.of(
                PlanPreviewOutputModel(
                    days = result.days.map { day ->
                        PreviewDayOutputModel(
                            date = day.date,
                            weekday = day.date.dayOfWeek.value,
                            isHoliday = day.isHoliday,
                            holidayName = day.holidayName,
                            requiredCount = day.requiredCount,
                            understaffed = day.understaffed,
                            assigned = day.assignedUserIds.mapNotNull { byId[it] }
                                .map(UserOutputMapper::toDto)
                        )
                    },
                    // Only people still on the team: a leaver carries a balance from
                    // the days they did, and this is a list of who the plan affects.
                    balances = result.balances.values
                        .mapNotNull { balance ->
                            byId[balance.userId]?.let { user ->
                                PreviewBalanceOutputModel(
                                    user = UserOutputMapper.toDto(user),
                                    expected = balance.expected,
                                    assigned = balance.assigned,
                                    debt = balance.debt
                                )
                            }
                        }
                        .sortedByDescending { it.debt }
                )
            )
        }

    @PostMapping("/{planId}/publish")
    fun publish(caller: AuthenticatedUser, @PathVariable planId: Int): ResponseEntity<*> =
        respond(planService.publish(caller, planId)) { ApiResponseBuilder.of(PlanOutputMapper.toDto(it)) }

    @PatchMapping("/{planId}/days/{date}")
    fun setDay(
        caller: AuthenticatedUser,
        @PathVariable planId: Int,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: SetDayAssignmentsInputModel
    ): ResponseEntity<*> = respond(planService.setDayAssignments(caller, planId, date, body.userIds)) {
        ApiResponseBuilder.of(PlanOutputMapper.toDto(it))
    }

    @PatchMapping("/{planId}")
    fun updateNotes(
        caller: AuthenticatedUser,
        @PathVariable planId: Int,
        @Valid @RequestBody body: UpdatePlanNotesInputModel
    ): ResponseEntity<*> = respond(planService.updateNotes(caller, planId, body.notes)) {
        ApiResponseBuilder.of(PlanOutputMapper.toDto(it))
    }

    @DeleteMapping("/{planId}")
    fun delete(caller: AuthenticatedUser, @PathVariable planId: Int): ResponseEntity<*> =
        when (val result = planService.delete(caller, planId)) {
            is Either.Success -> ResponseEntity.noContent().build<Unit>()
            is Either.Failure -> problem(result.value)
        }

    @GetMapping("/{planId}/email")
    fun email(caller: AuthenticatedUser, @PathVariable planId: Int): ResponseEntity<*> =
        respond(planService.email(planId)) { ApiResponseBuilder.of(PlanOutputMapper.toDto(it)) }

    /**
     * The same message, in the sender's words and with only the part of the plan they
     * are sending. Writes nothing — the team's template is what the next one starts
     * from — so this is a POST for the body it needs, not for a change it makes.
     */
    @PostMapping("/{planId}/email")
    fun email(
        caller: AuthenticatedUser,
        @PathVariable planId: Int,
        @Valid @RequestBody body: RenderEmailInputModel
    ): ResponseEntity<*> = respond(planService.email(planId, body.toOptions())) {
        ApiResponseBuilder.of(PlanOutputMapper.toDto(it))
    }

    private inline fun <E : BaseError, T> respond(result: Either<E, T>, body: (T) -> Any): ResponseEntity<*> =
        when (result) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON).body(body(result.value))

            is Either.Failure -> problem(result.value)
        }

    private fun problem(error: BaseError) = ResponseEntity.status(error.status)
        .contentType(MediaType.APPLICATION_PROBLEM_JSON).body(error.problem)
}
