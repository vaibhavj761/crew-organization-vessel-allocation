import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('no automatic polling on normal pages', () => {
  it('removes interval and focus/visibility refresh loops from chart state', () => {
    const source = read('src/state/ChartContext.tsx')
    expect(source).not.toContain('setInterval(')
    expect(source).not.toContain('setTimeout(')
    expect(source).not.toContain("visibilitychange")
    expect(source).not.toContain("window.addEventListener('focus'")
  })

  it('removes access-management polling loops', () => {
    const source = read('src/components/AdminAccessRequests.tsx')
    expect(source).not.toContain('setInterval(')
    expect(source).not.toContain('setTimeout(')
    expect(source).not.toContain("visibilitychange")
    expect(source).not.toContain("window.addEventListener('focus'")
    expect(source).toContain("type AccessRefreshReason = 'page-open' | 'manual-refresh' | 'post-action'")
    expect(source).toContain("void load('page-open', true)")
  })

  it('uses explicit refresh reasons instead of implicit effect loops', () => {
    const source = read('src/state/ChartContext.tsx')
    expect(source).toContain('allowedRefreshReasons')
    expect(source).toContain("refreshWorkspaceData('browser-bootstrap')")
    expect(source).toContain("refreshWorkspaceData('save-success')")
    expect(source).not.toContain("useEffect(() => {\n    void loadFromServer(true)\n  }, [loadFromServer])")
  })
})
