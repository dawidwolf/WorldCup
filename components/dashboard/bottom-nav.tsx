"use client"

import { cn } from "@/lib/utils"
import { Trophy, Users, User, CalendarDays } from "lucide-react"

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "matches", label: "Matches", icon: CalendarDays },
  { id: "players", label: "Bonus", icon: Users },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "profile", label: "Profile", icon: User },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-effect border-t safe-area-pb">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id)
                // Ensure page is at top for non-matches tabs
                if (item.id !== 'matches') {
                  // run after the tab change to avoid visual jump during render
                  setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 0)
                }
              }}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-6 h-6 transition-all",
                  isActive && "drop-shadow-[0_0_8px_var(--primary)]"
                )}
              />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
