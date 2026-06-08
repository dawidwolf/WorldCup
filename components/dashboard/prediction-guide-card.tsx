"use client"

import { HelpCircle, Clock, Edit3, Save } from "lucide-react"

interface PredictionGuideCardProps {
  t: (key: string) => string
}

export function PredictionGuideCard({ t }: PredictionGuideCardProps) {
  return (
    <div className="bg-gradient-to-br from-card to-muted/40 border border-background/35 rounded-2xl p-3 shadow-sm relative overflow-hidden group">
      {/* Decorative accent background blur */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-primary/10" />
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <HelpCircle className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("How to Predict?")}
        </span>
      </div>

      {/* Main explanation text */}
      <p className="text-muted-foreground text-sm mb-1">
        {t("Click on the score numbers (0:0) inside any match card below to enter or change your prediction. Your changes are saved automatically!")}
      </p>
    </div>
  )
}