"use client"

import { LogOut, Shield, User, Info, ArrowUp, ArrowDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface UserPool {
  pool_id: number
  pool_name: string
  is_admin: boolean
  joined_at: string
}

interface ProfileTabProps {
  username: string
  userPoints: number
  currentUserId?: number
  onLogout?: () => void
  rank?: number
  avatarUrl?: string
  selectedWinner?: { code: string; name: string; flag: string } | null
  selectedScorer?: { name: string; team: string; flag: string } | null
  stats?: { exactHits: number; hits: number; misses: number }
  onNavigateToRankings?: () => void
  onNavigateToPools?: () => void
  pools?: UserPool[]
  onLeavePool?: (poolId: number) => void
  onNavigateToBonus?: () => void
  isPublicView?: boolean
}

export function ProfileTab({
  username,
  userPoints,
  currentUserId,
  onLogout,
  rank = 0,
  avatarUrl,
  selectedWinner,
  selectedScorer,
  stats = { exactHits: 0, hits: 0, misses: 0 },
  onNavigateToRankings,
  onNavigateToPools,
  pools = [],
  onLeavePool,
  onNavigateToBonus,
  isPublicView = false,
}: ProfileTabProps) {
  const [localStats, setLocalStats] = useState<{ exactHits: number; hits: number; misses: number } | null>(null)
  const [userPointsLocal, setUserPointsLocal] = useState<number | null>(null)
  const [userRankLocal, setUserRankLocal] = useState<number | null>(null)
  const poolIdRef = useRef<number | null>(pools[0]?.pool_id ?? null)

  useEffect(() => {
    let mounted = true
    const fetchStats = async () => {
      if (!currentUserId) return
      try {
          const { data, error } = await supabase
            .from('users')
            .select('exact_hits,hits_total,misses_total,points_total')
            .eq('user_id', currentUserId)
            .maybeSingle()

        if (error) throw error
        if (!mounted) return
        if (data) {
          setLocalStats({
            exactHits: data.exact_hits || 0,
            hits: data.hits_total || 0,
            misses: data.misses_total || 0,
          })
          setUserPointsLocal(data.points_total || 0)
          // compute rank within current pool if available
          const pid = pools[0]?.pool_id ?? null
          if (pid) {
            computeRankForUser(pid)
          }
          // compute last-match deltas for small arrows
          computeLastMatchDeltas(currentUserId, data)
        }
      } catch (err) {
        console.error('Failed to fetch user stats', err)
      }
    }

    fetchStats()

    // subscribe to realtime updates for this user to keep stats and points fresh
    let channel: any = null
    if (currentUserId) {
      channel = supabase
        .channel(`user-stats-${currentUserId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `user_id=eq.${currentUserId}` },
          (payload: any) => {
            const n = payload.new
            if (!n) return
            setLocalStats({
              exactHits: n.exact_hits || 0,
              hits: n.hits_total || 0,
              misses: n.misses_total || 0,
            })
            if (typeof n.points_total === 'number') setUserPointsLocal(n.points_total)
            // recompute rank when our own row changed
            const pid = pools[0]?.pool_id ?? null
            if (pid) computeRankForUser(pid)
            // recompute last-match deltas when user aggregates change
            computeLastMatchDeltas(currentUserId, n)
          }
        )
        .subscribe()
    }

    return () => {
      mounted = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [currentUserId, pools])

  // Subscribe to score events so last-match delta arrows update instantly
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`user-points-events-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_points_events', filter: `user_id=eq.${currentUserId}` },
        () => {
          computeLastMatchDeltas(currentUserId)
        }
      )
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [currentUserId])

  // Subscribe to pool-level user updates so our rank updates when others change
  useEffect(() => {
    const pid = pools[0]?.pool_id
    if (!pid) return

    poolIdRef.current = pid
    const channel = supabase
      .channel(`public:users:pool-${pid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload: any) => {
          const newRec = payload.new
          const oldRec = payload.old
          if (!newRec) return
          // only care when points or exact_hits changed for anyone in the pool
          const changed = oldRec && ((oldRec.points_total !== newRec.points_total) || (oldRec.exact_hits !== newRec.exact_hits))
          if (!changed) return
          computeRankForUser(pid)
        }
      )
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [pools])

  // compute rank helper (mirror RankingsTab logic)
  async function computeRankForUser(poolId: number) {
    try {
      const { data, error } = await supabase
        .from('user_pools')
        .select(`user_id, users (user_id, username, points_total, exact_hits)`) 
        .eq('pool_id', poolId)

      if (error) throw error

      const transformed = (data || []).map((item: any) => {
        const u = item.users
        return {
          id: u.user_id,
          name: u.username,
          points: u.points_total || 0,
          exactHits: u.exact_hits || 0,
        }
      })

      // sort
      transformed.sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits
        return a.name.localeCompare(b.name)
      })

      // compute competition ranks (ties share rank and next increments by tie size)
      let currentRank = 1
      let tieCount = 1
      const out: any[] = []
      for (let i = 0; i < transformed.length; i++) {
        const u = transformed[i]
        if (i === 0) {
          out.push({ ...u, rank: currentRank })
          tieCount = 1
          continue
        }
        const prev = transformed[i - 1]
        if (u.points === prev.points && u.exactHits === prev.exactHits) {
          out.push({ ...u, rank: currentRank })
          tieCount++
        } else {
          currentRank = currentRank + tieCount
          tieCount = 1
          out.push({ ...u, rank: currentRank })
        }
      }

      const me = out.find((r) => r.id === currentUserId)
      setUserRankLocal(me ? me.rank : 0)
    } catch (err) {
      console.error('Failed to compute rank for user', err)
    }
  }

  const [arrowState, setArrowState] = useState<{ hits: string; exact: string; misses: string; accuracy: string }>({ hits: 'none', exact: 'none', misses: 'none', accuracy: 'none' })

  const computeLastMatchDeltas = async (userId: number, userRowData?: any) => {
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
          // treat anything else with zero points as miss
          totals.misses += 1
          if (ev.match_id !== lastMatchId) before.misses += 1
        }
      })

      // if we have explicit userRowData, prefer those aggregates for current totals
      const currentExact = userRowData?.exact_hits ?? totals.exact
      const currentHits = userRowData?.hits_total ?? totals.hits
      const currentMisses = userRowData?.misses_total ?? totals.misses

      const beforeExact = before.exact
      const beforeHits = before.hits
      const beforeMisses = before.misses

      const deltaExact = currentExact - beforeExact
      const deltaHits = currentHits - beforeHits
      const deltaMisses = currentMisses - beforeMisses

      const totalAfter = currentExact + currentHits + currentMisses
      const totalBefore = beforeExact + beforeHits + beforeMisses

      const accAfter = totalAfter > 0 ? ((currentExact + currentHits) / totalAfter) : 0
      const accBefore = totalBefore > 0 ? ((beforeExact + beforeHits) / totalBefore) : 0

      const pick = (d: number) => (d > 0 ? 'up' : d < 0 ? 'down' : 'none')

      setArrowState({
        exact: pick(deltaExact),
        hits: pick(deltaHits),
        misses: pick(deltaMisses),
        accuracy: accAfter > accBefore ? 'up' : accAfter < accBefore ? 'down' : 'none'
      })
    } catch (err) {
      console.error('Failed to compute last-match deltas', err)
      setArrowState({ hits: 'none', exact: 'none', misses: 'none', accuracy: 'none' })
    }
  }

  const displayStats = localStats ?? stats
  const totalPredictions = displayStats.exactHits + displayStats.hits + displayStats.misses
  const accuracyRaw = totalPredictions > 0 ? ((displayStats.exactHits + displayStats.hits) / totalPredictions) * 100 : 0
  const accuracy = accuracyRaw.toFixed(1)

  return (
    <div className="space-y-3">
      {/* Profile Header Card - Compact horizontal layout */}
      <button
        onClick={onNavigateToRankings}
        className="w-full bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50 flex items-center justify-between text-left hover:border-primary/50 transition-colors"
      >
        <span className="text-lg font-bold text-foreground">{username.toUpperCase()}</span>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">#{userRankLocal ?? rank}</p>
          <p className="text-sm text-muted-foreground">{(userPointsLocal ?? userPoints) || 0} pts</p>
        </div>
      </button>

      {/* Picks Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {isPublicView ? "Winner" : "Your Winner"}
          </h3>
          {selectedWinner ? (
            <button
              onClick={onNavigateToBonus}
              className="w-full flex items-center gap-2 text-left"
            >
              <span className="text-2xl">{selectedWinner.flag}</span>
              <span className="text-foreground font-semibold">{selectedWinner.code}</span>
            </button>
          ) : (
            <p className="text-muted-foreground text-sm">Not selected</p>
          )}
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {isPublicView ? "Scorer" : "Your Scorer"}
          </h3>
          {selectedScorer ? (
            <button
              onClick={onNavigateToBonus}
              className="w-full flex items-center gap-2 text-left"
            >
              <span className="text-2xl">{selectedScorer.flag}</span>
              <span className="text-foreground font-semibold">{selectedScorer.name}</span>
            </button>
          ) : (
            <p className="text-muted-foreground text-sm">Not selected</p>
          )}
        </div>
      </div>

      {/* Statistics Card */}
      <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Stats</h3>
        <div className="grid grid-cols-4 gap-3 text-center">
          <StatWithArrows label="Hits" value={displayStats.hits} arrow={arrowState.hits} toneClass="text-foreground" />
          <StatWithArrows label="Exact" value={displayStats.exactHits} arrow={arrowState.exact} toneClass="text-primary" />
          <StatWithArrows label="Misses" value={displayStats.misses} arrow={arrowState.misses} toneClass="text-destructive" />
          <StatWithArrows label="Accuracy" value={`${accuracy}%`} arrow={arrowState.accuracy} toneClass="text-primary" />
        </div>
      </div>

      {!isPublicView && (
        <>
          {/* Pools Management Card */}
          <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Pools</h3>
              <button 
                onClick={onNavigateToPools}
                className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg border border-primary/20"
              >
                Switch Pool →
              </button>
            </div>
            <div className="space-y-2">
              {pools.length > 0 ? (
                pools.map((pool) => (
                  <div key={pool.pool_id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{pool.pool_name.toUpperCase()}</span>
                      {pool.is_admin && (
                        <span className="bg-primary/20 text-primary text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold uppercase tracking-wider border border-primary/30">
                          <Shield className="w-2.5 h-2.5" /> Admin
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onLeavePool?.(pool.pool_id)}
                      className="text-xs font-bold text-destructive bg-destructive/10 px-4 py-2 rounded-xl border border-destructive/20 active:bg-destructive/20 transition-colors"
                    >
                      Leave
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-2">You are not in any pools yet.</p>
              )}
            </div>
          </div>

          {/* Info Card - Global Predictions */}
          {pools.length > 1 && (
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex gap-3 items-start">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90 leading-snug">
                Your match predictions are <span className="text-primary font-bold italic">global</span> and apply to every pool you belong to — you only need to predict once.
              </p>
            </div>
          )}

          {/* Official Rules Card */}
          <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
            <h3 className="text-sm font-semibold text-foreground mb-3">Official Rules</h3>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">3 points</span> for predicting the exact score</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">1 point</span> for predicting the correct winner</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">5 points</span> for predicting the tournament winner</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">3 points</span> for predicting the top scorer</span>
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground mb-1">Deadlines</h4>
              <p className="text-muted-foreground text-sm">
                Match predictions lock 30 minutes before kickoff. Tournament winner and top scorer predictions must be submitted before the first match.
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full bg-destructive/10 text-destructive rounded-xl p-3 flex items-center justify-center gap-2 border border-destructive/20 active:bg-destructive/20 transition-colors mt-4"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-semibold italic">Logout</span>
          </button>
        </>
      )}
    </div>
  )
}

// Small helper component to render value with vertical arrows
function StatWithArrows({ label, value, arrow, toneClass }: { label: string; value: number | string; arrow: string; toneClass: string }) {
  const upClass = arrow === 'up' ? 'text-emerald-500' : 'text-muted-foreground opacity-40'
  const downClass = arrow === 'down' ? 'text-destructive' : 'text-muted-foreground opacity-40'

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1">
        <div className="w-10 flex justify-center">
          <p className={`text-lg font-bold ${toneClass} font-mono`}>{value}</p>
        </div>
        <div className="flex flex-col items-center -ml-1">
          <ArrowUp className={`w-3 h-3 ${upClass}`} strokeWidth={3} />
          <ArrowDown className={`w-3 h-3 ${downClass} mt-0.5`} strokeWidth={3} />
        </div>
      </div>
      <div className="mt-1 w-10 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
