import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { getAppTime } from "@/lib/time"

export type DBTeam = {
  team_id: number;
  team_name: string;
  abbreviation: string;
  team_flag: string;
}

export type DBPlayer = {
  player_id: number;
  player_name: string;
  team_id: number;
  goals: number;
}

const normalizeTeam = (team: any): DBTeam => ({
  team_id: Number(team.team_id ?? 0),
  team_name: String(team.team_name ?? ""),
  abbreviation: String(team.abbreviation ?? ""),
  team_flag: String(team.team_flag ?? ""),
})

const normalizePlayer = (player: any): DBPlayer => ({
  player_id: Number(player.player_id ?? 0),
  player_name: String(player.player_name ?? ""),
  team_id: Number(player.team_id ?? 0),
  goals: Number(player.goals ?? 0),
})

export function useBonus(userId: number | null) {
  const [teams, setTeams] = useState<DBTeam[]>([])
  const [players, setPlayers] = useState<DBPlayer[]>([])
  
  // The user's saved picks from DB (if any)
  const [savedWinnerId, setSavedWinnerId] = useState<number | null>(null)
  const [savedScorerId, setSavedScorerId] = useState<number | null>(null)

  // Top goalscorers live leaderboard
  const [goldenBootLeaders, setGoldenBootLeaders] = useState<DBPlayer[]>([])

  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(() => getAppTime().getTime())
  const [tournamentStartMs, setTournamentStartMs] = useState<number | null>(null)

  // Keep the lock state fresh so the cards flip automatically as time moves.
  useEffect(() => {
    const checkTime = () => {
      setCurrentTimeMs(getAppTime().getTime())
    }
    checkTime()
    const interval = setInterval(checkTime, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setIsLocked(Boolean(tournamentStartMs && currentTimeMs >= tournamentStartMs))
  }, [currentTimeMs, tournamentStartMs])

  useEffect(() => {
    if (!userId) return
    const currentUserId = userId

    async function loadData() {
      setLoading(true)

      const [teamsRes, playersRes, userRes, deadlineRes] = await Promise.all([
        supabase.from('teams').select('*').order('team_name'),
        supabase.from('player_stats').select('*').order('player_name'),
        supabase.from('users').select('predicted_tournament_winner_id, predicted_top_scorer_id').eq('user_id', currentUserId).single(),
        supabase
          .from('matches')
          .select('kickoff_utc, is_finished, round, group_turn')
          .order('kickoff_utc', { ascending: true })
      ])

      if (!teamsRes.error && teamsRes.data) {
        setTeams(teamsRes.data.map(normalizeTeam))
      }
      if (!playersRes.error && playersRes.data) {
        const normalizedPlayers = playersRes.data.map(normalizePlayer)
        setPlayers(normalizedPlayers)
        // Build golden boot leaders sorted by goals DESC then player_id ASC.
        // Keep the full list so the UI can scroll through every player.
        const leaders = [...normalizedPlayers]
          .sort((a, b) => {
            if (b.goals !== a.goals) return b.goals - a.goals
            return a.player_id - b.player_id
          })
        setGoldenBootLeaders(leaders)
      }
      if (!userRes.error && userRes.data) {
        setSavedWinnerId(userRes.data.predicted_tournament_winner_id)
        setSavedScorerId(userRes.data.predicted_top_scorer_id)
      }

      if (!deadlineRes.error && deadlineRes.data) {
        const kickoffTimes = deadlineRes.data
          .map((row: any) => row.kickoff_utc)
          .filter(Boolean)
          .map((value: string) => Date.parse(value))
          .filter((value: number) => !Number.isNaN(value))

        if (kickoffTimes.length > 0) {
          setTournamentStartMs(kickoffTimes[0])
        }
      }

      setLoading(false)
    }

    loadData()
  }, [userId])

  // Realtime subscription: listen for updates to player_stats and update local state
  // Start subscription only after initial players load to avoid race during startup.
  useEffect(() => {
    if (players.length === 0) return

    // create a dedicated channel for player_stats updates
    const channel = supabase
      .channel('player-stats')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'player_stats' },
        (payload: any) => {
          try {
            const n = payload.new
            if (!n) return

            setPlayers((prev) => {
              const exists = prev.some((p) => p.player_id === n.player_id)
              let updated: DBPlayer[]
              if (exists) {
                updated = prev.map((p) =>
                  p.player_id === n.player_id
                    ? {
                        ...p,
                        goals: Number(n.goals ?? 0),
                        player_name: String(n.player_name ?? p.player_name),
                        team_id: Number(n.team_id ?? p.team_id),
                      }
                    : p
                )
              } else {
                // new player row introduced
                updated = [
                  ...prev,
                  {
                    player_id: Number(n.player_id),
                    player_name: String(n.player_name ?? 'Unknown'),
                    team_id: Number(n.team_id ?? 0),
                    goals: Number(n.goals ?? 0),
                  },
                ]
              }

              // Recompute leaders using Golden Boot tie-breaker: goals DESC, then player_id ASC
              const leaders = [...updated]
                .sort((a, b) => {
                  if (b.goals !== a.goals) return b.goals - a.goals
                  return a.player_id - b.player_id
                })

              // update leaders immediately
              setGoldenBootLeaders(leaders)

              return updated
            })
          } catch (err) {
            console.error('Failed to handle realtime player_stats update', err)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [players.length])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('bonus-match-phase')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload: any) => {
          const row = payload.new as any
          if (!row) return

          if (row.group_turn === 1 || String(row.round ?? '').trim().toLowerCase() === 'group stage') {
            setCurrentTimeMs(getAppTime().getTime())
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const saveWinner = async (teamId: number | null) => {
    if (!userId || isLocked) return
    const { error } = await supabase.rpc('save_bonus_pick', {
      p_user_id: userId,
      p_pick_type: 'winner',
      p_team_id: teamId ?? undefined,
      p_player_id: undefined,
    })
    if (!error) setSavedWinnerId(teamId)
    return { error }
  }

  const saveScorer = async (playerId: number | null) => {
    if (!userId || isLocked) return
    const { error } = await supabase.rpc('save_bonus_pick', {
      p_user_id: userId,
      p_pick_type: 'scorer',
      p_team_id: undefined,
      p_player_id: playerId ?? undefined,
    })
    if (!error) setSavedScorerId(playerId)
    return { error }
  }

  return {
    teams,
    players,
    savedWinnerId,
    savedScorerId,
    goldenBootLeaders,
    isLocked,
    tournamentStartMs,
    loading,
    saveWinner,
    saveScorer
  }
}
