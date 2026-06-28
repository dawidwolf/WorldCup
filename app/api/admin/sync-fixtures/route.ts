import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 1. Fetch the latest live competition data from the API
    const apiResponse = await fetch(`https://api.football-data.org/v4/competitions/WC/matches`, {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! },
      cache: 'no-store'
    })

    if (!apiResponse.ok) throw new Error('Failed to fetch from Football API')
    const data = await apiResponse.json()
    const apiMatches = data.matches || []

    // 2. FETCH MAP: Build a dictionary mapping API IDs directly to YOUR local IDs
    const { data: localTeams, error: teamsError } = await supabase
      .from('teams') 
      .select('team_id, api_team_id') 

    if (teamsError) throw teamsError

    const teamLookup: Record<number, number> = {}
    localTeams?.forEach(team => {
      if (team.api_team_id) {
        teamLookup[team.api_team_id] = team.team_id 
      }
    })

    // 3. THE FIX: Grab matches that are missing the real team IDs (instead of API IDs)
    const { data: dbMatches, error: dbError } = await supabase
      .from('matches')
      .select('match_id, kickoff_utc, round, home_team, away_team, api_fixture_id')
      .or('home_team_id.is.null,away_team_id.is.null') // <-- This forces it to pull matches with placeholders!

    if (dbError) throw dbError
    if (!dbMatches || dbMatches.length === 0) {
      return NextResponse.json({ message: 'All matches are already synchronized with real teams!' })
    }

    let updatedCount = 0

    // 4. Loop and match them up by kickoff time
    for (const dbMatch of dbMatches) {
      const dbMatchTime = new Date(dbMatch.kickoff_utc).getTime()

      const matchingApiMatch = apiMatches.find((apiM: any) => {
        return new Date(apiM.utcDate).getTime() === dbMatchTime
      })

      if (matchingApiMatch) {
        // Grab the unchangeable numeric team IDs directly from the external API
        const apiHomeId = matchingApiMatch.homeTeam?.id
        const apiAwayId = matchingApiMatch.awayTeam?.id

        // Translate the API's global IDs into YOUR local database IDs instantly!
        const localHomeId = apiHomeId ? teamLookup[apiHomeId] : null
        const localAwayId = apiAwayId ? teamLookup[apiAwayId] : null

        // 5. Update your database row safely
        await supabase
          .from('matches')
          .update({
            api_fixture_id: matchingApiMatch.id, // Keeps your pre-filled ID safe
            home_team: matchingApiMatch.homeTeam?.name || dbMatch.home_team,
            away_team: matchingApiMatch.awayTeam?.name || dbMatch.away_team,
            home_team_id: localHomeId, 
            away_team_id: localAwayId, 
          })
          .eq('match_id', dbMatch.match_id)

        updatedCount++
      }
    }

    return NextResponse.json({ message: `Successfully synchronized ${updatedCount} knockout fixtures with real teams!` })

  } catch (error: any) {
    console.error('[sync-fixtures] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// QStash POST safety net
export async function POST() {
  return GET();
}