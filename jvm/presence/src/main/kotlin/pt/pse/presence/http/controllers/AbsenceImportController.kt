package pt.pse.presence.http.controllers

import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import pt.pse.presence.domain.objects.AuthenticatedUser
import pt.pse.presence.http.models.ApiResponseBuilder
import pt.pse.presence.http.models.absence.CommitImportInputModel
import pt.pse.presence.http.models.absence.ImportOutputMapper
import pt.pse.presence.services.AbsenceImportService
import pt.pse.presence.services.CommitRow
import pt.pse.presence.utils.BaseError
import pt.pse.presence.utils.Either

@RestController
@RequestMapping("/api/v1/absences/imports")
@Validated
class AbsenceImportController(private val importService: AbsenceImportService) {

    @GetMapping
    fun history(caller: AuthenticatedUser): ResponseEntity<*> =
        respond(importService.history()) { imports ->
            ApiResponseBuilder.ofList(imports.map(ImportOutputMapper::toDto))
        }

    @PostMapping
    fun upload(caller: AuthenticatedUser, @RequestParam("file") file: MultipartFile): ResponseEntity<*> =
        respond(
            importService.preview(caller, file.originalFilename ?: "sem-nome.xlsx", file.inputStream)
        ) { ApiResponseBuilder.of(ImportOutputMapper.toDto(it)) }

    @PostMapping("/{importId}/commit")
    fun commit(
        caller: AuthenticatedUser,
        @PathVariable importId: Int,
        @RequestBody body: CommitImportInputModel
    ): ResponseEntity<*> = respond(
        importService.commit(
            caller,
            importId,
            body.rows.map { CommitRow(it.line, it.name, it.startDate, it.endDate, it.userId, it.apply) }
        )
    ) { ApiResponseBuilder.of(ImportOutputMapper.toDto(it)) }

    @DeleteMapping("/{importId}")
    fun discard(caller: AuthenticatedUser, @PathVariable importId: Int): ResponseEntity<*> =
        respond(importService.discard(caller, importId)) { removed ->
            ApiResponseBuilder.of(mapOf("removed" to removed))
        }

    private inline fun <E : BaseError, T> respond(result: Either<E, T>, body: (T) -> Any): ResponseEntity<*> =
        when (result) {
            is Either.Success -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(body(result.value))

            is Either.Failure -> ResponseEntity.status(result.value.status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(result.value.problem)
        }
}
