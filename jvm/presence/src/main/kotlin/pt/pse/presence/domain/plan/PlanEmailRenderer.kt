package pt.pse.presence.domain.plan

import org.springframework.stereotype.Component
import pt.pse.presence.domain.objects.Plan
import pt.pse.presence.domain.objects.PlanDay
import pt.pse.presence.domain.objects.Team
import java.time.LocalDate
import java.time.YearMonth

/**
 * Renders the plan as the message the team lead already sends.
 *
 * The shape is not ours to choose: a month at a time, a seven column grid with the
 * date in the top corner of its own cell and the people under it, named and run
 * together as a sentence. Producing something tidier would mean the recipient has to
 * re-read a format they have been scanning for years.
 *
 * The grid is the same for every commitment; the words around it are not. The subject
 * and the opening paragraph come from the team, because the internal plan and the
 * client-facing AT roster are read by different people and say different things about
 * who goes where. Both are templates over two tokens, [MONTHS_TOKEN] for the month
 * names alone and [MONTHS_YEAR_TOKEN] for the same with the year. [Options] is how one
 * send departs from them without changing what the next send starts from.
 */
@Component
class PlanEmailRenderer {

    data class RenderedEmail(val subject: String, val html: String, val text: String)

    /**
     * What this particular message says, and how much of the plan it carries.
     *
     * The team's wording is where every message starts and is a default rather than a
     * rule: the plan that goes out after lunch opens "Boa tarde", and the one that
     * goes out in December says something about December that no stored template
     * holds. [greeting], [subject], [intro] and [notes] are the sender's words for
     * this one send; left null, the team's own are used, and nothing here is
     * remembered either way.
     *
     * The rest is how much travels. A plan generated two months at a time is often
     * sent a month at a time ([months]); a roster going to a client counts the people
     * on it rather than naming them ([nameMembers]); and two columns of weekend and a
     * row of public holidays are grid saying nothing when the commitment is one
     * weekday ([weekends], [holidays]).
     */
    data class Options(
        val greeting: String? = null,
        val subject: String? = null,
        val intro: String? = null,
        /** The months to send. Null is the whole plan, which is the ordinary case. */
        val months: Set<YearMonth>? = null,
        val nameMembers: Boolean = true,
        val weekends: Boolean = true,
        val holidays: Boolean = true,
        val notes: String? = null
    )

    fun render(plan: Plan, team: Team, options: Options = Options()): RenderedEmail {
        val months = plan.days
            .filter { options.months == null || YearMonth.from(it.date) in options.months }
            .groupBy { YearMonth.from(it.date) }
            .toSortedMap()
        val monthNames = said(months.keys.toList(), withYear = false)
        val monthNamesWithYear = said(months.keys.toList(), withYear = true)

        // The subject names the months too, so a plan sent a month at a time does not
        // announce both in the line the recipient files it under.
        fun fill(template: String) = substitute(
            substitute(template, MONTHS_TOKEN, monthNames),
            MONTHS_YEAR_TOKEN,
            monthNamesWithYear
        )

        // One paragraph per line, blanks dropped, so the notes can be typed as
        // ordinary text without the writer thinking about markup.
        val notes = (options.notes ?: plan.notes)
            ?.lines()?.map(String::trim)?.filter(String::isNotEmpty).orEmpty()

        val greeting = options.greeting?.trim()?.ifEmpty { null } ?: GREETING
        val intro = fill(options.intro ?: team.emailIntro)
        return RenderedEmail(
            subject = fill(options.subject ?: team.emailSubject),
            html = html(greeting, intro, notes, months, options),
            text = text(greeting, intro, notes, months, options)
        )
    }

