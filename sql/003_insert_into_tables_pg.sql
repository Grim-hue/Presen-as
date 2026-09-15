-- Seed_tables
-- Target DB: pse_presence
--
-- Development seed. The password hash below is a throwaway for local work and must
-- never reach a deployed environment: see the note on psepre_app_user at the end.

SET search_path TO dev;

-- =====================================================================
-- seed psepre_team
-- =====================================================================
-- Two commitments, not two departments. The development team owes Mondays at the PSE
-- office; the SPS roster owes Wednesdays at the AT premises, with six people and a
-- different set of them. Each carries its own rule, its own roster and its own
-- fairness ledger, and each starts counting from the first day its plan covers, so
-- nothing accrues for weeks that were never scheduled.
--
-- The wording is data rather than code because the two emails address different
-- readers: one is internal, the other goes to the client.

INSERT INTO psepre_team (team_id, name, on_site_weekday, required_on_site, fairness_since, email_subject, email_intro) VALUES
(1, 'Development Team', 1, 2, DATE '2026-09-07',
 'Plano de trabalho presencial {meses_ano}',
 'Venho por este meio enviar o plano de trabalho para o mês de {meses} com as datas em que os elementos da development team devem trabalhar presencialmente na sede da PSE.'),
(2, 'AT — SPS', 3, 6, DATE '2026-08-05',
 'AT - SPS: Plano de presenças físicas nas instalações da AT ({meses})',
 'Venho por este meio enviar o plano de trabalho para o mês de {meses} com as datas em que os elementos da PSE devem trabalhar presencialmente na AT.');

SELECT setval('dev.psepre_team_team_id_seq', (SELECT MAX(team_id) FROM dev.psepre_team));


-- =====================================================================
-- seed psepre_app_user
-- =====================================================================

-- Users 1 to 3 have a local password and can sign in. Users 4 to 10 are on the AT
-- roster and nothing more: password_hash is null, which the column comment already
-- defines as "local login is not available for this user". A person has to be a row
-- here to be scheduled; that does not make them a user of the application.
INSERT INTO psepre_app_user (user_id, forename, surname, email, username, password_hash, is_admin) VALUES
(1,  'André',     'Freitas',   'andre.freitas@pse.pt',     'andre.freitas',     '$2y$10$JZgQmVfXj9NHh5E17TWoT..RzkzK6f2wfumShd8BWClSvuR5eN8Hq', TRUE),
(2,  'Tiago',     'Sousa',     'tiago.sousa@pse.pt',       'tiago.sousa',       '$2y$10$JZgQmVfXj9NHh5E17TWoT..RzkzK6f2wfumShd8BWClSvuR5eN8Hq', FALSE),
(3,  'João',      'Vieira',    'joao.vieira@pse.pt',       'joao.vieira',       '$2y$10$JZgQmVfXj9NHh5E17TWoT..RzkzK6f2wfumShd8BWClSvuR5eN8Hq', FALSE),
-- João Nunes is the one who sends the AT plan, so he is the administrator of it.
(4,  'João',      'Nunes',     'jnunes@pse.pt',            'jnunes',            NULL, TRUE),
(5,  'Sara',      'Rodrigues', 'sara.rodrigues@pse.pt',    'sara.rodrigues',    NULL, FALSE),
(6,  'Nuno',      'Gomes',     'nuno.gomes@pse.pt',        'nuno.gomes',        NULL, FALSE),
(7,  'Beatriz',   'Gonçalves', 'beatriz.goncalves@pse.pt', 'beatriz.goncalves', NULL, FALSE),
(8,  'Guilherme', 'Neto',      'guilherme.neto@pse.pt',    'guilherme.neto',    NULL, FALSE),
(9,  'Duarte',    'Gonçalves', 'duarte.goncalves@pse.pt',  'duarte.goncalves',  NULL, FALSE),
(10, 'Rui',       'Almeida',   'rui.almeida@pse.pt',       'rui.almeida',       NULL, FALSE);

SELECT setval('dev.psepre_app_user_user_id_seq', (SELECT MAX(user_id) FROM dev.psepre_app_user));


