"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
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
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
  updatePrediction: (matchId: number, home: number | null, away: number | null) => Promise<void>
  updateBonusPick: (type: 'winner' | 'scorer', id: number) => Promise<void>
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
      const transformed: RankedUser[] = rows.map((item: any, idx: number) => {
        const u = item.users || {}
        const userIdNum = u.user_id
        const winnerId = u.predicted_tournament_winner_id ?? null
        const scorerId = u.predicted_top_scorer_id ?? null

        const winnerPick = (u.teams && (u.teams.team_flag || u.teams.abbreviation)) ? String(u.teams.team_flag || u.teams.abbreviation) : '🏳️'
        const winnerCode = (u.teams && u.teams.abbreviation) ? String(u.teams.abbreviation) : ''

        return {
          rank: idx + 1,
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

      setRankings(transformed)
    } catch (err) {
      console.error("Error fetching rankings:", err)
    }
  }, [currentUserId])

  const fetchData = useCallback(async () => {
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

    setIsLoading(true)
    try {
      const [matchesRes, predictionsRes, userRes, teamsRes, playersRes, standingsRes, poolsRes] = await Promise.all([
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
      ])

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
  }, [currentUserId, fetchRankings])

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

  const updateBonusPick = useCallback(async (type: 'winner' | 'scorer', id: number) => {
    if (!currentUserId) return

    const column = type === 'winner' ? 'predicted_tournament_winner_id' : 'predicted_top_scorer_id'
    
    // 1. Optimistically update local state so the UI stays instant
    setUserProfile(current => current ? { ...current, [column]: id } : null)

    // 2. Go straight to a clean database table modification
    try {
      const { error } = await supabase
        .from('users')
        .update({ [column]: id } as any)
        .eq('user_id', currentUserId)

      if (error) throw error
    } catch (err: any) {
      console.error(`Failed to save ${type} pick directly:`, err?.message || err)
    }
  }, [currentUserId])

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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_stats' }, (payload) => {
        setPlayers(current => {
          if (payload.eventType === 'INSERT') return [...current, payload.new as Player]
          if (payload.eventType === 'UPDATE') return current.map(p => p.player_id === (payload.new as Player).player_id ? (payload.new as Player) : p)
          if (payload.eventType === 'DELETE') return current.filter(p => p.player_id !== (payload.old as Player).player_id)
          return current
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
        const newUser = payload.new as UserProfile
        setRankings(current => {
          return current.map((row: any) => {
            if ((row as any).user_id === newUser.user_id) {
              return {
                ...row,
                users: {
                  ...((row as any).users || {}),
                  points_total: newUser.points_total,
                  exact_hits: newUser.exact_hits,
                  hits_total: newUser.hits_total,
                  misses_total: newUser.misses_total,
                  predicted_tournament_winner_id: newUser.predicted_tournament_winner_id,
                  predicted_top_scorer_id: newUser.predicted_top_scorer_id
                }
              }
            }
            return row
          })
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

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
      isLoading, 
      error, 
      refreshData: fetchData, 
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
