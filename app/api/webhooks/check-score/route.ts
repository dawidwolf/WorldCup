import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, retryCount = 0 } = body

    if (!matchId) return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })

    const { data: match, error: dbError } = await supabase
      .from('matches')
      .select('api_fixture_id, is_finished')
      .eq('match_id', matchId)
      .single()

    if (dbError || !match || match.is_finished) {
      return NextResponse.json({ message: 'Match already finished or not found' })
    }

    if (!match.api_fixture_id) {
       return NextResponse.json({ message: 'No API Fixture ID set for this match' })
    }

    let isFinished = false
    let homeScore = null
    let awayScore = null
    let status = 'UNKNOWN'

    // We wrap the API call in its own try/catch so a failure DOES NOT crash the file
    try {
      const apiResponse = await fetch(`https://api.football-data.org/v4/matches/${match.api_fixture_id}`, {
        headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
      })
      
      if (apiResponse.ok) {
        const matchData = await apiResponse.json()
        status = matchData.status 
        homeScore = matchData.score?.fullTime?.home
        awayScore = matchData.score?.fullTime?.away
        isFinished = status === 'FINISHED'
      } else {
        console.error(`API Hiccup: Status ${apiResponse.status}`)
      }
    } catch (e) {
      console.error(`Fetch failed, skipping this ping.`)
    }

    // IF FINISHED: Save the scores instantly
    if (isFinished && homeScore !== null && awayScore !== null && homeScore !== undefined && awayScore !== undefined) {
      
      await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'FT',
        is_finished: true
      }).eq('match_id', matchId)

      return NextResponse.json({ message: `Match ${matchId} finished. Scores updated perfectly!` })
    
    // IF NOT FINISHED (or if the API temporarily failed): Hit the Snooze Button!
    } else {
      if (retryCount < 90) { 
        const targetUrl = `https://worldcuppred.vercel.app/api/webhooks/check-score`
        await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '30s'
          },
          body: JSON.stringify({ matchId, retryCount: retryCount + 1 })
        })
        
        return NextResponse.json({ message: `Match checking... Scheduled retry #${retryCount + 1} in 30 seconds.` })
      } else {
        return NextResponse.json({ message: 'Match went on too long. Max retries hit.' })
      }
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}