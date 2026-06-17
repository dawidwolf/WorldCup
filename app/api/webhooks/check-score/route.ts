import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // 1. Safely parse the incoming Upstash webhook
    const bodyText = await request.text()
    if (!bodyText) return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    const body = JSON.parse(bodyText)
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

    let isFinished = false
    let homeScore = null
    let awayScore = null

    // 2. Fetch API Safely (Bypassing JSON parse crashes)
    try {
      const apiResponse = await fetch(`https://api.football-data.org/v4/matches/${match.api_fixture_id}`, {
        headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
      })
      
      if (apiResponse.ok) {
        const textData = await apiResponse.text() // Read as text first!
        if (textData) {
          const matchData = JSON.parse(textData)
          homeScore = matchData.score?.fullTime?.home
          awayScore = matchData.score?.fullTime?.away
          isFinished = matchData.status === 'FINISHED'
        }
      }
    } catch (e) {
      console.error(`API Fetch failed, but keeping loop alive.`)
    }

    // 3. Update Database Safely (Bypassing the Supabase 204 Bug)
    if (isFinished && homeScore !== null && awayScore !== null) {
      
      const { error: updateError } = await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'FT',
        is_finished: true
      }).eq('match_id', matchId).select() // <-- .select() guarantees a safe JSON return!

      if (updateError) throw updateError

      return NextResponse.json({ message: `Match ${matchId} finished. Scores updated perfectly!` })
    
    // 4. The Snooze Button
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
        
        return NextResponse.json({ message: `Scheduled retry #${retryCount + 1}` })
      } else {
        return NextResponse.json({ message: 'Max retries hit.' })
      }
    }

  } catch (error: any) {
    console.error("Fatal Webhook Error:", error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}