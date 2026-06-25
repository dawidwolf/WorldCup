import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Next.js automatically loads your .env.local file. 
// The correct syntax is process.env.VARIABLE_NAME
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 1. Fetch the latest live competition data from the API
    // We replaced the hardcoded key with the secure process.env call
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
      // FIX 1: Updated to use 'team_id' based on your CSV schema
      .select('team_id, api_team_id') 

    if (teamsError) throw teamsError

    const teamLookup: Record<number, number> = {}
    localTeams?.forEach(team => {
      if (team.api_team_id) {
        teamLookup[team.api_team_id] = team.team_id // FIX 1 applied here
      }
    })

    // 3. Grab your unlinked knockout matches from Supabase
    const { data: dbMatches, error: dbError } = await supabase
      .from('matches')
      // FIX 2: Added home_team and away_team so TypeScript knows they exist
      .select('match_id, kickoff_utc, round, home_team, away_team')
      .is('api_fixture_id', null)

    if (dbError) throw dbError
    if (!dbMatches || dbMatches.length === 0) {
      return NextResponse.json({ message: 'All matches are already synchronized!' })
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
            api_fixture_id: matchingApiMatch.id,
            home_team: matchingApiMatch.homeTeam?.name || dbMatch.home_team,
            away_team: matchingApiMatch.awayTeam?.name || dbMatch.away_team,
            home_team_id: localHomeId, 
            away_team_id: localAwayId, 
          })
          .eq('match_id', dbMatch.match_id)

        updatedCount++
      }
    }

    return NextResponse.json({ message: `Successfully synchronized ${updatedCount} knockout fixtures using numeric ID mapping.` })

  } catch (error: any) {
    console.error('[sync-fixtures] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}