    /**
     * The message as HTML, carrying its own colours and its own width.
     *
     * Both because it has to. A mail client keeps no stylesheet — Outlook and Gmail
     * strip `<style>`, and this is pasted into a compose window as a fragment, where
     * there is nowhere to put one — so anything left unstyled is coloured by whoever
     * draws it. Unstyled, the plan arrived in a reader on dark mode as white text on
     * black; and sized by its contents, seven columns of weekday name over a list of
     * names each ran wider than the window, so the weekend was off the right edge of
     * a table nobody could scroll. Every rule below is inline for the first reason and
     * proportional for the second.
     */
    private fun html(
        greeting: String,
        intro: String,
        notes: List<String>,
        months: Map<YearMonth, List<PlanDay>>,
        options: Options
    ): String = buildString {
        val weekdays = if (options.weekends) WEEKDAYS else WEEKDAYS.take(WORKING_COLUMNS)
        /*
         * A table for a sheet of paper, not a div.
         *
         * Word draws what Outlook composes and reads `bgcolor` where it ignores a
         * stylesheet, and a client on dark mode reverses what it finds no ground
         * under. A div saying `background-color` in CSS is exactly that case: the
         * message came back black. Every surface below says it twice — the attribute
         * for Word, the property for everything else — and the wrapper is what puts a
         * white page behind the paragraphs as well as the grid.
         */
        append("<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\"")
        append(" bgcolor=\"").append(PAPER).append("\" style=\"").append(SHEET).append("\">")
        append("<tr><td bgcolor=\"").append(PAPER).append("\" style=\"").append(BODY).append("\">")
        append("<p style=\"").append(PARA).append("\">").append(greeting).append("</p>")
        append("<p style=\"").append(PARA).append("\">").append(intro).append("</p>")
        notes.forEach { append("<p style=\"").append(PARA).append("\">").append(it).append("</p>") }
        months.forEach { (month, days) ->
            append("<p style=\"").append(HEADING).append("\">")
            append(MONTHS[month.monthValue - 1].replaceFirstChar(Char::uppercase))
            append(' ').append(month.year).append("</p>")
            append("<table cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" bgcolor=\"")
            append(PAPER).append("\" style=\"").append(GRID).append("\">")
            append("<tr>")
            weekdays.forEach {
                append("<th scope=\"col\" width=\"").append(100 / weekdays.size)
                append("%\" bgcolor=\"").append(BAND).append("\" style=\"").append(TH)
                append("\">").append(it).append("</th>")
            }
            append("</tr>")
            weeksOf(month, weekdays.size).forEach { week ->
                // The days either side of the month keep their own numbers, as a
                // calendar does, but nothing is written under them: they are drawn
                // in full in the grid they belong to.
                val notes = week.map {
                    if (YearMonth.from(it) == month) noteFor(it, days, options) else ""
                }
                /*
                 * A week with nothing written in it is seven date numbers, and at the
                 * height of a calendar square that is a hand's width of ruled white
                 * space in the middle of the page. The week a month opens in is
                 * usually one of them — most of it belongs to the month before — and
                 * so is any week the commitment did not fall in. The row stays, because
                 * a calendar missing a week stops being a calendar; it shrinks to the
                 * numbers it holds.
                 */
                val cell = if (notes.all(String::isBlank)) SPARE else CELL
                append("<tr>")
                week.forEachIndexed { column, date ->
                    append("<td bgcolor=\"").append(PAPER).append("\" style=\"").append(cell).append("\">")
                    append("<div style=\"").append(DATE).append("\">").append(date.dayOfMonth).append("</div>")
                    if (notes[column].isNotBlank()) {
                        append("<div style=\"").append(NOTE).append("\">").append(notes[column]).append("</div>")
                    }
                    append("</td>")
                }
                append("</tr>")
            }
            append("</table>")
        }
        append("<p style=\"").append(PARA).append("\">Com os melhores cumprimentos,</p>")
        append("</td></tr></table>")
    }

    private fun text(
        greeting: String,
        intro: String,
        notes: List<String>,
        months: Map<YearMonth, List<PlanDay>>,
        options: Options
    ): String = buildString {
        appendLine(greeting).appendLine()
        appendLine(intro).appendLine()
        notes.forEach { appendLine(it).appendLine() }
        months.forEach { (month, days) ->
            appendLine("${MONTHS[month.monthValue - 1].replaceFirstChar(Char::uppercase)} ${month.year}")
            days.forEach { day ->
                val note = noteFor(day.date, days, options)
                // A day left out of the grid is left out here too, or the plain text
                // half of the message would say more than the half beside it.
                if (note.isNotBlank()) {
                    appendLine("  ${day.date} ${WEEKDAYS[day.date.dayOfWeek.value - 1]}: $note")
                }
            }
            appendLine()
        }
        appendLine("Com os melhores cumprimentos,")
    }

