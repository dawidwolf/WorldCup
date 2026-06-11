"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useTournamentData } from "@/context/tournament-data-context"
import { supabase } from "@/lib/supabase"
import { Spinner } from "@/components/ui/spinner"

interface MatchPredictionsModalProps {
  matchId: number
  isOpen: boolean
  onClose: () => void
  activePoolId: number | null
  currentUserId: number | null
  isLive?: boolean
}

interface PoolPrediction {
  user_id: number
  predictor_name: string
  predicted_home_score: number | null
  predicted_away_score: number | null
  points_delta: number
  is_finished: boolean
}

interface MatchScore {
  home: number | null
  away: number | null
}

export default function MatchPredictionsModal({
  matchId,
  isOpen,
  onClose,
  activePoolId,
  currentUserId,
  isLive = false,
}: MatchPredictionsModalProps) {
  const { t } = useTournamentData()
  const [predictions, setPredictions] = useState<PoolPrediction[]>([])
  const [matchScore, setMatchScore] = useState<MatchScore | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !activePoolId) {
      setPredictions([])
      setMatchScore(null)
      return
    }

    const fetchData = async () => {
      setIsLoading(true)

      try {
        const { data: matchData } = await supabase
          .from('matches')
          .select('home_score, away_score, is_finished')
          .eq('match_id', matchId)
          .single()

        if (matchData && matchData.home_score !== null && matchData.away_score !== null) {
          setMatchScore({ home: matchData.home_score, away: matchData.away_score })
        }

        const { data: rawPoolMembers } = await supabase
          .from('user_pools')
          .select(`
            user_id,
            users ( username )
          `)
          .eq('pool_id', activePoolId)

        const poolMembers = (rawPoolMembers || []).map(pm => ({
          user_id: pm.user_id,
          username: (pm.users as any)?.username || "Unknown"
        }))

        const { data: rawPreds } = await supabase
          .from('predictions')
          .select('user_id, predicted_home_score, predicted_away_score')
          .eq('match_id', matchId)

        if (poolMembers.length > 0 && matchData) {
          const merged: PoolPrediction[] = poolMembers.map((member) => {
            const userPred = (rawPreds || []).find(p => p.user_id === member.user_id)
            
            const homeScore = userPred?.predicted_home_score ?? null;
            const awayScore = userPred?.predicted_away_score ?? null;

            let earnedPoints = 0;
            if (matchData.is_finished && matchData.home_score !== null && matchData.away_score !== null && homeScore !== null && awayScore !== null) {
              const actH = matchData.home_score;
              const actA = matchData.away_score;

              if (homeScore === actH && awayScore === actA) {
                earnedPoints = 5; // Exact score
              } else {
                const actualDiff = actH - actA;
                const predDiff = homeScore - awayScore;
                if (actualDiff === predDiff) {
                  earnedPoints = 3; // Correct goal difference
                } else if (Math.sign(actualDiff) === Math.sign(predDiff)) {
                  earnedPoints = 2; // Correct outcome
                }
              }
            }

            return {
              user_id: member.user_id as number,
              predictor_name: member.username,
              predicted_home_score: homeScore,
              predicted_away_score: awayScore,
              points_delta: earnedPoints,
              is_finished: matchData.is_finished ?? false
            }
          })

          merged.sort((a, b) => {
            if (b.points_delta !== a.points_delta) {
              return b.points_delta - a.points_delta
            }
            return a.predictor_name.localeCompare(b.predictor_name)
          })

          setPredictions(merged)
        }
      } catch (error) {
        console.error("Error fetching modal data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    const channel = supabase
      .channel(`match-predictions-${matchId}-${activePoolId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions', filter: `match_id=eq.${matchId}` },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, matchId, activePoolId])

  return (
    /* THIS WRAPPER IS THE MAGIC SHIELD THAT STOPS EVENT BUBBLING */
    <div 
      onClick={(e) => e.stopPropagation()} 
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[calc(100%-32px)] max-w-sm rounded-2xl bg-card border-border/50 shadow-2xl p-6 mx-auto [&>button.absolute]:hidden overflow-hidden">
          <div className="flex flex-col space-y-4">
            
            {/* HEADER */}
            <div className="flex justify-between items-center pb-2 border-b border-border/30">
              <span className="text-s font-bold text-muted-foreground  tracking-wider">
                {t("Predictions")}
              </span>
              {matchScore && matchScore.home !== null && matchScore.away !== null && (
                <span className="text-s font-medium text-muted-foreground">
                  {t("Final Score")}: {matchScore.home}:{matchScore.away}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="w-8 h-8" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 overflow-x-hidden">
                {predictions.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm italic py-4">{t("No predictions")}</p>
                ) : (
                  predictions.map((pred) => (
                    <div
                      key={pred.user_id}
                      className={cn(
                        "flex items-center justify-between py-2.5 border-b border-border/30 last:border-0 px-1"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-foreground truncate">
                          {pred.predictor_name.toUpperCase()}
                        </span>
                        {pred.user_id === currentUserId && (
                          <span className="text-m font-medium text-foreground text-primary">{t("(You)")}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        {/* PREDICTED SCORE */}
                        {pred.predicted_home_score !== null && pred.predicted_away_score !== null ? (
                          <span className="text-lg font-bold text-foreground">
                            {pred.predicted_home_score}:{pred.predicted_away_score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">
                            {isLive ? t("No predictions") : "—"}
                          </span>
                        )}

                        {/* POINTS BADGE */}
                        {pred.is_finished && (
                          <div className="w-[50px] text-right flex justify-end">
                            <div className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold inline-flex items-center justify-center",
                              pred.points_delta === 5 ? "bg-primary text-white" :
                              pred.points_delta === 3 ? "bg-emerald-600 text-white" :
                              pred.points_delta === 2 ? "bg-muted text-white border border-primary" :
                              "bg-muted text-white border border-destructive" 
                            )}>
                              <span>
                                {pred.points_delta > 0 ? `${pred.points_delta} ${t("p")}` : `0 ${t("p")}`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* CLOSE BUTTON */}
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                className="w-full bg-muted text-muted-foreground py-3 rounded-xl font-bold uppercase tracking-widest transition-all border border-destructive shadow-sm focus:outline-none focus:ring-0 active:scale-[0.98] lg:hover:bg-muted/80"
              >
                {t("Close")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}