import type { ViewMode } from '../types'

export const APP_NAME = 'Crew Operations Organization Chart'
export const APP_SHORT_NAME = 'CrewOps Org Chart'
export const APP_SUBTITLE = 'Secure internal crewing structure and vessel allocation workspace'

export function getPageTitle(viewMode: ViewMode) {
  const labelByView: Record<ViewMode, string> = {
    dashboard: 'Dashboard',
    overview: 'Organization Chart',
    operations: 'Operations & Vessel Allocation',
    vessels: 'Vessel Master',
    ai: 'AI Assistant',
    access: 'Access Management',
  }

  return `${labelByView[viewMode]} · ${APP_SHORT_NAME}`
}
