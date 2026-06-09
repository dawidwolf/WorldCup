﻿"use client"

import { LogOut, Shield, Info, ArrowUp, ArrowDown } from 'lucide-react'
import { useState } from 'react'
import { useTournamentData } from '@/context/tournament-data-context'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useHistoryLayer } from '@/hooks/use-history-layer'
import { toast } from "sonner"


export interface UserPool {
  pool_id: number
  pool_name: string
  is_admin: boolean
  joined_at: string
  hideLanguageToggle: boolean,
}



interface ProfileTabProps {
  hideLanguageToggle: boolean,
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
  hideLanguageToggle,
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
  const { language, setLanguage, t, userProfile, rankings, arrowState } = useTournamentData()
  const [showInvite, setShowInvite] = useState(false)
  const [invitePoolName, setInvitePoolName] = useState<string>("")

  const { closeWithHistory: closeInvite } = useHistoryLayer({
    layerId: `profile-invite-${currentUserId ?? username}`,
    isOpen: showInvite,
    onClose: () => setShowInvite(false),
  })

  const displayRank = isPublicView ? rank : (rankings.find(r => r.isCurrentUser)?.rank ?? 0);
  const displayPoints = isPublicView ? userPoints : (userProfile?.points_total ?? 0);
  const displayStats = isPublicView ? stats : {
    exactHits: userProfile?.exact_hits ?? 0,
    hits: userProfile?.hits_total ?? 0,
    misses: userProfile?.misses_total ?? 0,
  };
  const totalPredictions = displayStats.exactHits + displayStats.hits + displayStats.misses
  const accuracyRaw = totalPredictions > 0 ? ((displayStats.exactHits + displayStats.hits) / totalPredictions) * 100 : 0
  const accuracy = accuracyRaw.toFixed(1)

  // ⚡ Just the clean URL string
  const getInviteUrl = () => {
    return "worldcuppred.vercel.app"
  }

