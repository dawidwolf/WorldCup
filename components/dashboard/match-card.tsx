"use client"

import { useState, useEffect, useRef } from "react"
import MatchPredictionsModal from '@/components/match-predictions-modal'
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useHistoryLayer } from "@/hooks/use-history-layer"
import { useTournamentData } from "@/context/tournament-data-context"

interface Team {
  code: string
  name: string
  flag: string
}

interface MatchCardProps {
  id: string
  homeTeam: Team
  awayTeam: Team
  group: string
  matchTime: string
  status?: string
  closesIn?: string
  isToday?: boolean
  isUpcomingFar?: boolean //
  isPredictionSaved?: boolean
  isCompleted?: boolean
  isLive?: boolean // Added for live match state
  finalScore?: { home: number; away: number }
  pointsEarned?: { amount: number; type: string }
  onPredictionChange?: (matchId: string, home: number | null, away: number | null) => void
  initialPrediction?: { home: number | null; away: number | null }
  controlledPrediction?: { home: number | null; away: number | null }
  isSaving?: boolean
  activePoolId?: number | null
  currentUserId?: number | null
}

export function MatchCard({
  id,
  homeTeam,
  awayTeam,
  group,
  matchTime,
  status,
  closesIn,
  isToday,
  isUpcomingFar,
  isPredictionSaved,
  isCompleted,
  isLive,
  finalScore,
  pointsEarned,
  onPredictionChange,
  initialPrediction,
  controlledPrediction,
  isSaving = false,
  activePoolId = null,
  currentUserId = null,
  
}: MatchCardProps): import("react/jsx-runtime").JSX.Element {
  const { t } = useTournamentData()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [homeScore, setHomeScore] = useState<string>(
    initialPrediction?.home?.toString() ?? ""
  )
  const [awayScore, setAwayScore] = useState<string>(
    initialPrediction?.away?.toString() ?? ""
  )

  const homeInputRef = useRef<HTMLInputElement | null>(null)
  const awayInputRef = useRef<HTMLInputElement | null>(null)

  const { closeWithHistory: closeModal } = useHistoryLayer({
    layerId: `match-modal-${id}`,
    isOpen: isModalOpen,
    onClose: () => setIsModalOpen(false),
  })

  const normalizedStatus = (status ?? "").trim().toUpperCase()
  const isPostponed = normalizedStatus === "PST"
  const isFinishedByStatus = isCompleted || normalizedStatus === "FT"
  const isLiveByStatus = isLive || ["LIVE", "1H", "2H", "ET", "PEN"].includes(normalizedStatus)
  const usesTimeBasedBadge = ["NS", "SCHEDULED", ""].includes(normalizedStatus)

  // Sync with controlled prediction when provided
  useEffect(() => {
    if (typeof controlledPrediction !== 'undefined') {
      setHomeScore(controlledPrediction?.home?.toString() ?? "")
      setAwayScore(controlledPrediction?.away?.toString() ?? "")
    }
  }, [controlledPrediction])

  const handleScoreChange = (team: "home" | "away", value: string) => {
    // Allow empty or single digits 0-9
    if (value === "" || /^[0-9]$/.test(value)) {
      // Keep empty string display for unknown predictions
      if (team === "home") {
        setHomeScore(value === "" ? "" : value)
        // if user typed a digit into home, auto-focus away input
        if (value !== "") {
          setTimeout(() => awayInputRef.current?.focus(), 0)
        }
        const h = value === "" ? null : parseInt(value, 10)
        const a = awayScore === "" ? null : parseInt(awayScore, 10)
        scheduleSave(h, a)
      } else {
        setAwayScore(value === "" ? "" : value)
        const h = homeScore === "" ? null : parseInt(homeScore, 10)
        const a = value === "" ? null : parseInt(value, 10)
        scheduleSave(h, a)
      }
    }
  }

  const saveTimer = useRef<number | null>(null)
  const isFocused = useRef(false)

  const scheduleSave = (home: number | null, away: number | null) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    // @ts-ignore
    saveTimer.current = window.setTimeout(() => {
      if (!isFocused.current) {
        const hadPrev = (initialPrediction && (initialPrediction.home !== null || initialPrediction.away !== null)) || (controlledPrediction && (controlledPrediction.home !== null || controlledPrediction.away !== null))
        const bothNull = home === null && away === null
        const oneNull = (home === null || away === null) && !bothNull
        // only save if both values are set, or both null (and there's something to delete)
        if (oneNull || (bothNull && !hadPrev)) return
        onPredictionChange?.(id, home, away)
      }
    }, 500)
  }

  const flushSaveNow = () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const parseOrNull = (v: string) => (v === "" ? null : parseInt(v, 10))
    const h = parseOrNull(homeScore)
    const a = parseOrNull(awayScore)
    const hadPrev = (initialPrediction && (initialPrediction.home !== null || initialPrediction.away !== null)) || (controlledPrediction && (controlledPrediction.home !== null || controlledPrediction.away !== null))
    const bothNull = h === null && a === null
    const oneNull = (h === null || a === null) && !bothNull
    // only save if both values are set, or both null (and there's something to delete)
    if (oneNull || (bothNull && !hadPrev)) return
    onPredictionChange?.(id, h, a)
  }

  // Determine the status badge to show on the top right
  // Determine the status badge to show on the top right
  const renderStatusBadge = () => {
    if (isSaving) {
      return (
        <span className="bg-muted px-3 py-1 rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Spinner className="w-3 h-3" />
          {t("Saving...")}
        </span>
      )
    }
    if (isPostponed) {
      return (
        <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-medium">
          {t("Postponed")}
        </span>
      )
    }
    if (isFinishedByStatus) {
      return (
        <span className="bg-muted px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
          {t("Finished")}
        </span>
      )
    }
    if (isLiveByStatus) {
      return (
        <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-medium animate-pulse">
          {t("Live")}
        </span>
      )
    }
    if (isPredictionSaved && usesTimeBasedBadge) {
      return (
        <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <Check className="w-3 h-3" />
          {t("Saved")}
        </span>
      )
    }
    
    // 1. Red status badge if match is closing within 24 hours
    if (usesTimeBasedBadge && isToday) {
      return (
        <span className="bg-destructive/20 text-destructive px-3 py-1 rounded-full text-xs font-medium animate-pulse">
          {t("Closes soon")}
        </span>
      )
    }

    // 2. Grey status badge if match is further away than 3 days
    if (usesTimeBasedBadge && isUpcomingFar) {
      return (
        <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-medium">
          {closesIn ? closesIn : t("Coming up")}
        </span>
      )
    }

    // 3. Default Amber/Yellow badge for matches in the 2-3 days window
    return (
      <span className="bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-xs font-medium">
        {closesIn ? closesIn : t("Coming up")}
      </span>
    )
  }

  const handleCardClick = () => {
    // Only allow opening the predictions modal for Live or Finished matches
    if (isLiveByStatus || isFinishedByStatus) {
      setIsModalOpen(true)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      role="button"
      aria-disabled={!(isLiveByStatus || isFinishedByStatus)}
      className={cn(
        "bg-card rounded-2xl p-4 shadow-lg shadow-black/20 border border-border/50 transition-all",
        (isLiveByStatus || isFinishedByStatus) ? "cursor-pointer" : "opacity-95",
        isFinishedByStatus && "opacity-60"
      )}
    >
      {/* Top Row - Group/Time and Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted-foreground text-sm">{group} • {matchTime}</span>
        {renderStatusBadge()}
      </div>

      {/* Middle Row - Teams and Score */}
      <div className={cn(
        "grid grid-cols-3 items-center gap-2",
        isFinishedByStatus && pointsEarned && "mb-3"
      )}>
        {/* Home Team */}
        <div className="flex flex-col items-center">
          <span className="text-3xl">{homeTeam.flag}</span>
          <span className="font-bold text-foreground text-sm">{homeTeam.code}</span>
        </div>

        {/* Score Input */}
        <div className="flex items-center justify-center gap-2">
          {(isFinishedByStatus || isLiveByStatus) && finalScore ? (
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-foreground">{finalScore.home}</span>
              <span className="text-2xl text-muted-foreground">:</span>
              <span className="text-3xl font-bold text-foreground">{finalScore.away}</span>
            </div>
          ) : (
            <>
              <input
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if ((e as any).key === 'Enter') {
                    e.preventDefault()
                    flushSaveNow()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                value={homeScore}
                ref={homeInputRef}
                onClick={(e) => e.stopPropagation()}
                readOnly={isFinishedByStatus || isLiveByStatus}
                onChange={(e) => handleScoreChange("home", e.target.value)}
                onFocus={(e) => { isFocused.current = true; (e.target as HTMLInputElement).select() }}
                onMouseUp={(e) => { e.preventDefault(); (e.currentTarget as HTMLInputElement).select() }}
                onBlur={() => { isFocused.current = false; flushSaveNow() }}
                placeholder=""
                className={cn("w-12 h-12 rounded-xl bg-input border-2 border-border text-center text-2xl font-bold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all", (isFinishedByStatus || isLiveByStatus) && "opacity-50 cursor-not-allowed bg-muted")}
                maxLength={1}
              />
              <span className="text-2xl font-bold text-muted-foreground">:</span>
              <input
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if ((e as any).key === 'Enter') {
                    e.preventDefault()
                    flushSaveNow()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                value={awayScore}
                ref={awayInputRef}
                onClick={(e) => e.stopPropagation()}
                readOnly={isFinishedByStatus || isLiveByStatus}
                onChange={(e) => handleScoreChange("away", e.target.value)}
                onFocus={(e) => { isFocused.current = true; (e.target as HTMLInputElement).select() }}
                onMouseUp={(e) => { e.preventDefault(); (e.currentTarget as HTMLInputElement).select() }}
                onBlur={() => { isFocused.current = false; flushSaveNow() }}
                placeholder=""
                className={cn("w-12 h-12 rounded-xl bg-input border-2 border-border text-center text-2xl font-bold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all", (isFinishedByStatus || isLiveByStatus) && "opacity-50 cursor-not-allowed bg-muted")}
                maxLength={1}
              />
            </>
          )}
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center">
          <span className="text-3xl">{awayTeam.flag}</span>
          <span className="font-bold text-foreground text-sm">{awayTeam.code}</span>
        </div>
      </div>

      {/* Bottom Row - Prediction summary + points for live/finished matches */}
      {(isLiveByStatus || isFinishedByStatus) && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-muted-foreground text-sm truncate">
              {(() => {
                const predHome = (controlledPrediction && typeof controlledPrediction.home !== 'undefined') ? controlledPrediction?.home : initialPrediction?.home
                const predAway = (controlledPrediction && typeof controlledPrediction.away !== 'undefined') ? controlledPrediction?.away : initialPrediction?.away

                if (predHome == null && predAway == null) {
                  return t("No prediction submitted.")
                }

                const ph = predHome ?? 0
                const pa = predAway ?? 0
                return `${t("You predicted: ")}${ph}:${pa}.`
              })()}
              <span className={cn(
                "ml-1",
                isFinishedByStatus ? "text-muted-foreground" : "text-primary"
              )}>
                {t("Tap to see predictions")}
              </span>
            </div>

            {isFinishedByStatus && pointsEarned && (
              <div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium inline-flex items-center justify-center",
                  pointsEarned.amount === 5 ? "bg-emerald-600 text-white" :
                  pointsEarned.amount === 3 ? "bg-blue-600 text-white" :
                  pointsEarned.amount === 2 ? "border border-emerald-500 text-emerald-500 bg-transparent" :
                  "bg-muted text-muted-foreground"
                )}>
                  <span>
                    {pointsEarned.amount > 0 ? `${pointsEarned.amount} pts` : `0 pts`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <MatchPredictionsModal
        matchId={Number(id)}
        isOpen={isModalOpen}
        onClose={closeModal}
        activePoolId={activePoolId}
        currentUserId={currentUserId}
        isLive={isLive}
      />
    </div>
  )
}
