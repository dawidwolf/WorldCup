"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { getFlag } from "@/lib/flags"
import { dictionary, Language } from "@/lib/dictionary"
import { supabase } from "@/lib/supabase"
import { Database } from "@/lib/database.types"

export type Match = Database["public"]["Tables"]["matches"]["Row"]
export type Prediction = Database["public"]["Tables"]["predictions"]["Row"]
export type UserProfile = Database["public"]["Tables"]["users"]["Row"]
export type Standing = Database["public"]["Tables"]["standings"]["Row"]
export type Team = Database["public"]["Tables"]["teams"]["Row"]
export type Player = Database["public"]["Tables"]["player_stats"]["Row"]

export interface UserPool {
  pool_id: number
  pool_name: string
  is_admin: boolean
  joined_at: string
}

export interface RankedUser {
  rank: number
  id: number
  name: string
  winnerPick: string
  winnerCode: string
  scorerPick: string
  scorerId?: number | null
  winnerId?: number | null
  exactHits: number
  hits?: number
  misses?: number
  points: number
  isCurrentUser: boolean
}

interface TournamentDataContextType {
  matches: Match[]
  predictions: Record<number, Prediction>
  userProfile: UserProfile | null
  standings: Standing[]
  teams: Team[]
  players: Player[]
  pools: UserPool[]
  rankings: RankedUser[]
  activePoolId: number | null
  arrowState: { hits: string; exact: string; misses: string; accuracy: string };
  isBonusLocked: boolean
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
  silentRefresh: () => Promise<void> // <-- ADDED THIS LINE
  updatePrediction: (matchId: number, home: number | null, away: number | null) => Promise<void>
  updateBonusPick: (type: 'winner' | 'scorer', id: number) => Promise<{ error: string | null }>
  setActivePool: (poolId: number | null) => void
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const TournamentDataContext = createContext<TournamentDataContextType | undefined>(undefined)

export function TournamentDataProvider({ children, userId }: { children: React.ReactNode, userId: number | null }) {
  const currentUserId = userId
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [standings, setStandings] = useState<Standing[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [pools, setPools] = useState<UserPool[]>([])
  const [rankings, setRankings] = useState<RankedUser[]>([])
  const [activePoolId, setActivePoolId] = useState<number | null>(null)
  const [arrowState, setArrowState] = useState<{ hits: string; exact: string; misses: string; accuracy: string }>({ hits: 'none', exact: 'none', misses: 'none', accuracy: 'none' })
  const [isBonusLocked, setIsBonusLocked] = useState(true)
  const [language, setLanguage] = useState<Language>('hu')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRankings = useCallback(async (poolId: number) => {
    try {
      const { data, error } = await supabase
        .from("user_pools")
        .select(`
          user_id,
          is_admin,
          users (
            user_id,
            username,
            points_total,
            exact_hits,
            hits_total,
            misses_total,
            predicted_tournament_winner_id,
            predicted_top_scorer_id,
            teams:predicted_tournament_winner_id (
              team_name,
              team_flag,
              abbreviation
            ),
            player_stats:predicted_top_scorer_id (
              player_name,
              teams (
                team_flag,
                abbreviation,
                team_name
              )
            )
          )
        `)
        .eq("pool_id", poolId)

      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      const transformed: Omit<RankedUser, "rank">[] = rows.map((item: any) => {
        const u = item.users || {}
        const userIdNum = u.user_id
        const winnerId = u.predicted_tournament_winner_id ?? null
        const scorerId = u.predicted_top_scorer_id ?? null

        const winnerPick = u.teams ? (u.teams.team_flag || getFlag(u.teams.abbreviation)) : '🏳️'
        const winnerCode = (u.teams && u.teams.abbreviation) ? String(u.teams.abbreviation) : ''

        return {
          id: userIdNum,
          name: String(u.username || '').toUpperCase(),
          winnerPick,
          winnerCode,
          scorerPick: (u.player_stats && u.player_stats.player_name) ? String(u.player_stats.player_name) : '',
          scorerId,
          winnerId,
          exactHits: u.exact_hits || 0,
          hits: u.hits_total || 0,
          misses: u.misses_total || 0,
          points: u.points_total || 0,
          isCurrentUser: Number(userIdNum) === Number(currentUserId),
        }
      })

      const sorted = transformed.slice().sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits
        return a.name.localeCompare(b.name)
      })

      const ranked: RankedUser[] = []
      let currentRank = 1
      let tieCount = 1

      for (let i = 0; i < sorted.length; i++) {
        const u = sorted[i]
        if (i === 0) {
          ranked.push({ ...u, rank: currentRank })
          continue
        }

        const prev = sorted[i - 1]
        if (u.points === prev.points && u.exactHits === prev.exactHits) {
          ranked.push({ ...u, rank: currentRank })
          tieCount++
        } else {
          currentRank = currentRank + tieCount
          tieCount = 1
          ranked.push({ ...u, rank: currentRank })
        }
      }
      setRankings(ranked)
    } catch (err) {
      console.error("Error fetching rankings:", err)
    }
  }, [currentUserId])

