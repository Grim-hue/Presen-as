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
import pt.pse.presence.domain.objects.AbsenceSource
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.absence.AbsenceOutputMapper
import pt.pse.presence.http.models.absence.CreateAbsenceInputModel
import pt.pse.presence.http.models.absence.UpdateAbsenceInputModel
import pt.pse.presence.services.AbsenceService
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.Either
import java.time.LocalDate

@RestController
@RequestMapping("/api/v1/absences")
@Validated
class AbsenceController(private val absenceService: AbsenceService) {

    @GetMapping
    fun list(
        caller: AuthenticatedUser,
        @RequestParam(required = false) userId: Int?,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate?,
        @RequestParam(required = false) source: AbsenceSource?
    ): ResponseEntity<*> = respond(absenceService.list(userId, from, to, source)) { absences ->
        ApiResponseBuilder.ofList(absences.map(AbsenceOutputMapper::toDto))
    }

    @PostMapping
    fun create(caller: AuthenticatedUser, @Valid @RequestBody body: CreateAbsenceInputModel): ResponseEntity<*> =
        respond(
            absenceService.create(caller, body.userId, body.startDate, body.endDate, body.kind, body.note)
        ) { ApiResponseBuilder.of(AbsenceOutputMapper.toDto(it)) }

    @PatchMapping("/{absenceId}")
    fun update(
        caller: AuthenticatedUser,
        @PathVariable absenceId: Int,
        @Valid @RequestBody body: UpdateAbsenceInputModel
    ): ResponseEntity<*> = respond(
        absenceService.update(caller, absenceId, body.startDate, body.endDate, body.kind, body.note)
    ) { ApiResponseBuilder.of(AbsenceOutputMapper.toDto(it)) }

    @DeleteMapping("/{absenceId}")
    fun delete(caller: AuthenticatedUser, @PathVariable absenceId: Int): ResponseEntity<*> =
        when (val result = absenceService.delete(caller, absenceId)) {
            is Either.Success -> ResponseEntity.noContent().build<Unit>()
            is Either.Failure -> problem(result.value)
        }

    private inline fun <E : BaseError, T> respond(result: Either<E, T>, body: (T) -> Any): ResponseEntity<*> =
        when (result) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(body(result.value))

            is Either.Failure -> problem(result.value)
        }

    private fun problem(error: BaseError) = ResponseEntity.status(error.status)
        .contentType(MediaType.APPLICATION_PROBLEM_JSON)
        .body(error.problem)
}
