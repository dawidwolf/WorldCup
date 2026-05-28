"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabase"
import { Spinner } from "@/components/ui/spinner"

interface PredictionRow {
  user_id: number
  username?: string
  predictor_name?: string
  display_home_score: string
  display_away_score: string
  is_finished: boolean
  points_delta?: number | null
  event_type?: string | null
  points_total?: number | null
  exact_hits?: number | null
}

interface Props {
  matchId: number | null | undefined
  isOpen: boolean
  onClose?: () => void
  activePoolId?: number | null
  currentUserId?: number | null
  isLive?: boolean
}

export default function MatchPredictionsModal({ matchId, isOpen, onClose, activePoolId, currentUserId, isLive }: Props) {
  const [predictions, setPredictions] = useState<PredictionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [Motion, setMotion]: any = useState(null)
  const [visibleMotionReady, setVisibleMotionReady] = useState<boolean>(false)

  useEffect(() => {
    // try to load framer-motion dynamically; if not available we safely fall back
    let mounted = true
    import("framer-motion").then((m) => { if (mounted) setMotion(m) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!isOpen || !matchId) return
    let mounted = true
    setLoading(true)
    const fetchPredictions = async () => {
      try {
        // Strictly require an activePoolId to avoid returning global predictions
        if (activePoolId == null) {
          // Do not fetch global predictions; enforce pool isolation
          if (!mounted) return
          setPredictions([])
          return
        }

        const { data, error } = await supabase
          .from('pool_predictions_view')
          .select('*')
          .eq('match_id', matchId)
          .eq('pool_id', activePoolId)

        if (error) throw error
        if (!mounted) return
        setPredictions((data || []) as PredictionRow[])
      } catch (err) {
        console.error("Failed to load predictions", err)
        setPredictions([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void fetchPredictions()

    const channel = supabase
      .channel(`match-predictions-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions' },
        (payload) => {
          const newRow = payload.new as any
          const oldRow = payload.old as any

          const changedMatchId =
            String(newRow?.match_id ?? oldRow?.match_id ?? '') === String(matchId)

          if (!changedMatchId) return

          void fetchPredictions()
        }
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [isOpen, matchId, activePoolId])

  useEffect(() => {
    // no-op: modal visibility is controlled by `isOpen` prop directly
    // keep a small flag to indicate motion lib readiness if needed
    setVisibleMotionReady(!!Motion)
  }, [isOpen])

  // When there are no predictions in the database, we simply show a centered
  // "No predictions" empty state.

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  const Panel: any = Motion?.motion ? Motion.motion.div : "div"
  const panelProps = Motion?.motion ? {
    initial: { scale: 0.98, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { duration: 0.18 } },
    exit: { scale: 0.98, opacity: 0, transition: { duration: 0.12 } }
  } : { className: "transition-transform duration-200 ease-out" }

  const renderBadge = (p: PredictionRow) => {
    if (!p.is_finished) return null
    const pts = p.points_delta ?? 0
    if (pts === 3) {
      return (
        <span className="ml-2 inline-flex items-center text-sm font-semibold bg-emerald-600/10 text-emerald-700 px-2 py-1 rounded-lg shadow-[0_0_12px_rgba(16,185,129,0.12)]">
          +3 PTS (Exact)
        </span>
      )
    }
    if (pts === 1) {
      return (
        <span className="ml-2 inline-flex items-center text-sm font-semibold bg-sky-100 text-sky-700 px-2 py-1 rounded-lg">
          +1 PT (Outcome)
        </span>
      )
    }
    return (
      <span className="ml-2 inline-flex items-center text-sm font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
        0 PTS
      </span>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      {/* overlay */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
        onClick={(e) => { e.stopPropagation(); onClose?.() }}
      />

      <Panel
        {...panelProps}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="relative w-full sm:max-w-md max-w-lg mx-auto rounded-2xl overflow-hidden bg-card border border-border/40 z-20 pointer-events-auto shadow-xl"
      >
        <header className="px-4 pt-4 pb-2 border-b border-border/30">
          <h3 className="text-sm font-bold text-foreground">Predictions</h3>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-2 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Spinner className="w-8 h-8 text-primary" /></div>
          ) : predictions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-center text-sm text-muted-foreground">No predictions</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {(() => {
                // sort by pool ranking fields if present: points_total, exact_hits, then username
                const sorted = [...predictions].sort((a, b) => {
                  const pa = a.points_total ?? 0
                  const pb = b.points_total ?? 0
                  if (pb !== pa) return pb - pa
                  const ea = a.exact_hits ?? 0
                  const eb = b.exact_hits ?? 0
                  if (eb !== ea) return eb - ea
                  return (a.username || '').localeCompare(b.username || '')
                })
                return sorted.map((p) => {
                  const home = p.display_home_score === '🔒' ? '-' : p.display_home_score
                  const away = p.display_away_score === '🔒' ? '-' : p.display_away_score
                  const baseName = p.predictor_name ?? p.username ?? 'Unknown'
                  const isMe = currentUserId != null && String(p.user_id) === String(currentUserId)
                  return (
                    <li key={`${p.user_id}-${baseName}`} className="flex items-center justify-between px-3 py-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {baseName}{isMe && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-foreground">{home}</div>
                        <div className="text-sm text-muted-foreground">:</div>
                        <div className="text-sm font-medium text-foreground">{away}</div>
                        {renderBadge(p)}
                      </div>
                    </li>
                  )
                })
              })()}
            </ul>
          )}
        </div>

        <div className="sticky bottom-0 bg-card/90 backdrop-blur-sm border-t border-border/30 px-4 py-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose?.() }}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold shadow-md active:scale-[0.99] transition-transform"
          >
            Close
          </button>
        </div>
      </Panel>
    </div>,
    document.body
  )
}
