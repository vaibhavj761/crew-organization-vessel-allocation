export type CrewManagerLayoutMode = 'one' | 'two' | 'three' | 'four' | 'many'

export function getCrewManagerLayoutMode(count: number): CrewManagerLayoutMode {
  if (count <= 1) return 'one'
  if (count === 2) return 'two'
  if (count === 3) return 'three'
  if (count === 4) return 'four'
  return 'many'
}

export function getViewportVesselColumnCount(count: number) {
  if (count <= 8) return 1
  if (count <= 16) return 2
  return 3
}
