export type Language = "en" | "hu"
type Dictionary = Record<string, string>

// ─────────────────────────────────────────────────────────────
//  ENGLISH
// ─────────────────────────────────────────────────────────────
const en: Dictionary = {

  // ── AUTH SCREEN ───────────────────────────────────────────
  "World Cup Predictor": "World Cup Predictor",
  "Predict the matches of the 2026 FIFA World Cup": "Predict the matches of the 2026 FIFA World Cup",
  "Log in": "Log in",
  "Sign up": "Sign up",
  "Username": "Username",
  "PIN": "PIN",
  "Create Account": "Create Account",

  // ── AUTH — error toasts ───────────────────────────────────
  "Username must be at least 3 characters": "Username must be at least 3 characters",
  "Username already taken!": "Username already taken!",
  "Please choose a different username.": "Please choose a different username.",
  "Signup failed": "Signup failed",
  "Please try again.": "Please try again.",
  "Login failed": "Login failed",
  "Invalid username or PIN": "Invalid username or PIN",
  "Multiple accounts match this username. Please contact support.": "Multiple accounts match this username. Please contact support.",

  // ── POOLS SCREEN ──────────────────────────────────────────
  "Back": "Back",
  "Pools": "Pools",
  "Enter →": "Enter →",
  "Join Pool": "Join Pool",
  "Create Pool": "Create Pool",
  "Pool Name": "Pool Name",

  // ── POOLS — error / success toasts ───────────────────────
  "Pool name must be at least 3 characters": "Pool name must be at least 3 characters",
  "Please enter the pool name": "Please enter the pool name",
  "You are already in this pool": "You are already in this pool",
  "Failed to create pool": "Failed to create pool",
  "Failed to join pool": "Failed to join pool",
  "Joined pool successfully!": "Joined pool successfully!",
  "Pool created:": "Pool created:",

  // ── BOTTOM NAV ────────────────────────────────────────────
  "Matches": "Matches",
  "Bonus": "Bonus",
  "Rankings": "Rankings",
  "Profile": "Profile",

  // ── MATCH FILTERS ─────────────────────────────────────────
  "All Matches": "All Matches",
  "Today": "Today",
  "Groups": "Groups",
  "Knockouts": "Knockouts",

  // ── MATCHES TAB — separators ──────────────────────────────
  "Tomorrow": "Tomorrow",

  // ── MATCHES TAB — loading / empty ─────────────────────────
  "Loading Matches...": "Loading Matches...",
  "No matches today.": "No matches today.",
  "← Groups": "← Groups",

  // ── MATCHES TAB — group table headers ─────────────────────
  "GD": "GD",
  "PTS": "PTS",

  'Failed to save prediction': 'Failed to save prediction',
  'Invalid score value': 'Invalid score value',
  'No active user': 'No active user',

  // ── MATCH CARD — status badges ────────────────────────────
  "Saving...": "Saving...",
  "Postponed": "Postponed",
  "Finished": "Finished",
  "Live": "Live",
  "Saved": "Saved",
  "Closes soon": "Closes soon",
  "Coming up": "Coming up",
  "Group": "Group",

  // ── MATCH CARD — prediction text ──────────────────────────
  "No prediction submitted.": "No prediction submitted.",
  "You predicted: ": "You predicted: ",
  "Tap to see predictions": "Tap to see predictions",

  // ── MATCH CARD — points badges ────────────────────────────
  "pts": "pts",
  "0 pts": "0 pts",

  // ── BONUS TAB ─────────────────────────────────────────────
  "Predict Winner": "Predict Winner",
  "Predict Top Scorer": "Predict Top Scorer",
  "Search team...": "Search team...",
  "Search player...": "Search player...",
  "Locked": "Locked",
  "Failed to save winner pick": "Failed to save winner pick",
  "Failed to save top scorer pick": "Failed to save top scorer pick",
  "Live Golden Boot Race": "Live Golden Boot Race",
  "Player": "Player",
  "Goals": "Goals",

  // ── RANKINGS TAB ─────────────────────────────────────────
  "Loading Leaderboard...": "Loading Leaderboard...",
  "Leaderboard": "Leaderboard",
  "Global Leaderboard": "Global Leaderboard",
  "#": "#",
  "User": "User",
  "Pick": "Pick",
  "Exact": "Exact",
  "Pts": "Pts",
  "(You)": "(You)",
  "No users in this pool yet.": "No users in this pool yet.",
  "INVITE": "INVITE",
  "Failed to load rankings": "Failed to load rankings",
  "Hidden": "Hidden",

  // ── RANKINGS — invite modal ───────────────────────────────
  "Invite to": "Invite to",
  "Share the link or scan the QR code for a quick join": "Share the link or scan the QR code for a quick join",
  "Copy": "Copy",
  "QR Code": "QR Code",
  "Close": "Close",
  "Invite link copied": "Invite link copied",
  "Failed to copy link": "Failed to copy link",

  // ── PROFILE TAB — picks cards ─────────────────────────────
  "Your Winner": "Your Winner",
  "Winner": "Winner",
  "Your Scorer": "Your Scorer",
  "Scorer": "Scorer",
  "Not selected": "Not selected",
  "Invite QR code": "Invite QR code",

  "Language": "Language",
  "English": "🇬🇧 English",
  "Hungarian": "🇭🇺 Hungarian",

  // ── PROFILE TAB — stats card ──────────────────────────────
  "Stats": "Stats",
  "All Hits": "All Hits",
  "Misses": "Misses",
  "Accuracy": "Accuracy",

  // ── PROFILE TAB — pools card ──────────────────────────────
  "Your Pools": "Your Pools",
  "Switch Pool": "Switch Pool",
  "Admin": "Admin",
  "Invite": "Invite",
  "Leave": "Leave",
  "You are not in any pools yet.": "You are not in any pools yet.",
  "Scan the qr code, register and enter the groups name to join.": "Scan the qr code, register and enter the groups name to join.",

  // ── PROFILE TAB — leave pool confirm ─────────────────────
  "Are you sure you want to leave": "Are you sure you want to leave",
  "You are the only admin. Please promote someone else before leaving.": "You are the only admin. Please promote someone else before leaving.",
  "Failed to leave pool": "Failed to leave pool",

  // ── PROFILE TAB — invite modal ───────────────────────────
  "Invite players to": "Invite players to",

  // ── PROFILE TAB — info banner ─────────────────────────────
  "Your match predictions are": "Your match predictions are",
  "global": "global",
  "and apply to every pool you belong to — you only need to predict once.": "and apply to every pool you belong to — you only need to predict once.",
  "Your match predictions are global and apply to every pool you belong to — you only need to predict once.": "Your match predictions are global and apply to every pool you belong to - you only need to predict once.",

  // ── PROFILE TAB — rules card ──────────────────────────────
  "Official Rules": "Official Rules",
  "5 points": "5 points",
  "for the exact score": "for the exact score",
  "3 points": "3 points",
  "for the correct winner and goal difference": "for the correct winner and goal difference",
  "2 points": "2 points",
  "for the correct winner": "for the correct winner",
  "10 points": "10 points",
  "for the tournament winner": "for the tournament winner",
  "for the top scorer": "for the top scorer",
  "Deadlines": "Deadlines",
  "Match predictions lock exactly at kickoff. Every prediction can be changed until its deadline. Scores update after matches.": "Match predictions lock exactly at kickoff. Every prediction can be changed until its deadline. Scores update after matches.",

  // ── PROFILE TAB — logout ──────────────────────────────────
  "Logout": "Logout",

  // ── PROFILE TAB — back-to-exit toast ─────────────────────
  "Press back again to exit game.": "Press back again to exit game.",

  // ── PREDICTIONS MODAL ─────────────────────────────────────
  "Predictions": "Predictions",
  "No predictions": "No predictions",
  "5 pts": "5 pts",
  "3 pts": "3 pts",
  "2 pts": "2 pts",

  // ── PAGE — loading / session ──────────────────────────────
  "Restoring session...": "Restoring session...",
  "Initializing tournament data...": "Initializing tournament data...",

  "How to Predict?": "How to Predict?",
  "Click on the score numbers (0:0) inside any match card below to enter or change your prediction. Your changes are saved automatically!": "Click on the score numbers (0:0) inside any match card below to enter or change your prediction. Your changes are saved automatically!",
  "Flexible Deadline": "Flexible Deadline",
  "You can freely modify your predicted scores anytime right up until each match officially kicks off.": "You can freely modify your predicted scores anytime right up until each match officially kicks off.",
  "Look for the Checkmark": "Look for the Checkmark",
  "A green check badge on a match card confirms your prediction is safely synced to our servers.": "A green check badge on a match card confirms your prediction is safely synced to our servers.",
  "Click on a group to view the matches.": "Click on a group to view the matches.",
}











