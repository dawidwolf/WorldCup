import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = 'https://worldcuppred.vercel.app'
const MAX_RETRIES = 360 // 360 * 15s = 90 minutes of polling after 110th min

export async function POST(request: Request) {
  let matchIdToRetry: number | null = null;
  let nextRetryCount = 1;

  try {
    const bodyText = await request.text()
    if (!bodyText) return NextResponse.json({ message: 'Empty body' }, { status: 200 })
    
    const body = JSON.parse(bodyText)
    const { matchId, retryCount = 0 } = body

    if (!matchId) return NextResponse.json({ message: 'Missing matchId' }, { status: 200 })
    
    matchIdToRetry = matchId;
    nextRetryCount = retryCount + 1;

    const { data: match, error: dbError } = await supabase
      .from('matches')
      .select('api_fixture_id, is_finished')
      .eq('match_id', matchId)
      .single()

    if (dbError) {
      console.error('[check-score] Transient DB Error:', dbError)
      throw new Error("Temporary DB Error"); 
    }

    if (!match || match.is_finished) {
      return NextResponse.json({ message: 'Match finished or not found' }, { status: 200 })
    }

    const cleanId = parseInt(String(match.api_fixture_id), 10)
    if (isNaN(cleanId)) {
      return NextResponse.json({ message: 'Invalid API ID' }, { status: 200 })
    }

    let isFinished = false
    let homeScore = null
    let awayScore = null
    let penaltyWinner = null // <-- Added for penalty logic

    try {
      // SAFETY NET 1: AbortController prevents API from hanging Vercel
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const apiResponse = await fetch(`https://api.football-data.org/v4/matches/${cleanId}`, {
        headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! },
        cache: 'no-store',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (apiResponse.ok) {
        const textData = await apiResponse.text()
        if (textData) {
          const matchData = JSON.parse(textData)
          
          // SAFETY NET 2: Bulletproof Parser (Strict Open-Play Goals)
          const scoreObj = matchData.score || {};
          
          const hasRegularTime = scoreObj.regularTime && scoreObj.regularTime.home !== null;
          const hasExtraTime = scoreObj.extraTime && scoreObj.extraTime.home !== null;
          
          if (hasRegularTime) {
            // 1. Start with the 90-minute score
            homeScore = scoreObj.regularTime.home;
            awayScore = scoreObj.regularTime.away;
            
            // 2. If it went to Extra Time, explicitly ADD the extra time goals to the total!
            if (hasExtraTime) {
              homeScore += scoreObj.extraTime.home;
              awayScore += scoreObj.extraTime.away;
            }
          } else {
            // Fallback if the API only provides a generic full time score
            homeScore = scoreObj.fullTime?.home;
            awayScore = scoreObj.fullTime?.away;
          }
          
          // 3. Safely detect if a penalty shootout happened for the visual (p) badge
          // We now use the API's explicit 'duration' and 'winner' flags instead of just counting goals
          if (scoreObj.duration === 'PENALTY_SHOOTOUT' || (scoreObj.penalties && scoreObj.penalties.home !== null)) {
            
            // Primary check: The API explicitly tells us who won
            if (scoreObj.winner === 'HOME_TEAM') {
              penaltyWinner = 'home';
            } else if (scoreObj.winner === 'AWAY_TEAM') {
              penaltyWinner = 'away';
            } 
            // Fallback check: Manually calculate from the goals if the string is missing
            else if (scoreObj.penalties && scoreObj.penalties.home !== null && scoreObj.penalties.away !== null) {
              if (scoreObj.penalties.home > scoreObj.penalties.away) {
                penaltyWinner = 'home';
              } else if (scoreObj.penalties.away > scoreObj.penalties.home) {
                penaltyWinner = 'away';
              }
            }
          }
          
          isFinished = matchData.status === 'FINISHED' || matchData.status === 'AWARDED';
          
          console.log(`=== DEBUG MATCH ${matchId} ===`)
          console.log(`RAW STATUS: ${matchData.status}`)
          console.log(`PARSED: Home: ${homeScore}, Away: ${awayScore}, isFinished: ${isFinished}, penaltyWinner: ${penaltyWinner}`)
          console.log(`===========================`)
        }
      }
    } catch (e) {
      console.error(`[check-score] API fetch failed or timed out. Skipping this cycle.`)
    }

    if (isFinished && homeScore != null && awayScore != null) {
      // SAFETY NET 3: Two-Step DB Update (Prevents Trigger Timeout)
      
      // Step A: Update scores and penalty winner only
      await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        penalty_winner: penaltyWinner, // <-- Added penalty winner injection
        status: 'FT',
      }).eq('match_id', matchId)

      // Step B: Flip the finished switch to run the heavy math triggers
      const { error: updateError } = await supabase.from('matches').update({
        is_finished: true,
        goals_processed: true,
      }).eq('match_id', matchId)

      if (updateError) {
        console.error('[check-score] Supabase update error:', updateError)
        throw new Error("DB Update Failed");
      }

      // --- THE NEW AUTOMATION BLOCK ---
      
      // 1. Trigger the Top Scorers check (10 seconds from now)
      await fetch(`https://qstash.upstash.io/v2/publish/${BASE_URL}/api/admin/sync-scorers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Upstash-Delay': '10s',
        }
      });

      // 2. Trigger the Knockout Bracket check (30 minutes from now)
      await fetch(`https://qstash.upstash.io/v2/publish/${BASE_URL}/api/admin/sync-fixtures`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Upstash-Delay': '30m', 
        }
      });

      return NextResponse.json({ message: `Match ${matchId} finished and updated. Scorers and Fixtures scheduled.` }, { status: 200 })
    } 

  } catch (error: any) {
    console.error('[check-score] Caught error, dropping down to retry loop:', error)
  }
  
  if (matchIdToRetry && nextRetryCount <= MAX_RETRIES) {
    const qstashRes = await fetch(`https://qstash.upstash.io/v2/publish/${BASE_URL}/api/webhooks/check-score`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': '15s', // Perfect 15-second interval
        'Upstash-Deduplication-Id': `match-${matchIdToRetry}-retry-${nextRetryCount}`,
      },
      body: JSON.stringify({ matchId: matchIdToRetry, retryCount: nextRetryCount })
    });

    if (!qstashRes.ok) {
      console.error('[check-score] QStash rejected the retry.', await qstashRes.text());
    }

    return NextResponse.json({ message: `Snoozing... retry #${nextRetryCount}/${MAX_RETRIES}` }, { status: 200 })
  }

  return NextResponse.json({ message: 'Max retries hit or fatal setup error.' }, { status: 200 })
}