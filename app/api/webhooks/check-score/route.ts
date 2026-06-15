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

    // 1. Double check the database
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

    // 2. Call the NEW football-data.org API
    const apiResponse = await fetch(`https://api.football-data.org/v4/matches/${match.api_fixture_id}`, {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
    })
    
    if (!apiResponse.ok) {
       const errorData = await apiResponse.text()
       throw new Error(`football-data.org request failed: ${errorData}`)
    }
      
    const matchData = await apiResponse.json()

    // 3. Extract the clean data
    const status = matchData.status // 'FINISHED', 'IN_PLAY', 'PAUSED'
    const homeScore = matchData.score?.fullTime?.home
    const awayScore = matchData.score?.fullTime?.away

    const isFinished = status === 'FINISHED'

    // 4. IF FINISHED: Save the scores instantly
    // We also make sure the scores are not null/undefined just to be safe
    if (isFinished && homeScore !== null && awayScore !== null && homeScore !== undefined && awayScore !== undefined) {
      
      const { error: updateError } = await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'FT', // We manually set FT so your frontend UI reads it perfectly
        is_finished: true
      }).eq('match_id', matchId)

      if (updateError) throw updateError

      return NextResponse.json({ message: `Match ${matchId} finished. Scores updated perfectly!` })
    
    // 5. IF NOT FINISHED: Hit the 60-Second Snooze Button
    } else {
      // 45 retries * 1 minute = 45 minutes of checking (covers extra time and penalties perfectly)
      if (retryCount < 45) {
        const targetUrl = `https://worldcuppred.vercel.app/api/webhooks/check-score`
        await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '1m' // <-- The 60-second Sniper Poll!
          },
          body: JSON.stringify({ matchId, retryCount: retryCount + 1 })
        })
        
        return NextResponse.json({ message: `Match still playing (Status: ${status}). Scheduled retry #${retryCount + 1} in 1 minute.` })
      } else {
        return NextResponse.json({ message: 'Match went on too long. Max retries hit.' })
      }
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}