    /**
     * What is written under a date.
     *
     * The people, named and joined as a sentence rather than counted: "2 elementos"
     * alone sends the reader to another message to find out who. A holiday says so by
     * name. [Options.nameMembers] is the one case that counts instead, for a roster
     * that goes outside the company.
     */
    private fun noteFor(date: LocalDate?, days: List<PlanDay>, options: Options): String {
        val day = days.firstOrNull { it.date == date } ?: return ""
        return when {
            day.isHoliday ->
                if (options.holidays) "Feriado" + (day.holidayName?.let { " ($it)" } ?: "") else ""
            day.assigned.isEmpty() -> "Sem elementos disponíveis"
            !options.nameMembers ->
                "${day.assigned.size} elemento${if (day.assigned.size == 1) "" else "s"}"
            else -> listed(day.assigned.map { it.displayName })
        }
    }

    /**
     * The months the message carries, said the way somebody says them out loud.
     *
     * Named one by one with the year on each, four months are the same year announced
     * four times — "setembro 2026, outubro 2026, novembro 2026 e dezembro 2026" — and
     * the reader has to get to the end of the line to find out it is one unbroken run.
     * So: three or more consecutive months are a range, and the year is said once, at
     * the end, whenever the whole list sits inside one. Two months stay a list, because
     * "de setembro a outubro" says nothing "setembro e outubro" does not; and months
     * with a gap between them stay a list whatever their number, because a range over
     * a gap would promise months the plan does not cover.
     */
    private fun said(months: List<YearMonth>, withYear: Boolean): String {
        if (months.isEmpty()) return ""
        val oneYear = months.first().year == months.last().year
        // The year rides on each month only when the list crosses from one into another.
        fun name(month: YearMonth) =
            MONTHS[month.monthValue - 1] + if (withYear && !oneYear) " ${month.year}" else ""
        val year = if (withYear && oneYear) " ${months.first().year}" else ""
        val consecutive = months.zipWithNext().all { (a, b) -> a.plusMonths(1) == b }
        return if (consecutive && months.size > 2) {
            "de ${name(months.first())} a ${name(months.last())}$year"
        } else {
            listed(months.map(::name)) + year
        }
    }

    /**
     * [token] filled in, without a range bringing a second "de" to a sentence that
     * already said it.
     *
     * The team's opening paragraph is "para o mês de {meses}", which is the right
     * sentence for the one month it was written for and becomes "de de setembro a
     * dezembro" the moment the months are a range. The preposition belongs to whichever
     * of the two says it first, so the template keeps its own and the range goes without.
     */
    private fun substitute(template: String, token: String, months: String): String =
        template
            .replace(
                Regex("\\bde ${Regex.escape(token)}"),
                Regex.escapeReplacement("de " + months.removePrefix("de "))
            )
            .replace(token, months)

    /**
     * "A, B e C" — a list as it is said rather than as it is stored.
     *
     * The same rule for the people on a day and for the months a plan covers: commas
     * between, and "e" before the last. Four months joined by "e" throughout read as
     * four separate announcements in one sentence.
     */
    private fun listed(items: List<String>): String =
        if (items.size < 2) items.joinToString("") else {
            items.dropLast(1).joinToString(", ") + " e " + items.last()
        }

