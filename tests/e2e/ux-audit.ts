import type { Page } from '@playwright/test'

/**
 * The mechanical half of "does this feel made by someone who cared".
 *
 * Completeness is checked by the feature specs beside this file; what they cannot see is the class
 * of defect that ships silently — text nobody can read in dark mode, an icon button a screen reader
 * announces as "button", a control too small to hit on a touch screen, a page that scrolls sideways
 * in Persian. None of it fails a build, a type-check or a unit test, and all of it is the difference
 * between a product and a prototype.
 *
 * Every rule here is decidable from the rendered page, so it is checked by looking at the running
 * interface rather than by reading the source. Anything a machine cannot judge — whether the copy is
 * kind, whether the layout has rhythm — is deliberately not here; see the `kern-ui` skill for that.
 */

export type Violation = {
  /** which rule was broken, so failures group by cause rather than by page */
  rule: 'cursor' | 'name' | 'target' | 'contrast' | 'overflow' | 'focus' | 'heading'
  /** what is wrong, in the units a fix is expressed in */
  detail: string
  /** enough of the element to find it: tag, classes, and the text a person would search for */
  where: string
}

export type AuditResult = {
  violations: Violation[]
  /** elements a rule could not judge — reported so a quiet audit is not mistaken for a clean one */
  skipped: { contrastOverImagery: number }
  counted: { interactive: number; text: number }
}

/**
 * Runs in the page, so it is written as one self-contained function with no imports: Playwright
 * serialises the source and evaluates it in the browser.
 */
