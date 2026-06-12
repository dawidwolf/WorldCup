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

    // 1. Double check the database so we don't accidentally check a match we already finished
    const { data: match, error: dbError } = await supabase
      .from('matches')
      .select('api_fixture_id, is_finished')
      .eq('match_id', matchId)
      .single()

    if (dbError || !match || match.is_finished) {
      return NextResponse.json({ message: 'Match already finished or not found' })
    }

    // 2. Call the Sports Reporter (Cost: 1 API Call)
    const apiResponse = await fetch(`https://v3.football.api-sports.io/fixtures?id=${match.api_fixture_id}`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_API_KEY! }
    })
    
    if (!apiResponse.ok) throw new Error('API-Football request failed')
      
    const apiData = await apiResponse.json()
    const fixtureData = apiData.response[0]

    const status = fixtureData.fixture.status.short
    const homeScore = fixtureData.goals.home
    const awayScore = fixtureData.goals.away

    const isFinished = ['FT', 'AET', 'PEN'].includes(status)

    // 3. IF FINISHED: Save everything
    if (isFinished && homeScore !== null && awayScore !== null) {
      
      // Update the match score (This fires your 5/3/2 points trigger automatically!)
      await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: status,
        is_finished: true
      }).eq('match_id', matchId)

      // 4. Update the Goal Scorers!
      const events = fixtureData.events || []
      // We only care about Normal Goals and Penalty Goals (Ignore Own Goals and Misses)
      const goals = events.filter((e: any) => e.type === 'Goal' && e.detail !== 'Own Goal' && e.detail !== 'Missed Penalty')

      for (const goal of goals) {
        const playerId = goal.player.id
        if (playerId) {
          // Look up if this player is in your Top 114 list
          const { data: player } = await supabase
            .from('player_stats')
            .select('goals')
            .eq('api_player_id', playerId)
            .single()
            
          // If they are on your list, add +1 to their goal count!
          if (player) {
            await supabase.from('player_stats').update({ goals: player.goals + 1 }).eq('api_player_id', playerId)
          }
        }
      }

      return NextResponse.json({ message: `Match ${matchId} finished. Scores and stats updated!` })
    
    // 5. IF NOT FINISHED: Hit the Snooze Button
    } else {
      if (retryCount < 6) {
        // Send a message to Upstash asking it to call us back in exactly 5 minutes
        const targetUrl = `https://worldcuppred.vercel.app/api/webhooks/check-score`
        await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '5m' // The 5 minute snooze!
          },
          body: JSON.stringify({ matchId, retryCount: retryCount + 1 })
        })
        
        return NextResponse.json({ message: `Match still playing. Scheduled retry #${retryCount + 1} in 5 minutes.` })
      } else {
        return NextResponse.json({ message: 'Match went on too long. Max retries hit.' })
      }
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}