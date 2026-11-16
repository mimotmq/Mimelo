/* Sample data for the static mockup. No real account data. */
window.MOCK = (function () {
  const clubs = [
    { code: "ARS", name: "Arsenal", league: "Premier League", stars: 4.5 },
    { code: "LIV", name: "Liverpool", league: "Premier League", stars: 4.5 },
    { code: "MCI", name: "Man City", league: "Premier League", stars: 5 },
    { code: "RMA", name: "Real Madrid", league: "LaLiga", stars: 5 },
    { code: "BAR", name: "Barcelona", league: "LaLiga", stars: 4.5 },
    { code: "BAY", name: "Bayern", league: "Bundesliga", stars: 5 },
    { code: "PSG", name: "PSG", league: "Ligue 1", stars: 4.5 },
    { code: "INT", name: "Inter", league: "Serie A", stars: 4.5 },
    { code: "MIL", name: "AC Milan", league: "Serie A", stars: 4 },
    { code: "JUV", name: "Juventus", league: "Serie A", stars: 4 },
    { code: "BVB", name: "Dortmund", league: "Bundesliga", stars: 4 },
    { code: "ATM", name: "Atlético", league: "LaLiga", stars: 4 }
  ];

  /* Sample club catalogue for the team picker: men and women, by nation and league. */
  const teamPool = [
    /* Men · Premier League */
    { code: "ARS", name: "Arsenal", gender: "men", nation: "England", league: "Premier League" },
    { code: "AVL", name: "Aston Villa", gender: "men", nation: "England", league: "Premier League" },
    { code: "BOU", name: "Bournemouth", gender: "men", nation: "England", league: "Premier League" },
    { code: "BRE", name: "Brentford", gender: "men", nation: "England", league: "Premier League" },
    { code: "BHA", name: "Brighton", gender: "men", nation: "England", league: "Premier League" },
    { code: "CHE", name: "Chelsea", gender: "men", nation: "England", league: "Premier League" },
    { code: "CRY", name: "Crystal Palace", gender: "men", nation: "England", league: "Premier League" },
    { code: "EVE", name: "Everton", gender: "men", nation: "England", league: "Premier League" },
    { code: "FUL", name: "Fulham", gender: "men", nation: "England", league: "Premier League" },
    { code: "LIV", name: "Liverpool", gender: "men", nation: "England", league: "Premier League" },
    { code: "MCI", name: "Man City", gender: "men", nation: "England", league: "Premier League" },
    { code: "MUN", name: "Man United", gender: "men", nation: "England", league: "Premier League" },
    { code: "NEW", name: "Newcastle", gender: "men", nation: "England", league: "Premier League" },
    { code: "NFO", name: "Nottingham Forest", gender: "men", nation: "England", league: "Premier League" },
    { code: "TOT", name: "Tottenham", gender: "men", nation: "England", league: "Premier League" },
    { code: "WHU", name: "West Ham", gender: "men", nation: "England", league: "Premier League" },
    /* Men · LaLiga */
    { code: "ATH", name: "Athletic Club", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "ATM", name: "Atlético Madrid", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "BAR", name: "Barcelona", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "BET", name: "Real Betis", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "GIR", name: "Girona", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "RMA", name: "Real Madrid", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "RSO", name: "Real Sociedad", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "SEV", name: "Sevilla", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "VAL", name: "Valencia", gender: "men", nation: "Spain", league: "LaLiga" },
    { code: "VIL", name: "Villarreal", gender: "men", nation: "Spain", league: "LaLiga" },
    /* Men · Serie A */
    { code: "ATA", name: "Atalanta", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "BOL", name: "Bologna", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "FIO", name: "Fiorentina", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "INT", name: "Inter", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "JUV", name: "Juventus", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "LAZ", name: "Lazio", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "MIL", name: "AC Milan", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "NAP", name: "Napoli", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "ROM", name: "Roma", gender: "men", nation: "Italy", league: "Serie A" },
    { code: "TOR", name: "Torino", gender: "men", nation: "Italy", league: "Serie A" },
    /* Men · Bundesliga */
    { code: "B04", name: "Bayer Leverkusen", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "BAY", name: "Bayern Munich", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "BVB", name: "Borussia Dortmund", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "BMG", name: "Mönchengladbach", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "SGE", name: "Eintracht Frankfurt", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "RBL", name: "RB Leipzig", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "SCF", name: "Freiburg", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "VFB", name: "Stuttgart", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "WOB", name: "Wolfsburg", gender: "men", nation: "Germany", league: "Bundesliga" },
    { code: "UNI", name: "Union Berlin", gender: "men", nation: "Germany", league: "Bundesliga" },
    /* Men · Ligue 1 */
    { code: "LIL", name: "Lille", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "OL", name: "Lyon", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "OM", name: "Marseille", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "ASM", name: "Monaco", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "PSG", name: "Paris Saint-Germain", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "REN", name: "Rennes", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "STR", name: "Strasbourg", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "TOU", name: "Toulouse", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "NAN", name: "Nantes", gender: "men", nation: "France", league: "Ligue 1" },
    { code: "NIC", name: "Nice", gender: "men", nation: "France", league: "Ligue 1" },
    /* Men · Eredivisie */
    { code: "AJX", name: "Ajax", gender: "men", nation: "Netherlands", league: "Eredivisie" },
    { code: "AZ", name: "AZ Alkmaar", gender: "men", nation: "Netherlands", league: "Eredivisie" },
    { code: "FEY", name: "Feyenoord", gender: "men", nation: "Netherlands", league: "Eredivisie" },
    { code: "PSV", name: "PSV", gender: "men", nation: "Netherlands", league: "Eredivisie" },
    /* Men · Primeira Liga */
    { code: "BEN", name: "Benfica", gender: "men", nation: "Portugal", league: "Primeira Liga" },
    { code: "POR", name: "Porto", gender: "men", nation: "Portugal", league: "Primeira Liga" },
    { code: "SCP", name: "Sporting CP", gender: "men", nation: "Portugal", league: "Primeira Liga" },
    { code: "BRA", name: "Braga", gender: "men", nation: "Portugal", league: "Primeira Liga" },
    /* Men · Saudi Pro League */
    { code: "HIL", name: "Al Hilal", gender: "men", nation: "Saudi Arabia", league: "Saudi Pro League" },
    { code: "NAS", name: "Al Nassr", gender: "men", nation: "Saudi Arabia", league: "Saudi Pro League" },
    { code: "ITT", name: "Al Ittihad", gender: "men", nation: "Saudi Arabia", league: "Saudi Pro League" },
    { code: "AHL", name: "Al Ahli", gender: "men", nation: "Saudi Arabia", league: "Saudi Pro League" },
    /* Men · MLS */
    { code: "MIA", name: "Inter Miami", gender: "men", nation: "USA", league: "MLS" },
    { code: "LAG", name: "LA Galaxy", gender: "men", nation: "USA", league: "MLS" },
    { code: "LAFC", name: "Los Angeles FC", gender: "men", nation: "USA", league: "MLS" },
    { code: "SEA", name: "Seattle Sounders", gender: "men", nation: "USA", league: "MLS" },
    /* Men · National teams */
    { code: "ARG", name: "Argentina", gender: "men", nation: "Argentina", league: "National teams" },
    { code: "BRAZ", name: "Brazil", gender: "men", nation: "Brazil", league: "National teams" },
    { code: "ENG", name: "England", gender: "men", nation: "England", league: "National teams" },
    { code: "FRA", name: "France", gender: "men", nation: "France", league: "National teams" },
    { code: "ESP", name: "Spain", gender: "men", nation: "Spain", league: "National teams" },
    { code: "GER", name: "Germany", gender: "men", nation: "Germany", league: "National teams" },
    /* Women · WSL */
    { code: "ARSW", name: "Arsenal Women", gender: "women", nation: "England", league: "Barclays WSL" },
    { code: "CHEW", name: "Chelsea Women", gender: "women", nation: "England", league: "Barclays WSL" },
    { code: "MCIW", name: "Man City Women", gender: "women", nation: "England", league: "Barclays WSL" },
    { code: "MUNW", name: "Man United Women", gender: "women", nation: "England", league: "Barclays WSL" },
    { code: "TOTW", name: "Tottenham Women", gender: "women", nation: "England", league: "Barclays WSL" },
    { code: "LIVW", name: "Liverpool Women", gender: "women", nation: "England", league: "Barclays WSL" },
    { code: "AVLW", name: "Aston Villa Women", gender: "women", nation: "England", league: "Barclays WSL" },
    { code: "EVEW", name: "Everton Women", gender: "women", nation: "England", league: "Barclays WSL" },
    /* Women · Liga F */
    { code: "BARW", name: "Barcelona Femení", gender: "women", nation: "Spain", league: "Liga F" },
    { code: "RMAW", name: "Real Madrid Femenino", gender: "women", nation: "Spain", league: "Liga F" },
    { code: "ATMW", name: "Atlético Femenino", gender: "women", nation: "Spain", league: "Liga F" },
    { code: "LEVW", name: "Levante Femení", gender: "women", nation: "Spain", league: "Liga F" },
    { code: "ATHW", name: "Athletic Club Femenino", gender: "women", nation: "Spain", league: "Liga F" },
    { code: "RSW", name: "Real Sociedad Femenino", gender: "women", nation: "Spain", league: "Liga F" },
    /* Women · Première Ligue */
    { code: "OLW", name: "Lyon Féminin", gender: "women", nation: "France", league: "Première Ligue" },
    { code: "PSGW", name: "PSG Féminin", gender: "women", nation: "France", league: "Première Ligue" },
    { code: "PARW", name: "Paris FC Féminin", gender: "women", nation: "France", league: "Première Ligue" },
    { code: "MONW", name: "Montpellier Féminin", gender: "women", nation: "France", league: "Première Ligue" },
    { code: "RENW", name: "Rennes Féminin", gender: "women", nation: "France", league: "Première Ligue" },
    { code: "DIJW", name: "Dijon Féminin", gender: "women", nation: "France", league: "Première Ligue" },
    /* Women · Frauen-Bundesliga */
    { code: "BAYW", name: "Bayern Women", gender: "women", nation: "Germany", league: "Frauen-Bundesliga" },
    { code: "WOBW", name: "Wolfsburg Women", gender: "women", nation: "Germany", league: "Frauen-Bundesliga" },
    { code: "SGFW", name: "Eintracht Women", gender: "women", nation: "Germany", league: "Frauen-Bundesliga" },
    { code: "HOFW", name: "Hoffenheim Women", gender: "women", nation: "Germany", league: "Frauen-Bundesliga" },
    { code: "RBLW", name: "RB Leipzig Women", gender: "women", nation: "Germany", league: "Frauen-Bundesliga" },
    { code: "FREW", name: "Freiburg Women", gender: "women", nation: "Germany", league: "Frauen-Bundesliga" },
    /* Women · Serie A Femminile */
    { code: "ROMW", name: "Roma Women", gender: "women", nation: "Italy", league: "Serie A Femminile" },
    { code: "JUVW", name: "Juventus Women", gender: "women", nation: "Italy", league: "Serie A Femminile" },
    { code: "INTW", name: "Inter Women", gender: "women", nation: "Italy", league: "Serie A Femminile" },
    { code: "MILW", name: "AC Milan Women", gender: "women", nation: "Italy", league: "Serie A Femminile" },
    { code: "FIOW", name: "Fiorentina Women", gender: "women", nation: "Italy", league: "Serie A Femminile" },
    /* Women · NWSL */
    { code: "PORW", name: "Portland Thorns", gender: "women", nation: "USA", league: "NWSL" },
    { code: "SEAW", name: "Seattle Reign", gender: "women", nation: "USA", league: "NWSL" },
    { code: "SDW", name: "San Diego Wave", gender: "women", nation: "USA", league: "NWSL" },
    { code: "GOTW", name: "Gotham FC", gender: "women", nation: "USA", league: "NWSL" },
    { code: "ORLW", name: "Orlando Pride", gender: "women", nation: "USA", league: "NWSL" },
    { code: "KCW", name: "Kansas City Current", gender: "women", nation: "USA", league: "NWSL" },
    /* Women · National teams */
    { code: "ENGW", name: "England Women", gender: "women", nation: "England", league: "National teams" },
    { code: "ESPW", name: "Spain Women", gender: "women", nation: "Spain", league: "National teams" },
    { code: "USAW", name: "USA Women", gender: "women", nation: "USA", league: "National teams" },
    { code: "GERW", name: "Germany Women", gender: "women", nation: "Germany", league: "National teams" },
    { code: "FRAW", name: "France Women", gender: "women", nation: "France", league: "National teams" },
    { code: "NEDW", name: "Netherlands Women", gender: "women", nation: "Netherlands", league: "National teams" }
  ];

  /* Team strength, sampled from the EA FC 27 club ratings.
     Shown only on the match overview; it also shifts the Elo projection. */
  const teamStars = {
    ARS: 5,
    AVL: 4,
    BOU: 3,
    BRE: 3,
    BHA: 4,
    CHE: 4,
    CRY: 3,
    EVE: 3,
    FUL: 3,
    LIV: 5,
    MCI: 5,
    MUN: 4,
    NEW: 4,
    NFO: 3,
    TOT: 4,
    WHU: 4,
    ATH: 4,
    ATM: 5,
    BAR: 5,
    BET: 4,
    GIR: 4,
    RMA: 5,
    RSO: 4,
    SEV: 4,
    VAL: 3,
    VIL: 4,
    ATA: 4,
    BOL: 4,
    FIO: 4,
    INT: 5,
    JUV: 4,
    LAZ: 4,
    MIL: 4,
    NAP: 4,
    ROM: 4,
    TOR: 3,
    B04: 4,
    BAY: 5,
    BVB: 4,
    BMG: 3,
    SGE: 4,
    RBL: 4,
    SCF: 3,
    VFB: 4,
    WOB: 3,
    UNI: 3,
    LIL: 4,
    OL: 4,
    OM: 4,
    ASM: 4,
    PSG: 5,
    REN: 3,
    STR: 3,
    TOU: 3,
    NAN: 3,
    NIC: 3,
    AJX: 4,
    AZ: 3,
    FEY: 3,
    PSV: 4,
    BEN: 4,
    POR: 4,
    SCP: 4,
    BRA: 4,
    HIL: 4,
    NAS: 4,
    ITT: 4,
    AHL: 4,
    MIA: 3,
    LAG: 3,
    LAFC: 3,
    SEA: 3,
    ARG: 5,
    BRAZ: 5,
    ENG: 5,
    FRA: 5,
    ESP: 5,
    GER: 4,
    ARSW: 5,
    CHEW: 5,
    MCIW: 5,
    MUNW: 4,
    TOTW: 4,
    LIVW: 4,
    AVLW: 3.5,
    EVEW: 3.5,
    BARW: 5,
    RMAW: 4,
    ATMW: 4,
    LEVW: 3.5,
    ATHW: 3.5,
    RSW: 3.5,
    OLW: 5,
    PSGW: 4,
    PARW: 4,
    MONW: 3.5,
    RENW: 3.5,
    DIJW: 3,
    BAYW: 5,
    WOBW: 4.5,
    SGFW: 4,
    HOFW: 3.5,
    RBLW: 4,
    FREW: 3.5,
    ROMW: 4,
    JUVW: 4.5,
    INTW: 4,
    MILW: 4,
    FIOW: 3.5,
    PORW: 4.5,
    SEAW: 4,
    SDW: 4,
    GOTW: 4,
    ORLW: 4,
    KCW: 4.5,
    ENGW: 5,
    ESPW: 5,
    USAW: 5,
    GERW: 4.5,
    FRAW: 4.5,
    NEDW: 4.5
  };

  const games = [
    { slug: "eafc27", name: "EA FC 27", live: true, tone: "eafc", blurb: "The FC 27 record book. Same rules, its own stats.", players: 8, matches: 48, scoring: "Shared", href: "game.html" },
    { slug: "eafc26", name: "EA FC 26", live: true, tone: "eafc26", blurb: "The FC 26 record book. Same rules, its own stats.", players: 8, matches: 64, scoring: "Shared", href: "game.html?game=eafc26" },
    { slug: "smash", name: "Super Smash Bros.", edition: "Ultimate", live: true, tone: "smash", blurb: "Characters, stages, and matchup ratings.", scoring: "Own", players: 8, matches: 36, href: "game.html?game=smash" },
    { slug: "tennis", name: "Tennis", edition: "Singles & doubles", live: true, tone: "tennis", blurb: "Sets, tie-breaks, and a season-long tour.", scoring: "Own", players: 8, matches: 42, href: "game.html?game=tennis" },
    { slug: "tt", name: "Table tennis", edition: "Singles", live: true, tone: "tt", blurb: "Point-by-point games and a club-night ladder.", scoring: "Own", players: 8, matches: 24, href: "game.html?game=tt" }
  ];

  /* ---- EA FC 27 ---- */
  const fc27 = {
    stats: { matches: 48, played: 38, pending: 3 },
    players: [
      { id: 1, name: "Alex Rivera", handle: "@arivera", initials: "AR", elo: 1432, peak: 1468, rank: 1, w: 31, d: 6, l: 11, gf: 112, ga: 74, form: "WWDWL", trend: 18, club: "ARS", teams: [{ code: "ARS", count: 9 }, { code: "RMA", count: 3 }, { code: "BAR", count: 2 }], flairs: ["Arsenal", "Season 3 champion"], since: "Sep 2025" },
      { id: 2, name: "Jordan Chen", handle: "@jchen", initials: "JC", elo: 1405, peak: 1441, rank: 2, w: 29, d: 8, l: 12, gf: 104, ga: 81, form: "WWWLW", trend: 12, club: "LIV", teams: [{ code: "LIV", count: 7 }, { code: "MCI", count: 5 }, { code: "BAY", count: 2 }], flairs: ["Liverpool", "Cup finalist"], since: "Sep 2025" },
      { id: 3, name: "Maya Okafor", handle: "@mokafor", initials: "MO", elo: 1388, peak: 1420, rank: 3, w: 27, d: 9, l: 13, gf: 98, ga: 79, form: "DWWLW", trend: 9, club: "MCI", teams: [{ code: "MCI", count: 7 }, { code: "ARS", count: 4 }, { code: "PSG", count: 3 }], flairs: ["Man City", "Best form"], since: "Oct 2025" },
      { id: 4, name: "Sam Patel", handle: "@spatel", initials: "SP", elo: 1361, peak: 1397, rank: 4, w: 24, d: 11, l: 15, gf: 91, ga: 84, form: "LWDWW", trend: -6, club: "RMA", teams: [{ code: "RMA", count: 7 }, { code: "ATM", count: 4 }, { code: "JUV", count: 3 }], flairs: ["Real Madrid"], since: "Oct 2025" },
      { id: 5, name: "Theo Nguyen", handle: "@tnguyen", initials: "TN", elo: 1344, peak: 1372, rank: 5, w: 23, d: 8, l: 19, gf: 87, ga: 83, form: "WLWDL", trend: 4, club: "BAR", teams: [{ code: "BAR", count: 8 }, { code: "INT", count: 3 }, { code: "BVB", count: 3 }], flairs: ["Barcelona"], since: "Sep 2025" },
      { id: 6, name: "Rosa Silva", handle: "@rsilva", initials: "RS", elo: 1319, peak: 1350, rank: 6, w: 21, d: 10, l: 18, gf: 82, ga: 80, form: "DWLWL", trend: -11, club: "BAY", teams: [{ code: "BAY", count: 7 }, { code: "RMA", count: 4 }, { code: "MIL", count: 3 }], flairs: ["Bayern", "Giant killer"], since: "Nov 2025" },
      { id: 7, name: "Kofi Mensah", handle: "@kmensah", initials: "KM", elo: 1291, peak: 1338, rank: 7, w: 19, d: 12, l: 20, gf: 78, ga: 86, form: "LLWDW", trend: 7, club: "PSG", teams: [{ code: "PSG", count: 8 }, { code: "LIV", count: 3 }, { code: "BAR", count: 3 }], flairs: ["PSG"], since: "Oct 2025" },
      { id: 8, name: "Lena Ortiz", handle: "@lortiz", initials: "LO", elo: 1268, peak: 1301, rank: 8, w: 18, d: 9, l: 23, gf: 74, ga: 89, form: "LWLLD", trend: -14, club: "INT", teams: [{ code: "INT", count: 8 }, { code: "JUV", count: 4 }, { code: "ATM", count: 2 }], flairs: ["Inter"], since: "Sep 2025" }
    ],
    matches: [
      { id: 101, date: "2026-11-08", time: "20:10", p1: 1, p2: 2, club1: "ARS", club2: "MCI", s1: 2, s2: 1, pens: null, aet: false, status: "locked", delta: 14, elo: true, league: "Winter League", submitted: "Alex Rivera", locked: "Game admin" },
      { id: 102, date: "2026-11-07", time: "19:30", p1: 3, p2: 4, club1: "MCI", club2: "RMA", s1: 2, s2: 2, pens: [5, 4], aet: true, status: "locked", delta: 6, elo: true, league: "Continental Cup", submitted: "Maya Okafor", locked: "Game admin" },
      { id: 103, date: "2026-11-06", time: "21:05", p1: 5, p2: 6, club1: "BAR", club2: "BAY", s1: 1, s2: 3, pens: null, aet: false, status: "locked", delta: -17, elo: true, league: "Winter League", submitted: "Rosa Silva", locked: "Game admin" },
      { id: 104, date: "2026-11-06", time: "18:45", p1: 7, p2: 8, club1: "PSG", club2: "INT", s1: 4, s2: 2, pens: null, aet: false, status: "pending", delta: null, elo: true, league: "Winter League", submitted: "Kofi Mensah", locked: null },
      { id: 105, date: "2026-11-05", time: "20:00", p1: 1, p2: 4, club1: "RMA", club2: "ATM", s1: 1, s2: 1, pens: null, aet: false, status: "pending", delta: null, elo: true, league: "Winter League", submitted: "Sam Patel", locked: null },
      { id: 106, date: "2026-11-03", time: "19:15", p1: 2, p2: 5, club1: "LIV", club2: "BAR", s1: 3, s2: 0, pens: null, aet: false, status: "locked", delta: 13, elo: true, league: "Friday Knockout", submitted: "Jordan Chen", locked: "Game admin" },
      { id: 107, date: "2026-11-02", time: "22:00", p1: 3, p2: 1, club1: "MCI", club2: "ARS", s1: 0, s2: 2, pens: null, aet: false, status: "locked", delta: -15, elo: true, league: "Winter League", submitted: "Alex Rivera", locked: "Game admin" },
      { id: 108, date: "2026-10-30", time: "20:40", p1: 8, p2: 7, club1: "INT", club2: "PSG", s1: 2, s2: 2, pens: null, aet: true, status: "pending", delta: null, elo: true, league: "Continental Cup", submitted: "Lena Ortiz", locked: null },
      { id: 109, date: "2026-10-28", time: "19:50", p1: 6, p2: 3, club1: "BAY", club2: "MCI", s1: 1, s2: 0, pens: null, aet: false, status: "locked", delta: 11, elo: true, league: "Winter League", submitted: "Rosa Silva", locked: "Game admin" },
      { id: 110, date: "2026-10-27", time: "21:20", p1: 4, p2: 2, club1: "RMA", club2: "LIV", s1: 3, s2: 3, pens: [4, 5], aet: true, status: "locked", delta: -5, elo: true, league: "Continental Cup", submitted: "Jordan Chen", locked: "Game admin" }
    ],
    standings: [
      { p: 1, name: "Alex Rivera", initials: "AR", pld: 14, w: 10, d: 2, l: 2, gf: 31, ga: 18, gd: 13, pts: 32, form: "WWDWL" },
      { p: 2, name: "Jordan Chen", initials: "JC", pld: 14, w: 9, d: 2, l: 3, gf: 29, ga: 20, gd: 9, pts: 29, form: "WWWLW" },
      { p: 3, name: "Maya Okafor", initials: "MO", pld: 14, w: 8, d: 3, l: 3, gf: 27, ga: 19, gd: 8, pts: 27, form: "DWWLW" },
      { p: 4, name: "Sam Patel", initials: "SP", pld: 14, w: 7, d: 3, l: 4, gf: 25, ga: 22, gd: 3, pts: 24, form: "LWDWW" },
      { p: 5, name: "Theo Nguyen", initials: "TN", pld: 14, w: 6, d: 2, l: 6, gf: 23, ga: 23, gd: 0, pts: 20, form: "WLWDL" },
      { p: 6, name: "Rosa Silva", initials: "RS", pld: 14, w: 5, d: 3, l: 6, gf: 21, ga: 22, gd: -1, pts: 18, form: "DWLWL" },
      { p: 7, name: "Kofi Mensah", initials: "KM", pld: 14, w: 4, d: 3, l: 7, gf: 19, ga: 25, gd: -6, pts: 15, form: "LLWDW" },
      { p: 8, name: "Lena Ortiz", initials: "LO", pld: 14, w: 2, d: 2, l: 10, gf: 15, ga: 31, gd: -16, pts: 8, form: "LWLLD" }
    ],
    groups: {
      a: [
        { name: "Alex Rivera", initials: "AR", p: 3, w: 3, d: 0, l: 0, gf: 8, ga: 2, gd: 6, pts: 9 },
        { name: "Maya Okafor", initials: "MO", p: 3, w: 2, d: 1, l: 0, gf: 7, ga: 3, gd: 4, pts: 7 },
        { name: "Theo Nguyen", initials: "TN", p: 3, w: 1, d: 0, l: 2, gf: 4, ga: 5, gd: -1, pts: 3 },
        { name: "Lena Ortiz", initials: "LO", p: 3, w: 0, d: 0, l: 3, gf: 2, ga: 8, gd: -6, pts: 0 }
      ],
      b: [
        { name: "Jordan Chen", initials: "JC", p: 3, w: 2, d: 1, l: 0, gf: 7, ga: 3, gd: 4, pts: 7 },
        { name: "Sam Patel", initials: "SP", p: 3, w: 2, d: 0, l: 1, gf: 6, ga: 4, gd: 2, pts: 6 },
        { name: "Rosa Silva", initials: "RS", p: 3, w: 1, d: 1, l: 1, gf: 5, ga: 5, gd: 0, pts: 4 },
        { name: "Kofi Mensah", initials: "KM", p: 3, w: 0, d: 0, l: 3, gf: 2, ga: 8, gd: -6, pts: 0 }
      ]
    },
    fixtures: [
      { date: "12 Dec", stage: "Final", home: "Alex Rivera", away: "Jordan Chen", score: "2–1", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Alex Rivera", away: "Sam Patel", score: "3–1", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Jordan Chen", away: "Maya Okafor", score: "2–0", status: "locked" },
      { date: "28 Nov", stage: "Group A", home: "Alex Rivera", away: "Maya Okafor", score: "2–1", status: "locked" },
      { date: "28 Nov", stage: "Group B", home: "Jordan Chen", away: "Sam Patel", score: "1–0", status: "locked" },
      { date: "21 Nov", stage: "Group A", home: "Theo Nguyen", away: "Lena Ortiz", score: "2–0", status: "locked" },
      { date: "21 Nov", stage: "Group B", home: "Rosa Silva", away: "Kofi Mensah", score: "2–1", status: "locked" }
    ],
    competitions: [
      { id: "winter", name: "Winter League", kind: "League", format: "Double round robin", players: 8, fixtures: 56, played: 38, leader: "Alex Rivera", elo: true, status: "In progress" },
      { id: "continental", name: "Continental Cup", kind: "Tournament", format: "Groups → knockout", players: 8, fixtures: 16, played: 16, leader: "Alex Rivera", elo: true, status: "Complete" },
      { id: "friday", name: "Friday Knockout", kind: "Tournament", format: "Single elimination", players: 8, fixtures: 8, played: 8, leader: "Jordan Chen", elo: true, status: "Complete" }
    ],
    activity: [
      { icon: "check", title: "Alex Rivera approved 2–1 vs Jordan Chen", sub: "Winter League · +14 Elo", time: "2h ago" },
      { icon: "clock", title: "Kofi Mensah submitted 4–2 vs Lena Ortiz", sub: "Waiting for a game admin", time: "5h ago" },
      { icon: "trophy", title: "Continental Cup final is set", sub: "Alex Rivera vs Jordan Chen · 12 Dec", time: "Yesterday" },
      { icon: "chart", title: "Ratings published for 6 matches", sub: "Peak movement: Maya Okafor +9", time: "2 days ago" }
    ]
  };

  /* ---- EA FC 26 ---- */
  const fc26 = {
    stats: { matches: 64, played: 52, pending: 2 },
    players: [
      { id: 1, name: "Alex Rivera", handle: "@arivera", initials: "AR", elo: 1460, peak: 1499, rank: 3, w: 36, d: 8, l: 14, gf: 126, ga: 95, form: "WLWWW", trend: 9, club: "ARS", teams: [{ code: "ARS", count: 7 }, { code: "RMA", count: 6 }, { code: "BAR", count: 5 }], flairs: ["Arsenal", "FC 26 cup finalist"], since: "Sep 2025" },
      { id: 2, name: "Jordan Chen", handle: "@jchen", initials: "JC", elo: 1512, peak: 1540, rank: 1, w: 42, d: 7, l: 9, gf: 140, ga: 82, form: "WWDWW", trend: 21, club: "LIV", teams: [{ code: "LIV", count: 12 }, { code: "MCI", count: 4 }, { code: "BAY", count: 2 }], flairs: ["Liverpool", "FC 26 champion"], since: "Sep 2025" },
      { id: 3, name: "Maya Okafor", handle: "@mokafor", initials: "MO", elo: 1488, peak: 1502, rank: 2, w: 38, d: 9, l: 11, gf: 131, ga: 90, form: "WDWWW", trend: 14, club: "MCI", teams: [{ code: "MCI", count: 11 }, { code: "ARS", count: 4 }, { code: "PSG", count: 3 }], flairs: ["Man City", "FC 26 finalist"], since: "Oct 2025" },
      { id: 4, name: "Sam Patel", handle: "@spatel", initials: "SP", elo: 1405, peak: 1442, rank: 5, w: 29, d: 11, l: 18, gf: 110, ga: 104, form: "LWDWW", trend: -5, club: "RMA", teams: [{ code: "RMA", count: 9 }, { code: "ATM", count: 5 }, { code: "JUV", count: 4 }], flairs: ["Real Madrid"], since: "Oct 2025" },
      { id: 5, name: "Theo Nguyen", handle: "@tnguyen", initials: "TN", elo: 1378, peak: 1410, rank: 6, w: 26, d: 10, l: 22, gf: 102, ga: 110, form: "WLLDW", trend: -2, club: "BAR", teams: [{ code: "BAR", count: 10 }, { code: "INT", count: 5 }, { code: "BVB", count: 3 }], flairs: ["Barcelona"], since: "Sep 2025" },
      { id: 6, name: "Rosa Silva", handle: "@rsilva", initials: "RS", elo: 1431, peak: 1460, rank: 4, w: 32, d: 10, l: 16, gf: 119, ga: 101, form: "DWWLW", trend: 11, club: "BAY", teams: [{ code: "BAY", count: 10 }, { code: "RMA", count: 5 }, { code: "MIL", count: 3 }], flairs: ["Bayern", "Giant killer"], since: "Nov 2025" },
      { id: 7, name: "Kofi Mensah", handle: "@kmensah", initials: "KM", elo: 1349, peak: 1390, rank: 7, w: 23, d: 8, l: 27, gf: 96, ga: 118, form: "LLWDL", trend: -12, club: "PSG", teams: [{ code: "PSG", count: 8 }, { code: "LIV", count: 6 }, { code: "BAR", count: 4 }], flairs: ["PSG"], since: "Oct 2025" },
      { id: 8, name: "Lena Ortiz", handle: "@lortiz", initials: "LO", elo: 1312, peak: 1350, rank: 8, w: 18, d: 7, l: 33, gf: 82, ga: 131, form: "LLLDL", trend: -18, club: "INT", teams: [{ code: "INT", count: 9 }, { code: "JUV", count: 5 }, { code: "ATM", count: 4 }], flairs: ["Inter"], since: "Sep 2025" }
    ],
    matches: [
      { id: 201, date: "2026-11-09", time: "20:30", p1: 2, p2: 1, club1: "LIV", club2: "BAR", s1: 3, s2: 0, pens: null, aet: false, status: "locked", delta: 16, elo: true, league: "FC 26 League", submitted: "Jordan Chen", locked: "Game admin" },
      { id: 202, date: "2026-11-08", time: "19:10", p1: 3, p2: 6, club1: "MCI", club2: "BAY", s1: 2, s2: 2, pens: [4, 5], aet: true, status: "locked", delta: -6, elo: true, league: "FC 26 Cup", submitted: "Maya Okafor", locked: "Game admin" },
      { id: 203, date: "2026-11-07", time: "21:00", p1: 4, p2: 5, club1: "ATM", club2: "BAR", s1: 1, s2: 2, pens: null, aet: false, status: "locked", delta: -9, elo: true, league: "FC 26 League", submitted: "Sam Patel", locked: "Game admin" },
      { id: 204, date: "2026-11-06", time: "18:50", p1: 7, p2: 8, club1: "PSG", club2: "INT", s1: 4, s2: 1, pens: null, aet: false, status: "pending", delta: null, elo: true, league: "FC 26 League", submitted: "Kofi Mensah", locked: null },
      { id: 205, date: "2026-11-05", time: "20:15", p1: 1, p2: 2, club1: "RMA", club2: "MCI", s1: 2, s2: 1, pens: null, aet: false, status: "locked", delta: 11, elo: true, league: "FC 26 Cup", submitted: "Alex Rivera", locked: "Game admin" },
      { id: 206, date: "2026-11-03", time: "19:35", p1: 6, p2: 3, club1: "RMA", club2: "ARS", s1: 0, s2: 3, pens: null, aet: false, status: "locked", delta: -12, elo: true, league: "FC 26 League", submitted: "Rosa Silva", locked: "Game admin" },
      { id: 207, date: "2026-11-02", time: "21:40", p1: 5, p2: 4, club1: "INT", club2: "RMA", s1: 2, s2: 2, pens: null, aet: true, status: "pending", delta: null, elo: true, league: "FC 26 Cup", submitted: "Theo Nguyen", locked: null },
      { id: 208, date: "2026-10-30", time: "20:05", p1: 8, p2: 1, club1: "JUV", club2: "BAR", s1: 1, s2: 5, pens: null, aet: false, status: "locked", delta: -15, elo: true, league: "FC 26 League", submitted: "Lena Ortiz", locked: "Game admin" },
      { id: 209, date: "2026-10-28", time: "19:20", p1: 2, p2: 7, club1: "BAY", club2: "LIV", s1: 2, s2: 0, pens: null, aet: false, status: "locked", delta: 10, elo: true, league: "FC 26 Cup", submitted: "Jordan Chen", locked: "Game admin" },
      { id: 210, date: "2026-10-27", time: "21:25", p1: 4, p2: 5, club1: "JUV", club2: "BAR", s1: 3, s2: 3, pens: [5, 4], aet: true, status: "locked", delta: 4, elo: true, league: "FC 26 League", submitted: "Sam Patel", locked: "Game admin" }
    ],
    standings: [
      { p: 1, name: "Jordan Chen", initials: "JC", pld: 18, w: 12, d: 3, l: 3, gf: 41, ga: 22, gd: 19, pts: 39, form: "WWDWW" },
      { p: 2, name: "Maya Okafor", initials: "MO", pld: 18, w: 11, d: 4, l: 3, gf: 38, ga: 24, gd: 14, pts: 37, form: "WDWWW" },
      { p: 3, name: "Alex Rivera", initials: "AR", pld: 18, w: 10, d: 4, l: 4, gf: 35, ga: 26, gd: 9, pts: 34, form: "WLWWW" },
      { p: 4, name: "Rosa Silva", initials: "RS", pld: 18, w: 9, d: 4, l: 5, gf: 32, ga: 28, gd: 4, pts: 31, form: "DWWLW" },
      { p: 5, name: "Sam Patel", initials: "SP", pld: 18, w: 7, d: 4, l: 7, gf: 29, ga: 30, gd: -1, pts: 25, form: "LWDWW" },
      { p: 6, name: "Theo Nguyen", initials: "TN", pld: 18, w: 6, d: 3, l: 9, gf: 25, ga: 33, gd: -8, pts: 21, form: "WLLDW" },
      { p: 7, name: "Kofi Mensah", initials: "KM", pld: 18, w: 3, d: 4, l: 11, gf: 21, ga: 39, gd: -18, pts: 13, form: "LLWDL" },
      { p: 8, name: "Lena Ortiz", initials: "LO", pld: 18, w: 1, d: 2, l: 15, gf: 16, ga: 47, gd: -31, pts: 5, form: "LLLDL" }
    ],
    groups: {
      a: [
        { name: "Jordan Chen", initials: "JC", p: 3, w: 3, d: 0, l: 0, gf: 9, ga: 2, gd: 7, pts: 9 },
        { name: "Maya Okafor", initials: "MO", p: 3, w: 2, d: 1, l: 0, gf: 7, ga: 3, gd: 4, pts: 7 },
        { name: "Sam Patel", initials: "SP", p: 3, w: 1, d: 0, l: 2, gf: 4, ga: 6, gd: -2, pts: 3 },
        { name: "Lena Ortiz", initials: "LO", p: 3, w: 0, d: 0, l: 3, gf: 2, ga: 9, gd: -7, pts: 0 }
      ],
      b: [
        { name: "Alex Rivera", initials: "AR", p: 3, w: 2, d: 1, l: 0, gf: 8, ga: 3, gd: 5, pts: 7 },
        { name: "Rosa Silva", initials: "RS", p: 3, w: 2, d: 0, l: 1, gf: 6, ga: 4, gd: 2, pts: 6 },
        { name: "Theo Nguyen", initials: "TN", p: 3, w: 1, d: 1, l: 1, gf: 5, ga: 5, gd: 0, pts: 4 },
        { name: "Kofi Mensah", initials: "KM", p: 3, w: 0, d: 0, l: 3, gf: 2, ga: 9, gd: -7, pts: 0 }
      ]
    },
    fixtures: [
      { date: "12 Dec", stage: "Final", home: "Jordan Chen", away: "Maya Okafor", score: "2–0", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Jordan Chen", away: "Rosa Silva", score: "3–1", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Maya Okafor", away: "Alex Rivera", score: "2–1", status: "locked" },
      { date: "28 Nov", stage: "Group A", home: "Jordan Chen", away: "Maya Okafor", score: "2–1", status: "locked" },
      { date: "28 Nov", stage: "Group B", home: "Alex Rivera", away: "Rosa Silva", score: "1–0", status: "locked" },
      { date: "21 Nov", stage: "Group A", home: "Sam Patel", away: "Lena Ortiz", score: "2–0", status: "locked" },
      { date: "21 Nov", stage: "Group B", home: "Theo Nguyen", away: "Kofi Mensah", score: "2–1", status: "locked" }
    ],
    competitions: [
      { id: "winter", name: "FC 26 League", kind: "League", format: "Double round robin", players: 8, fixtures: 56, played: 42, leader: "Jordan Chen", elo: true, status: "In progress" },
      { id: "continental", name: "FC 26 Cup", kind: "Tournament", format: "Groups → knockout", players: 8, fixtures: 16, played: 16, leader: "Jordan Chen", elo: true, status: "Complete" },
      { id: "friday", name: "FC 26 Knockout", kind: "Tournament", format: "Single elimination", players: 8, fixtures: 8, played: 8, leader: "Jordan Chen", elo: true, status: "Complete" }
    ],
    activity: [
      { icon: "check", title: "Jordan Chen approved 3–0 vs Alex Rivera", sub: "FC 26 League · +16 Elo", time: "1h ago" },
      { icon: "clock", title: "Kofi Mensah submitted 4–1 vs Lena Ortiz", sub: "Waiting for a game admin", time: "4h ago" },
      { icon: "trophy", title: "FC 26 Cup final is set", sub: "Jordan Chen vs Maya Okafor · 12 Dec", time: "Yesterday" },
      { icon: "chart", title: "Ratings published for 8 matches", sub: "Peak movement: Maya Okafor +11", time: "2 days ago" }
    ]
  };

  /* ---- Tennis ---- */
  const tennis = {
    stats: { matches: 42, played: 34, pending: 2 },
    players: [
      { id: 1, name: "Alex Rivera", handle: "@arivera", initials: "AR", nation: "United States", flag: "USA", tier: "Elite",
        elo: 1510, peak: 1544, rank: 1, eloD: 1460, peakD: 1495, rankD: 2,
        w: 18, l: 7, d: 0, setsW: 40, setsL: 19, gamesW: 334, gamesL: 260, form: "WWWLW", trend: 16, trendD: 9,
        flairs: ["Grass specialist", "Club champion"], since: "Mar 2025" },
      { id: 3, name: "Maya Okafor", handle: "@mokafor", initials: "MO", nation: "Nigeria", flag: "NGA", tier: "Elite",
        elo: 1496, peak: 1512, rank: 2, eloD: 1410, peakD: 1434, rankD: 4,
        w: 17, l: 8, d: 0, setsW: 38, setsL: 21, gamesW: 321, gamesL: 271, form: "WWLWW", trend: 12, trendD: -4,
        flairs: ["Big server", "Doubles semifinalist"], since: "Apr 2025" },
      { id: 2, name: "Jordan Chen", handle: "@jchen", initials: "JC", nation: "Canada", flag: "CAN", tier: "Contender",
        elo: 1472, peak: 1499, rank: 3, eloD: 1488, peakD: 1520, rankD: 1,
        w: 16, l: 9, d: 0, setsW: 36, setsL: 24, gamesW: 310, gamesL: 280, form: "WLWWW", trend: 8, trendD: 18,
        flairs: ["Doubles champion", "Net player"], since: "Mar 2025" },
      { id: 6, name: "Rosa Silva", handle: "@rsilva", initials: "RS", nation: "Spain", flag: "ESP", tier: "Contender",
        elo: 1440, peak: 1466, rank: 4, eloD: 1450, peakD: 1478, rankD: 3,
        w: 15, l: 10, d: 0, setsW: 34, setsL: 25, gamesW: 305, gamesL: 285, form: "LWWLW", trend: -3, trendD: 11,
        flairs: ["Clay specialist", "Friday Mixer champion"], since: "May 2025" },
      { id: 4, name: "Sam Patel", handle: "@spatel", initials: "SP", nation: "Great Britain", flag: "GBR", tier: "Challenger",
        elo: 1395, peak: 1422, rank: 5, eloD: 1360, peakD: 1390, rankD: 6,
        w: 12, l: 13, d: 0, setsW: 28, setsL: 30, gamesW: 268, gamesL: 278, form: "WLWLL", trend: -7, trendD: 3,
        flairs: ["All-court player"], since: "Apr 2025" },
      { id: 5, name: "Theo Nguyen", handle: "@tnguyen", initials: "TN", nation: "France", flag: "FRA", tier: "Challenger",
        elo: 1371, peak: 1398, rank: 6, eloD: 1390, peakD: 1412, rankD: 5,
        w: 11, l: 14, d: 0, setsW: 26, setsL: 32, gamesW: 259, gamesL: 284, form: "LWLWW", trend: 5, trendD: 6,
        flairs: ["Speed merchant"], since: "Jun 2025" },
      { id: 7, name: "Kofi Mensah", handle: "@kmensah", initials: "KM", nation: "Ghana", flag: "GHA", tier: "Rookie",
        elo: 1318, peak: 1345, rank: 7, eloD: 1342, peakD: 1366, rankD: 7,
        w: 8, l: 17, d: 0, setsW: 20, setsL: 37, gamesW: 238, gamesL: 312, form: "LLWLL", trend: -11, trendD: -5,
        flairs: ["Power hitter"], since: "Jul 2025" },
      { id: 8, name: "Lena Ortiz", handle: "@lortiz", initials: "LO", nation: "Mexico", flag: "MEX", tier: "Rookie",
        elo: 1294, peak: 1321, rank: 8, eloD: 1305, peakD: 1338, rankD: 8,
        w: 6, l: 19, d: 0, setsW: 16, setsL: 40, gamesW: 221, gamesL: 320, form: "WLLLL", trend: -14, trendD: -9,
        flairs: ["Leftie"], since: "Aug 2025" }
    ],
    matches: [
      { id: 301, date: "2026-11-09", time: "18:30", format: "singles", p1: 1, p2: 3, surface: "Hardcourt", sets: [{ a: 6, b: 4 }, { a: 7, b: 6, tb: 5 }], status: "locked", delta: 11, elo: true, league: "Summer Tour", submitted: "Alex Rivera", locked: "Game admin" },
      { id: 302, date: "2026-11-08", time: "19:15", format: "doubles", team1: [2, 5], team2: [4, 6], surface: "Clay", sets: [{ a: 6, b: 2 }, { a: 6, b: 3 }], status: "locked", delta: 14, elo: true, league: "Club Open", submitted: "Jordan Chen", locked: "Game admin" },
      { id: 303, date: "2026-11-07", time: "20:00", format: "singles", p1: 6, p2: 2, surface: "Grass", sets: [{ a: 6, b: 7, tb: 4 }, { a: 6, b: 4 }, { a: 3, b: 6 }, { a: 4, b: 6 }], status: "locked", delta: -16, elo: true, league: "Summer Tour", submitted: "Rosa Silva", locked: "Game admin" },
      { id: 304, date: "2026-11-06", time: "21:10", format: "singles", p1: 4, p2: 8, surface: "Hardcourt", sets: [{ a: 6, b: 1 }, { a: 6, b: 0 }], status: "pending", delta: null, elo: true, league: "Summer Tour", submitted: "Sam Patel", locked: null },
      { id: 305, date: "2026-11-05", time: "18:45", format: "doubles", team1: [1, 7], team2: [3, 8], surface: "Hardcourt", sets: [{ a: 6, b: 4 }, { a: 6, b: 7, tb: 6 }, { a: 10, b: 8 }], status: "pending", delta: null, elo: true, league: "Club Open", submitted: "Kofi Mensah", locked: null },
      { id: 306, date: "2026-11-03", time: "19:30", format: "singles", p1: 2, p2: 5, surface: "Hardcourt", sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }], status: "locked", delta: 18, elo: true, league: "Friday Mixer", submitted: "Jordan Chen", locked: "Game admin" },
      { id: 307, date: "2026-11-02", time: "20:20", format: "singles", p1: 3, p2: 1, surface: "Clay", sets: [{ a: 7, b: 6, tb: 8 }, { a: 7, b: 6, tb: 4 }], status: "locked", delta: 5, elo: true, league: "Summer Tour", submitted: "Maya Okafor", locked: "Game admin" },
      { id: 308, date: "2026-10-30", time: "19:00", format: "doubles", team1: [6, 8], team2: [4, 5], surface: "Grass", sets: [{ a: 6, b: 3 }, { a: 4, b: 6 }, { a: 6, b: 4 }], status: "pending", delta: null, elo: true, league: "Club Open", submitted: "Lena Ortiz", locked: null },
      { id: 309, date: "2026-10-28", time: "20:40", format: "singles", p1: 1, p2: 7, surface: "Hardcourt", sets: [{ a: 6, b: 2 }, { a: 6, b: 3 }], status: "locked", delta: 9, elo: true, league: "Summer Tour", submitted: "Alex Rivera", locked: "Game admin" },
      { id: 310, date: "2026-10-27", time: "19:50", format: "singles", p1: 6, p2: 3, surface: "Clay", sets: [{ a: 6, b: 7, tb: 3 }, { a: 6, b: 2 }, { a: 2, b: 6 }, { a: 6, b: 4 }], status: "locked", delta: -7, elo: true, league: "Friday Mixer", submitted: "Rosa Silva", locked: "Game admin" }
    ],
    standings: [
      { p: 1, name: "Alex Rivera", initials: "AR", pld: 16, w: 13, d: 0, l: 3, gf: 27, ga: 11, gd: 16, pts: 26, form: "WWWLW" },
      { p: 2, name: "Maya Okafor", initials: "MO", pld: 16, w: 12, d: 0, l: 4, gf: 26, ga: 13, gd: 13, pts: 24, form: "WWLWW" },
      { p: 3, name: "Jordan Chen", initials: "JC", pld: 16, w: 11, d: 0, l: 5, gf: 24, ga: 15, gd: 9, pts: 22, form: "WLWWW" },
      { p: 4, name: "Rosa Silva", initials: "RS", pld: 16, w: 10, d: 0, l: 6, gf: 22, ga: 16, gd: 6, pts: 20, form: "LWWLW" },
      { p: 5, name: "Sam Patel", initials: "SP", pld: 16, w: 8, d: 0, l: 8, gf: 18, ga: 18, gd: 0, pts: 16, form: "WLWLL" },
      { p: 6, name: "Theo Nguyen", initials: "TN", pld: 16, w: 7, d: 0, l: 9, gf: 16, ga: 19, gd: -3, pts: 14, form: "LWLWW" },
      { p: 7, name: "Kofi Mensah", initials: "KM", pld: 16, w: 5, d: 0, l: 11, gf: 12, ga: 23, gd: -11, pts: 10, form: "LLWLL" },
      { p: 8, name: "Lena Ortiz", initials: "LO", pld: 16, w: 3, d: 0, l: 13, gf: 8, ga: 27, gd: -19, pts: 6, form: "WLLLL" }
    ],
    groups: {
      a: [
        { name: "Alex Rivera", initials: "AR", p: 3, w: 3, d: 0, l: 0, gf: 6, ga: 1, gd: 5, pts: 6 },
        { name: "Rosa Silva", initials: "RS", p: 3, w: 2, d: 0, l: 1, gf: 4, ga: 3, gd: 1, pts: 4 },
        { name: "Sam Patel", initials: "SP", p: 3, w: 1, d: 0, l: 2, gf: 3, ga: 4, gd: -1, pts: 2 },
        { name: "Lena Ortiz", initials: "LO", p: 3, w: 0, d: 0, l: 3, gf: 1, ga: 6, gd: -5, pts: 0 }
      ],
      b: [
        { name: "Jordan Chen", initials: "JC", p: 3, w: 3, d: 0, l: 0, gf: 6, ga: 1, gd: 5, pts: 6 },
        { name: "Maya Okafor", initials: "MO", p: 3, w: 2, d: 0, l: 1, gf: 4, ga: 3, gd: 1, pts: 4 },
        { name: "Theo Nguyen", initials: "TN", p: 3, w: 1, d: 0, l: 2, gf: 3, ga: 4, gd: -1, pts: 2 },
        { name: "Kofi Mensah", initials: "KM", p: 3, w: 0, d: 0, l: 3, gf: 1, ga: 6, gd: -5, pts: 0 }
      ]
    },
    fixtures: [
      { date: "12 Dec", stage: "Final", home: "Jordan Chen", away: "Alex Rivera", score: "6–4 7–6", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Jordan Chen", away: "Rosa Silva", score: "6–3 6–4", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Alex Rivera", away: "Maya Okafor", score: "7–5 6–7 6–4", status: "locked" },
      { date: "28 Nov", stage: "Group A", home: "Alex Rivera", away: "Rosa Silva", score: "6–4 6–2", status: "locked" },
      { date: "28 Nov", stage: "Group B", home: "Jordan Chen", away: "Maya Okafor", score: "6–4 6–3", status: "locked" },
      { date: "21 Nov", stage: "Group A", home: "Sam Patel", away: "Lena Ortiz", score: "6–2 6–1", status: "locked" },
      { date: "21 Nov", stage: "Group B", home: "Theo Nguyen", away: "Kofi Mensah", score: "6–4 4–6 6–3", status: "locked" }
    ],
    competitions: [
      { id: "summer", name: "Summer Tour", kind: "League", format: "Double round robin", players: 8, fixtures: 56, played: 34, leader: "Alex Rivera", elo: true, status: "In progress" },
      { id: "clubopen", name: "Club Open", kind: "Tournament", format: "Groups → knockout", players: 8, fixtures: 16, played: 16, leader: "Jordan Chen", elo: true, status: "Complete" },
      { id: "mixer", name: "Friday Mixer", kind: "Tournament", format: "Single elimination", players: 8, fixtures: 8, played: 8, leader: "Rosa Silva", elo: true, status: "Complete" }
    ],
    activity: [
      { icon: "check", title: "Alex Rivera approved 6–4 7–6 vs Maya Okafor", sub: "Summer Tour · +11 Elo", time: "2h ago" },
      { icon: "clock", title: "Sam Patel submitted 6–1 6–0 vs Lena Ortiz", sub: "Waiting for a game admin", time: "5h ago" },
      { icon: "trophy", title: "Club Open final is set", sub: "Jordan Chen vs Alex Rivera · 12 Dec", time: "Yesterday" },
      { icon: "chart", title: "Doubles ratings published", sub: "Jordan Chen +18 · Rosa Silva +11", time: "2 days ago" }
    ]
  };

  /* ---- Table Tennis ---- */
  const tableTennis = {
    stats: { matches: 24, played: 20, pending: 1 },
    players: [
      { id: 1, name: "Alex Rivera", handle: "@arivera", initials: "AR", nation: "United States", flag: "USA", tier: "Elite", elo: 1518, peak: 1542, rank: 1, w: 14, l: 4, d: 0, setsW: 43, setsL: 20, gamesW: 43, gamesL: 20, form: "WWLWW", trend: 18, flairs: ["Topspin specialist"], since: "Mar 2025" },
      { id: 2, name: "Jordan Chen", handle: "@jchen", initials: "JC", nation: "Canada", flag: "CAN", tier: "Elite", elo: 1492, peak: 1510, rank: 2, w: 13, l: 5, d: 0, setsW: 39, setsL: 22, gamesW: 39, gamesL: 22, form: "WWWLW", trend: 11, flairs: ["Fast hands"], since: "Mar 2025" },
      { id: 3, name: "Maya Okafor", handle: "@mokafor", initials: "MO", nation: "Nigeria", flag: "NGA", tier: "Contender", elo: 1468, peak: 1489, rank: 3, w: 12, l: 6, d: 0, setsW: 38, setsL: 27, gamesW: 38, gamesL: 27, form: "WLWWW", trend: 8, flairs: ["Backhand attack"], since: "Apr 2025" },
      { id: 4, name: "Sam Patel", handle: "@spatel", initials: "SP", nation: "Great Britain", flag: "GBR", tier: "Contender", elo: 1433, peak: 1455, rank: 4, w: 10, l: 8, d: 0, setsW: 34, setsL: 30, gamesW: 34, gamesL: 30, form: "LWWLW", trend: 2, flairs: ["Control player"], since: "Apr 2025" },
      { id: 5, name: "Theo Nguyen", handle: "@tnguyen", initials: "TN", nation: "France", flag: "FRA", tier: "Challenger", elo: 1396, peak: 1418, rank: 5, w: 9, l: 9, d: 0, setsW: 31, setsL: 32, gamesW: 31, gamesL: 32, form: "WLWLL", trend: -3, flairs: ["Serve specialist"], since: "Jun 2025" },
      { id: 6, name: "Rosa Silva", handle: "@rsilva", initials: "RS", nation: "Spain", flag: "ESP", tier: "Challenger", elo: 1374, peak: 1402, rank: 6, w: 8, l: 10, d: 0, setsW: 29, setsL: 36, gamesW: 29, gamesL: 36, form: "LLWWW", trend: -5, flairs: ["Counter attacker"], since: "May 2025" },
      { id: 7, name: "Kofi Mensah", handle: "@kmensah", initials: "KM", nation: "Ghana", flag: "GHA", tier: "Rookie", elo: 1329, peak: 1353, rank: 7, w: 6, l: 12, d: 0, setsW: 24, setsL: 40, gamesW: 24, gamesL: 40, form: "LWLLL", trend: -9, flairs: ["Power loop"], since: "Jul 2025" },
      { id: 8, name: "Lena Ortiz", handle: "@lortiz", initials: "LO", nation: "Mexico", flag: "MEX", tier: "Rookie", elo: 1290, peak: 1320, rank: 8, w: 4, l: 14, d: 0, setsW: 18, setsL: 44, gamesW: 18, gamesL: 44, form: "LLLLW", trend: -13, flairs: ["Developing attacker"], since: "Aug 2025" }
    ],
    matches: [
      { id: 401, date: "2026-11-10", time: "19:00", format: "singles", p1: 1, p2: 2, sets: [{ a: 11, b: 8 }, { a: 9, b: 11 }, { a: 11, b: 7 }, { a: 11, b: 9 }], status: "locked", delta: 12, elo: true, league: "Club Ladder", submitted: "Alex Rivera", locked: "Game admin" },
      { id: 402, date: "2026-11-09", time: "18:30", format: "singles", p1: 3, p2: 4, sets: [{ a: 11, b: 6 }, { a: 11, b: 8 }, { a: 11, b: 9 }], status: "locked", delta: 14, elo: true, league: "Friday Cup", submitted: "Maya Okafor", locked: "Game admin" },
      { id: 403, date: "2026-11-08", time: "20:10", format: "singles", p1: 5, p2: 6, sets: [{ a: 8, b: 11 }, { a: 11, b: 7 }, { a: 11, b: 9 }, { a: 9, b: 11 }, { a: 11, b: 8 }], status: "locked", delta: 8, elo: true, league: "Club Ladder", submitted: "Theo Nguyen", locked: "Game admin" },
      { id: 404, date: "2026-11-07", time: "19:45", format: "singles", p1: 7, p2: 8, sets: [{ a: 11, b: 5 }, { a: 11, b: 9 }, { a: 11, b: 6 }], status: "pending", delta: null, elo: true, league: "Club Ladder", submitted: "Kofi Mensah", locked: null },
      { id: 405, date: "2026-11-06", time: "20:20", format: "singles", p1: 2, p2: 3, sets: [{ a: 11, b: 9 }, { a: 7, b: 11 }, { a: 11, b: 8 }, { a: 11, b: 7 }], status: "locked", delta: 6, elo: true, league: "Friday Cup", submitted: "Jordan Chen", locked: "Game admin" },
      { id: 406, date: "2026-11-05", time: "18:50", format: "singles", p1: 4, p2: 1, sets: [{ a: 9, b: 11 }, { a: 11, b: 9 }, { a: 8, b: 11 }, { a: 10, b: 12 }], status: "locked", delta: -13, elo: true, league: "Club Ladder", submitted: "Sam Patel", locked: "Game admin" }
    ],
    standings: [
      { p: 1, name: "Alex Rivera", initials: "AR", pld: 18, w: 14, d: 0, l: 4, gf: 43, ga: 20, gd: 23, pts: 28, form: "WWLWW" },
      { p: 2, name: "Jordan Chen", initials: "JC", pld: 18, w: 13, d: 0, l: 5, gf: 39, ga: 22, gd: 17, pts: 26, form: "WWWLW" },
      { p: 3, name: "Maya Okafor", initials: "MO", pld: 18, w: 12, d: 0, l: 6, gf: 38, ga: 27, gd: 11, pts: 24, form: "WLWWW" },
      { p: 4, name: "Sam Patel", initials: "SP", pld: 18, w: 10, d: 0, l: 8, gf: 34, ga: 30, gd: 4, pts: 20, form: "LWWLW" },
      { p: 5, name: "Theo Nguyen", initials: "TN", pld: 18, w: 9, d: 0, l: 9, gf: 31, ga: 32, gd: -1, pts: 18, form: "WLWLL" },
      { p: 6, name: "Rosa Silva", initials: "RS", pld: 18, w: 8, d: 0, l: 10, gf: 29, ga: 36, gd: -7, pts: 16, form: "LLWWW" },
      { p: 7, name: "Kofi Mensah", initials: "KM", pld: 18, w: 6, d: 0, l: 12, gf: 24, ga: 40, gd: -16, pts: 12, form: "LWLLL" },
      { p: 8, name: "Lena Ortiz", initials: "LO", pld: 18, w: 4, d: 0, l: 14, gf: 18, ga: 44, gd: -26, pts: 8, form: "LLLLW" }
    ],
    groups: { a: [], b: [] },
    fixtures: [
      { date: "12 Dec", stage: "Final", home: "Alex Rivera", away: "Jordan Chen", score: "3–2", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Alex Rivera", away: "Sam Patel", score: "3–1", status: "locked" },
      { date: "05 Dec", stage: "Semifinal", home: "Jordan Chen", away: "Maya Okafor", score: "3–2", status: "locked" }
    ],
    competitions: [
      { id: "tt-ladder", name: "Club Ladder", kind: "League", format: "Single round robin", players: 8, fixtures: 28, played: 20, leader: "Alex Rivera", elo: true, status: "In progress" },
      { id: "tt-cup", name: "Friday Cup", kind: "Tournament", format: "Single elimination", players: 8, fixtures: 7, played: 7, leader: "Maya Okafor", elo: true, status: "Complete" }
    ],
    activity: [
      { icon: "check", title: "Alex Rivera beat Jordan Chen 3–1", sub: "Club Ladder · +12 Elo", time: "Yesterday" },
      { icon: "clock", title: "Kofi Mensah submitted a result", sub: "Waiting for a game admin", time: "2 days ago" },
      { icon: "trophy", title: "Friday Cup final is set", sub: "Alex Rivera vs Jordan Chen · 12 Dec", time: "3 days ago" },
      { icon: "chart", title: "Club Ladder updated", sub: "Alex Rivera holds first place", time: "4 days ago" }
    ]
  };

  /* ---- Super Smash Bros. Ultimate ---- */

  /* All 89 fighters, in official in-game number order. Stock icons are added
     by the group later; the record book shows a monogram placeholder until then. */
  const smashRoster = [
    ["Mario", "MAR"], ["Donkey Kong", "DK"], ["Link", "LINK"], ["Samus", "SAM"], ["Dark Samus", "DSAM"],
    ["Yoshi", "YOS"], ["Kirby", "KIR"], ["Fox", "FOX"], ["Pikachu", "PIKA"], ["Luigi", "LUI"],
    ["Ness", "NESS"], ["Captain Falcon", "CFAL"], ["Jigglypuff", "JIG"], ["Peach", "PEACH"], ["Daisy", "DAISY"],
    ["Bowser", "BOWS"], ["Ice Climbers", "ICES"], ["Sheik", "SHEIK"], ["Zelda", "ZEL"], ["Dr. Mario", "DRM"],
    ["Pichu", "PICHU"], ["Falco", "FALC"], ["Marth", "MART"], ["Lucina", "LUC"], ["Young Link", "YLNK"],
    ["Ganondorf", "GAN"], ["Mewtwo", "MEW"], ["Roy", "ROY"], ["Chrom", "CHRO"], ["Mr. Game & Watch", "GNW"],
    ["Meta Knight", "META"], ["Pit", "PIT"], ["Dark Pit", "DPIT"], ["Zero Suit Samus", "ZSS"], ["Wario", "WARI"],
    ["Snake", "SNAK"], ["Ike", "IKE"], ["Squirtle", "SQRT"], ["Ivysaur", "IVY"], ["Charizard", "CHAR"],
    ["Diddy Kong", "DIDD"], ["Lucas", "LUCA"], ["Sonic", "SONI"], ["King Dedede", "DEDE"], ["Olimar", "OLIM"],
    ["Lucario", "LCR"], ["R.O.B.", "ROB"], ["Toon Link", "TLNK"], ["Wolf", "WOLF"], ["Villager", "VILL"],
    ["Mega Man", "MEGA"], ["Wii Fit Trainer", "WFT"], ["Rosalina & Luma", "ROSA"], ["Little Mac", "LMAC"], ["Greninja", "GREN"],
    ["Mii Brawler", "MIIB"], ["Mii Swordfighter", "MIIS"], ["Mii Gunner", "MIIG"], ["Palutena", "PALU"], ["Pac-Man", "PAC"],
    ["Robin", "RBIN"], ["Shulk", "SHLK"], ["Bowser Jr.", "BJR"], ["Duck Hunt", "DUCK"], ["Ryu", "RYU"],
    ["Ken", "KEN"], ["Cloud", "CLD"], ["Corrin", "CORR"], ["Bayonetta", "BAYO"], ["Inkling", "INK"],
    ["Ridley", "RIDL"], ["Simon", "SIMN"], ["Richter", "RICH"], ["King K. Rool", "KR"], ["Isabelle", "ISAB"],
    ["Incineroar", "INC"], ["Piranha Plant", "PLNT"], ["Joker", "JOKR"], ["Hero", "HERO"], ["Banjo & Kazooie", "BK"],
    ["Terry", "TERR"], ["Byleth", "BYLE"], ["Min Min", "MINM"], ["Steve", "STEV"], ["Sephiroth", "SEPH"],
    ["Pyra", "PYRA"], ["Mythra", "MYTH"], ["Kazuya", "KAZ"], ["Sora", "SORA"]
  ].map((f, i) => ({ id: i + 1, num: i + 1, name: f[0], code: f[1] }));

  /* Starter stage list; the group supplies stage artwork later. */
  const smashStages = [
    { id: "battlefield", name: "Battlefield", code: "BF" },
    { id: "final-destination", name: "Final Destination", code: "FD" },
    { id: "small-battlefield", name: "Small Battlefield", code: "SBF" },
    { id: "smashville", name: "Smashville", code: "SV" },
    { id: "town-and-city", name: "Town and City", code: "T&C" },
    { id: "pokemon-stadium-2", name: "Pokémon Stadium 2", code: "PS2" },
    { id: "hollow-bastion", name: "Hollow Bastion", code: "HB" },
    { id: "lylat-cruise", name: "Lylat Cruise", code: "LC" },
    { id: "yoshis-story", name: "Yoshi's Story", code: "YS" },
    { id: "kalos", name: "Kalos Pokémon League", code: "KPL" }
  ];

  const smash = {
    roster: smashRoster,
    stages: smashStages,
    stats: { matches: 36, played: 30, pending: 2 },
    players: [
      { id: 1, name: "Alex Rivera", handle: "@arivera", initials: "AR", tag: "RVR", mains: [1, 88],
        elo: 1522, peak: 1548, rank: 1, eloD: 1470, peakD: 1499, rankD: 2,
        w: 17, l: 6, d: 0, gamesW: 54, gamesL: 30, form: "WWWLW", trend: 14, trendD: 7,
        flairs: ["Mario main", "Season 3 champion"], since: "Sep 2025" },
      { id: 2, name: "Jordan Chen", handle: "@jchen", initials: "JC", tag: "JCHEN", mains: [78, 9],
        elo: 1501, peak: 1516, rank: 2, eloD: 1510, peakD: 1532, rankD: 1,
        w: 16, l: 7, d: 0, gamesW: 51, gamesL: 33, form: "WWLWW", trend: 10, trendD: 16,
        flairs: ["Joker main", "Doubles champion"], since: "Sep 2025" },
      { id: 3, name: "Maya Okafor", handle: "@mokafor", initials: "MO", tag: "MOKA", mains: [3, 23],
        elo: 1476, peak: 1493, rank: 3, eloD: 1442, peakD: 1466, rankD: 3,
        w: 15, l: 8, d: 0, gamesW: 48, gamesL: 36, form: "WLWWW", trend: 6, trendD: 4,
        flairs: ["Swordfighter", "Best form"], since: "Oct 2025" },
      { id: 4, name: "Sam Patel", handle: "@spatel", initials: "SP", tag: "SPAT", mains: [8, 22],
        elo: 1429, peak: 1450, rank: 4, eloD: 1390, peakD: 1414, rankD: 5,
        w: 13, l: 10, d: 0, gamesW: 44, gamesL: 40, form: "LWWLW", trend: -4, trendD: 2,
        flairs: ["Spacey main"], since: "Oct 2025" },
      { id: 5, name: "Theo Nguyen", handle: "@tnguyen", initials: "TN", tag: "TNGO", mains: [67, 85],
        elo: 1398, peak: 1416, rank: 5, eloD: 1418, peakD: 1440, rankD: 4,
        w: 12, l: 11, d: 0, gamesW: 41, gamesL: 43, form: "WLWLL", trend: 3, trendD: 8,
        flairs: ["Cloud main"], since: "Sep 2025" },
      { id: 6, name: "Rosa Silva", handle: "@rsilva", initials: "RS", tag: "RSIL", mains: [89, 7],
        elo: 1352, peak: 1377, rank: 6, eloD: 1355, peakD: 1380, rankD: 6,
        w: 10, l: 13, d: 0, gamesW: 36, gamesL: 46, form: "LLWWW", trend: -7, trendD: -3,
        flairs: ["Sora main", "Giant killer"], since: "Nov 2025" },
      { id: 7, name: "Kofi Mensah", handle: "@kmensah", initials: "KM", tag: "KMEN", mains: [16, 26],
        elo: 1311, peak: 1335, rank: 7, eloD: 1304, peakD: 1329, rankD: 7,
        w: 8, l: 15, d: 0, gamesW: 30, gamesL: 52, form: "LWLLL", trend: -11, trendD: -6,
        flairs: ["Heavy main"], since: "Oct 2025" },
      { id: 8, name: "Lena Ortiz", handle: "@lortiz", initials: "LO", tag: "LORT", mains: [34, 40],
        elo: 1278, peak: 1301, rank: 8, eloD: 1286, peakD: 1310, rankD: 8,
        w: 5, l: 18, d: 0, gamesW: 24, gamesL: 58, form: "LLLLW", trend: -15, trendD: -9,
        flairs: ["ZSS main"], since: "Sep 2025" }
    ],
    matches: [
      { id: 501, date: "2026-11-10", time: "20:00", format: "singles", p1: 1, p2: 2, bestOf: 5, stocks: 3,
        games: [
          { a: 3, b: 1, cA: 1, cB: 78, st: "battlefield" },
          { a: 1, b: 3, cA: 1, cB: 78, st: "final-destination" },
          { a: 3, b: 0, cA: 88, cB: 9, st: "smashville", jv: true },
          { a: 2, b: 3, cA: 88, cB: 9, st: "small-battlefield" },
          { a: 3, b: 2, cA: 1, cB: 78, st: "battlefield", jv: true }
        ],
        status: "locked", delta: 11, elo: true, league: "Smash League", submitted: "Alex Rivera", locked: "Game admin" },
      { id: 502, date: "2026-11-09", time: "19:20", format: "singles", p1: 3, p2: 4, bestOf: 3, stocks: 3,
        games: [
          { a: 3, b: 2, cA: 23, cB: 8, st: "pokemon-stadium-2" },
          { a: 1, b: 3, cA: 23, cB: 8, st: "hollow-bastion" },
          { a: 3, b: 0, cA: 3, cB: 22, st: "final-destination", jv: true }
        ],
        status: "locked", delta: 9, elo: true, league: "Smash League", submitted: "Maya Okafor", locked: "Game admin" },
      { id: 503, date: "2026-11-08", time: "20:40", format: "doubles", team1: [2, 5], team2: [4, 6], bestOf: 3, stocks: 3,
        games: [
          { a: 3, b: 1, cA: 78, cB: 67, st: "town-and-city" },
          { a: 3, b: 2, cA: 9, cB: 85, st: "lylat-cruise" }
        ],
        status: "locked", delta: 14, elo: true, league: "Doubles Cup", submitted: "Jordan Chen", locked: "Game admin" },
      { id: 504, date: "2026-11-07", time: "19:05", format: "singles", p1: 5, p2: 6, bestOf: 5, stocks: 3,
        games: [
          { a: 3, b: 1, cA: 67, cB: 89, st: "battlefield", jv: true },
          { a: 2, b: 3, cA: 67, cB: 89, st: "final-destination" },
          { a: 3, b: 2, cA: 85, cB: 7, st: "smashville" }
        ],
        status: "pending", delta: null, elo: true, league: "Smash League", submitted: "Theo Nguyen", locked: null },
      { id: 505, date: "2026-11-06", time: "18:30", format: "singles", p1: 7, p2: 8, bestOf: 3, stocks: 3,
        games: [
          { a: 3, b: 1, cA: 16, cB: 34, st: "kalos" },
          { a: 1, b: 3, cA: 16, cB: 34, st: "yoshis-story" }
        ],
        status: "pending", delta: null, elo: true, league: "Smash League", submitted: "Kofi Mensah", locked: null },
      { id: 506, date: "2026-11-04", time: "21:10", format: "singles", p1: 6, p2: 1, bestOf: 3, stocks: 3,
        games: [
          { a: 0, b: 3, cA: 7, cB: 1, st: "battlefield" },
          { a: 2, b: 3, cA: 89, cB: 1, st: "final-destination" }
        ],
        status: "locked", delta: -12, elo: true, league: "Spring Major", submitted: "Rosa Silva", locked: "Game admin" },
      { id: 507, date: "2026-11-03", time: "19:45", format: "doubles", team1: [1, 7], team2: [3, 8], bestOf: 3, stocks: 3,
        games: [
          { a: 2, b: 3, cA: 1, cB: 23, st: "hollow-bastion" },
          { a: 3, b: 1, cA: 88, cB: 3, st: "smashville" }
        ],
        status: "pending", delta: null, elo: true, league: "Doubles Cup", submitted: "Alex Rivera", locked: null },
      { id: 508, date: "2026-10-31", time: "20:15", format: "singles", p1: 2, p2: 3, bestOf: 5, stocks: 3,
        games: [
          { a: 3, b: 2, cA: 78, cB: 23, st: "final-destination" },
          { a: 3, b: 1, cA: 78, cB: 23, st: "battlefield" },
          { a: 2, b: 3, cA: 9, cB: 3, st: "pokemon-stadium-2" },
          { a: 3, b: 0, cA: 78, cB: 23, st: "smashville" }
        ],
        status: "locked", delta: 8, elo: true, league: "Spring Major", submitted: "Jordan Chen", locked: "Game admin" }
    ],
    standings: [
      { p: 1, name: "Alex Rivera", initials: "AR", pld: 12, w: 10, d: 0, l: 2, gf: 34, ga: 12, gd: 22, pts: 20, form: "WWWLW" },
      { p: 2, name: "Jordan Chen", initials: "JC", pld: 12, w: 9, d: 0, l: 3, gf: 32, ga: 15, gd: 17, pts: 18, form: "WWLWW" },
      { p: 3, name: "Maya Okafor", initials: "MO", pld: 12, w: 8, d: 0, l: 4, gf: 29, ga: 17, gd: 12, pts: 16, form: "WLWWW" },
      { p: 4, name: "Sam Patel", initials: "SP", pld: 12, w: 7, d: 0, l: 5, gf: 25, ga: 20, gd: 5, pts: 14, form: "LWWLW" },
      { p: 5, name: "Theo Nguyen", initials: "TN", pld: 12, w: 6, d: 0, l: 6, gf: 23, ga: 23, gd: 0, pts: 12, form: "WLWLL" },
      { p: 6, name: "Rosa Silva", initials: "RS", pld: 12, w: 5, d: 0, l: 7, gf: 20, ga: 26, gd: -6, pts: 10, form: "LLWWW" },
      { p: 7, name: "Kofi Mensah", initials: "KM", pld: 12, w: 4, d: 0, l: 8, gf: 16, ga: 30, gd: -14, pts: 8, form: "LWLLL" },
      { p: 8, name: "Lena Ortiz", initials: "LO", pld: 12, w: 2, d: 0, l: 10, gf: 11, ga: 33, gd: -22, pts: 4, form: "LLLLW" }
    ],
    groups: { a: [], b: [] },
    fixtures: [
      { date: "14 Dec", stage: "Grand Final", home: "Jordan Chen", away: "Alex Rivera", score: "1–3", status: "locked" },
      { date: "14 Dec", stage: "Grand Final · reset", home: "Jordan Chen", away: "Alex Rivera", score: "2–3", status: "locked" },
      { date: "13 Dec", stage: "Losers Final", home: "Alex Rivera", away: "Maya Okafor", score: "3–2", status: "locked" },
      { date: "13 Dec", stage: "Winners Final", home: "Alex Rivera", away: "Jordan Chen", score: "2–3", status: "locked" },
      { date: "12 Dec", stage: "Winners Semifinal", home: "Jordan Chen", away: "Theo Nguyen", score: "3–2", status: "locked" },
      { date: "12 Dec", stage: "Losers Semifinal", home: "Theo Nguyen", away: "Maya Okafor", score: "2–3", status: "locked" }
    ],
    competitions: [
      { id: "smash-ladder", name: "Smash League", kind: "League", format: "Double round robin", players: 8, fixtures: 56, played: 30, leader: "Alex Rivera", elo: true, status: "In progress" },
      { id: "smash-major", name: "Spring Major", kind: "Tournament", format: "Double elimination", players: 8, fixtures: 14, played: 12, leader: "Alex Rivera", elo: true, status: "In progress" }
    ],
    bracket: {
      winners: [
        { title: "Winners R1", matches: [
          { home: "Alex Rivera", away: "Kofi Mensah", score: "3–1", winner: "Alex Rivera" },
          { home: "Maya Okafor", away: "Rosa Silva", score: "3–2", winner: "Maya Okafor" },
          { home: "Jordan Chen", away: "Lena Ortiz", score: "3–0", winner: "Jordan Chen" },
          { home: "Sam Patel", away: "Theo Nguyen", score: "2–3", winner: "Theo Nguyen" }
        ] },
        { title: "Winners Semis", matches: [
          { home: "Alex Rivera", away: "Maya Okafor", score: "3–1", winner: "Alex Rivera" },
          { home: "Jordan Chen", away: "Theo Nguyen", score: "3–2", winner: "Jordan Chen" }
        ] },
        { title: "Winners Final", matches: [
          { home: "Alex Rivera", away: "Jordan Chen", score: "2–3", winner: "Jordan Chen" }
        ] }
      ],
      losers: [
        { title: "Losers R1", matches: [
          { home: "Kofi Mensah", away: "Rosa Silva", score: "1–3", winner: "Rosa Silva" },
          { home: "Lena Ortiz", away: "Sam Patel", score: "0–3", winner: "Sam Patel" }
        ] },
        { title: "Losers R2", matches: [
          { home: "Theo Nguyen", away: "Rosa Silva", score: "3–2", winner: "Theo Nguyen" },
          { home: "Maya Okafor", away: "Sam Patel", score: "3–1", winner: "Maya Okafor" }
        ] },
        { title: "Losers Semis", matches: [
          { home: "Theo Nguyen", away: "Maya Okafor", score: "2–3", winner: "Maya Okafor" }
        ] },
        { title: "Losers Final", matches: [
          { home: "Alex Rivera", away: "Maya Okafor", score: "3–2", winner: "Alex Rivera" }
        ] }
      ],
      grand: { title: "Grand Final", matches: [
        { home: "Jordan Chen", away: "Alex Rivera", score: "2–3", winner: "Alex Rivera", reset: true },
        { home: "Jordan Chen", away: "Alex Rivera", score: "1–3", winner: "Alex Rivera" }
      ] }
    },
    activity: [
      { icon: "check", title: "Alex Rivera beat Jordan Chen 3–2", sub: "Smash League · +11 Elo · two JVs", time: "2h ago" },
      { icon: "clock", title: "Theo Nguyen submitted 2–1 vs Rosa Silva", sub: "Waiting for a game admin", time: "5h ago" },
      { icon: "trophy", title: "Spring Major goes to a bracket reset", sub: "Alex Rivera forces game two in Grand Finals", time: "Yesterday" },
      { icon: "chart", title: "Doubles ratings published", sub: "Jordan Chen +16 · Theo Nguyen +8", time: "2 days ago" }
    ]
  };

  const teamPoolWithStars = teamPool.map((t) => Object.assign({}, t, { stars: teamStars[t.code] || 3.5 }));
  const base = { clubs: clubs, games: games, teamPool: teamPoolWithStars };
  const mock27 = Object.assign({}, base, fc27);
  const mock26 = Object.assign({}, base, fc26);
  const mockTennis = Object.assign({}, base, tennis);
  const mockTableTennis = Object.assign({}, base, tableTennis);
  const mockSmash = Object.assign({}, base, smash);
  window.MOCK = mock27;
  window.MOCK26 = mock26;
  window.MOCK_TENNIS = mockTennis;
  window.MOCK_TABLE_TENNIS = mockTableTennis;
  window.MOCK_SMASH = mockSmash;
   window.GAME_SET = { eafc27: mock27, eafc26: mock26, tennis: mockTennis, tt: mockTableTennis, smash: mockSmash };
  window.resolveGame = function (params) {
    const raw = params && params.get ? params.get("game") : null;
    let slug = raw;
    const path = window.location && window.location.pathname ? window.location.pathname.toLowerCase() : "";
    if (!window.GAME_SET[slug]) {
      const hashQuery = window.location && window.location.hash ? window.location.hash.split("?")[1] : "";
      const hashGame = new URLSearchParams(hashQuery).get("game");
      if (window.GAME_SET[hashGame]) slug = hashGame;
    }
    if (!window.GAME_SET[slug] && window.location && window.location.search) {
      const nestedQuery = window.location.search.slice(1).split("?").pop();
      const nestedGame = new URLSearchParams(nestedQuery).get("game");
      if (window.GAME_SET[nestedGame]) slug = nestedGame;
    }
    if (!window.GAME_SET[slug]) {
      try {
        const previewGame = window.sessionStorage.getItem("mimelo-preview-game");
        if (window.GAME_SET[previewGame]) slug = previewGame;
      } catch (_) {}
    }
    if (!window.GAME_SET[slug]) slug = path.includes("table-tennis") ? "tt" : path.includes("tennis") ? "tennis" : "eafc27";
    const M = window.GAME_SET[slug];
    window.MOCK = M;
    return {
      slug: slug,
      M: M,
      isTennis: slug === "tennis",
      isTableTennis: slug === "tt",
      isSmash: slug === "smash",
      query: slug === "eafc27" ? "" : ("&game=" + slug),
      href: "game.html" + (slug === "eafc27" ? "" : ("?game=" + slug))
    };
  };
  return mock27;
})();