// ─────────────────────────────────────────────────────────────
//  HUNGARIAN
// ─────────────────────────────────────────────────────────────
const hu: Dictionary = {

  // ── AUTH SCREEN ───────────────────────────────────────────
  "World Cup Predictor": "VB Tippverseny",
  "Predict the matches of the 2026 FIFA World Cup": "Tippelj a 2026-os FIFA Világbajnokság meccseire!",
  "Log in": "Belépés",
  "Sign up": "Regisztráció",
  "Username": "Felhasználónév",
  "PIN": "PIN-kód",
  "Create Account": "Regisztrálás",

  // ── AUTH — error toasts ───────────────────────────────────
  "Username must be at least 3 characters": "A felhasználónévnek legalább 3 karakter hosszúnak kell lennie",
  "Username already taken!": "Ez a felhasználónév már foglalt!",
  "Please choose a different username.": "Kérjük, válassz egy másik nevet.",
  "Signup failed": "Sikertelen regisztráció",
  "Please try again.": "Kérjük, próbáld meg újra.",
  "Login failed": "Sikertelen belépés",
  "Invalid username or PIN": "Helytelen felhasználónév vagy PIN-kód",
  "Multiple accounts match this username. Please contact support.": "Több fiók is egyezik ezzel a névvel. Kérjük, vedd fel velünk a kapcsolatot.",

  // ── POOLS SCREEN ──────────────────────────────────────────
  "Back": "Vissza",
  "Pools": "Csoportok",
  "Enter →": "Belépés →",
  "Join Pool": "Csatlakozás",
  "Create Pool": "Csoport létrehozása",
  "Pool Name": "Csoport neve",

  // ── POOLS — error / success toasts ───────────────────────
  "Pool name must be at least 3 characters": "A csoport nevének legalább 3 karakter hosszúnak kell lennie",
  "Please enter the pool name": "Kérjük, add meg a csoport nevét",
  "You are already in this pool": "Már tagja vagy ennek a csoportnak",
  "Failed to create pool": "Nem sikerült létrehozni a csoportot",
  "Failed to join pool": "Nem sikerült csatlakozni a csoporthoz",
  "Joined pool successfully!": "Sikeresen csatlakoztál a csoporthoz!",
  "Pool created:": "Csoport létrehozva:",

  // ── BOTTOM NAV ────────────────────────────────────────────
  "Matches": "Meccsek",
  "Bonus": "Bónusz",
  "Rankings": "Ranglista",
  "Profile": "Profil",

  // ── MATCH FILTERS ─────────────────────────────────────────
  "All Matches": "Összes meccs",
  "Today": "Mai",
  "Groups": "Csoportok",
  "Knockouts": "Kieséses",

  // ── MATCHES TAB — separators ──────────────────────────────
  "Tomorrow": "Holnap",

  // ── MATCHES TAB — loading / empty ─────────────────────────
  "Loading Matches...": "Meccsek betöltése...",
  "No matches today.": "Ma nincsenek meccsek.",

  // ── MATCHES TAB — group table headers ─────────────────────
  "GD": "GK",
  "PTS": "PT",

  'Failed to save prediction': "Nem sikerült elmenteni a tippet",
  'Invalid score value': "Érvénytelen tipp",
  'No active user': "Nincs aktív felhasználó",


  // ── MATCH CARD — status badges ────────────────────────────
  "Saving...": "Mentés...",
  "Postponed": "Elhalasztva",
  "Finished": "Vége",
  "Live": "Élő",
  "Saved": "Mentve",
  "Closes soon": "Hamarosan lezárul",
  "Coming up": "Közelgő",
  "Group": "Csoport",

  // ── MATCH CARD — prediction text ──────────────────────────
  "No prediction submitted.": "Még nem tippeltél.",
  "You predicted: ": "A tipped: ",
  "Tap to see predictions": "Kattints a tippek megtekintéséhez",

  // ── MATCH CARD — points badges ────────────────────────────
  "pts": "pont",
  "0 pts": "0 pont",
  "2 pts": "2 pont",
  "3 pts": "3 pont",
  "5 pts": "5 pont",
  "10 pts": "10 pont",

  // ── BONUS TAB ─────────────────────────────────────────────
  "Predict Winner": "Tippelj Bajnokot",
  "Predict Top Scorer": "Tippelj Gólkirályt",
  "Search team...": "Csapat keresése...",
  "Search player...": "Játékos keresése...",
  "Locked": "Lezárva",
  "Failed to save winner pick": "Nem sikerült elmenteni a bajnok tippedet",
  "Failed to save top scorer pick": "Nem sikerült elmenteni a gólkirály tippedet",
  "Live Golden Boot Race": "Góllövőlista Állása",
  "Player": "Játékos",
  "Goals": "Gólok",

  // ── RANKINGS TAB ─────────────────────────────────────────
  "Loading Leaderboard...": "Ranglista betöltése...",
  "Leaderboard": "Ranglista",
  "Global Leaderboard": "Globális Ranglista",
  "#": "#",
  "User": "Név",
  "Pick": "Bajnok",
  "Exact": "Teli",
  "Pts": "Pont",
  "(You)": "(Te)",
  "No users in this pool yet.": "Még nincs senki ebben a csoportban.",
  "INVITE": "MEGHÍVÁS",
  "Failed to load rankings": "Nem sikerült betölteni a ranglistát",
  "Hidden": "Titkos (a torna kezdetéig)",

  // ── RANKINGS — invite modal ───────────────────────────────
  "Invite to": "Meghívás ide:",
  "Share the link or scan the QR code for a quick join": "Oszd meg a linket vagy szkenneld be a QR-kódot a gyors csatlakozáshoz",
  "Copy": "Másolás",
  "QR Code": "QR-kód",
  "Close": "Bezárás",
  "Invite link copied": "Meghívó link másolva",
  "Failed to copy link": "Nem sikerült másolni a linket",

  // ── PROFILE TAB — picks cards ─────────────────────────────
  "Your Winner": "A tippelt bajnokod",
  "Winner": "Bajnok",
  "Your Scorer": "A tippelt gólkirályod",
  "Scorer": "Gólkirály",
  "Not selected": "Nincs kiválasztva",
  "Invite QR code": "Meghívó QR-kód",

  "Language": "Nyelv",
  "English": "🇬🇧 Angol",
  "Hungarian": "🇭🇺 Magyar",

  // ── PROFILE TAB — stats card ──────────────────────────────
  "Stats": "Statisztikák",
  "All Hits": "Találatok",
  "Misses": "Hibák",
  "Accuracy": "Pontosság",

  // ── PROFILE TAB — pools card ──────────────────────────────
  "Your Pools": "Csoportjaid",
  "Switch Pool": "Csoportváltás",
  "Admin": "Admin",
  "Invite": "Meghívás",
  "Leave": "Kilépés",
  "You are not in any pools yet.": "Még nem vagy egyetlen csoportban sem.",
  "Scan the qr code, register and enter the groups name to join.": "Olvasd be a QR-kódot, regisztrálj, és add meg a csoport nevét a csatlakozáshoz.",

  // ── PROFILE TAB — leave pool confirm ─────────────────────
  "Are you sure you want to leave": "Biztosan ki szeretnél lépni ebből:",
  "You are the only admin. Please promote someone else before leaving.": "Te vagy az egyetlen admin. Előbb add át a szerepet valaki másnak.",
  "Failed to leave pool": "Nem sikerült kilépni a csoportból",

  // ── PROFILE TAB — invite modal ───────────────────────────
  "Invite players to": "Meghívás ebbe a csoportra:",

  // ── PROFILE TAB — info banner ─────────────────────────────
  "Your match predictions are": "A meccs tippjeid",
  "global": "globálisak",
  "and apply to every pool you belong to — you only need to predict once.": "és minden csoportodban érvényesek — elég egyszer tippelni.",
  "Your match predictions are global and apply to every pool you belong to — you only need to predict once.": "A tippjeid minden csoportodban érvényesek - elég egyszer tippelned.",

  // ── PROFILE TAB — rules card ──────────────────────────────
  "Official Rules": "Szabályok",
  "5 points": "5 pont",
  "for the exact score": "a pontos végeredményért",
  "3 points": "3 pont",
  "for the correct winner and goal difference": "a helyes győztesért és gólkülönbségért",
  "2 points": "2 pont",
  "for the correct winner": "a helyes győztesért",
  "10 points": "10 pont",
  "for the tournament winner": "a torna győzteséért",
  "for the top scorer": "a gólkirályért",
  "Deadlines": "Határidők",
  "Match predictions lock exactly at kickoff. Every prediction can be changed until its deadline. Scores update after matches.": "A meccsekre a kezdőrugásig tippelhetsz, és addig meg is változtathatod a tippedet. - A bajnokot és a gólkirályt az első meccsig kell megtippelned. - Hosszabbítás esetén a teljes játékidő szerint járnak a pontok.",

  // ── PROFILE TAB — logout ──────────────────────────────────
  "Logout": "Kijelentkezés",

  // ── PROFILE TAB — back-to-exit toast ─────────────────────
  "Press back again to exit game.": "Nyomd meg még egyszer a kilépéshez.",

  // ── PREDICTIONS MODAL ─────────────────────────────────────
  "Predictions": "Tippek",
  "No predictions": "Nincsenek tippek",

  // ── PAGE — loading / session ──────────────────────────────
  "Restoring session...": "Belépés visszaállítása...",
  "Initializing tournament data...": "Adatok betöltése...",

  "How to Predict?": "Hogyan tippelj?",
  "Click on the score numbers (0:0) inside any match card below to enter or change your prediction. Your changes are saved automatically!": "Kattints egy meccsre a tippeléshez! A meccs kezdetéig megváltoztathatod a tippedet! A bónusz menüben tippeld meg a bajnokot és a gólkirályt is!",
  "Flexible Deadline": "Rugalmas határidő",
  "You can freely modify your predicted scores anytime right up until each match officially kicks off.": "Tippjeidet teljesen szabadon módosíthatod az adott mérkőzés hivatalos kezdetéig.",
  "Look for the Checkmark": "Keresd a pipát",
  "A green check badge on a match card confirms your prediction is safely synced to our servers.": "A meccskártyákon megjelenő zöld pipa jelzi, hogy a tipped sikeresen elmentődött a szerverünkön.",
  "Click on a group to view the matches.": "Kattints egy csoportra a meccsek megtekintéséhez.",
}

// ─────────────────────────────────────────────────────────────
export const dictionary: Record<Language, Dictionary> = { en, hu }
