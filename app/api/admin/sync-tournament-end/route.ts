import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { finalMatchId } = body

    if (!finalMatchId) return NextResponse.json({ message: 'Missing finalMatchId' }, { status: 400 })

    // 1. GET THE FINAL MATCH TO DETERMINE THE WINNER
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, home_score, away_score, penalty_winner, is_finished')
      .eq('match_id', finalMatchId)
      .single()

    if (matchError || !match || !match.is_finished) {
      return NextResponse.json({ message: 'Final match not ready or not found.' }, { status: 200 })
    }

    // Figure out who won the trophy
    let tournamentWinnerId = null;
    if (match.penalty_winner === 'home') tournamentWinnerId = match.home_team_id;
    else if (match.penalty_winner === 'away') tournamentWinnerId = match.away_team_id;
    else if (match.home_score > match.away_score) tournamentWinnerId = match.home_team_id;
    else if (match.away_score > match.home_score) tournamentWinnerId = match.away_team_id;

    if (!tournamentWinnerId) {
      return NextResponse.json({ message: 'Could not mathematically determine a winner.' }, { status: 400 })
    }

    // 2. DETERMINE TOP SCORER(S)
    const { data: players, error: playersError } = await supabase
      .from('player_stats')
      .select('player_id, goals')
      .order('goals', { ascending: false })

    if (playersError || !players || players.length === 0) throw playersError;

    // Grab the highest goal count, then filter to find ALL players who have that exact amount
    const maxGoals = players[0].goals;
    const topScorerIds = players.filter(p => p.goals === maxGoals).map(p => p.player_id);

    // 3. DISTRIBUTE BONUS POINTS TO USERS
    // We only select users who haven't received their bonus yet (bonus_awarded = false)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id, points_total, predicted_tournament_winner_id, predicted_top_scorer_id, bonus_awarded')
      .eq('bonus_awarded', false)

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'All users have already received their tournament bonuses.' }, { status: 200 })
    }

    let usersRewardedCount = 0;

    for (const user of users) {
      let bonusPoints = 0;

      // Check Winner Pick
      if (user.predicted_tournament_winner_id === tournamentWinnerId) {
        bonusPoints += 10;
      }

      // Check Scorer Pick (Checks if their pick is ANYWHERE inside the array of tied winners)
      if (user.predicted_top_scorer_id && topScorerIds.includes(user.predicted_top_scorer_id)) {
        bonusPoints += 10;
      }

      // Update the user's total score and lock their account so they can't get bonuses again
      await supabase
        .from('users')
        .update({ 
          points_total: user.points_total + bonusPoints,
          bonus_awarded: true 
        })
        .eq('user_id', user.user_id)
        
      if (bonusPoints > 0) usersRewardedCount++;
    }

    return NextResponse.json({ 
      message: `WORLD CUP CONCLUDED! Winner ID: ${tournamentWinnerId}. Top Scorers: ${topScorerIds.join(', ')}. ${usersRewardedCount} users won bonus points!` 
    }, { status: 200 })

  } catch (error: any) {
    console.error('[sync-tournament-end] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}