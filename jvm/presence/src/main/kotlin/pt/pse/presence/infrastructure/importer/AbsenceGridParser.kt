package pt.pse.presence.infrastructure.importer

import org.apache.poi.ss.usermodel.Cell
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.Row
import org.apache.poi.ss.usermodel.Sheet
import org.apache.poi.ss.usermodel.Workbook
import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.ParsedRow
import pt.pse.presence.domain.objects.ParsedSheet
import pt.pse.presence.domain.objects.RejectedRow
import java.text.Normalizer
import java.time.LocalDate

/**
 * Reads the "Mapa de Férias" grid: a year laid out as quarter blocks, one column per
 * day, one row per person, with a mark on every day someone is away.
 *
 * The shape, per block:
 *
 * ```
 *            B          AG           BI            <- month names, at the column each starts
 *            Q  S  S    Q  S  S      Q  S  S       <- weekday initials, ignored
 *  1º TRIM   1  2  3    1  2  3      1  2  3       <- day of month
 *  Development Team                                <- a heading, skipped
 *  André Freitas          X  X                     <- a person, marks are absent days
 * ```
 *
 * Read column by column rather than by header name, because the file has no header
 * naming a start or an end date: a period exists only as a run of adjacent marks.
 */
@Component
class AbsenceGridParser {

    fun matches(workbook: Workbook): Boolean =
        workbook.getNumberOfSheets() > 0 && findBlocks(workbook.getSheetAt(0)).isNotEmpty()

    fun parse(workbook: Workbook): ParsedSheet {
        val sheet = workbook.getSheetAt(0)
        val blocks = findBlocks(sheet)
        if (blocks.isEmpty()) {
            throw AbsenceSheetParser.UnreadableSheet(
                "Não foi encontrada nenhuma linha com nomes de meses."
            )
        }

        val year = findYear(sheet)
            ?: throw AbsenceSheetParser.UnreadableSheet(
                "Não foi encontrado o ano. Esperava-se algo como \"Férias 2026\" no topo da folha."
            )

        val rejected = mutableListOf<RejectedRow>()
        // Person -> the days they are marked absent, gathered across every block.
        val marked = linkedMapOf<String, MutableSet<LocalDate>>()
        val firstLine = mutableMapOf<String, Int>()

        blocks.forEach { block ->
            val dates = columnDates(sheet, block, year)
            if (dates.isEmpty()) {
                rejected += RejectedRow(block.headerRow + 1, "Bloco sem números de dia legíveis.")
                return@forEach
            }

            for (rowIndex in (block.headerRow + 3)..block.lastPersonRow) {
                val row = sheet.getRow(rowIndex) ?: continue
                val name = text(row.getCell(NAME_COLUMN))
                if (name.isBlank() || isNotAPerson(name)) continue

                firstLine.putIfAbsent(name, rowIndex + 1)
                val days = marked.getOrPut(name) { sortedSetOf() }
                dates.forEach { (column, date) ->
                    if (isMark(text(row.getCell(column)))) days += date
                }
            }
        }

        val rows = marked.entries.flatMap { (name, days) ->
            runsOf(days).map { (start, end) -> ParsedRow(firstLine[name] ?: 0, name, start, end) }
        }.sortedWith(compareBy({ it.startDate }, { it.name }))

        if (rows.isEmpty()) {
            rejected += RejectedRow(0, "Nenhuma ausência marcada na folha.")
        }
        return ParsedSheet(rows, rejected)
    }

    /** Consecutive days collapse into one period; a gap starts a new one. */
    private fun runsOf(days: Set<LocalDate>): List<Pair<LocalDate, LocalDate>> {
        val sorted = days.sorted()
        val runs = mutableListOf<Pair<LocalDate, LocalDate>>()
        var start: LocalDate? = null
        var previous: LocalDate? = null
        sorted.forEach { day ->
            if (start == null) {
                start = day
            } else if (previous!!.plusDays(1) != day) {
                runs += start!! to previous!!
                start = day
            }
            previous = day
        }
        if (start != null) runs += start!! to previous!!
        return runs
    }

