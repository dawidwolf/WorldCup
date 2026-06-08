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
    <>
      {/* ⚡ LAYER 1: Visual background plate moved to z-30. 
          On the matches tab, the filters (z-40) will safely cover this up without any double-blur overlap! */}
      <div 
        className="fixed top-0 left-0 right-0 z-30 max-w-md mx-auto border-x border-primary/5 h-[76px] bg-background/100 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_44px,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_44px,transparent)] pointer-events-none" 
      />
      
      {/* ⚡ LAYER 2: Text content layer kept at z-50 to stay perfectly on top of all components */}
      <header className="fixed top-0 left-0 right-0 z-50 max-w-md mx-auto border-x border-transparent h-12 pointer-events-none">
        <div className="relative h-full flex items-center justify-center px-4 pointer-events-auto">
          <p className="text-primary font-bold text-sm uppercase tracking-widest truncate">
            {groupName}
          </p>
        </div>
      </header>
    </>
  )
}