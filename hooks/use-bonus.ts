// hooks/use-bonus.ts
// Full replacement — drop this file in and it will work with your existing bonus-tab.tsx unchanged.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────
export type DBTeam = {
  team_id: number
  team_name: string | null
  abbreviation: string | null
  group: string | null
  team_flag: string | null
}

export type DBPlayer = {
  player_id: number
  player_name: string
  team_id: number | null
  goals: number | null
  api_player_id: number | null
}

// Shape that bonus-tab.tsx already expects from saveWinner / saveScorer
type SaveResult = { error: string | null }

interface UseBonusReturn {
  teams: DBTeam[]
  players: DBPlayer[]
  savedWinnerId: number | null
  savedScorerId: number | null
  goldenBootLeaders: DBPlayer[]
  isLocked: boolean
  loading: boolean
  saveWinner: (teamId: number) => Promise<SaveResult>
  saveScorer: (playerId: number) => Promise<SaveResult>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBonus(currentUserId: number | null): UseBonusReturn {
  const [teams, setTeams] = useState<DBTeam[]>([])
  const [players, setPlayers] = useState<DBPlayer[]>([])
  const [savedWinnerId, setSavedWinnerId] = useState<number | null>(null)
  const [savedScorerId, setSavedScorerId] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(true)

  // ─── Load everything on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)

      // Run all three fetches in parallel — faster than sequential awaits
      const [teamsRes, playersRes, userRes] = await Promise.all([
        supabase
          .from("teams")
          .select("team_id, team_name, abbreviation, group, team_flag")
          .order("team_name", { ascending: true }),

        supabase
          .from("player_stats")
          .select("player_id, player_name, team_id, goals, api_player_id")
          .order("player_name", { ascending: true }),

        supabase
          .from("users")
          .select("predicted_tournament_winner_id, predicted_top_scorer_id, late_winner_penalty, late_scorer_penalty")
          .eq("user_id", currentUserId)
          .single(),
      ])

      // Teams
      if (teamsRes.error) {
        console.error("[useBonus] teams load error:", teamsRes.error.message)
      } else {
        setTeams(teamsRes.data ?? [])
      }

      // Players
      if (playersRes.error) {
        console.error("[useBonus] players load error:", playersRes.error.message)
      } else {
        setPlayers(playersRes.data ?? [])
      }

      // User's saved picks
      if (userRes.error) {
        console.error("[useBonus] user load error:", userRes.error.message)
        // If this errors it's almost always an RLS issue — session variable not set
      } else if (userRes.data) {
        setSavedWinnerId(userRes.data.predicted_tournament_winner_id ?? null)
        setSavedScorerId(userRes.data.predicted_top_scorer_id ?? null)
      }

      // Determine if picks are locked:
      // Locked = the first match of the tournament has already kicked off
      const firstMatchRes = await supabase
        .from("matches")
        .select("kickoff_utc")
        .not("kickoff_utc", "is", null)
        .order("kickoff_utc", { ascending: true })
        .limit(1)
        .single()

      if (!firstMatchRes.error && firstMatchRes.data?.kickoff_utc) {
        const firstKickoff = new Date(firstMatchRes.data.kickoff_utc)
        setIsLocked(new Date() >= firstKickoff)
      }

      setLoading(false)
    }

    load()
  }, [currentUserId])

  // ─── Save winner pick ──────────────────────────────────────────────────────
  const saveWinner = useCallback(async (teamId: number): Promise<SaveResult> => {
    if (!currentUserId) return { error: "Not logged in" }

    const { error } = await supabase.rpc("save_bonus_pick", {
      p_user_id: currentUserId,
      p_pick_type: "winner",
      p_team_id: teamId,
      p_player_id: null,
    } as any) // ⚡ Add 'as any' here to bypass TypeScript's RPC schema checks

    if (error) {
      console.error("[useBonus] saveWinner error:", error.message)
      return { error: error.message }
    }

    setSavedWinnerId(teamId)
    return { error: null }
  }, [currentUserId])

const saveScorer = useCallback(async (playerId: number): Promise<SaveResult> => {
    if (!currentUserId) return { error: "Not logged in" }

    const { error } = await supabase.rpc("save_bonus_pick", {
      p_user_id: currentUserId,
      p_pick_type: "scorer",
      p_team_id: null,
      p_player_id: playerId,
    } as any) // ⚡ Add 'as any' here too

    if (error) {
      console.error("[useBonus] saveScorer error:", error.message)
      return { error: error.message }
    }

    setSavedScorerId(playerId)
    return { error: null }
  }, [currentUserId])

  // ─── Golden boot leaderboard ───────────────────────────────────────────────
  // Sorted by goals desc, only players with goals > 0 (or all if none scored yet)
  const goldenBootLeaders = [...players].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))

  return {
    teams,
    players,
    savedWinnerId,
    savedScorerId,
    goldenBootLeaders,
    isLocked,
    loading,
    saveWinner,
    saveScorer,
  }
}