-- =====================================================================
-- seed psepre_team_member
-- =====================================================================

-- Three people are on both rosters, which is the point of keeping membership per
-- team: André owes Mondays at PSE and Wednesdays at AT, and each debt is counted
-- against the members he shares that particular commitment with.
INSERT INTO psepre_team_member (team_id, user_id, joined_at) VALUES
(1, 1,  DATE '2026-09-07'),
(1, 2,  DATE '2026-09-07'),
(1, 3,  DATE '2026-09-07'),
(2, 1,  DATE '2026-08-05'),
(2, 2,  DATE '2026-08-05'),
(2, 3,  DATE '2026-08-05'),
(2, 4,  DATE '2026-08-05'),
(2, 5,  DATE '2026-08-05'),
(2, 6,  DATE '2026-08-05'),
(2, 7,  DATE '2026-08-05'),
(2, 8,  DATE '2026-08-05'),
(2, 9,  DATE '2026-08-05'),
(2, 10, DATE '2026-08-05');


-- =====================================================================
-- seed psepre_holiday
-- =====================================================================
-- Portuguese national holidays plus the Lisbon municipal holiday, for 2026 and 2027.
-- The moveable feasts are anchored on Easter: Good Friday is Easter minus 2 days and
-- Corpus Christi is Easter plus 60. Easter is 5 April 2026 and 28 March 2027.
-- HolidayDomain computes these for any later year, so this seed only has to carry
-- enough to work with today.

INSERT INTO psepre_holiday (holiday_date, name, national) VALUES
-- 2026
(DATE '2026-01-01', 'Ano Novo',                       TRUE),
(DATE '2026-04-03', 'Sexta-feira Santa',              TRUE),
(DATE '2026-04-05', 'Páscoa',                         TRUE),
(DATE '2026-04-25', 'Dia da Liberdade',               TRUE),
(DATE '2026-05-01', 'Dia do Trabalhador',             TRUE),
(DATE '2026-06-04', 'Corpo de Deus',                  TRUE),
(DATE '2026-06-10', 'Dia de Portugal',                TRUE),
(DATE '2026-06-13', 'Santo António',                  FALSE),
(DATE '2026-08-15', 'Assunção de Nossa Senhora',      TRUE),
(DATE '2026-10-05', 'Implantação da República',       TRUE),
(DATE '2026-11-01', 'Todos os Santos',                TRUE),
(DATE '2026-12-01', 'Restauração da Independência',   TRUE),
(DATE '2026-12-08', 'Imaculada Conceição',            TRUE),
(DATE '2026-12-25', 'Natal',                          TRUE),
-- 2027
(DATE '2027-01-01', 'Ano Novo',                       TRUE),
(DATE '2027-03-26', 'Sexta-feira Santa',              TRUE),
(DATE '2027-03-28', 'Páscoa',                         TRUE),
(DATE '2027-04-25', 'Dia da Liberdade',               TRUE),
(DATE '2027-05-01', 'Dia do Trabalhador',             TRUE),
(DATE '2027-05-27', 'Corpo de Deus',                  TRUE),
(DATE '2027-06-10', 'Dia de Portugal',                TRUE),
(DATE '2027-06-13', 'Santo António',                  FALSE),
(DATE '2027-08-15', 'Assunção de Nossa Senhora',      TRUE),
(DATE '2027-10-05', 'Implantação da República',       TRUE),
(DATE '2027-11-01', 'Todos os Santos',                TRUE),
(DATE '2027-12-01', 'Restauração da Independência',   TRUE),
(DATE '2027-12-08', 'Imaculada Conceição',            TRUE),
(DATE '2027-12-25', 'Natal',                          TRUE);


-- =====================================================================
-- Local credentials
-- =====================================================================
-- Users 1 to 3 share the password "presencas". This exists so the app is usable the
-- moment the container is up. Before any deployment, either set real hashes or switch
-- auth.provider to the Active Directory provider and null these out.
--
-- The AT roster, users 4 to 10, has no password at all and so cannot sign in. Giving
-- them the development password to "make them work" would hand a shared credential to
-- seven more accounts; they need a real one, or the directory provider.
