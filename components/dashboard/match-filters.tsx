"use client"

import { cn } from "@/lib/utils"

interface MatchFiltersProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
}

const filters = [
  { id: "all", label: "All Matches" },
  { id: "today", label: "Today" },
  { id: "group", label: "Groups" },
  { id: "knockouts", label: "Knockouts" },
]

export function MatchFilters({ activeFilter, onFilterChange }: MatchFiltersProps) {
  return (
    <div className="fixed top-[44px] left-0 right-0 z-40 bg-transparent">
      <div className="relative px-4 h-12">
        {/* gradient masked backdrop blur behind buttons with tinted overlay to stabilize color */}
        {/* overlay removed — using shared page-level overlay for continuous blur */}

        <div className="relative flex gap-1.5 z-10 items-center h-full">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0",
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
    </div>
  )
}