function auditInPage(): AuditResult {
  const violations: Violation[] = []
  const skipped = { contrastOverImagery: 0 }
  const counted = { interactive: 0, text: 0 }
  const MAX_PER_RULE = 12

  const add = (rule: Violation['rule'], detail: string, where: string) => {
    if (violations.filter((v) => v.rule === rule).length >= MAX_PER_RULE) return
    violations.push({ rule, detail, where })
  }

  // ---- describing an element -------------------------------------------------------------------

  const describe = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    const cls = (el.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((c) => `.${c}`)
      .join('')
    const testid = el.getAttribute('data-testid')
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
    const id = el.id ? `#${el.id}` : ''
    const marks = [testid ? `[data-testid=${testid}]` : '', text ? `“${text}”` : ''].filter(Boolean)
    return `${tag}${id}${cls}${marks.length ? ` ${marks.join(' ')}` : ''}`
  }

  // ---- visibility ------------------------------------------------------------------------------

  const isVisible = (el: Element): boolean => {
    if (typeof el.checkVisibility === 'function') {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }

  /** aria-hidden anywhere above means assistive tech never sees it, so no rule here applies */
  const isHiddenFromA11y = (el: Element): boolean => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      if (n.getAttribute('aria-hidden') === 'true') return true
    }
    return false
  }

  const isDisabled = (el: Element): boolean =>
    Boolean(el.closest('[disabled],[aria-disabled="true"],fieldset[disabled]'))

  // ---- accessible name -------------------------------------------------------------------------

  const accessibleName = (el: Element): string => {
    const labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) {
      const parts = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim()
      if (parts) return parts
    }
    const label = el.getAttribute('aria-label')?.trim()
    if (label) return label
    const title = el.getAttribute('title')?.trim()
    if (title) return title

    // an input's visible name may live in a <label for> or a wrapping <label>
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      if (el.labels?.length) {
        const t = Array.from(el.labels)
          .map((l) => l.textContent ?? '')
          .join(' ')
          .trim()
        if (t) return t
      }
      if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button')) {
        if (el.value.trim()) return el.value.trim()
      }
    }

    // text, ignoring anything explicitly hidden from assistive tech
    const clone = el.cloneNode(true) as Element
    for (const hidden of Array.from(clone.querySelectorAll('[aria-hidden="true"]'))) hidden.remove()
    const text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) return text

    // an icon expressed as an <img> or a titled <svg> names itself
    const alt = el.querySelector('img[alt]')?.getAttribute('alt')?.trim()
    if (alt) return alt
    const svgTitle = el.querySelector('svg > title')?.textContent?.trim()
    if (svgTitle) return svgTitle
    return ''
  }

  // ---- colour ----------------------------------------------------------------------------------

  type RGBA = { r: number; g: number; b: number; a: number }

  const parseColor = (value: string): RGBA | null => {
    const m = value.match(/rgba?\(([^)]+)\)/)
    if (!m?.[1]) return null
    const parts = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number)
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null
    const [r, g, b, a] = parts as [number, number, number, number | undefined]
    return { r, g, b, a: a ?? 1 }
  }

  /** src over dst, both premultiplied out — the compositing the browser does for us on screen */
  const over = (src: RGBA, dst: RGBA): RGBA => {
    const a = src.a + dst.a * (1 - src.a)
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
    const mix = (s: number, d: number) => (s * src.a + d * dst.a * (1 - src.a)) / a
    return { r: mix(src.r, dst.r), g: mix(src.g, dst.g), b: mix(src.b, dst.b), a }
  }

  const luminance = ({ r, g, b }: RGBA): number => {
    const channel = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  const contrastRatio = (a: RGBA, b: RGBA): number => {
    const la = luminance(a)
    const lb = luminance(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  /**
   * What the eye actually sees where this text is drawn: its colour, and the colour behind it.
   *
   * The subtlety is `opacity`. The browser renders an element with `opacity < 1` and all of its
   * descendants into one buffer and composites *that* over what is behind — so text and any
   * background inside the faded group fade together, and the contrast between them is unchanged.
   * Fading only the text (the obvious implementation) invents failures on every dimmed card in the
   * product. What genuinely drops is the contrast against whatever lies outside the group.
   *
   * Returns null when imagery or a gradient is in the stack: a ratio against a gradient would be a
   * guess, and a guess that fails a build is worse than an honest gap.
   */
  const renderedPair = (el: Element): { fg: RGBA; bg: RGBA } | null => {
    const OPAQUE = 0.999
    const inside: RGBA[] = [] // backgrounds within the faded group, nearest first
    const outside: RGBA[] = [] // backgrounds behind it
    let groupAlpha = 1
    let crossed = false

    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const alpha = Number(cs.opacity)
      const c = parseColor(cs.backgroundColor)
      if (c && c.a > 0) {
        ;(crossed ? outside : inside).push(c)
        if (c.a >= OPAQUE && crossed) break
      }
      // this element's own opacity fades itself and everything under it, so the boundary is here
      if (!Number.isNaN(alpha) && alpha < OPAQUE) {
        groupAlpha *= alpha
        crossed = true
      }
    }

    const rootBg = parseColor(getComputedStyle(document.documentElement).backgroundColor)
    const base: RGBA =
      rootBg && rootBg.a >= OPAQUE
        ? rootBg
        : document.documentElement.dataset.theme === 'dark'
          ? { r: 0, g: 0, b: 0, a: 1 }
          : { r: 255, g: 255, b: 255, a: 1 }

    let behind = base
    for (let i = outside.length - 1; i >= 0; i--) behind = over(outside[i]!, behind)

    // everything inside the group is drawn first, then the whole group is laid down at groupAlpha
    let within: RGBA = { r: 0, g: 0, b: 0, a: 0 }
    for (let i = inside.length - 1; i >= 0; i--) within = over(inside[i]!, within)

    const fgRaw = parseColor(getComputedStyle(el).color)
    if (!fgRaw) return null

    const fade = (c: RGBA): RGBA => ({ ...c, a: c.a * groupAlpha })
    const bg = over(fade(within), behind)
    const fg = over(fade(over(fgRaw, within)), behind)
    return { fg, bg }
  }

  const hasOwnText = (el: Element): boolean =>
    Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
    )

  // ---- rules -----------------------------------------------------------------------------------

  const INTERACTIVE =
    'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="switch"], [role="option"], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])'

  /** the subset you aim a pointer at, as opposed to anything the keyboard can reach */
  const CLICKABLE =
    'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="switch"], [role="option"], select, summary, input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], input[type="date"], input[type="time"], input[type="color"], input[type="file"]'

  const interactive = Array.from(document.querySelectorAll(INTERACTIVE)).filter(
    (el) => isVisible(el) && !isHiddenFromA11y(el),
  )
  counted.interactive = interactive.length

  /**
   * WCAG 2.5.8 as written, not as remembered. A target under 24x24 still passes when nothing else
   * is within reach of it: the test is whether a 24px circle on this target would touch a 24px
   * circle on another, which is a distance of 24px between their centres.
   *
   * The exception matters. Without it every dense interface is told to inflate every control to
   * 24px, which is not what the standard asks for and would coarsen a design that is deliberately
   * compact. What it does catch is the real failure — a small control crowded by its neighbours.
   */
  const centres = interactive.map((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  /**
   * What a finger actually hits, which is not always what is drawn.
   *
   * A 15px close button with a transparent `::after { inset: -5px }` is a 25px target; measuring
   * `getBoundingClientRect()` alone would report it as too small and push somebody into enlarging
   * the icon instead, which is the wrong change. So the 24x24 box around the element's centre is
   * sampled at its corners and edge midpoints: if every one of those points lands on this element
   * or something inside it, the target really is 24x24 however small the box it paints.
   */
  const hitAreaCovers24 = (el: Element, rect: DOMRect): boolean => {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const d = 11.5 // just inside 24, so a boundary pixel does not decide it
    const points: [number, number][] = [
      [cx - d, cy - d],
      [cx, cy - d],
      [cx + d, cy - d],
      [cx - d, cy],
      [cx + d, cy],
      [cx - d, cy + d],
      [cx, cy + d],
      [cx + d, cy + d],
    ]
    return points.every(([x, y]) => {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false
      const hit = document.elementFromPoint(x, y)
      return Boolean(hit && (hit === el || el.contains(hit)))
    })
  }

  const crowded = (i: number): boolean => {
    const a = centres[i]
    if (!a) return false
    for (let j = 0; j < centres.length; j++) {
      if (j === i) continue
      const b = centres[j]
      if (b && Math.hypot(a.x - b.x, a.y - b.y) < 24) return true
    }
    return false
  }

  interactive.forEach((el, i) => {
    const cs = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const disabled = isDisabled(el)

    // 1. anything you click says so under the pointer
    //
    // Scoped to elements that are unambiguously click targets. A container that carries a `tabindex`
    // so the keyboard can reach it — a drag-and-drop zone, a focusable list — is not something you
    // aim at with a mouse, and a native text field wears the caret the platform gives it.
    if (!disabled && el.matches(CLICKABLE) && (cs.cursor === 'default' || cs.cursor === 'auto')) {
      add('cursor', `cursor: ${cs.cursor} on an enabled control`, describe(el))
    }

    // 2. an icon-only control that announces itself as "button" is unusable without sight
    if (!accessibleName(el)) {
      add('name', 'no accessible name (aria-label, title, text or img alt)', describe(el))
    }

    // 3. big enough to hit, or far enough from anything else to be hit safely
    const inlineInProse = cs.display === 'inline' && el.closest('p, li, .kern-prose, label')
    const undersized = rect.width < 24 || rect.height < 24
    if (!disabled && !inlineInProse && undersized && crowded(i) && !hitAreaCovers24(el, rect)) {
      add(
        'target',
        `${Math.round(rect.width)}x${Math.round(rect.height)}px drawn and hit, under 24x24 with another target inside 24px`,
        describe(el),
      )
    }
  })

  // 4. text a person can actually read, in whichever theme is on
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (!hasOwnText(el) || !isVisible(el) || isHiddenFromA11y(el)) continue
    if (isDisabled(el)) continue // a disabled control is exempt from contrast by design
    counted.text++
    const cs = getComputedStyle(el)
    const pair = renderedPair(el)
    if (!pair) {
      skipped.contrastOverImagery++
      continue
    }
    const { fg: composited, bg } = pair
    const size = Number.parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const required = large ? 3 : 4.5
    const ratio = contrastRatio(composited, bg)
    if (ratio < required) {
      add(
        'contrast',
        `${ratio.toFixed(2)}:1 against its background, needs ${required}:1 at ${size}px/${weight}`,
        describe(el),
      )
    }
  }

  // 5. nothing scrolls sideways — the commonest way a layout breaks in the direction you do not use
  const doc = document.documentElement
  if (doc.scrollWidth > doc.clientWidth + 1) {
    const culprits = Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        if (!isVisible(el)) return false
        const r = el.getBoundingClientRect()
        return r.right > doc.clientWidth + 1 || r.left < -1
      })
      .slice(0, 5)
      .map(describe)
    add(
      'overflow',
      `document scrolls ${doc.scrollWidth - doc.clientWidth}px sideways`,
      culprits.join(' | ') || '(no single element overhangs — check a wide grid or a min-width)',
    )
  }

  // 6. a page names itself, so the tab, the back button and a screen reader all agree what it is
  if (!document.querySelector('h1, [role="heading"][aria-level="1"]')) {
    add('heading', 'no level-1 heading on the page', document.title || '(untitled)')
  }

  return { violations, skipped, counted }
}

