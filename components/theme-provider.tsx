'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // ⚡ React 19 Fix: Convert the optimization script into a data block on the client 
  // so React safely ignores it and doesn't trigger the warning overlay.
  const scriptProps = typeof window === "undefined" 
    ? undefined 
    : ({ type: "application/json" } as const);

  return (
    <NextThemesProvider {...props} scriptProps={scriptProps}>
      {children}
    </NextThemesProvider>
  )
}