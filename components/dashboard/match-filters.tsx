"use client"

import { useTournamentData } from "@/context/tournament-data-context"
import { cn } from "@/lib/utils"

interface MatchFiltersProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
}

export function MatchFilters({ activeFilter, onFilterChange }: MatchFiltersProps) {
  const { t } = useTournamentData()
  const filters = [
    { id: "all", label: t("All Matches") },
    { id: "today", label: t("Today") },
    { id: "group", label: t("Groups") },
  ]

  return (
    // ⚡ Outer structural wrapper matching layout dimensions
    <div className="fixed top-0 left-0 right-0 z-40 max-w-md mx-auto border-x border-primary/5 h-[135px] pointer-events-none">
      
      {/* ⚡ LAYER 1: The visual background plate. This feathers and blurs perfectly without affecting button visibility */}
      <div 
        className="absolute inset-0 bg-background/100 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_72px,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_72px,transparent)]" 
      />
      
      {/* ⚡ LAYER 2: The interactive buttons. Positioned exactly at top-[44px] and fully clickable */}
      <div className="absolute top-[44px] left-0 right-0 px-4 h-12 flex gap-1.5 items-center pointer-events-auto">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0",
              // Removed ml-auto to make the "Groups" button stick to the other filter buttons
              activeFilter === filter.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-secondary text-muted-foreground border border-primary/40 hover:bg-secondary/80 hover:text-foreground"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

    </div>
  )
}