"use client"

interface HeaderProps {
  groupName: string
  groupCode: string
  rank: number
  points: number
  onNavigateToRankings?: () => void
}

export function Header({ groupName, groupCode, rank, points, onNavigateToRankings }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-0 px-4 py-6 h-12 bg-background/80 backdrop-blur-md max-w-md mx-auto border-x border-primary/5">
      <div className="relative h-full flex items-center justify-center">
        <p className="text-primary font-bold text-sm uppercase tracking-widest">{groupName}</p>
      </div>
    </header>
  )
}
