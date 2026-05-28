import { supabase } from './supabase'
import { toast } from 'sonner'

/**
 * Finalize a match by calling the `process_match_conclusion` RPC on the database.
 * @throws will toast and rethrow on failure
 */
export async function finalizeMatchScore(
  matchId: number | null | undefined,
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
  scorerIds: number[] | null | undefined
) {
  // Basic type-safety checks with user-facing toast
  if (typeof matchId !== 'number' || Number.isNaN(matchId)) {
    const msg = 'finalizeMatchScore: missing or invalid matchId'
    console.error(msg, { matchId, homeScore, awayScore, scorerIds })
    toast.error(msg)
    throw new Error(msg)
  }

  if (typeof homeScore !== 'number' || Number.isNaN(homeScore) || typeof awayScore !== 'number' || Number.isNaN(awayScore)) {
    const msg = 'finalizeMatchScore: missing or invalid score(s)'
    console.error(msg, { matchId, homeScore, awayScore, scorerIds })
    toast.error(msg)
    throw new Error(msg)
  }

  if (!Array.isArray(scorerIds)) {
    const msg = 'finalizeMatchScore: missing or invalid scorerIds'
    console.error(msg, { matchId, homeScore, awayScore, scorerIds })
    toast.error(msg)
    throw new Error(msg)
  }

  try {
    const { data, error } = await supabase.rpc('process_match_conclusion', {
      p_match_id: matchId,
      p_home_score: homeScore,
      p_away_score: awayScore,
      p_scorer_ids: scorerIds,
    })

    if (error) {
      console.error('process_match_conclusion RPC error', error)
      toast.error(error.message || 'Failed to finalize match')
      throw error
    }

    toast.success('Match finalized successfully')
    return data
  } catch (err: any) {
    console.error('finalizeMatchScore failed', err)
    // If the error has a message, surface it; otherwise show a generic message
    toast.error(err?.message || 'Unexpected error finalizing match')
    throw err
  }
}

export default finalizeMatchScore
