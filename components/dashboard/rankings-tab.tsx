"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { ProfileTab } from "./profile-tab"
import { getFlag } from "@/lib/flags"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { useHistoryLayer } from "@/hooks/use-history-layer"
import { useTournamentData } from "@/context/tournament-data-context"

interface RankingsTabProps {
  poolId?: number
  poolName?: string
  currentUserId?: number
}

type RankedUser = import("@/context/tournament-data-context").RankedUser

export function RankingsTab({ poolId, poolName, currentUserId }: RankingsTabProps) {
  const { t, rankings, isLoading, pools, activePoolId, players, teams, matches } = useTournamentData()
  const REVEAL_ALL_PICKS = true // ⚡ Set to true to reveal all picks and test the profile modal
  const [selectedPlayer, setSelectedPlayer] = useState<null | any>(null)
  const [showInvite, setShowInvite] = useState(false)

  const users = rankings
  const loading = isLoading
  const isAdmin = pools.find(p => p.pool_id === activePoolId)?.is_admin ?? false
  
  // =======================================================================
  // THE GRAND FINALE LOGIC
  // Calculate who won the tournament and who the top scorers are on the fly
  // =======================================================================
  const finalMatch = matches.find(m => m.round === "Final")
  const isTournamentFinished = finalMatch?.is_finished ?? false
  
  let actualWinnerId: number | null = null
  let topScorerIds: number[] = []

  if (isTournamentFinished && finalMatch) {
    // 1. Determine tournament winner
    if ((finalMatch as any).penalty_winner === 'home') {
      actualWinnerId = finalMatch.home_team_id ?? null
    } else if ((finalMatch as any).penalty_winner === 'away') {
      actualWinnerId = finalMatch.away_team_id ?? null
    } else if (finalMatch.home_score != null && finalMatch.away_score != null) {
      if (finalMatch.home_score > finalMatch.away_score) actualWinnerId = finalMatch.home_team_id ?? null
      else if (finalMatch.away_score > finalMatch.home_score) actualWinnerId = finalMatch.away_team_id ?? null
    }

    // 2. Determine top scorer(s)
    const maxGoals = players.length > 0 ? Math.max(...players.map(p => p.goals ?? 0)) : 0
    if (maxGoals > 0) {
      topScorerIds = players.filter(p => p.goals === maxGoals).map(p => p.player_id)
    }
  }
  // =======================================================================

  const { closeWithHistory: closeInvite } = useHistoryLayer({
    layerId: `rankings-invite-${poolId}`,
    isOpen: showInvite,
    onClose: () => setShowInvite(false),
  })

  const { closeWithHistory: closeProfile } = useHistoryLayer({
    layerId: `rankings-profile-${selectedPlayer?.id ?? "none"}`,
    isOpen: !!selectedPlayer,
    onClose: () => setSelectedPlayer(null),
  })

  const getInviteUrl = () => {
    if (!poolName) return "worldcuppred.vercel.app"
    return `worldcuppred.vercel.app?pool=${encodeURIComponent(poolName)}`
  }

  const copyInvite = () => {
    const url = getInviteUrl()
    
    if (navigator?.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(() => toast.success(t("Invite link copied")))
        .catch(() => toast.error(t("Failed to copy link")))
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = url
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        document.execCommand('copy')
        toast.success(t("Invite link copied"))
      } catch (error) {
        toast.error(t("Failed to copy link"))
      }
      textArea.remove()
    }
  }

  const openProfile = (player: RankedUser) => setSelectedPlayer(player)
  const closeSelectedPlayer = () => setSelectedPlayer(null)

  const getRankBadgeClassName = (rank: number, points: number) => {
    if (points <= 0) {
      return "bg-muted/60 text-muted-foreground border border-border/50"
    }
    if (rank === 1) return "bg-amber-500/20 text-amber-500 border border-amber-500/30"
    if (rank === 2) return "bg-slate-400/20 text-slate-400 border border-slate-400/30"
    if (rank === 3) return "bg-orange-700/20 text-orange-600 border border-orange-700/30"
    return "bg-muted/60 text-muted-foreground border border-border/50"
  }

  const getFinishedRankRowClassName = (rank: number) => {
    if (rank === 1) return "bg-amber-500/20"
    if (rank === 2) return "bg-slate-400/20"
    if (rank === 3) return "bg-orange-700/20"
    return ""
  }

  const toProfileProps = (player: RankedUser) => {
    const isHidden = !REVEAL_ALL_PICKS && !player.isCurrentUser

    const scorerInfo = player.scorerId ? players.find(p => p.player_id === player.scorerId) : null
    const scorerTeamInfo = scorerInfo ? teams.find(t => t.team_id === scorerInfo.team_id) : null

    return {
      hideLanguageToggle: true,
      username: player.name.toUpperCase(),
      rank: player.rank,
      userPoints: player.points,
      selectedWinner: isHidden 
        ? { code: t("Hidden"), name: "", flag: "🔒" }
        : player.winnerId ? { code: player.winnerCode, name: "", flag: player.winnerPick } : null,
      selectedScorer: isHidden
        ? { name: t("Hidden"), team: "", flag: "🔒" }
        : scorerInfo ? { name: scorerInfo.player_name, team: scorerTeamInfo?.team_name ?? "", flag: getFlag(scorerTeamInfo?.team_flag ?? scorerTeamInfo?.abbreviation ?? undefined) } : null,
      stats: {
        exactHits: player.exactHits ?? 0,
        hits: player.hits ?? 0,
        misses: player.misses ?? 0,
      },
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner className="w-8 h-8 text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">{t("Loading Leaderboard...")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
          {poolName ? `${poolName.toUpperCase()} ${t("Leaderboard")}` : t("Global Leaderboard")}
        </h2>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[2.5rem_1fr_4rem_3rem_2rem] gap-2 px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest border-b border-border/30">
        <span>#</span>
        <span>{t("User")}</span>
        <span className="text-center">{t("Pick")}</span>
        <span className="text-center">{t("Exact")}</span>
        <span className="text-right">{t("Pts")}</span>
      </div>

      {/* Friend Rows */}
      <div className="space-y-2">
        {users.map((friend) => {
          
          // Calculate bonus points for this specific user
          let bonus = 0;
          if (isTournamentFinished) {
            if (actualWinnerId && friend.winnerId === actualWinnerId) bonus += 10;
            if (friend.scorerId && topScorerIds.includes(friend.scorerId)) bonus += 10;
          }

          return (
            <button
              key={friend.id}
              onClick={() => openProfile(friend)}
              className={cn(
                "relative grid grid-cols-[2.5rem_1fr_4rem_3rem_2rem] gap-2 items-center px-3 py-3 rounded-2xl bg-muted/25 border border-border/50 transition-all text-left w-full overflow-hidden",
                "cursor-pointer hover:border-primary/30 active:scale-[0.98]",
                friend.isCurrentUser && "border-primary/50 bg-muted/35",
                isTournamentFinished && getFinishedRankRowClassName(friend.rank)
              )}
            >
              {/* Rank Badge */}
              <div className="flex justify-center">
                <span
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black italic",
                    getRankBadgeClassName(friend.rank, friend.points)
                  )}
                >
                  {friend.rank}
                </span>
              </div>

              {/* User Info with Conditional Bonus Badge */}
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className={cn(
                    "text-foreground text-sm font-semibold truncate",
                    friend.isCurrentUser && "text-primary italic"
                  )}
                >
                  {friend.name.toUpperCase()}
                  {friend.isCurrentUser && " " + t("(You)")}
                </span>
                
                {/* THE GREEN BONUS BADGE */}
                {bonus > 0 && (
                  <span className="inline-flex shrink-0 items-center justify-center bg-primary/20 text-primary border border-primary/30 text-[10px] font-black px-1.5 py-[1px] rounded shadow-sm ml-1">
                    +{bonus}
                  </span>
                )}
              </div>

              {/* Winner Pick Flag */}
              <div className="flex justify-center items-center">
                <span className="text-xl filter drop-shadow-sm select-none">
                  {friend.isCurrentUser || REVEAL_ALL_PICKS ? friend.winnerPick : "🔒"}
                </span>
              </div>

              {/* Exact Hits */}
              <div className="flex justify-center">
                <span className="text-muted-foreground font-bold text-xs">({friend.exactHits})</span>
              </div>

              {/* Points */}
              <div className="text-right">
                <span className="text-primary font-black text-sm tracking-tight">{friend.points}</span>
              </div>
            </button>
          )
        })}
        
        {users.length === 0 && (
          <div className="text-center py-10 bg-card/50 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground text-sm italic">{t("No users in this pool yet.")}</p>
          </div>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="w-full mt-2 relative items-center px-3 py-3 rounded-2xl bg-card hover:bg-muted text-muted-foreground border border-border/60 text-center font-bold text-sm uppercase tracking-widest cursor-pointer transition-all active:scale-[0.98]"
          >
            {t("INVITE")}
          </button>
        )}
      </div>

      {/* Invite Modal */}
      <Dialog open={showInvite} onOpenChange={(open) => (open ? setShowInvite(true) : closeInvite())}>
        <DialogContent className="w-[calc(100%-32px)] max-w-sm rounded-2xl bg-card border-border/50 shadow-2xl p-6 mx-auto">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-bold text-foreground">{t("Invite to")} <span className="text-primary">{poolName?.toUpperCase()}</span></h3>
            
            <p className="text-xs text-muted-foreground leading-relaxed px-1">
              {t("Scan the qr code, register and enter the groups name to join.")}
            </p>

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
                {t("Copy")}
              </button>
            </div>

            <div className="flex justify-center py-2 mx-auto w-fit">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0-0-0&bgcolor=255-255-255&data=${encodeURIComponent(getInviteUrl())}`}
                alt={t("Invite QR code")}
                className="w-[220px] h-[220px] rounded-xl bg-white p-2"
              />
            </div>
            
            <button
              onClick={closeInvite}
              className="w-full bg-card hover:bg-muted text-muted-foreground py-3 rounded-xl font-bold uppercase tracking-widest transition-all border border-border/50 shadow-sm active:scale-[0.98]"
            >
              {t("Close")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={!!selectedPlayer} onOpenChange={(open) => (open ? undefined : closeProfile())}>
        {selectedPlayer && (
          <DialogContent className="w-[calc(100%-32px)] max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none [&>button]:hidden mx-auto">
            <div className="max-h-[85vh] overflow-y-auto pr-1">
              <ProfileTab 
                {...toProfileProps(selectedPlayer)} 
                onNavigateToRankings={closeSelectedPlayer} 
                isPublicView={true} 
                hideLanguageToggle={true}
              />
              
              <button 
                onClick={closeSelectedPlayer}
                className="w-full mt-4 bg-card hover:bg-muted text-muted-foreground py-4 rounded-2xl font-bold uppercase tracking-widest transition-all border border-red-500/40 shadow-xl active:scale-[0.98]"
              >
                {t("Close")}
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}