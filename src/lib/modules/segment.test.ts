import { describe, expect, it } from 'vitest'
import { segmentOf } from './segment'

/**
 * The sidebar used to be chosen with `pathname.includes('/chat')`, which is wrong in two ways that
 * only show up for somebody else: a workspace whose slug happens to be a module name, and any route
 * that merely contains the word. A segment is compared exactly, so neither can happen.
 */
describe('segmentOf', () => {
  it('is empty at the workspace root — the home sidebar', () => {
    expect(segmentOf('/northstar', 'northstar')).toBe('')
    expect(segmentOf('/northstar/', 'northstar')).toBe('')
  })

  it('is the first segment, not the whole path', () => {
    expect(segmentOf('/northstar/tracker', 'northstar')).toBe('tracker')
    expect(segmentOf('/northstar/tracker/reports', 'northstar')).toBe('tracker')
    expect(segmentOf('/northstar/settings/tracker/fields', 'northstar')).toBe('settings')
  })

  it('does not confuse a workspace slug with a module', () => {
    // The bug: `'/chat/tracker'.includes('/chat')` is true, so a workspace called `chat` lit up
    // chat's sidebar on every page in it.
    expect(segmentOf('/chat/tracker', 'chat')).toBe('tracker')
    expect(segmentOf('/chat', 'chat')).toBe('')
    expect(segmentOf('/chat/chat', 'chat')).toBe('chat')
  })

  it('does not match a module name that merely appears in a route', () => {
    expect(segmentOf('/northstar/settings/mail', 'northstar')).toBe('settings')
    expect(segmentOf('/northstar/tracker?q=chat', 'northstar')).toBe('tracker?q=chat')
  })
})
