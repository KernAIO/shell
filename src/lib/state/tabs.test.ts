import { expect, describe as group, it } from 'vitest'
import {
  closeOthers,
  closeTab,
  closeToRight,
  insertTab,
  MAX_TABS,
  makeTab,
  moveTab,
  describe as relabel,
  relativeHref,
  restore,
  setPinned,
  stepId,
  type WorkTab,
} from './tabs'

const tab = (id: string, href = `/${id}`, pinned = false, named = false): WorkTab => ({
  id,
  href,
  label: id,
  icon: 'circle',
  pinned,
  named,
})

group('what a tab remembers of a URL', () => {
  it('reduces the workspace root to nothing', () => {
    expect(relativeHref('/acme', '', 'acme')).toBe('')
  })

  it('keeps the path below the workspace', () => {
    expect(relativeHref('/acme/settings/members', '', 'acme')).toBe('/settings/members')
  })

  it('keeps the query, which is where a conversation is named', () => {
    expect(relativeHref('/acme/chat', '?c=abc', 'acme')).toBe('/chat?c=abc')
  })

  it('drops a trailing slash so one place is not two tabs', () => {
    expect(relativeHref('/acme/inbox/', '', 'acme')).toBe('/inbox')
  })

  it('is not fooled by a workspace whose slug prefixes another', () => {
    expect(relativeHref('/acme-eu/chat', '', 'acme')).toBe('/acme-eu/chat')
  })
})

group('opening a tab', () => {
  it('puts it after the one you are on, where you look for it', () => {
    const tabs = [tab('a'), tab('b'), tab('c')]
    const next = insertTab(tabs, tab('new'), 'a')
    expect(next.map((t) => t.id)).toEqual(['a', 'new', 'b', 'c'])
  })

  it('appends when nothing is active', () => {
    expect(insertTab([tab('a')], tab('new'), null).map((t) => t.id)).toEqual(['a', 'new'])
  })

  it('drops the oldest unpinned tab past the cap rather than refusing', () => {
    const full = Array.from({ length: MAX_TABS }, (_, i) => tab(`t${i}`))
    const next = insertTab(full, tab('new'), 't0')
    expect(next).toHaveLength(MAX_TABS)
    expect(next.some((t) => t.id === 'new')).toBe(true)
    expect(next.some((t) => t.id === 't1')).toBe(false)
  })

  it('never evicts a pinned tab or the one you are on', () => {
    const full = Array.from({ length: MAX_TABS }, (_, i) => tab(`t${i}`, `/t${i}`, i === 0))
    const next = insertTab(full, tab('new'), 't1')
    expect(next.some((t) => t.id === 't0')).toBe(true)
    expect(next.some((t) => t.id === 't1')).toBe(true)
    expect(next.some((t) => t.id === 't2')).toBe(false)
  })
})

