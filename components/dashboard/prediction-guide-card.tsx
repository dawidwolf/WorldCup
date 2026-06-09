"use client"

import { useState, useEffect } from "react"
import { HelpCircle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface PredictionGuideCardProps {
  t: (key: string) => string
}

export function PredictionGuideCard({ t }: PredictionGuideCardProps) {
  // Initialize state directly from localStorage to prevent animation on load.
  // This runs only on the client, which is what we want.
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem("wc2026_guide_collapsed") === "true"
  })

  const toggleCollapse = () => {
    const nextState = !isCollapsed
    setIsCollapsed(nextState)
    // Save their preference so it stays out of the way on future visits
    localStorage.setItem("wc2026_guide_collapsed", String(nextState))
  }

  return (
    <div className="bg-gradient-to-br from-card to-muted/40 border border-background/35 rounded-2xl p-3 shadow-sm relative overflow-hidden group">
      {/* Decorative accent background blur */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-primary/10" />
      
      {/* Clickable Header */}
      <button 
        onClick={toggleCollapse}
        className={cn(
          "w-full flex items-center justify-between outline-none transition-all",
          !isCollapsed && "mb-2.5"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <HelpCircle className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("How to Predict?")}
          </span>
        </div>
        
        {/* Animated Chevron Arrow */}
        <div className="p-1 text-primary/100 hover:text-primary transition-colors">
          <ChevronDown 
            className={cn(
              "w-4 h-4 transition-transform duration-300",
              !isCollapsed && "rotate-180" // Points up when open, down when closed
            )} 
          />
        </div>
      </button>

      {/* Smoothly Animated Expandable Content */}
      <div 
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        )}
      >
        <div className="overflow-hidden">
          <p className="text-muted-foreground text-sm mb-1 leading-relaxed">
            {t("Click on the score numbers (0:0) inside any match card below to enter or change your prediction. Your changes are saved automatically!")}
          </p>
        </div>
      </div>
    </div>
  )
}