  const copyInvite = () => {
    const url = getInviteUrl()
    
    if (navigator?.clipboard && window.isSecureContext) {
      // Modern copy for HTTPS / Production
      navigator.clipboard.writeText(url)
        .then(() => toast.success(t("Invite link copied")))
        .catch(() => toast.error(t("Failed to copy link")))
    } else {
      // ⚡ SYNCHRONOUS fallback for mobile testing over local Wi-Fi
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


  return (
    <div className="space-y-3">
      {/* ⚡ Profile Card: Now 100% full width with strict layout protection defenses */}
      <button
        onClick={onNavigateToRankings}
        className="w-full bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50 flex items-center justify-between text-left hover:border-primary/50 transition-colors min-w-0"
      >
        <span className="text-lg font-bold text-foreground truncate mr-3">
          {username.toUpperCase()}
        </span>
        <div className="text-right flex items-center gap-2 shrink-0">
          <p className="text-lg font-bold text-primary">#{displayRank}</p>
          <span className="text-muted-foreground text-sm">|</span>
          <p className="text-sm text-muted-foreground">{displayPoints || 0} {t("pts")}</p>
        </div>
      </button>

      {/* ⚡ Segmented Setting Switch Row: Fixed button widths to eliminate language switching layout shifts */}
      {!hideLanguageToggle && (
        <div className="bg-card rounded-2xl p-1 shadow-lg shadow-black/20 border border-border/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-3">
            {t("Language")}
          </span>
          <div className="flex items-center gap-1 bg-transparent p-1 rounded-xl border border-transparent shrink-0">
            <button
              onClick={() => setLanguage('en')}
              className={`w-[100px] py-2.5 text-center rounded-lg font-bold tracking-wider text-[12px] transition-all ${
                language === 'en'
                  ? 'bg-muted text-foreground shadow-md shadow-black/10 border border-primary/50'
                  : 'text-muted-foreground hover:text-foreground bg-transparent border border-transparent'
              }`}
            >
              {t("English")}
            </button>
            <button
              onClick={() => setLanguage('hu')}
              className={`w-[100px] py-2.5 text-center rounded-lg font-bold tracking-wider text-[12px] transition-all ${
                language === 'hu'
                  ? 'bg-muted text-foreground shadow-md shadow-black/10 border border-primary/50'
                  : 'text-muted-foreground hover:text-foreground bg-transparent border border-transparent'
              }`}
            >
              {t("Hungarian")}
            </button>
          </div>
        </div>
      )}

      {/* Picks Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {isPublicView ? t("Winner") : t("Your Winner")}
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
            <p className="text-muted-foreground text-sm">{t("Not selected")}</p>
          )}
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {isPublicView ? t("Scorer") : t("Your Scorer")}
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
            <p className="text-muted-foreground text-sm">{t("Not selected")}</p>
          )}
        </div>
      </div>

      {/* Statistics Card */}
      <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("Stats")}</h3>
        <div className="grid grid-cols-4 gap-3 text-center">
                <StatWithArrows label={t("All Hits")} value={displayStats.hits} arrow={arrowState.hits} toneClass="text-primary" />
                <StatWithArrows label={t("Exact")} value={displayStats.exactHits} arrow={arrowState.exact} toneClass="text-primary" />
                <StatWithArrows label={t("Misses")} value={displayStats.misses} arrow={arrowState.misses} toneClass="text-destructive" />
                <StatWithArrows label={t("Accuracy")} value={`${accuracy}%`} arrow={arrowState.accuracy} toneClass="text-primary" showArrows={false} />
              </div>
      </div>

      {!isPublicView && (
        <>
          {/* Pools Management Card */}
          <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("Your Pools")}</h3>
              <button 
                onClick={onNavigateToPools}
                className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg border border-primary/20"
              >
                {t("Switch Pool")} →
              </button>
            </div>
            <div className="space-y-2">
              {pools.length > 0 ? (
                pools.map((pool) => (
                  <div key={pool.pool_id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-muted-foreground">{pool.pool_name.toUpperCase()}</span>
                      {pool.is_admin && (
                          <div className="flex items-center gap-1.5">
                            <span className="bg-secondary/20 text-primary text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold uppercase tracking-wider border border-primary/30">
                              <Shield className="w-2.5 h-4" /> Admin
                            </span>
                            <button
                              onClick={() => {
                                setInvitePoolName(pool.pool_name)
                                setShowInvite(true)
                              }}
                              className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg bg-card text-muted-foreground border border-border/60 hover:bg-muted transition-all"
                            >
                              {t("Invite")}
                            </button>
                          </div>
                      )}
                    </div>
                    <button
                      onClick={() => onLeavePool?.(pool.pool_id)}
                      className="text-xs font-bold text-destructive bg-secondary/10 px-4 py-2 rounded-xl border border-destructive/40 active:bg-destructive/20 transition-colors"
                    >
                      {t("Leave")}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-2">{t("You are not in any pools yet.")}</p>
              )}
            </div>
          </div>

          <Dialog open={showInvite} onOpenChange={(open) => (open ? setShowInvite(true) : closeInvite())}>
            {/* ⚡ FIX: Removed h-[56vh] and used h-auto max-h-[90vh] so components are never covered up or squished on mobile screens */}
            <DialogContent className="w-[calc(100%-32px)] max-w-sm h-auto max-h-[90vh] rounded-2xl bg-card border border-border/40 shadow-2xl p-0 mx-auto overflow-hidden [&>button]:hidden">
              <div className="flex flex-col">
                <div className="px-5 pt-5 pb-3 border-b border-border/30">
                  <h3 className="text-lg font-bold text-foreground">
                    {t("Invite players to")} <span className="text-primary">{invitePoolName.toUpperCase()}</span>
                  </h3>
                  {/* ⚡ ADDED: Clear guidance note below header layout */}
                  <p className="text-xs text-muted-foreground mt-1 leading-normal">
                    {t("Scan the qr code, register and enter the groups name to join.")}
                  </p>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4">
                  <div className="flex items-center gap-2 w-full">
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
                      className="shrink-0 px-3 py-2 rounded-xl bg-card hover:bg-muted text-muted-foreground text-sm font-bold border border-border/40"
                    >
                      {t("Copy")}
                    </button>
                  </div>

                  <div className="flex items-center justify-center py-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0-0-0&bgcolor=255-255-255&data=${encodeURIComponent(getInviteUrl())}`}
                      alt={t("Invite QR code")}
                      className="w-[220px] h-[220px] max-w-full rounded-xl bg-white p-2 shadow-inner"
                    />
                  </div>
                </div>

                <div className="bg-card/90 backdrop-blur-sm border-t border-border/30 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="w-full py-3 rounded-xl bg-card hover:bg-muted text-muted-foreground font-semibold transition-all border border-red-500/40"
                  >
                    {t("Close")}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Info Card - Global Predictions */}
          {pools.length > 1 && (
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex gap-3 items-start">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90 leading-snug">
                {t("Your match predictions are global and apply to every pool you belong to — you only need to predict once.")}
              </p>
            </div>
          )}

          {/* Official Rules Card */}
          <div className="bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
            <h3 className="text-sm font-semibold text-foreground mb-3">{t("Official Rules")}</h3>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">{t("5 points")}</span> {t("for the exact score")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">{t("3 points")}</span> {t("for the correct winner and goal difference")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">{t("2 points")}</span> {t("for the correct winner")}</span>
              </li>
              <div className="mt-3 pt-3 border-t border-border/50"></div>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">{t("10 points")}</span> {t("for the tournament winner")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><span className="text-primary font-semibold">{t("10 points")}</span> {t("for the top scorer")}</span>
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground mb-1">{t("Deadlines")}</h4>
              <p className="text-muted-foreground text-sm">
                {t("Match predictions lock exactly at kickoff. Every prediction can be changed until its deadline. Scores update after matches.")}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full bg-card text-destructive rounded-xl p-3 flex items-center justify-center gap-2 border border-destructive/40 active:bg-destructive/20 transition-colors mt-4"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-semibold italic">{t("Logout")}</span>
          </button>
        </>
      )}
    </div>
  )
}

// Small helper component to render value with vertical arrows
function StatWithArrows({ label, value, arrow, toneClass, showArrows = true }: { label: string; value: number | string; arrow?: string; toneClass: string; showArrows?: boolean }) {
  const upClass = arrow === 'up' ? 'text-emerald-500' : 'text-muted-foreground opacity-40'
  const downClass = arrow === 'down' ? 'text-destructive' : 'text-muted-foreground opacity-40'

  if (!showArrows) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-10 flex justify-center">
          <p className={`text-lg font-bold ${toneClass} font-mono`}>{value}</p>
        </div>
        <div className="mt-1 w-10 text-center">
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    )
  }

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
