import { useRef, useState, useEffect } from "react"
import { Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBonus } from "@/hooks/use-bonus"
import type { DBTeam, DBPlayer } from "@/hooks/use-bonus"
import { Spinner } from "@/components/ui/spinner"
import { getFlag } from "@/lib/flags"
import { toast } from "sonner"
import { useHistoryLayer } from "@/hooks/use-history-layer"
import { useTournamentData } from "@/context/tournament-data-context"

interface BonusTabProps {
  currentUserId: number
  onSaved?: () => void
}

export function BonusTab({ currentUserId, onSaved }: BonusTabProps) {
  const { teams, players, savedWinnerId, savedScorerId, goldenBootLeaders, isLocked, loading, saveWinner, saveScorer } = useBonus(currentUserId)
  const { t } = useTournamentData()
  const winnerInputRef = useRef<HTMLInputElement | null>(null)
  const scorerInputRef = useRef<HTMLInputElement | null>(null)
  const winnerCardRef = useRef<HTMLDivElement | null>(null)
  const scorerCardRef = useRef<HTMLDivElement | null>(null)

  const [localWinnerId, setLocalWinnerId] = useState<number | null>(null)
  const [localScorerId, setLocalScorerId] = useState<number | null>(null)

  useEffect(() => {
    setLocalWinnerId(savedWinnerId)
    setLocalScorerId(savedScorerId)
  }, [savedWinnerId, savedScorerId])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [])

  const [winnerSearch, setWinnerSearch] = useState("")
  const [scorerSearch, setScorerSearch] = useState("")
  const [showWinnerDropdown, setShowWinnerDropdown] = useState(false)
  const [showScorerDropdown, setShowScorerDropdown] = useState(false)

  const { closeWithHistory: closeWinnerDropdown } = useHistoryLayer({
    layerId: `bonus-winner-${currentUserId}`,
    isOpen: showWinnerDropdown,
    onClose: () => setShowWinnerDropdown(false),
  })

  const { closeWithHistory: closeScorerDropdown } = useHistoryLayer({
    layerId: `bonus-scorer-${currentUserId}`,
    isOpen: showScorerDropdown,
    onClose: () => setShowScorerDropdown(false),
  })

  if (loading) return <div className="flex justify-center py-8"><Spinner className="w-8 h-8" /></div>

  const selectedWinner = teams.find(t => t.team_id === localWinnerId)

  const getPlayerTeamInfo = (teamId?: number | null) => {
    if (teamId == null) return { teamName: "Unknown", flag: "⚽" }
    const team = teams.find(t => t.team_id === teamId)
    return {
      teamName: team?.team_name ?? "Unknown",
      flag: team ? getFlag(team.team_flag ?? team.abbreviation ?? undefined) : "⚽"
    }
  }

  const selectedScorer = players.find(p => p.player_id === localScorerId)
  const scorerTeamInfo = selectedScorer ? getPlayerTeamInfo(selectedScorer.team_id) : null

  const filteredTeams = teams.filter(team =>
    (team.team_name ?? "").toLowerCase().includes(winnerSearch.toLowerCase()) ||
    (team.abbreviation ?? "").toLowerCase().includes(winnerSearch.toLowerCase())
  )

  const filteredPlayers = players.filter(player =>
    player.player_name.toLowerCase().includes(scorerSearch.toLowerCase())
  )

  const renderBadge = (hasSelection: boolean, locked: boolean) => {
    if (locked) {
      if (hasSelection) {
        return (
          <span className="bg-muted px-2 py-1 rounded-md text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Check className="w-3 h-3" /> {t("Saved")}
          </span>
        )
      }

      return (
        <span className="bg-muted px-2 py-1 rounded-md text-xs font-medium text-muted-foreground">
          {t("Locked")}
        </span>
      )
    }

    if (hasSelection) {
      return (
        <span className="bg-primary/20 text-primary px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
          <Check className="w-3 h-3" /> {t("Saved")}
        </span>
      )
    }

    return (
      <span className="bg-destructive/20 text-destructive px-2 py-1 rounded-md text-xs font-medium animate-pulse">
        {t("Closes soon")}
      </span>
    )
  }

  const winnerCanEdit = !isLocked
  const scorerCanEdit = !isLocked

  const scrollToDefaultPosition = () => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "auto" })
  }

  const scrollCardToTop = (cardRef: React.RefObject<HTMLDivElement | null>) => {
    cardRef.current?.scrollIntoView({ block: "start", behavior: "auto" })
  }

  return (
    <div className="space-y-4">
      <div ref={winnerCardRef} className="scroll-mt-32 bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("Predict Winner")}
          </h3>
          {renderBadge(!!localWinnerId, isLocked)}
        </div>
        <div className="relative">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl">
              {selectedWinner ? getFlag(selectedWinner.team_flag ?? selectedWinner.abbreviation ?? undefined) : "🏆"}
            </span>
            <input
              ref={winnerInputRef}
              type="text"
              value={winnerSearch}
              onChange={(e) => {
                if (!winnerCanEdit) return
                setWinnerSearch(e.target.value)
                if (localWinnerId) setLocalWinnerId(null)
                setShowWinnerDropdown(true)
              }}
              onFocus={() => {
                if (!winnerCanEdit) return
                setShowWinnerDropdown(true)
                scrollCardToTop(winnerCardRef)
              }}
              onBlur={() => setTimeout(() => closeWinnerDropdown(), 200)}
              placeholder={selectedWinner?.team_name ?? t("Search team...")}
              readOnly={!winnerCanEdit}
              className={cn(
                "w-full bg-secondary/50 border border-border/50 rounded-xl pl-12 pr-10 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50",
                !winnerCanEdit && "opacity-60 cursor-not-allowed"
              )}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          </div>
          {showWinnerDropdown && !isLocked && filteredTeams.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border/50 shadow-xl overflow-hidden z-10 max-h-60 overflow-y-auto">
              {filteredTeams.map((team) => (
                <button
                  key={team.team_id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    winnerInputRef.current?.blur()
                  }}
                    onClick={async () => {
                    const result = await saveWinner(team.team_id)
                    if ((result as any)?.error) {
                      toast.error(t('Failed to save winner pick'))
                      return
                    }
                    setLocalWinnerId(team.team_id)
                    setWinnerSearch("")
                    setShowWinnerDropdown(false)
                    scrollToDefaultPosition()
                    onSaved?.()
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <span className="text-2xl">{getFlag(team.team_flag ?? team.abbreviation ?? undefined)}</span>
                  <span className="text-foreground">{team.team_name}</span>
                  <span className="text-muted-foreground text-sm ml-auto">{team.abbreviation}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={scorerCardRef} className="scroll-mt-14 bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("Predict Top Scorer")}
          </h3>
          {renderBadge(!!localScorerId, isLocked)}
        </div>
        <div className="relative">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl">
              {scorerTeamInfo ? scorerTeamInfo.flag : "⚽"}
            </span>
            <input
              ref={scorerInputRef}
              type="text"
              value={scorerSearch}
              onChange={(e) => {
                if (!scorerCanEdit) return
                setScorerSearch(e.target.value)
                if (localScorerId) setLocalScorerId(null)
                setShowScorerDropdown(true)
              }}
              onFocus={() => {
                if (!scorerCanEdit) return
                setShowScorerDropdown(true)
                scrollCardToTop(scorerCardRef)
              }}
              onBlur={() => setTimeout(() => closeScorerDropdown(), 200)}
              placeholder={selectedScorer ? selectedScorer.player_name : t("Search player...")}
              readOnly={!scorerCanEdit}
              className={cn(
                "w-full bg-secondary/50 border border-border/50 rounded-xl pl-12 pr-10 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50",
                !scorerCanEdit && "opacity-60 cursor-not-allowed"
              )}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          </div>
          {showScorerDropdown && !isLocked && filteredPlayers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border/50 shadow-xl overflow-hidden z-10 max-h-60 overflow-y-auto">
              {filteredPlayers.map((player) => {
                const teamInfo = getPlayerTeamInfo(player.team_id)
                return (
                  <button
                    key={player.player_id}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      scorerInputRef.current?.blur()
                    }}
                    onClick={async () => {
                      const result = await saveScorer(player.player_id)
                      if ((result as any)?.error) {
                        toast.error(t('Failed to save top scorer pick'))
                        return
                      }
                      setLocalScorerId(player.player_id)
                      setScorerSearch("")
                      setShowScorerDropdown(false)
                      requestAnimationFrame(() => scrollToDefaultPosition())
                      onSaved?.()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <span className="text-2xl">{teamInfo.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-foreground">{player.player_name}</span>
                      <span className="text-muted-foreground text-xs">{teamInfo.teamName}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-secondary/30 rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("Live Golden Boot Race")}
        </h3>
        <div className="px-3 mb-2 grid grid-cols-[2.5rem_1fr_3rem] items-center text-xs text-muted-foreground font-bold uppercase tracking-widest">
          <span className="pl-1">#</span>
          <span>{t("Player")}</span>
          <span className="text-right">{t("Goals")}</span>
        </div>
        {/* ⚡ Live Golden Boot Race List Wrapper */}
        <div className="space-y-2">
          {(() => {
            // 1. Create a copy and sort dynamically: Goals descending, then player_id ascending
            const sortedLeaders = [...goldenBootLeaders].sort((a, b) => {
              const goalsA = a.goals ?? 0
              const goalsB = b.goals ?? 0
              
              if (goalsB !== goalsA) {
                return goalsB - goalsA // Primary sort: Highest goals first
              }
              return a.player_id - b.player_id // Secondary fallback sort: Lowest player_id first
            })

            const ranks: number[] = []
            let currentRank = 1
            let tieCount = 1
            
            // 2. Compute ranks using the sorted array copy instead
            for (let i = 0; i < sortedLeaders.length; i++) {
              const cur = sortedLeaders[i]
              if (i === 0) {
                ranks.push(currentRank)
                tieCount = 1
                continue
              }
              const prev = sortedLeaders[i - 1]
              if ((cur.goals ?? 0) === (prev.goals ?? 0) && (cur.goals ?? 0) > 0) {
                ranks.push(currentRank)
                tieCount++
              } else {
                currentRank = currentRank + tieCount
                tieCount = 1
                ranks.push(currentRank)
              }
            }

            // 3. Map over sortedLeaders to build the final UI components
            return sortedLeaders.map((player, index) => {
              const rank = ranks[index] ?? (index + 1)
              const teamInfo = getPlayerTeamInfo(player.team_id)
              const isSelected = player.player_id === localScorerId || player.player_id === savedScorerId
              return (
                <div
                  key={player.player_id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl",
                    isSelected ? "border border-primary/50 bg-primary/[0.03]" : "bg-card"
                  )}
                >
                  <div className="w-6.2 flex justify-center">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground">{rank}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl">{teamInfo.flag}</span>
                    <span className={cn("text-foreground truncate", isSelected && "text-primary font-semibold")}>{player.player_name}</span>
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-primary font-bold">{player.goals ?? 0}</span>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}