/** Audits whatever the page is currently showing. */
export async function auditPage(page: Page): Promise<AuditResult> {
  return page.evaluate(auditInPage)
}

/**
 * Tabs through the page and reports any control whose focused appearance is identical to its resting
 * one. Keyboard users navigate by that difference; without it the focus is invisible and the
 * interface is unusable without a pointer.
 *
 * Separate from `auditPage` because it drives the keyboard rather than reading the DOM, which costs
 * a round trip per control — so it walks a bounded number of stops.
 */
export async function auditFocusVisibility(page: Page, stops = 20): Promise<Violation[]> {
  const violations: Violation[] = []
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab')
    const result = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body || el === document.documentElement) return null
      // only what the browser itself decides to mark; a control focused without :focus-visible is
      // not being navigated by keyboard and owes nothing
      if (!el.matches(':focus-visible')) return null
      /*
       * The ring does not have to be on the focused element. A text field inside a bordered box
       * (`SearchBox`) turns its own outline off and lets the box light up through `:focus-within` —
       * the same affordance, drawn one level out. So an ancestor that is currently `:focus-within`
       * counts, provided it is actually drawing something.
       */
      const draws = (n: Element) => {
        const s = getComputedStyle(n)
        return (s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'
      }
      let ring = draws(el)
      for (let n = el.parentElement; n && !ring && n.matches(':focus-within'); n = n.parentElement) {
        ring = draws(n)
      }
      const describe = () => {
        const tag = el.tagName.toLowerCase()
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
        const label = el.getAttribute('aria-label') ?? ''
        return `${tag}${label ? `[aria-label=${label}]` : ''}${text ? ` “${text}”` : ''}`
      }
      return { ring, where: describe() }
    })
    if (result && !result.ring) {
      violations.push({ rule: 'focus', detail: 'focused with no visible ring', where: result.where })
    }
  }
  return violations
}

/** Formats violations into a failure message a person can act on without opening a trace. */
export function report(label: string, violations: Violation[]): string {
  const byRule = new Map<string, Violation[]>()
  for (const v of violations) {
    const list = byRule.get(v.rule) ?? []
    list.push(v)
    byRule.set(v.rule, list)
  }
  const lines = [`${violations.length} UX violation(s) on ${label}:`]
  for (const [rule, list] of byRule) {
    lines.push(`\n  ${rule} (${list.length}):`)
    for (const v of list) lines.push(`    · ${v.detail}\n      ${v.where}`)
  }
  return lines.join('\n')
}
