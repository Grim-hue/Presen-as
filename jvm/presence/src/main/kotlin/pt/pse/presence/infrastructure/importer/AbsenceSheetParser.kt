package pt.pse.presence.infrastructure.importer

import org.apache.poi.ss.usermodel.Cell
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.DateUtil
import org.apache.poi.ss.usermodel.Row
import org.apache.poi.ss.usermodel.WorkbookFactory
import org.springframework.stereotype.Component
import pt.pse.presence.config.ImportProperties
import pt.pse.presence.domain.objects.ParsedRow
import pt.pse.presence.domain.objects.ParsedSheet
import pt.pse.presence.domain.objects.RejectedRow
import java.io.InputStream
import java.text.Normalizer
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Reads absence periods out of an .xlsx.
 *
 * Header driven rather than position driven: it finds the columns by their heading,
 * so inserting a column into the source file does not silently shift every date by
 * one. The headings themselves are configuration, because the file is produced
 * elsewhere and its exact wording is not ours to fix.
 *
 * A row that cannot be read is rejected with a reason and a line number, never
 * skipped in silence: a vacation quietly dropped here becomes someone scheduled to
 * be in the office while they are away.
 */
@Component
class AbsenceSheetParser(
    private val properties: ImportProperties,
    private val gridParser: AbsenceGridParser
) {

    class UnreadableSheet(message: String) : Exception(message)

    /**
     * Two layouts are in use and the file says which it is by its own shape.
     *
     * The map the team actually keeps is a year grid: quarter blocks, one column per
     * day, a mark on every day someone is away. A list with Nome, Início and Fim
     * columns is also accepted, because it is the obvious thing somebody will export
     * when asked for one.
     */
    fun parse(input: InputStream): ParsedSheet {
        val workbook = try {
            WorkbookFactory.create(input)
        } catch (e: Exception) {
            throw UnreadableSheet("O ficheiro não é um Excel válido.")
        }

        workbook.use { wb ->
            if (wb.getNumberOfSheets() == 0) throw UnreadableSheet("O ficheiro não tem folhas.")
            if (gridParser.matches(wb)) return gridParser.parse(wb)
            return parseColumns(wb)
        }
    }

    private fun parseColumns(wb: org.apache.poi.ss.usermodel.Workbook): ParsedSheet {
        run {
            val sheet = wb.getSheetAt(0)
            val header = findHeader(sheet)
                ?: throw UnreadableSheet(
                    "Não foi reconhecido o formato. Esperava-se o mapa anual, ou colunas com nome e datas."
                )

            val rows = mutableListOf<ParsedRow>()
            val rejected = mutableListOf<RejectedRow>()

            for (index in (header.rowIndex + 1)..minOf(sheet.lastRowNum, header.rowIndex + properties.maxRows)) {
                val row = sheet.getRow(index) ?: continue
                val line = index + 1

                val name = text(row.getCell(header.nameColumn))
                val rawStart = row.getCell(header.startColumn)
                val rawEnd = row.getCell(header.endColumn)

                if (name.isBlank() && rawStart == null && rawEnd == null) continue
                if (name.isBlank()) {
                    rejected += RejectedRow(line, "Sem nome.")
                    continue
                }

                val start = date(rawStart)
                val end = date(rawEnd)
                when {
                    start == null -> rejected += RejectedRow(line, "Data de início ilegível.")
                    end == null -> rejected += RejectedRow(line, "Data de fim ilegível.")
                    end.isBefore(start) -> rejected += RejectedRow(line, "A data de fim é anterior à de início.")
                    else -> rows += ParsedRow(line, name, start, end)
                }
            }
            return ParsedSheet(rows, rejected)
        }
    }

    private data class Header(val rowIndex: Int, val nameColumn: Int, val startColumn: Int, val endColumn: Int)

    private fun findHeader(sheet: org.apache.poi.ss.usermodel.Sheet): Header? {
        val limit = minOf(sheet.lastRowNum, properties.headerSearchRows)
        for (index in 0..limit) {
            val row = sheet.getRow(index) ?: continue
            val name = columnMatching(row, properties.nameHeaders) ?: continue
            val start = columnMatching(row, properties.startHeaders) ?: continue
            val end = columnMatching(row, properties.endHeaders) ?: continue
            // "a" and "de" are legitimate headings but also common words, so a header
            // row is only accepted when all three columns are found on the same row.
            if (start == end) continue
            return Header(index, name, start, end)
        }
        return null
    }

    private fun columnMatching(row: Row, candidates: List<String>): Int? =
        (0 until row.lastCellNum).firstOrNull { column ->
            normalise(text(row.getCell(column))) in candidates.map(::normalise)
        }

    /** Lowercase, trimmed, accents stripped, so "Início" matches "inicio". */
    private fun normalise(value: String): String =
        Normalizer.normalize(value.trim().lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")

    private fun text(cell: Cell?): String = when (cell?.cellType) {
        null, CellType.BLANK -> ""
        CellType.STRING -> cell.stringCellValue.trim()
        CellType.NUMERIC -> if (DateUtil.isCellDateFormatted(cell)) {
            cell.localDateTimeCellValue.toLocalDate().toString()
        } else {
            cell.numericCellValue.toLong().toString()
        }
        CellType.BOOLEAN -> cell.booleanCellValue.toString()
        CellType.FORMULA -> runCatching { cell.stringCellValue.trim() }.getOrDefault("")
        else -> ""
    }

    private fun date(cell: Cell?): LocalDate? {
        if (cell == null) return null
        if (cell.cellType == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.localDateTimeCellValue.toLocalDate()
        }
        val raw = text(cell)
        if (raw.isBlank()) return null
        // Excel dates often arrive as text. Day first, because the file is Portuguese
        // and 03/08 there means 3 August, not 8 March.
        return FORMATS.firstNotNullOfOrNull { format ->
            runCatching { LocalDate.parse(raw, format) }.getOrNull()
        }
    }

    private companion object {
        val FORMATS = listOf(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy")
        )
    }
}
