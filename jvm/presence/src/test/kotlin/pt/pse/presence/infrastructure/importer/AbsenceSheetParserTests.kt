package pt.pse.presence.infrastructure.importer

import org.apache.poi.ss.usermodel.Workbook
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import pt.pse.presence.config.ImportProperties
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class AbsenceSheetParserTests {

    private val parser = AbsenceSheetParser(ImportProperties(), AbsenceGridParser())

    /** Builds a real .xlsx in memory, so the test exercises POI rather than a stub. */
    private fun workbook(build: (Workbook) -> Unit): ByteArrayInputStream {
        val wb = XSSFWorkbook()
        build(wb)
        val out = ByteArrayOutputStream()
        wb.write(out)
        wb.close()
        return ByteArrayInputStream(out.toByteArray())
    }

    private fun sheetOf(vararg rows: List<Any?>) = workbook { wb ->
        val sheet = wb.createSheet("Ferias")
        val dateStyle = wb.createCellStyle().apply {
            dataFormat = wb.creationHelper.createDataFormat().getFormat("dd/mm/yyyy")
        }
        rows.forEachIndexed { r, values ->
            val row = sheet.createRow(r)
            values.forEachIndexed { c, value ->
                val cell = row.createCell(c)
                when (value) {
                    null -> {}
                    is LocalDate -> {
                        cell.setCellValue(value)
                        cell.cellStyle = dateStyle
                    }
                    else -> cell.setCellValue(value.toString())
                }
            }
        }
    }

    @Test
    fun `finds the header below a title and a blank row`() {
        val sheet = parser.parse(
            sheetOf(
                listOf("Mapa de férias 2026"),
                listOf<Any?>(),
                listOf("Colaborador", "Data Início", "Data Fim"),
                listOf("André Freitas", LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 21))
            )
        )
        assertEquals(1, sheet.rows.size)
        assertEquals("André Freitas", sheet.rows.single().name)
        assertEquals(LocalDate.of(2026, 8, 3), sheet.rows.single().startDate)
    }

    @Test
    fun `header matching ignores case and accents`() {
        val sheet = parser.parse(
            sheetOf(
                listOf("NOME", "inicio", "FIM"),
                listOf("Tiago Sousa", LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 28))
            )
        )
        assertEquals(1, sheet.rows.size)
    }

    @Test
    fun `reads text dates day first, as a Portuguese sheet writes them`() {
        val sheet = parser.parse(
            sheetOf(
                listOf("Nome", "Início", "Fim"),
                listOf("João Vieira", "03/08/2026", "21/08/2026")
            )
        )
        // 03/08 is 3 August. Reading it as 8 March would put someone in the office
        // while they are away, and nothing downstream would notice.
        assertEquals(LocalDate.of(2026, 8, 3), sheet.rows.single().startDate)
        assertEquals(LocalDate.of(2026, 8, 21), sheet.rows.single().endDate)
    }

    @Test
    fun `accepts several written date formats`() {
        listOf("2026-08-03", "03/08/2026", "3/8/2026", "03-08-2026", "03.08.2026").forEach { written ->
            val sheet = parser.parse(
                sheetOf(listOf("Nome", "Início", "Fim"), listOf("André Freitas", written, written))
            )
            assertEquals(LocalDate.of(2026, 8, 3), sheet.rows.single().startDate, "failed on \"$written\"")
        }
    }

    @Test
    fun `bad rows are rejected with a reason and a line number, never dropped silently`() {
        val sheet = parser.parse(
            sheetOf(
                listOf("Nome", "Início", "Fim"),
                listOf("André Freitas", LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 21)),
                listOf("Tiago Sousa", LocalDate.of(2026, 10, 5), null),
                listOf("", LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 6)),
                listOf("João Vieira", LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 10))
            )
        )
        assertEquals(1, sheet.rows.size)
        assertEquals(listOf(3, 4, 5), sheet.rejected.map { it.line })
        assertTrue(sheet.rejected[0].reason.contains("fim", ignoreCase = true))
        assertTrue(sheet.rejected[1].reason.contains("nome", ignoreCase = true))
        assertTrue(sheet.rejected[2].reason.contains("anterior", ignoreCase = true))
    }

    @Test
    fun `fully blank rows are skipped without being reported as errors`() {
        val sheet = parser.parse(
            sheetOf(
                listOf("Nome", "Início", "Fim"),
                listOf("André Freitas", LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 21)),
                listOf<Any?>(),
                listOf("Tiago Sousa", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5))
            )
        )
        assertEquals(2, sheet.rows.size)
        assertTrue(sheet.rejected.isEmpty())
    }

    @Test
    fun `a sheet without the expected columns is refused, not half read`() {
        val e = assertFailsWith<AbsenceSheetParser.UnreadableSheet> {
            parser.parse(sheetOf(listOf("Pessoa", "Desde", "Duração"), listOf("André Freitas", "x", "y")))
        }
        assertTrue(e.message!!.contains("formato"), "the message must say what was expected: " + e.message)
    }

    @Test
    fun `a file that is not a workbook is refused`() {
        assertFailsWith<AbsenceSheetParser.UnreadableSheet> {
            parser.parse(ByteArrayInputStream("this is not a spreadsheet".toByteArray()))
        }
    }
}
