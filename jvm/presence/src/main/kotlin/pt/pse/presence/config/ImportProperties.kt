package pt.pse.presence.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * How to read the vacation spreadsheet.
 *
 * The real file's layout is not fixed by us, so the column headings are
 * configuration rather than code. Matching is case and accent insensitive, so
 * "Início" and "inicio" both find the same column.
 */
@ConfigurationProperties(prefix = "absence.import")
data class ImportProperties(
    val nameHeaders: List<String> = listOf("nome", "colaborador", "elemento", "funcionario"),
    val startHeaders: List<String> = listOf("inicio", "data inicio", "data de inicio", "de"),
    val endHeaders: List<String> = listOf("fim", "data fim", "data de fim", "ate", "a"),
    /** How far down to look for the header row before giving up. */
    val headerSearchRows: Int = 10,
    val maxRows: Int = 5000
)