  const computeLastMatchDeltas = useCallback(async (userId: number, userRowData?: any) => {
    try {
      // find last finished match
      const { data: lm } = await supabase
        .from('matches')
        .select('match_id')
        .eq('is_finished', true)
        .order('match_id', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastMatchId = lm?.match_id ?? null

      // fetch all events for this user
      const { data: events } = await supabase
        .from('user_points_events')
        .select('match_id,event_type')
        .eq('user_id', userId)

      if (!events) {
        setArrowState({ hits: 'none', exact: 'none', misses: 'none', accuracy: 'none' })
        return
      }

      const totals = { exact: 0, hits: 0, misses: 0 }
      const before = { exact: 0, hits: 0, misses: 0 }

      events.forEach((ev: any) => {
        const t = ev.event_type
        if (t === 'exact_hit') {
          totals.exact += 1
          if (ev.match_id !== lastMatchId) before.exact += 1
        } else if (t === 'outcome_hit') {
          totals.hits += 1
          if (ev.match_id !== lastMatchId) before.hits += 1
        } else if (t === 'miss') {
          totals.misses += 1
          if (ev.match_id !== lastMatchId) before.misses += 1
        }
      })

      const currentExact = userRowData?.exact_hits ?? totals.exact
      const currentHits = userRowData?.hits_total ?? totals.hits
      const currentMisses = userRowData?.misses_total ?? totals.misses
      const deltaExact = currentExact - before.exact
      const deltaHits = currentHits - before.hits
      const deltaMisses = currentMisses - before.misses
      const totalAfter = currentExact + currentHits + currentMisses
      const totalBefore = before.exact + before.hits + before.misses
      const accAfter = totalAfter > 0 ? ((currentExact + currentHits) / totalAfter) : 0
      const accBefore = totalBefore > 0 ? ((before.exact + before.hits) / totalBefore) : 0
      const pick = (d: number) => (d > 0 ? 'up' : d < 0 ? 'down' : 'none')
      setArrowState({ exact: pick(deltaExact), hits: pick(deltaHits), misses: pick(deltaMisses), accuracy: accAfter > accBefore ? 'up' : accAfter < accBefore ? 'down' : 'none' })
    } catch (err) {
      setArrowState({ hits: 'none', exact: 'none', misses: 'none', accuracy: 'none' })
    }
  }, [])

  // <-- UPDATED SIGNATURE: Accept isSilent parameter
  const fetchData = useCallback(async (isSilent = false) => {
    if (!currentUserId) {
      setMatches([])
      setPredictions({})
      setUserProfile(null)
      setStandings([])
      setTeams([])
      setPlayers([])
      setPools([])
      setRankings([])
      setIsLoading(false)
      return
    }

    // <-- UPDATED LOGIC: Only show loading spinner if it's not a silent refresh
    if (!isSilent) setIsLoading(true)
    
    try {
      const [matchesRes, predictionsRes, userRes, teamsRes, playersRes, standingsRes, poolsRes, firstMatchRes] = await Promise.all([
        supabase.from("matches").select("*").order("kickoff_utc", { ascending: true }),
        supabase.from("predictions").select("*").eq("user_id", currentUserId),
        supabase.from("users").select("*").eq("user_id", currentUserId).maybeSingle(),
        supabase.from("teams").select("*").order("team_name"),
        supabase.from("player_stats").select("*").order("player_name"),
        supabase.from("standings").select("*"),
        supabase.from("user_pools").select(`
          pool_id,
          is_admin,
          joined_at,
          pools (
            pool_name
          )
        `).eq("user_id", currentUserId)
        ,
        supabase.from("matches").select("kickoff_utc").not("kickoff_utc", "is", null).order("kickoff_utc", { ascending: true }).limit(1).single(),      ])

      if (matchesRes.error) throw matchesRes.error
      if (predictionsRes.error) throw predictionsRes.error
      if (userRes.error) throw userRes.error
      if (teamsRes.error) throw teamsRes.error
      if (playersRes.error) throw playersRes.error
      if (standingsRes.error) throw standingsRes.error
      if (poolsRes.error) throw poolsRes.error

      const formattedPools: UserPool[] = (poolsRes.data || []).map((up: any) => ({
        pool_id: up.pool_id,
        pool_name: up.pools.pool_name,
        is_admin: up.is_admin,
        joined_at: up.joined_at,
      }))

      const predsMap: Record<number, Prediction> = {}
      predictionsRes.data?.forEach((p: any) => { predsMap[p.match_id] = p })

      const stored = localStorage.getItem(`wc2026_active_pool_id_${currentUserId}`)
      const storedPoolId = stored ? Number(stored) : null
      const validPool = formattedPools.some(p => p.pool_id === storedPoolId)
      const initialPoolId = validPool ? storedPoolId : (formattedPools[0]?.pool_id || null)

      if (initialPoolId) {
        await fetchRankings(initialPoolId)
        await computeLastMatchDeltas(currentUserId, userRes.data)
      }

      // Check for bonus lock
      if (!firstMatchRes.error && firstMatchRes.data?.kickoff_utc) {
        const firstKickoff = new Date(firstMatchRes.data.kickoff_utc)
        setIsBonusLocked(new Date() >= firstKickoff)
      } else {
        setIsBonusLocked(false) // Default to unlocked if fetch fails
        if (firstMatchRes.error) console.error("Could not determine bonus lock time:", firstMatchRes.error)
      }

      // Batch all state updates together to avoid intermediate renders
      setMatches(matchesRes.data || [])
      setPredictions(predsMap)
      setUserProfile(userRes.data)
      setTeams(teamsRes.data || [])
      setPlayers(playersRes.data || [])
      setStandings(standingsRes.data || [])
      setPools(formattedPools)
      setActivePoolId(initialPoolId)
      setError(null)

      // Turn off loading after all state is set to prevent UI flashes
      setIsLoading(false)
    } catch (err: any) {
      console.error("Error fetching tournament data:", err)
      setError(err.message)
      // Ensure loading state is cleared on error as well
      setIsLoading(false)
    }
  }, [currentUserId, fetchRankings, computeLastMatchDeltas])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const setActivePool = useCallback((poolId: number | null) => {
    setActivePoolId(poolId)
    if (poolId) {
      if (currentUserId) {
        localStorage.setItem(`wc2026_active_pool_id_${currentUserId}`, String(poolId))
      }
      fetchRankings(poolId)
    }
  }, [currentUserId, fetchRankings])

  const t = useCallback((key: string) => {
    try {
      const dictForLang = dictionary[language] as any
      return (dictForLang && dictForLang[key]) ? dictForLang[key] : key
    } catch (err) {
      return key
    }
  }, [language])

  const updatePrediction = useCallback(async (matchId: number, home: number | null, away: number | null) => {
    if (!currentUserId) return

    // 1. UPDATE LOCAL UI STATE IMMEDIATELY
    setPredictions(current => {
      const next = { ...current }
      
      if (home === null && away === null) {
        // If blank, wipe out from cache entirely so inputs look empty
        delete next[matchId]
      } else {
        // Safe structural lookup to make TypeScript happy
        const existingPred = current[matchId]
        
        next[matchId] = {
          match_id: matchId,
          user_id: currentUserId,
          prediction_id: existingPred ? existingPred.prediction_id : 0,
          created_at: existingPred ? existingPred.created_at : new Date().toISOString(),
          version: 1,
          late_penalty_applied: false,
          predicted_home_score: home,
          predicted_away_score: away,
          updated_at: new Date().toISOString()
        } as any
      }
      return next
    })

    // 2. RUN DIRECT DATABASE OPERATIONS
    try {
      if (home === null && away === null) {
        // Purge row cleanly to respect database NOT-NULL constraints
        const { error } = await supabase
          .from('predictions')
          .delete()
          .eq('user_id', currentUserId)
          .eq('match_id', matchId)

        if (error) throw error
      } else {
        // Upsert values safely without duplication conflicts
        const { error } = await supabase
          .from('predictions')
          .upsert(
            {
              user_id: currentUserId,
              match_id: matchId,
              predicted_home_score: home,
              predicted_away_score: away,
              updated_at: new Date().toISOString()
            } as any,
            {
              onConflict: 'user_id,match_id'
            }
          )

        if (error) throw error
      }
    } catch (err: any) {
      console.error(
        `Failed to sync prediction with database. Code: ${err?.code || 'N/A'}, Message: ${err?.message || 'N/A'}`
      )
    }
  }, [currentUserId])

  const updateBonusPick = useCallback(async (type: 'winner' | 'scorer', id: number): Promise<{ error: string | null }> => {
    if (!currentUserId) return { error: 'Not logged in' }

    const column = type === 'winner' ? 'predicted_tournament_winner_id' : 'predicted_top_scorer_id'
    const originalProfile = userProfile
    
    // 1. Optimistically update local state so the UI stays instant
    setUserProfile(current => current ? { ...current, [column]: id } : null)

    // 2. Call the RPC to persist the change
    try {
      const { error } = await supabase.rpc("save_bonus_pick", {
        p_user_id: currentUserId,
        p_pick_type: type,
        p_team_id: type === 'winner' ? id : undefined,
        p_player_id: type === 'scorer' ? id : undefined,
      })

      if (error) throw error

      // On success, refresh rankings as bonus picks can affect it
      if (activePoolId) {
        fetchRankings(activePoolId)
      }

      return { error: null } // Success
    } catch (err: any) {
      console.error(`Failed to save ${type} pick via RPC:`, err?.message || err)
      setUserProfile(originalProfile) // Revert on failure
      return { error: err.message || `Failed to save ${type} pick` }
    }
  }, [currentUserId, userProfile, activePoolId, fetchRankings])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase.channel('tournament-global-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        setMatches(current => {
          if (payload.eventType === 'INSERT') {
            return [...current, payload.new as Match].sort((a,b) => (a.kickoff_utc||'').localeCompare(b.kickoff_utc||''))
          }
          if (payload.eventType === 'UPDATE') {
            return current.map(m => m.match_id === (payload.new as Match).match_id ? (payload.new as Match) : m)
          }
          if (payload.eventType === 'DELETE') {
            return current.filter(m => m.match_id !== (payload.old as Match).match_id)
          }
          return current
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions', filter: `user_id=eq.${currentUserId}` }, (payload) => {
        setPredictions(current => {
          const next = { ...current }
          if (payload.eventType === 'DELETE') {
            delete next[(payload.old as Prediction).match_id]
          } else {
            const p = payload.new as Prediction
            next[p.match_id] = p
          }
          return next
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `user_id=eq.${currentUserId}` }, (payload) => {
        setUserProfile(payload.new as UserProfile)
        computeLastMatchDeltas(currentUserId, payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_stats' }, (payload) => {
        setPlayers(current => {
          if (payload.eventType === 'INSERT') return [...current, payload.new as Player]
          if (payload.eventType === 'UPDATE') return current.map(p => p.player_id === (payload.new as Player).player_id ? (payload.new as Player) : p)
          if (payload.eventType === 'DELETE') return current.filter(p => p.player_id !== (payload.old as Player).player_id)
          return current
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, computeLastMatchDeltas])

  // Pool-specific realtime for rankings
  useEffect(() => {
    if (!activePoolId || !currentUserId) return;

    const channel = supabase
      .channel(`pool-updates-${activePoolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchRankings(activePoolId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points_events' }, () => {
        fetchRankings(activePoolId)
        computeLastMatchDeltas(currentUserId)
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePoolId, currentUserId, fetchRankings, computeLastMatchDeltas]);

  return (
    <TournamentDataContext.Provider value={{ 
      matches, 
      predictions, 
      userProfile, 
      standings, 
      teams, 
      players, 
      pools,
      rankings,
      activePoolId,
      arrowState,
      isBonusLocked,
      isLoading, 
      error, 
      refreshData: () => fetchData(false), 
      silentRefresh: () => fetchData(true), // <-- ADDED THIS LINE
      updatePrediction,
      updateBonusPick,
      setActivePool,
      language,
      setLanguage,
      t
    }}>
      {children}
    </TournamentDataContext.Provider>
  )
}

export function useTournamentData() {
  const context = useContext(TournamentDataContext)
  if (context === undefined) {
    throw new Error("useTournamentData must be used within a TournamentDataProvider")
  }
  return context
}