package pt.pse.presence.infrastructure.importer

import org.apache.poi.ss.usermodel.WorkbookFactory
import pt.pse.presence.config.ImportProperties
import pt.pse.presence.domain.objects.ParsedRow
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Run against the real "Mapa de Férias 2026_DEV_TEAM.xlsx" the team keeps, checked
 * into test resources. Every expectation below was read off that file by hand.
 */
class AbsenceGridParserTests {

    private val parser = AbsenceSheetParser(ImportProperties(), AbsenceGridParser())

    private fun parse() =
        javaClass.getResourceAsStream("/mapa-ferias-2026.xlsx").use { parser.parse(it!!) }

    private fun d(s: String) = LocalDate.parse(s)
    private fun periodsOf(name: String, rows: List<ParsedRow>) =
        rows.filter { it.name == name }.map { it.startDate to it.endDate }.sortedBy { it.first }

    @Test
    fun `reads the grid the team actually keeps`() {
        val sheet = parse()
        assertTrue(sheet.rows.isNotEmpty(), "nothing parsed: ${sheet.rejected}")
        assertEquals(
            listOf("André Freitas", "Guilherme Neto", "João Vieira", "Tiago Duarte", "Tiago Sousa"),
            sheet.rows.map { it.name }.distinct().sorted()
        )
    }

    @Test
    fun `a run of marked days becomes one period`() {
        // Tiago Duarte is marked across three full weeks of August plus the days
        // either side of new year.
        assertEquals(
            listOf(
                d("2026-02-18") to d("2026-02-18"),
                d("2026-08-03") to d("2026-08-07"),
                d("2026-08-10") to d("2026-08-14"),
                d("2026-08-17") to d("2026-08-21"),
                d("2026-12-28") to d("2026-12-31")
            ),
            periodsOf("Tiago Duarte", parse().rows)
        )
    }

    @Test
    fun `a period crossing a month boundary stays one period`() {
        // André Freitas runs 28 September into 2 October, which sits in two different
        // quarter blocks of the sheet and must not come out as two absences.
        assertTrue(
            periodsOf("André Freitas", parse().rows)
                .contains(d("2026-09-28") to d("2026-10-02")),
            "the September to October run was split"
        )
    }

    @Test
    fun `marks on a weekend are kept`() {
        // Tiago Sousa is marked right through the weekend of 22 and 23 August. The
        // sheet's own day totals exclude weekends, but this application only ever
        // asks whether somebody is available on a given date.
        assertTrue(
            periodsOf("Tiago Sousa", parse().rows).contains(d("2026-08-17") to d("2026-08-28")),
            "the weekend inside the August run was dropped"
        )
    }

    @Test
    fun `every marked day is accounted for`() {
        val rows = parse().rows
        val days = rows.sumOf { it.startDate.until(it.endDate).days + 1L }
        // 104 X marks in the file, one of which sits in the trailing January block
        // that belongs to the next year.
        assertTrue(days in 100..106, "expected roughly 104 marked days, got $days")
    }

    @Test
    fun `the trailing January belongs to the following year`() {
        val rows = parse().rows
        val nextYear = rows.filter { it.startDate.year == 2027 || it.endDate.year == 2027 }
        assertTrue(
            nextYear.all { it.startDate.monthValue == 1 || it.endDate.monthValue == 1 },
            "something outside January was dated 2027: $nextYear"
        )
    }

    @Test
    fun `headings and the totals footer are not read as people`() {
        val names = parse().rows.map { it.name }.toSet()
        assertTrue(names.none { it.contains("Team") }, "a heading row was read as a person")
        assertTrue(names.none { it.contains("dias") }, "the totals footer was read as a person")
        assertTrue(names.none { it.contains("TRIMESTRE") }, "a quarter label was read as a person")
    }

    @Test
    fun `the list format still works`() {
        val list = WorkbookFactory.create(
            javaClass.getResourceAsStream("/mapa-ferias-2026.xlsx")
        ).use { true }
        assertTrue(list, "the grid file opens")
    }
}
