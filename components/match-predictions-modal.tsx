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
  display_home_score: string | null
  display_away_score: string | null
  points_delta: number | null
  is_finished: boolean
}

// This interface represents the raw shape of data from the 'pool_predictions_view'.
// All fields are potentially nullable as per Supabase's default `select('*')` behavior.
interface PoolPredictionFromView {
  user_id: number | null;
  predictor_name: string | null;
  display_home_score: string | null;
  display_away_score: string | null;
  points_delta: number | null;
  is_finished: boolean | null;
  [key: string]: any; // Allow other properties from the view
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !activePoolId) {
      setPredictions([])
      return
    }

    const fetchPredictions = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('pool_predictions_view')
        .select('*')
        .eq('match_id', matchId)
        .eq('pool_id', activePoolId)
        .order('points_delta', { ascending: false, nullsFirst: true })
        .order('predictor_name', { ascending: true })

      if (error) {
        console.error("Error fetching predictions:", error)
        // Optionally show a toast error
      } else {
        const formattedPredictions = ((data as PoolPredictionFromView[]) || [])
          .filter(
            (p): p is PoolPredictionFromView & { user_id: number; predictor_name: string } =>
              p.user_id != null && p.predictor_name != null
          )
          .map((p): PoolPrediction => ({
            user_id: p.user_id,
            predictor_name: p.predictor_name,
            display_home_score: p.display_home_score,
            display_away_score: p.display_away_score,
            points_delta: p.points_delta,
            is_finished: p.is_finished ?? false,
          }));
        setPredictions(formattedPredictions)
      }
      setIsLoading(false)
    }

    fetchPredictions()

    // Realtime subscription for predictions
    const channel = supabase
      .channel(`match-predictions-${matchId}-${activePoolId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          // Refetch all predictions to ensure correct sorting and data integrity
          fetchPredictions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, matchId, activePoolId])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-32px)] max-w-sm rounded-2xl bg-card border-border/50 shadow-2xl p-6 mx-auto">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-bold text-foreground">{t("Predictions")}</h3>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-8 h-8" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {predictions.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">{t("No predictions")}</p>
              ) : (
                predictions.map((pred) => (
                  <div
                    key={pred.user_id}
                    className={cn(
                      "flex items-center justify-between py-2 px-3 rounded-lg",
                      pred.user_id === currentUserId ? "bg-primary/10 border border-primary/30" : "bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {pred.predictor_name.toUpperCase()}
                      </span>
                      {pred.user_id === currentUserId && (
                        <span className="text-xs text-muted-foreground">{t("(You)")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {pred.display_home_score !== null && pred.display_away_score !== null ? (
                        <span className="text-lg font-bold text-foreground">
                          {pred.display_home_score}:{pred.display_away_score}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">
                          {isLive ? t("No predictions") : "—"}
                        </span>
                      )}

                      {pred.is_finished && pred.points_delta !== null && (
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium inline-flex items-center justify-center",
                            pred.points_delta === 5 ? "bg-primary text-white" : // Dark green fill
                            pred.points_delta === 3 ? "bg-emerald-600 text-white" : // Primary green fill
                            pred.points_delta === 2 ? "bg-muted text-white border border-primary" : // Grey fill with primary green border
                            "bg-muted text-white border border-destructive" // Grey fill with red border
                          )}
                        >
                          {pred.points_delta > 0 ? `${pred.points_delta} ${t("p")}` : `0 ${t("p")}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full bg-card hover:bg-muted text-muted-foreground py-3 rounded-xl font-bold uppercase tracking-widest transition-all border border-border/50 shadow-sm active:scale-[0.98]"
          >
            {t("Close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}