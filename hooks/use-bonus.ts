import { useState, useEffect, useMemo } from "react"
import { getAppTime } from "@/lib/time"
import { useTournamentData } from "../context/tournament-data-context"

type Match = {
  match_id: number
  kickoff_utc: string
}
import { toast } from "sonner"

export type DBTeam = {
  team_id: number;
  team_name: string | null;
  abbreviation: string | null;
  team_flag: string | null;
}

export type DBPlayer = {
  player_id: number;
  player_name: string;
  team_id: number | null;
  goals: number;
}

export function useBonus(userId: number | null) {
  const { teams, players, userProfile, matches, isLoading: contextLoading, updateBonusPick } = useTournamentData()
  
  const savedWinnerId = userProfile?.predicted_tournament_winner_id ?? null
  const savedScorerId = userProfile?.predicted_top_scorer_id ?? null

  const goldenBootLeaders = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals
      return a.player_id - b.player_id
    })
  }, [players])

  const [currentTimeMs, setCurrentTimeMs] = useState(() => getAppTime().getTime())
  
  const tournamentStartMs = useMemo(() => {
    if (!matches.length) return null
    // Cutoff is the first match kickoff.
    return Math.min(...(matches as any[]).map((m: any) => Date.parse(m.kickoff_utc || '')))
  }, [matches])

  const isLocked = Boolean(tournamentStartMs && currentTimeMs >= tournamentStartMs)

  useEffect(() => {
    const interval = setInterval(() => setCurrentTimeMs(getAppTime().getTime()), 5000)
    return () => clearInterval(interval)
  }, [])

  const saveWinner = async (teamId: number) => {
    if (isLocked) {
      toast.error('Tournament has started. Picks are locked.')
      return
    }
    await updateBonusPick('winner', teamId)
  }

  const saveScorer = async (playerId: number) => {
    if (isLocked) {
      toast.error('Tournament has started. Picks are locked.')
      return
    }
    await updateBonusPick('scorer', playerId)
  }

  return {
    teams,
    players,
    savedWinnerId,
    savedScorerId,
    goldenBootLeaders,
    isLocked,
    loading: contextLoading,
    saveWinner,
    saveScorer
  }
}
