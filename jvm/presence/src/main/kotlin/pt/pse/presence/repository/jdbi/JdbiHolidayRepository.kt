package pt.pse.presence.repository.jdbi

import org.jdbi.v3.core.Handle
import pt.pse.presence.domain.objects.Holiday
import pt.pse.presence.domain.objects.NewHoliday
import pt.pse.presence.repository.HolidayRepository
import pt.pse.presence.repository.jdbi.mapper.HolidayMapper
import pt.pse.presence.repository.jdbi.model.HolidayDbModel
import java.time.LocalDate

class JdbiHolidayRepository(private val handle: Handle) : HolidayRepository {

    override fun findBetween(from: LocalDate, to: LocalDate): List<Holiday> =
        handle.createQuery(
            """
            SELECT ${HolidayDbModel.id()}, ${HolidayDbModel.date()}, ${HolidayDbModel.name()},
                   ${HolidayDbModel.national()}
            FROM ${HolidayDbModel.table()}
            WHERE ${HolidayDbModel.date()} BETWEEN :from AND :to
            ORDER BY ${HolidayDbModel.date()}
            """.trimIndent()
        )
            .bind("from", from)
            .bind("to", to)
            .map(HolidayMapper())
            .list()

    /**
     * ON CONFLICT against uq_holiday_date_name, so generating a year twice is
     * harmless and a holiday somebody edited by hand is not silently reverted.
     */
    override fun insertIgnoringExisting(holidays: List<NewHoliday>): Int {
        if (holidays.isEmpty()) return 0
        val batch = handle.prepareBatch(
            """
            INSERT INTO ${HolidayDbModel.table()}
                (${HolidayDbModel.date()}, ${HolidayDbModel.name()}, ${HolidayDbModel.national()})
            VALUES (:date, :name, :national)
            ON CONFLICT (${HolidayDbModel.date()}, ${HolidayDbModel.name()}) DO NOTHING
            """.trimIndent()
        )
        holidays.forEach {
            batch.bind("date", it.date).bind("name", it.name).bind("national", it.national).add()
        }
        return batch.execute().sum()
    }

    override fun delete(holidayId: Int): Boolean =
        handle.createUpdate(
            "DELETE FROM ${HolidayDbModel.table()} WHERE ${HolidayDbModel.id()} = :holidayId"
        ).bind("holidayId", holidayId).execute() == 1
}
