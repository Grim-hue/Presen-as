package pt.pse.presence.http.controllers

import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.holiday.GeneratedYearOutputModel
import pt.pse.presence.http.models.holiday.HolidayOutputMapper
import pt.pse.presence.services.HolidayService
import pt.pse.presence.utils.Either

@RestController
@RequestMapping("/api/v1/holidays")
@Validated
class HolidayController(private val holidayService: HolidayService) {

    @GetMapping
    fun list(caller: AuthenticatedUser, @RequestParam year: Int): ResponseEntity<*> =
        when (val result = holidayService.listByYear(year)) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponseBuilder.ofList(result.value.map(HolidayOutputMapper::toDto)))

            is Either.Failure -> problem(result)
        }

    @PostMapping("/generate")
    fun generate(caller: AuthenticatedUser, @RequestParam year: Int): ResponseEntity<*> =
        when (val result = holidayService.generateYear(caller, year)) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(
                    ApiResponseBuilder.of(
                        GeneratedYearOutputModel(
                            year = result.value.year,
                            added = result.value.added,
                            holidays = result.value.holidays.map(HolidayOutputMapper::toDto)
                        )
                    )
                )

            is Either.Failure -> problem(result)
        }

    @DeleteMapping("/{holidayId}")
    fun delete(caller: AuthenticatedUser, @PathVariable holidayId: Int): ResponseEntity<*> =
        when (val result = holidayService.delete(caller, holidayId)) {
            is Either.Success -> ResponseEntity.noContent().build<Unit>()
            is Either.Failure -> problem(result)
        }

    private fun problem(failure: Either.Failure<pt.pse.presence.utils.BaseError>) =
        ResponseEntity.status(failure.value.status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .body(failure.value.problem)
}
