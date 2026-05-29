"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { ProfileTab } from "./profile-tab"
import { supabase } from "@/lib/supabase"
import { getFlag } from "@/lib/flags"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"

interface RankingsTabProps {
  poolId?: number
  poolName?: string
  currentUserId?: number
}

interface RankedUser {
  rank: number
  id: number
  name: string
  winnerPick: string
  winnerCode: string
  scorerPick: string
  exactHits: number
  hits?: number
  misses?: number
  points: number
  isCurrentUser: boolean
}

export function RankingsTab({ poolId, poolName, currentUserId }: RankingsTabProps) {
  // Add a comment to trigger re-save
  const [users, setUsers] = useState<RankedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<null | any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)

  useEffect(() => {
    if (poolId) {
      fetchRankings()
    }
  }, [poolId, currentUserId])

  // Subscribe to realtime user updates and update local leaderboard entries
  useEffect(() => {
    if (!poolId) return

    const channel = supabase
      .channel(`public:users:pool-${poolId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        (payload) => {
          const newRec = payload.new as any
          if (!newRec) return

          const oldRec = payload.old as any

          // Act when points, exact_hits or predicted_tournament_winner_id changed
          const changedPointsOrHits = oldRec && (
            (oldRec.points_total !== newRec.points_total) ||
            (oldRec.exact_hits !== newRec.exact_hits)
          )
          const changedWinner = oldRec && (oldRec.predicted_tournament_winner_id !== newRec.predicted_tournament_winner_id)
          if (!changedPointsOrHits && !changedWinner) return

          ;(async () => {
            let newFlag: string | undefined
            let newCode: string | undefined
            if (changedWinner) {
              if (newRec.predicted_tournament_winner_id) {
                try {
                  const { data: team } = await supabase
                    .from("teams")
                    .select("team_flag, abbreviation, team_name")
                    .eq("team_id", newRec.predicted_tournament_winner_id)
                    .single()
                  newFlag = getFlag(team?.team_flag || team?.abbreviation) || "🏳️"
                  newCode = team?.abbreviation || ""
                } catch (e) {
                  newFlag = "🏳️"
                  newCode = ""
                }
              } else {
                newFlag = "🏳️"
                newCode = ""
              }
            }

            setUsers((prev) => {
                 const idx = prev.findIndex((u) => String(u.id) === String(newRec.user_id))
              if (idx === -1) return prev

              const updated = [...prev]
              updated[idx] = {
                ...updated[idx],
                points: newRec.points_total || 0,
                exactHits: newRec.exact_hits || 0,
                ...(changedWinner ? { winnerPick: newFlag, winnerCode: newCode || "" } : {}),
              }

              // visually highlight when points/ hits change
              if (changedPointsOrHits) {
                setHighlightId(newRec.user_id)
                setTimeout(() => setHighlightId(null), 1200)
              }

              return computeRanks(sortUsers(updated))
            })
          })()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [poolId])

  const fetchRankings = async () => {
    setLoading(true)
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

      // Check if current user is admin
      const currentUserData = rows.find((item: any) => String(item.user_id) === String(currentUserId))
      setIsAdmin(currentUserData?.is_admin || false)

      // Transform and sort
      const transformed: any[] = rows
        .map((item: any) => {
          const u = item.users
          if (!u) return null
          return {
            id: u.user_id,
            name: String(u.username || "").toUpperCase(),
            points: u.points_total || 0,
            exactHits: u.exact_hits || 0,
            hits: u.hits_total || 0,
            misses: u.misses_total || 0,
            winnerPick: getFlag(u.teams?.team_flag || u.teams?.abbreviation) || "🏳️",
            winnerCode: u.teams?.abbreviation || "",
            scorerPick: u.player_stats ? `${u.player_stats.player_name}__${getFlag(u.player_stats.teams?.team_flag || u.player_stats.teams?.abbreviation) || '⚽'}` : "Not selected",
               isCurrentUser: String(u.user_id) === String(currentUserId)
          }
        })
        .filter(Boolean)

      // Sort and compute competition-style ranks (ties share same rank; next rank skips by tie size)
      const sorted = sortUsers(transformed)
      const ranked = computeRanks(sorted)
      setUsers(ranked)
    } catch (err: any) {
      console.error("Error fetching rankings:", err)
      toast.error("Failed to load rankings")
    } finally {
      setLoading(false)
    }
  }

  // Helper: sort by points desc, exactHits desc, name asc
  function sortUsers(arr: any[]) {
    return arr.slice().sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits
      return a.name.localeCompare(b.name)
    })
  }

  // Helper: compute competition ranking where ties share rank and next rank increments by tie size
  function computeRanks(sorted: any[]) {
    const out: any[] = []
    let currentRank = 1
    let tieCount = 1

    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i]
      if (i === 0) {
        out.push({ ...u, rank: currentRank })
        tieCount = 1
        continue
      }

      const prev = sorted[i - 1]
      if (u.points === prev.points && u.exactHits === prev.exactHits) {
        // same tie group
        out.push({ ...u, rank: currentRank })
        tieCount++
      } else {
        currentRank = currentRank + tieCount
        tieCount = 1
        out.push({ ...u, rank: currentRank })
      }
    }

    return out
  }

  const openProfile = (player: RankedUser) => setSelectedPlayer(player)
  const closeProfile = () => setSelectedPlayer(null)

  const getInviteUrl = () => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/?pool=${encodeURIComponent(poolName || "")}`
  }

  const copyTextToClipboard = async (text: string) => {
    if (typeof window === "undefined") return false

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  }

  const copyInvite = async () => {
    const url = getInviteUrl()
    if (!url) return
    try {
      await copyTextToClipboard(url)
      toast.success("Invite link copied")
    } catch (err) {
      console.error("Copy failed", err)
      toast.error("Failed to copy link")
    }
  }

  // Convert ranked user into the props expected by ProfileTab
  const toProfileProps = (player: RankedUser) => {
    const scorerNameAndFlag = player.scorerPick !== "Not selected"
      ? (() => {
          const separatorIndex = player.scorerPick.indexOf("__")
          const name = separatorIndex >= 0 ? player.scorerPick.slice(0, separatorIndex) : player.scorerPick
          const flag = separatorIndex >= 0 ? player.scorerPick.slice(separatorIndex + 2) : "⚽"
          return { name, flag, team: "" }
        })()
      : null

    // For now, we don't have full stats in the leaderboard query, so we use placeholders or simple math
    // In a real app, you might fetch this separately in the Profile modal or include it in the query
    return {
      username: player.name.toUpperCase(),
      rank: player.rank,
      userPoints: player.points,
        selectedWinner: player.winnerPick !== "🏳️" ? { code: player.winnerCode, name: "", flag: player.winnerPick } : null,
      selectedScorer: scorerNameAndFlag ? { name: scorerNameAndFlag.name, team: scorerNameAndFlag.team, flag: scorerNameAndFlag.flag } : null,
      stats: { exactHits: player.exactHits, hits: (player as any).hits || 0, misses: (player as any).misses || 0 },
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner className="w-8 h-8 text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading Leaderboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
          {poolName ? `${poolName.toUpperCase()} Leaderboard` : "Global Leaderboard"}
        </h2>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[2.5rem_1fr_3rem_3rem_3.5rem] gap-2 px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest border-b border-border/30">
        <span>#</span>
        <span>User</span>
        <span className="text-center">Pick</span>
        <span className="text-center">Hits</span>
        <span className="text-right">Pts</span>
      </div>

      {/* Friend Rows */}
      <div className="space-y-2">
        {users.map((friend) => (
          <button
            key={friend.id}
            onClick={() => openProfile(friend)}
            className={cn(
              "relative grid grid-cols-[2.5rem_1fr_3rem_3rem_3.5rem] gap-2 items-center px-3 py-3 rounded-2xl bg-card border border-border/50 transition-all text-left w-full overflow-hidden",
              "cursor-pointer hover:border-primary/30 active:scale-[0.98]",
              friend.isCurrentUser && "border-primary/50 bg-primary/[0.03]",
                friend.rank === 1 && "shadow-[0_0_20px_rgba(234,179,8,0.05)]",
                friend.rank === 2 && "shadow-[0_0_20px_rgba(148,163,184,0.05)]",
                friend.rank === 3 && "shadow-[0_0_20px_rgba(180,83,9,0.05)]",
                highlightId === friend.id && "ring-2 ring-primary/30 scale-[1.01]"
            )}
          >
            {/* Rank-specific Background Glows */}
            {friend.rank === 1 && <div className="absolute inset-0 bg-amber-500/[0.03] pointer-events-none" />}
            {friend.rank === 2 && <div className="absolute inset-0 bg-slate-400/[0.03] pointer-events-none" />}
            {friend.rank === 3 && <div className="absolute inset-0 bg-orange-700/[0.03] pointer-events-none" />}

            {/* Rank Badge */}
            <div className="flex justify-center">
              <span
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black italic",
                  friend.rank === 1 && "bg-amber-500/20 text-amber-500 border border-amber-500/30",
                  friend.rank === 2 && "bg-slate-400/20 text-slate-400 border border-slate-400/30",
                  friend.rank === 3 && "bg-orange-700/20 text-orange-600 border border-orange-700/30",
                  friend.rank > 3 && "bg-muted/50 text-muted-foreground border border-border/50"
                )}
              >
                {friend.rank}
              </span>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "text-foreground text-sm font-semibold truncate",
                  friend.isCurrentUser && "text-primary italic"
                )}
              >
                {friend.name.toUpperCase()}
                {friend.isCurrentUser && " (You)"}
              </span>
            </div>

            {/* Winner Pick Flag */}
            <div className="flex justify-center items-center">
              <span className="text-xl filter drop-shadow-sm select-none">
                {friend.winnerPick}
              </span>
            </div>

            {/* Exact Hits */}
            <div className="flex justify-center">
              <span className="text-muted-foreground font-bold text-xs">{friend.exactHits}</span>
            </div>

            {/* Points */}
            <div className="text-right">
              <span className="text-primary font-black text-sm tracking-tight">{friend.points}</span>
            </div>
          </button>
        ))}
        
        {users.length === 0 && (
          <div className="text-center py-10 bg-card/50 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground text-sm italic">No users in this pool yet.</p>
          </div>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="w-full mt-2 relative items-center px-3 py-3 rounded-2xl bg-card hover:bg-muted text-muted-foreground border border-border/60 text-center font-bold text-sm uppercase tracking-widest cursor-pointer transition-all active:scale-[0.98]"
          >
            INVITE
          </button>
        )}
      </div>

      {/* Invite Modal */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="w-[calc(100%-32px)] max-w-sm rounded-2xl bg-card border-border/50 shadow-2xl p-6 mx-auto">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-bold text-foreground">Invite to <span className="text-primary">{poolName?.toUpperCase()}</span></h3>
            <p className="text-sm text-muted-foreground">Share the link or scan the QR code for a quick join</p>

            <div className="flex items-center gap-2 mt-2 w-full">
              <input
                readOnly
                tabIndex={-1}
                onFocus={(e) => e.currentTarget.blur()}
                value={getInviteUrl()}
                className="flex-1 min-w-0 bg-white/5 text-sm text-foreground px-3 py-2 rounded-xl border border-border/30 truncate"
              />
              <button
                type="button"
                onClick={copyInvite}
                className="shrink-0 px-3 py-2 bg-muted/20 text-sm rounded-xl border border-border/30 font-bold text-muted-foreground"
              >
                Copy
              </button>
            </div>

            <div className="flex justify-center py-4 mx-auto w-fit">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0-0-0&bgcolor=255-255-255&data=${encodeURIComponent(getInviteUrl())}`}
                alt="QR Code"
                className="w-[220px] h-[220px]"
              />
            </div>
            
            <button
              onClick={() => setShowInvite(false)}
              className="w-full bg-card hover:bg-muted text-muted-foreground py-3 rounded-xl font-bold uppercase tracking-widest transition-all border border-border/50 shadow-sm active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && closeProfile()}>
        {selectedPlayer && (
          <DialogContent className="w-[calc(100%-32px)] max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none [&>button]:hidden mx-auto">
            <div className="max-h-[85vh] overflow-y-auto pr-1">
              <ProfileTab {...toProfileProps(selectedPlayer)} onNavigateToRankings={closeProfile} isPublicView={true} />
              
              <button 
                onClick={closeProfile}
                className="w-full mt-4 bg-card hover:bg-muted text-muted-foreground py-4 rounded-2xl font-bold uppercase tracking-widest transition-all border border-red-500/40 shadow-xl active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