    private data class Block(
        val headerRow: Int,
        /** Column where each month begins, ascending. */
        val monthStarts: List<Pair<Int, Int>>,
        val lastPersonRow: Int
    )

    private fun findBlocks(sheet: Sheet): List<Block> {
        val headers = (0..sheet.lastRowNum).mapNotNull { index ->
            val row = sheet.getRow(index) ?: return@mapNotNull null
            val months = (0 until row.lastCellNum).mapNotNull { column ->
                MONTHS[normalise(text(row.getCell(column)))]?.let { column to it }
            }
            if (months.size >= 2) index to months.sortedBy { it.first } else null
        }

        return headers.mapIndexed { index, (headerRow, months) ->
            // A block's people run until the next block starts, or to the end.
            val nextHeader = headers.getOrNull(index + 1)?.first ?: (sheet.lastRowNum + 1)
            Block(headerRow, months, lastPersonRow = nextHeader - 1)
        }
    }

    /**
     * Maps each day column of a block to a date, by pairing the day-of-month row with
     * the month that column falls under.
     */
    private fun columnDates(sheet: Sheet, block: Block, year: Int): List<Pair<Int, LocalDate>> {
        val dayRow = sheet.getRow(block.headerRow + 2) ?: return emptyList()

        // Months run left to right. A month number that drops relative to the one
        // before it has wrapped into the next year, which is how the last block
        // carries a January after its December. Comparing against the block's largest
        // month instead would put that block's October and November in the wrong year.
        var offset = 0
        var previous = 0
        val months = block.monthStarts.map { (column, month) ->
            if (month < previous) offset++
            previous = month
            Triple(column, month, offset)
        }

        return (0 until dayRow.lastCellNum).mapNotNull { column ->
            if (column == NAME_COLUMN) return@mapNotNull null
            val day = text(dayRow.getCell(column)).toIntOrNull() ?: return@mapNotNull null
            val (_, month, yearOffset) = months.lastOrNull { it.first <= column }
                ?: return@mapNotNull null

            runCatching { LocalDate.of(year + yearOffset, month, day) }.getOrNull()
                ?.let { column to it }
        }
    }

    private fun findYear(sheet: Sheet): Int? {
        for (index in 0..minOf(sheet.lastRowNum, YEAR_SEARCH_ROWS)) {
            val row = sheet.getRow(index) ?: continue
            for (column in 0 until row.lastCellNum) {
                YEAR.find(text(row.getCell(column)))?.let { return it.value.toInt() }
            }
        }
        return null
    }

    /**
     * Any non-blank mark counts. The file uses X, but a map that switched to another
     * letter would otherwise drop every absence in silence, and a vacation lost here
     * puts somebody in the office while they are away.
     */
    private fun isMark(value: String) = value.isNotBlank()

    private fun isNotAPerson(name: String): Boolean {
        val n = normalise(name)
        return n.endsWith("trimestre") ||
            n.endsWith("team") ||
            n.contains(" dias") ||
            MONTHS.containsKey(n)
    }

    private fun text(cell: Cell?): String = when (cell?.cellType) {
        null, CellType.BLANK -> ""
        CellType.STRING -> cell.stringCellValue.trim()
        CellType.NUMERIC -> cell.numericCellValue.toLong().toString()
        CellType.FORMULA -> runCatching { cell.stringCellValue.trim() }.getOrDefault("")
        else -> cell.toString().trim()
    }

    private fun normalise(value: String): String =
        Normalizer.normalize(value.trim().lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")

    private companion object {
        const val NAME_COLUMN = 0
        const val YEAR_SEARCH_ROWS = 5
        val YEAR = Regex("20\\d{2}")
        val MONTHS = listOf(
            "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
        ).withIndex().associate { (index, name) -> name to index + 1 }
    }
}