    /**
     * Weeks as Monday-first rows, cut to [columns].
     *
     * Whole weeks, and the dates either side of the month with them: a month that
     * begins on a Wednesday begins under Wednesday, and the two cells before it hold
     * the Monday and Tuesday they really are rather than a hole. The week is always
     * built to seven first — Monday-first is what decides where the month starts, and
     * dropping the weekend before that would move every date in the grid.
     */
    private fun weeksOf(month: YearMonth, columns: Int): List<List<LocalDate>> {
        val first = month.atDay(1)
        val last = month.atEndOfMonth()
        val start = first.minusDays((first.dayOfWeek.value - 1).toLong())
        val end = last.plusDays((7 - last.dayOfWeek.value).toLong())
        val weeks = mutableListOf<List<LocalDate>>()
        var cursor = start
        while (!cursor.isAfter(end)) {
            val week = cursor
            weeks += (0 until columns).map { week.plusDays(it.toLong()) }
            cursor = cursor.plusWeeks(1)
        }
        return weeks
    }

    private companion object {
        const val MONTHS_TOKEN = "{meses}"
        const val MONTHS_YEAR_TOKEN = "{meses_ano}"

        /** What the message opens with when the sender does not say otherwise. */
        const val GREETING = "Bom dia,"

        /** Monday to Friday, when the weekend is not worth two columns of the grid. */
        const val WORKING_COLUMNS = 5

        /*
         * The palette of the message. Light and stated outright, never inherited: a
         * client on dark mode has nothing to reverse if every surface names itself,
         * and a plan is a thing people print and pin up.
         */
        /*
         * One ink for everything the reader reads.
         *
         * The month over the grid and the names under the dates used to be set a step
         * down from the dates themselves, which is a habit from screens with a
         * hierarchy to signal. A plan has none: the month, the date and the people are
         * the three things it is for, and dimming two of them only made them harder to
         * read on a projector, on paper, and in a client that had already knocked the
         * contrast about.
         */
        const val INK = "#1f2328"
        const val RULE = "#9b9b9b"
        const val BAND = "#9b9b9b"
        const val ON_BAND = "#ffffff"
        const val PAPER = "#ffffff"

        /** Calibri is what Outlook writes in, so the message matches what surrounds it. */
        const val FONT = "font-family:'Segoe UI',Calibri,Helvetica,Arial,sans-serif;"

        const val SHEET = "border-collapse:collapse;width:100%;background-color:$PAPER;"
        const val BODY = FONT + "padding:0;font-size:14px;line-height:1.5;color:$INK;" +
            "background-color:$PAPER;text-align:left;vertical-align:top;"
        const val PARA = "margin:0 0 14px 0;color:$INK;"

        /** The month, set large and grey over its grid, as the template has it. */
        const val HEADING = "margin:22px 0 6px 0;font-size:26px;font-weight:400;color:$INK;"

        /*
         * A share of the width rather than as much of it as the longest name wants.
         * `table-layout:fixed` is what divides the seven columns evenly and makes a
         * roster wrap inside its own column instead of setting the column's width;
         * without it one Wednesday of six names decides how wide the month is, and the
         * weekend ends up past the right edge of the window.
         */
        const val GRID = "border-collapse:collapse;table-layout:fixed;width:100%;margin:0 0 20px 0;"
        const val TH = "border:1px solid $RULE;background-color:$BAND;color:$ON_BAND;" +
            "padding:4px 8px;font-size:14px;font-weight:400;text-align:center;"

        /*
         * One cell per day, tall enough to be a calendar square: the date in the
         * corner and the people under it, which is the pair the reader's eye goes
         * between. A height rather than a minimum, because Word has no minimum.
         */
        const val CELL = "border:1px solid $RULE;background-color:$PAPER;" +
            "height:120px;padding:5px 8px;vertical-align:top;"

        /** The same square with no height asked for: a week with nothing in it is a line. */
        const val SPARE = "border:1px solid $RULE;background-color:$PAPER;" +
            "padding:5px 8px;vertical-align:top;"
        const val DATE = "text-align:right;font-size:14px;color:$INK;"
        const val NOTE = "margin-top:6px;font-size:13px;line-height:1.35;color:$INK;" +
            "word-wrap:break-word;"

        val MONTHS = listOf(
            "janeiro", "fevereiro", "março", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
        )
        val WEEKDAYS = listOf(
            "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira",
            "Sexta-Feira", "Sábado", "Domingo"
        )
    }
}
