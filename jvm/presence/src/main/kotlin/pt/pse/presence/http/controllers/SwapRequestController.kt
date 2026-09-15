package pt.pse.presence.http.controllers

import jakarta.validation.Valid
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.swap.CreateSwapInputModel
import pt.pse.presence.http.models.swap.SwapOutputMapper
import pt.pse.presence.services.SwapRequestService
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.Either

@RestController
@RequestMapping("/api/v1/swaps")
@Validated
class SwapRequestController(private val swapRequestService: SwapRequestService) {

    /** Received and sent together: the bell asks one question, not two. */
    @GetMapping
    fun list(caller: AuthenticatedUser): ResponseEntity<*> =
        respond(swapRequestService.list(caller)) { requests ->
            ApiResponseBuilder.ofList(requests.map(SwapOutputMapper::toDto))
        }

    @PostMapping
    fun create(caller: AuthenticatedUser, @Valid @RequestBody body: CreateSwapInputModel): ResponseEntity<*> =
        respond(
            swapRequestService.create(
                caller, body.myPlanDayId, body.targetPlanDayId, body.targetUserId, body.note
            )
        ) { ApiResponseBuilder.of(SwapOutputMapper.toDto(it)) }

    @PostMapping("/{swapRequestId}/approve")
    fun approve(caller: AuthenticatedUser, @PathVariable swapRequestId: Int): ResponseEntity<*> =
        respond(swapRequestService.approve(caller, swapRequestId)) {
            ApiResponseBuilder.of(SwapOutputMapper.toDto(it))
        }

    @PostMapping("/{swapRequestId}/reject")
    fun reject(caller: AuthenticatedUser, @PathVariable swapRequestId: Int): ResponseEntity<*> =
        respond(swapRequestService.reject(caller, swapRequestId)) {
            ApiResponseBuilder.of(SwapOutputMapper.toDto(it))
        }

    @DeleteMapping("/{swapRequestId}")
    fun cancel(caller: AuthenticatedUser, @PathVariable swapRequestId: Int): ResponseEntity<*> =
        when (val result = swapRequestService.cancel(caller, swapRequestId)) {
            is Either.Success -> ResponseEntity.noContent().build<Unit>()
            is Either.Failure -> problem(result.value)
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
