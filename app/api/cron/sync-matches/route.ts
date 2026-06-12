import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
  try {
    const now = new Date().toISOString()

    // --- NEW: PHASE 1 - AUTOMATICALLY TURN MATCHES "LIVE" (0 API Calls) ---
    // If the current time is past kickoff, and it hasn't been marked LIVE or finished yet
    const { error: liveError } = await supabase
      .from('matches')
      .update({ status: 'LIVE' })
      .lte('kickoff_utc', now)
      .eq('is_finished', false)
      .or('status.is.null,status.eq.NS,status.eq.SCHEDULED') // Only update if Not Started

    if (liveError) console.error("Error setting matches to LIVE:", liveError)

    // --- PHASE 2 - SYNC FINISHED MATCHES (1 API Call) ---
    const syncThreshold = new Date(Date.now() - 115 * 60 * 1000).toISOString()

    const { data: pendingMatches, error: dbError } = await supabase
      .from('matches')
      .select('match_id, api_fixture_id, home_team, away_team')
      .eq('is_finished', false)
      .not('api_fixture_id', 'is', null)
      .lte('kickoff_utc', syncThreshold)

    if (dbError) throw new Error(`Database error: ${dbError.message}`)

    if (!pendingMatches || pendingMatches.length === 0) {
      return NextResponse.json({ message: 'Live statuses updated. No matches pending final score sync.' }, { status: 200 })
    }

    console.log(`Found ${pendingMatches.length} pending matches. Fetching from API...`)

    const fixtureIds = pendingMatches.map((m) => m.api_fixture_id).join(',')

    const apiResponse = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${fixtureIds}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-apisports-key': process.env.API_FOOTBALL_API_KEY!,
      },
    })

    if (!apiResponse.ok) throw new Error('Failed to fetch from API-Football')

    const apiData = await apiResponse.json()
    const fixtures = apiData.response
    const updatedMatches = []

    for (const fixture of fixtures) {
      const apiFixtureId = fixture.fixture.id
      const matchStatus = fixture.fixture.status.short 
      const homeScore = fixture.goals.home
      const awayScore = fixture.goals.away

      const isActuallyFinished = ['FT', 'AET', 'PEN'].includes(matchStatus)

      if (isActuallyFinished && homeScore !== null && awayScore !== null) {
        // NOTE: Later, we will add the Goal Scorer logic right here!
        
        const { error: updateError } = await supabase
          .from('matches')
          .update({
            home_score: homeScore,
            away_score: awayScore,
            status: matchStatus,
            is_finished: true,
          })
          .eq('api_fixture_id', apiFixtureId)

        if (updateError) {
          console.error(`Failed to update fixture ${apiFixtureId}:`, updateError)
        } else {
          updatedMatches.push(apiFixtureId)
        }
      }
    }

    return NextResponse.json({ 
      message: 'Sync complete', 
      matchesChecked: pendingMatches.length,
      matchesFinished: updatedMatches.length,
      updatedIds: updatedMatches
    }, { status: 200 })

  } catch (error: any) {
    console.error('Match Sync Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}