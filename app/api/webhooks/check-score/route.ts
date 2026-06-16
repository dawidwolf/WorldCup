export const maxDuration = 60; // Gives your DB 60 seconds to finish the math!

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
    if (isFinished && homeScore !== null && awayScore !== null && homeScore !== undefined && awayScore !== undefined) {
      
      // STEP 4A: Update the scores and status first
      const { error: scoreError } = await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'FT'
      }).eq('match_id', matchId)

      if (scoreError) throw scoreError

      // STEP 4B: Flip the is_finished switch to trigger the database math
      const { error: finishError } = await supabase.from('matches').update({
        is_finished: true
      }).eq('match_id', matchId)

      if (finishError) throw finishError

      // STEP 4C: Update the Goalscorers!
      // Extract the goals array from the football-data.org response
      const goals = matchData.goals || []
      
      // Count how many goals each player scored in this specific match
      const goalCounts: Record<number, number> = {}
      for (const goal of goals) {
        // We ensure a scorer exists (skipping own goals if the API doesn't attribute them)
        if (goal.scorer && goal.scorer.id) {
          goalCounts[goal.scorer.id] = (goalCounts[goal.scorer.id] || 0) + 1
        }
      }

      // Send the increments to Supabase using our new RPC function
      for (const [scorerId, count] of Object.entries(goalCounts)) {
        const { error: rpcError } = await supabase.rpc('increment_player_goals', {
          p_api_player_id: parseInt(scorerId),
          p_goals_to_add: count
        })
        
        if (rpcError) {
          console.error(`Failed to update goals for player ${scorerId}:`, rpcError)
        }
      }

      return NextResponse.json({ message: `Match ${matchId} finished. Scores and Player Goals updated perfectly!` })
    
    // 5. IF NOT FINISHED: Hit the 30-Second Snooze Button
    } else {
      // 90 retries * 30 seconds = 45 minutes of checking (still covers extra time and penalties perfectly!)
      if (retryCount < 90) { 
        const targetUrl = `https://worldcuppred.vercel.app/api/webhooks/check-score`
        await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '30s' // <--- 30-second delay
          },
          body: JSON.stringify({ matchId, retryCount: retryCount + 1 })
        })
        
        return NextResponse.json({ message: `Match still playing (Status: ${status}). Scheduled retry #${retryCount + 1} in 30 seconds.` })
      } else {
        return NextResponse.json({ message: 'Match went on too long. Max retries hit.' })
      }
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}