group('closing a tab', () => {
  it('moves to the right neighbour, so repeated closes travel one way', () => {
    const result = closeTab([tab('a'), tab('b'), tab('c')], 'b', 'b')
    expect(result.activeId).toBe('c')
    expect(result.tabs.map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('falls back to the left when there is no right', () => {
    expect(closeTab([tab('a'), tab('b')], 'b', 'b').activeId).toBe('a')
  })

  it('leaves you where you are when you close something else', () => {
    expect(closeTab([tab('a'), tab('b')], 'b', 'a').activeId).toBe('b')
  })

  it('reports nothing closed for an id that is not there', () => {
    const result = closeTab([tab('a')], 'a', 'gone')
    expect(result.closed).toBeNull()
    expect(result.tabs).toHaveLength(1)
  })

  it('hands back an empty strip and no active tab, for the caller to fill', () => {
    const result = closeTab([tab('a')], 'a', 'a')
    expect(result.tabs).toEqual([])
    expect(result.activeId).toBeNull()
  })

  it('spares pinned tabs when closing the others', () => {
    const tabs = [tab('pin', '/pin', true), tab('a'), tab('b')]
    expect(closeOthers(tabs, 'a').map((t) => t.id)).toEqual(['pin', 'a'])
  })

  it('spares pinned tabs when closing everything after one', () => {
    const tabs = [tab('a'), tab('b'), tab('keep', '/keep', true), tab('c')]
    expect(closeToRight(tabs, 'a').map((t) => t.id)).toEqual(['a', 'keep'])
  })
})

group('ordering', () => {
  it('moves a tab to a new position', () => {
    expect(moveTab([tab('a'), tab('b'), tab('c')], 0, 2).map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('ignores a move that goes nowhere or out of bounds', () => {
    const tabs = [tab('a'), tab('b')]
    expect(moveTab(tabs, 1, 1)).toBe(tabs)
    expect(moveTab(tabs, 0, 5)).toBe(tabs)
  })

  it('keeps pinned tabs at the front however they are dragged', () => {
    const tabs = [tab('pin', '/pin', true), tab('a'), tab('b')]
    expect(moveTab(tabs, 2, 0).map((t) => t.id)).toEqual(['pin', 'b', 'a'])
  })

  it('pulls a tab to the front when it is pinned', () => {
    expect(setPinned([tab('a'), tab('b'), tab('c')], 'c', true).map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('leaves an unpinned tab at the head of the unpinned block, not back where it came from', () => {
    const tabs = [tab('c', '/c', true), tab('a'), tab('b')]
    expect(setPinned(tabs, 'c', false).map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('wraps around the ends when stepping', () => {
    const tabs = [tab('a'), tab('b'), tab('c')]
    expect(stepId(tabs, 'c', 1)).toBe('a')
    expect(stepId(tabs, 'a', -1)).toBe('c')
    expect(stepId([], null, 1)).toBeNull()
  })
})

group('naming', () => {
  it('renames every tab pointing at the same place', () => {
    const tabs = [tab('a', '/chat?c=1'), tab('b', '/chat?c=1'), tab('c', '/chat?c=2')]
    const next = relabel(tabs, '/chat?c=1', { label: '#eng-core' })
    expect(next.map((t) => t.label)).toEqual(['#eng-core', '#eng-core', 'c'])
  })

  it('returns the same list when nothing changed, so no save is triggered', () => {
    const tabs = [tab('a', '/a', false, true)]
    expect(relabel(tabs, '/a', { label: 'a', icon: 'circle' })).toBe(tabs)
    expect(relabel(tabs, '/elsewhere', { label: 'x' })).toBe(tabs)
  })

  it('lets the shell refresh a name it derived, so a language change reaches the strip', () => {
    const tabs = [tab('a', '/inbox')]
    expect(relabel(tabs, '/inbox', { label: 'صندوق ورودی' }, false)[0]?.label).toBe('صندوق ورودی')
  })

  it('never lets the shell overwrite what the page named', () => {
    const tabs = [tab('a', '/chat?c=1', false, true)]
    expect(relabel(tabs, '/chat?c=1', { label: 'Chat' }, false)[0]?.label).toBe('a')
  })
})

group('restoring a saved strip', () => {
  it('reads back what was written', () => {
    const saved = { tabs: [tab('a'), tab('b')], activeId: 'b' }
    expect(restore(JSON.parse(JSON.stringify(saved)))?.activeId).toBe('b')
  })

  it('falls back to the first tab when the active one is gone', () => {
    expect(restore({ tabs: [tab('a')], activeId: 'missing' })?.activeId).toBe('a')
  })

  it('refuses anything that is not a tab list rather than repairing it', () => {
    expect(restore(null)).toBeNull()
    expect(restore({ tabs: 'nope' })).toBeNull()
    expect(restore({ tabs: [] })).toBeNull()
    expect(restore({ tabs: [{ id: 'a' }] })).toBeNull()
  })

  it('restores pinned tabs to the front', () => {
    const restored = restore({ tabs: [tab('a'), tab('p', '/p', true)], activeId: 'a' })
    expect(restored?.tabs.map((t) => t.id)).toEqual(['p', 'a'])
  })
})

group('making a tab', () => {
  it('starts unpinned with the label it was given', () => {
    expect(makeTab('/inbox', { label: 'Inbox', icon: 'inbox' }, 'id1')).toEqual({
      id: 'id1',
      href: '/inbox',
      label: 'Inbox',
      icon: 'inbox',
      pinned: false,
      named: false,
    })
  })
})
