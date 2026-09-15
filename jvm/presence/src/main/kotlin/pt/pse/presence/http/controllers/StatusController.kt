package pt.pse.presence.http.controllers

import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.services.StatusService
import pt.pse.presence.utils.Either

@RestController
@RequestMapping("/api/v1/status")
class StatusController(private val statusService: StatusService) {

    @GetMapping
    fun status(): ResponseEntity<*> =
        when (val result = statusService.check()) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponseBuilder.of(result.value))

            is Either.Failure -> ResponseEntity.status(result.value.status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(result.value.problem)
        }
}
