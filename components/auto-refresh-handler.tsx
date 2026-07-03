"use client"

import { useEffect } from 'react'
import { useTournamentData } from '@/context/tournament-data-context'

export function AutoRefreshHandler() {
  // We assume you will add a 'silentRefresh' function to your context next
  const { silentRefresh } = useTournamentData() 

  useEffect(() => {
    const handleFocus = () => {
      // When the user switches back to the tab or unlocks their phone
      if (document.visibilityState === 'visible') {
        console.log("App regained focus. Silently fetching fresh data...")
        if (silentRefresh) {
          silentRefresh()
        }
      }
    }

    // Listen for tab switching
    document.addEventListener('visibilitychange', handleFocus)
    // Listen for window clicking/focusing
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleFocus)
      window.removeEventListener('focus', handleFocus)
    }
  }, [silentRefresh])

  return null // This component is invisible!
}