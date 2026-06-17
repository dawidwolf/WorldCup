import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const bodyText = await request.text()
    if (!bodyText) return NextResponse.json({ message: 'Empty body' }, { status: 200 })
    
    const body = JSON.parse(bodyText)
    const { matchId, retryCount = 0 } = body

    if (!matchId) return NextResponse.json({ message: 'Missing matchId' }, { status: 200 })

    const { data: match, error: dbError } = await supabase
      .from('matches')
      .select('api_fixture_id, is_finished')
      .eq('match_id', matchId)
      .single()

    if (dbError || !match || match.is_finished) {
      return NextResponse.json({ message: 'Match finished or not found' }, { status: 200 })
    }

    // Safeguard ID format
    const cleanId = parseInt(String(match.api_fixture_id), 10)
    if (isNaN(cleanId)) return NextResponse.json({ message: 'Invalid API ID' }, { status: 200 })

    let isFinished = false
    let homeScore = null
    let awayScore = null

    try {
      const apiResponse = await fetch(`https://api.football-data.org/v4/matches/${cleanId}`, {
        headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
      })
      
      if (apiResponse.ok) {
        const textData = await apiResponse.text()
        if (textData) {
          const matchData = JSON.parse(textData)
          homeScore = matchData.score?.fullTime?.home
          awayScore = matchData.score?.fullTime?.away
          isFinished = matchData.status === 'FINISHED'
        }
      }
    } catch (e) {
      console.error(`API Fetch failed, skipping this cycle.`)
    }

    if (isFinished && homeScore != null && awayScore != null) {
      const { error: updateError } = await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'FT',
        is_finished: true
      }).eq('match_id', matchId).select()

      if (updateError) {
        console.error("Supabase Trigger Error:", updateError)
        return NextResponse.json({ message: 'DB Update failed, stopping retry.' }, { status: 200 })
      }

      // --- NEW: THE GOAL-HUNTER TRIGGER ---
      // Silently ping the scorer sync route in the background so it updates real-time!
      try {
        fetch(`https://worldcuppred.vercel.app/api/admin/sync-scorers`, { method: 'GET' })
          .catch((err) => console.error("Silent Scorer Ping failed:", err))
      } catch (e) {}
      // ------------------------------------

      return NextResponse.json({ message: 'Match finished and updated.' }, { status: 200 })
    
    } else {
      if (retryCount < 120) { 
        await fetch(`https://qstash.upstash.io/v2/publish/https://worldcuppred.vercel.app/api/webhooks/check-score`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '30s'
          },
          body: JSON.stringify({ matchId, retryCount: retryCount + 1 })
        })
        return NextResponse.json({ message: `Snoozing... retry #${retryCount + 1}` }, { status: 200 })
      } 
      return NextResponse.json({ message: 'Max retries hit.' }, { status: 200 })
    }

  } catch (error: any) {
    console.error("Fatal Webhook Crash:", error)
    return NextResponse.json({ message: 'Crashed safely' }, { status: 200 })
  }
}