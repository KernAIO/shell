# Kern — "Ink / Paper" Design System

Extracted from the Claude-Design canvas `Kern Workspace Ink.dc.html` (1440×900 preview). This is the
single reference for building the SvelteKit + Tailwind v4 + shadcn-svelte app. Every hex / px value
below is taken verbatim from the source; anything marked **(proposed)** is derived and not in the file.

The look: warm paper greys, near-black ink, one burnt-orange accent used sparingly (logo tick,
"In progress", measure bar, focus ring, links). Almost no shadows on the main surface; depth comes from
1px hairlines and slightly different paper tones. Overlays (palette, popover, toast, detail panel) are
the only elements that get real shadows. Typography is Instrument Sans for UI and DM Mono for
"metadata" (issue keys, counts, section labels, keyboard hints, breadcrumbs).

---

## 1. Design tokens

### 1.1 Color palette (light — as shipped)

#### Paper / surfaces

| Token | Hex | Used for |
|---|---|---|
| `canvas` | `#E9E6DD` | `html, body` background outside the app frame (only visible behind the 100vh app). |
| `shell` | `#F0EEE7` | App root background → icon rail + sidebar background. Also the inbox list pane and planner "Unplanned" pane background. Ring color around rail notification dots. |
| `surface` | `#FBFAF7` | Content area background (header, toolbar, scroll body). Also the **inverse text color** (text on ink-900 buttons / active nav / logo). |
| `surface-raised` | `#FFFFFF` | Cards (stat tiles, board cards, milestone cards, HR cards, leave cards, rooms, desks), detail side panel, notification popover, command palette, chat composer, ref/embed cards, reply input, secondary "Decline/Enter" buttons. Row hover on issue/HR rows. |
| `surface-header` | `#F7F5EF` | Issue-list group header row bg; detail panel header bg. |
| `surface-input` | `#F5F2EA` | Search boxes (sidebar "Search this space" + header "Search"), planner unplanned task cards. |
| `surface-popover-hover` | `#F3F0E8` | Notification popover header bg; hover row in popover and in command palette. |
| `surface-hover` | `#F0EDE4` | Hover bg on content-area ghost buttons (bell, toolbar Filter / by, view-mode icons, board "+"), segmented-control track (Office Floor/Rooms), inactive planner day chip bg, inbox row hover, free-desk avatar placeholder, Decline button hover. |
| `surface-chip` | `#EFEBE1` | Grey chip bg, board-card meta chips, project pill bg (sidebar), Todo/Triage status tint, neutral state chip bg (Planned / Upcoming / Onboarding). Board-card footer border. |
| `surface-switcher-hover` | `#EAE7DE` | Workspace switcher hover. |
| `surface-active` | `#E9E5DB` | Active tab bg, nav badge bg, cmd-K chip hover, header measure track bg. |
| `surface-card-hover` | `#EFEFF1` | Hover bg for white cards that link somewhere (home "Waiting on you" cards, chat ref cards, doc embeds). Note: cool grey outlier, intentional. |
| `surface-planner-card-hover` | `#EDE9DE` | Hover on planner unplanned cards. |

#### Borders / lines

| Token | Hex | Used for |
|---|---|---|
| `border` | `#E4E0D6` | Default 1px border: rail/sidebar right borders, header bottoms, card borders, search box border, section label rule, sidebar nav **hover** bg, rail item hover bg, popover row dividers. |
| `border-hairline` | `#EAE6DC` | Row dividers inside lists (issue rows, agenda, activity feed, HR rows, meetings rows, planner hour lines, detail panel section rules). Also the detail panel's shadow color. |
| `border-strong` | `#DCD7C9` | Buttons (secondary/outline), inputs (reply), cmd-K buttons, palette header bottom, detail panel left border, milestone progress track bg. |
| `border-muted` | `#D5CFC2` | Scrollbar thumb, rail dividers (22×1), dashed free-desk border, segmented-control active shadow. |
| `border-hover` | `#C8C1B0` | Board card hover border; inactive room dot. |
| `scrollbar-thumb-hover` | `#BDB6A4` | Scrollbar thumb hover. |
| `caret` | `#B5AD9B` | Sidebar section chevron stroke. |
| `priority-off` | `#CFC8B8` | Priority bar "off" segment fill. |

#### Ink (text) tiers

| Token | Hex | Used for |
|---|---|---|
| `ink-900` | `#1C1A17` | Headings, titles, names, active nav/rail bg, primary button bg, logo square, toast bg, week-day active chip bg, preset tab active underline. |
| `ink-800` | `#2A2721` | Issue row titles, inbox titles, agenda titles, palette command labels, input text, "This week" values. |
| `ink-700` | `#3A362E` | Base body text (`color` on app root), chat/message bodies, detail body, free-room names, desk names. |
| `ink-650` | `#413D35` | Sidebar nav item text, secondary-button text (Huddle, Archive, Edit office, Notes). |
| `ink-600` | `#474339` | Mention card text, HR role, Decline/Enter button text, inactive planner day chip text. |
| `ink-580` | `#4E4940` | Priority bar "on" fill; board-card chip text. |
| `ink-550` | `#575247` | Toolbar button text (Filter, by), status label text, bell button, activity feed body. |
| `ink-520` | `#5B564B` | Grey chip foreground. |
| `ink-500` | `#615B4F` | Milestone goal text, pin icon, neutral inbox-kind chip fg. |
| `ink-450` | `#6B6459` | Stat tile labels, "This week" labels, HR team col, neutral state chip fg, segmented inactive text, popover body text, milestone progress text. |
| `ink-400` | `#7A7365` | Secondary text: notes, meta lines, badge text, palette icons, close buttons, composer tools, cmd-K button icon, agenda time. |
| `ink-350` | `#8A8375` | Muted: issue keys (in rows), estimates, due (cool), stat notes, chat kind label, preset inactive tabs, palette placeholder, section sub-labels (uppercase 11px), rail preferences icon, Triage group caret, default/Todo status colour. |
| `ink-330` | `#8E8779` | Sidebar nav icons (inactive), rail icons (inactive), default avatar/project colour. |
| `ink-300` | `#97907F` | DM Mono section labels ("ASSIGNED TO YOU"), subheading, board-card footer, workspace sub-line, detail panel key, inactive tab text. |
| `ink-280` | `#9A9285` | Timestamps, hour labels, HR table header, Triage status colour, palette search icon. |
| `ink-250` | `#A79F8E` | Placeholders, breadcrumb, counts next to section labels, board key, chevrons, "Free desk" name, Away status, palette hint. |
| `ink-hover` | `#38332B` | Primary button hover bg. |

#### Accent (burnt orange)

| Token | Hex | Used for |
|---|---|---|
| `accent` | `#B4661C` | Logo tick, "In progress" status colour, header measure/progress bar fill, input focus border, live-room card border, NH avatar, Product project colour. |
| `accent-text` | `#A85A18` | Links (`a`), "Convert to issue", activity targets, mention "where" lines, "Book", inbox "where". |
| `accent-deep` | `#8A4512` | Link hover, active-filter chip text, planner "pairing" event ink. |
| `accent-tint` | `#F3E9DA` | Active filter chip bg, "In progress" tint, selected inbox row bg. |
| `accent-tint-2` | `#F5EADA` | Planner accent event bg. |
| `ring` | `rgba(180,102,28,0.16)` | Focus ring (`0 0 0 3px`). |

#### Semantic

| Role | Fg / solid | Tint bg | Used for |
|---|---|---|---|
| Danger | `#A63D26` | `#F7DEDA` | Urgent priority badge bg, badge "glow" bg, unread dots, rail notification dot, inbox count in header, "hot" due dates (Today/Tomorrow), "Declined" chip fg. |
| Success (deep) | `#4F7A55` | — | Presence dots (online), "Done" status icon colour, free-room dot, live room-list dot. |
| Success (chip) | `#3D9A63` | `#DEEDE4` | Chip fg for Active / Live room badge / Done meeting / Done milestone; stat delta "+3"; "In a call" desk status; milestone Done bar. |
| Success (group ink) | `#3D8A5F` | `#DEEDE4` | Group-chat conversation icon. |
| Success (status tint) | — | `#E8EFE8` | "Done" status tint; planner focus-block bg (ink `#3E6144`). |
| Info blue | `#3A69B8` | `#DCE6F5` | Chip fg: "assigned" inbox kind, Live meeting, milestone In progress, Onboarding person; channel conversation icon. |
| Info blue (bar) | `#4474C4` | — | Milestone in-progress bar + flag icon. |
| Info slate | `#4A5C6A` | `#EAEEF1` | Planner standup event. |
| Purple | `#7A55B5` | `#E7DDF7` | Chip fg: "mention" inbox kind; DM conversation icon. |
| Purple (status) | `#6E5A8C` | `#EDE9F3` | "In review" status colour/tint; planner "Sprint review" event (ink `#584571`). |
| Warning amber | `#B5742A` | `#F7E9D8` | "On leave" person chip. |
| Neutral grey | `#8A8A8F` | `#EFEBE1` | Planned milestone flag icon. |

#### Avatar / identity colours (solid bg, fg `#FBFAF7`)

`MR #7E6A93` · `DB #5F7383` · `IO #B7714E` · `TL #6E8B62` · `YO #85947A` · `NH #B4661C` · `SK #A05A48` · `OR #B49A5F` · default `#8E8779`.
Assign deterministically by hashing user id into this 9-colour list.

#### Project / team colours (14×14 rounded squares, r=4)

`Realtime #6E8B62` · `Search #7E6A93` · `Issues #5F7383` · `Docs #B49A5F` · `Platform #7E6A93` · `Design #B7714E` · `Product #B4661C` · `Ops #6E8B62` · default `#8E8779`.

#### Overlay / misc

| Token | Value | Used for |
|---|---|---|
| `overlay` | `rgba(0,0,0,0.2)` | Command palette backdrop. |
| `btn-secondary-bg` | `rgba(0,0,0,0.02)` | Secondary buttons resting bg (Huddle, Archive, Edit office, Notes, Recording, pin). |
| `btn-secondary-hover` | `rgba(0,0,0,0.05)` | Their hover. |
| `ghost-hover-dark` | `rgba(0,0,0,0.08)` | "+" in issue group header hover. |

### 1.2 Typography

Fonts (Google Fonts): `Instrument Sans` (400–700, italic 400) and `DM Mono` (400, 500).

```
--font-sans: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'DM Mono', ui-monospace, monospace;
```
`-webkit-font-smoothing: antialiased` on the app root.

Sizes actually used (px) and where:

| px | Role |
|---|---|
| 8 | DM avatar initials in sidebar (18px avatar) |
| 9 | min avatar initials |
| 10 | 26px avatar initials (footer) |
| 10.5 | DM Mono section labels (uppercase, tracking 0.16em, w500), nav badges (mono w500), cmd-K chip (mono), toolbar "BY" (mono, tracking 0.1em) |
| 11 | Workspace sub-line (mono), header inbox count (mono w500), project pill label (mono w500 upper tracking 0.1em), uppercase sub-labels (sans w600 tracking 0.06em: "Desks", "Rooms", "Activity", "Unplanned", HR table header), planner day-of-week |
| 11.5 | Counts (mono), breadcrumb (mono), board card key (mono), board card footer (mono), desk status |
| 12 | Stat label, timestamps, palette hint (mono), detail key (mono), subheading (mono), chips, mention time, hour labels, HR location, planner event meta, desk name (w500) |
| 12.5 | Notes/meta, tabs, small buttons (Schedule/Approve/Join/Notes), due dates, estimates, stat notes, board chips |
| 13 | Body-small: issue key in rows, status text, toolbar buttons, labels in detail grid, HR cells, toast, inbox author (w500), header search input, table values |
| 13.5 | Sidebar nav items, primary button label, secondary buttons, column/group names (w600), agenda titles, planner task title, activity body, reply input, ref titles, meetings time |
| 14 | Row titles, chat message body, doc embeds, message author (w500), palette label, room names, composer input, detail body |
| 15 | Workspace name (w600), chat conversation name (w500), palette placeholder, milestone name (w500), doc body text (lh 1.7) |
| 16 | Logo "K", planner day number (w500) |
| 17 | Doc H2 (w600, tracking −0.01em) |
| 19 | Detail panel issue title (w600, lh 1.32, tracking −0.02em) |
| 22 | Inbox detail title (w600, lh 1.3, tracking −0.02em) |
| 25 | Page heading (w600, lh 1.1, tracking −0.025em) |
| 26 | HR stat value (w600, lh 1, tracking −0.03em) |
| 28 | Home stat value (w600, lh 1, tracking −0.03em) |
| 30 | Doc title (w600, lh 1.2, tracking −0.03em) |

Weights: 400 body, 500 emphasis (names, buttons, nav active labels use 600), 600 headings/active. No 700 used in UI.

Letter-spacing conventions: display/headings negative (−0.015 to −0.03em); body −0.005em on nav labels and board titles; mono metadata −0.01em; uppercase labels +0.06em (sans) / +0.1em / +0.16em (mono).

Line-heights: 1 (stat numbers), 1.1 (page heading), 1.2–1.32 (titles), 1.42 (board card title), 1.45 (snippets), 1.5 (feed, mention text, milestone goal), 1.55 (messages, threads), 1.6 (detail body), 1.7 (doc prose). `text-wrap: pretty` on multi-line titles/bodies.

### 1.3 Radii

| Token | px | Used |
|---|---|---|
| `r-xs` | 4 | Project/team colour squares, priority glyph box |
| `r-sm` | 5 | Badges, composer tool buttons, segmented-control items, group-header "+" |
| `r-md` | 6 | Chips/pills, small buttons (28–32px), cmd-K chip, board "+", conversation action buttons, detail close, toast-ish small |
| `r-md+` | 7 | Project pill (sidebar), segmented-control track |
| `r-lg` | 8 | Inbox rows, planner events, conversation icon, toast, reply input, planner unplanned cards, toolbar buttons, view-mode buttons, avatar 26px (≈0.3×) |
| `r-xl` | 9 | Nav items, rail items, primary button, cmd-K button, search boxes, header buttons, week-day chips, preferences button |
| `r-2xl` | 10 | Cards (stat/milestone/HR/room/desk/ref/embed), logo square, notification popover, chat composer, conversation chip |
| `r-card` | 11 | Board cards |
| `r-dialog` | 12 | Command palette |
| `r-full` | 999 | Dots, progress bars, avatar status ring |

Avatars: `border-radius = round(size × 0.3)` (22→7, 24→7, 26→8, 28→8, 30→9, 32→10, 36→11).

### 1.4 Spacing rhythm

Base 2px grid with these recurring values: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 40, 44, 48.

- Content padding: `20px 24px 40px` (home), `18px 24px 40–44px` (lists/feeds), `22px 28px 30px` (board), `28px 32px 48px` (docs), `24px 28px 40px` (inbox detail), `16px 24px 44px` (office/planner).
- Header block: `20px 28px 0`; toolbar `0 28px`.
- Sidebar groups: `4px 12px 6px`; control strip `12px 12px 4px`; footer `0 14px`.
- Gaps: icon–label 8–10px; stacked cards 8–10px; grid columns 10px (stat tiles), 20–22px (two-column layouts).
- Section label row: height 32px, gap 10px, with a 1px `#E4E0D6` rule filling the remainder.

### 1.5 Borders, shadows, effects

- Default border `1px solid #E4E0D6`; strong `1px solid #DCD7C9`; hairline rows `1px solid #EAE6DC`; dashed empty `1px dashed #D5CFC2`.
- Shadows (only on overlays):
  - Detail panel: `-8px 0 24px #EAE6DC` (flip to `8px 0 24px` in RTL).
  - Notification popover: `0 8px 24px rgba(0,0,0,0.2)`.
  - Command palette: `0 24px 48px rgba(0,0,0,0.28)`.
  - Toast: `0 8px 24px rgba(0,0,0,0.24)`.
  - Segmented active item: `0 1px 2px #D5CFC2`.
  - Avatar stack ring: `0 0 0 2px #FFFFFF`; rail dot ring `0 0 0 2px #F0EEE7`; footer presence dot `border: 2px solid #F0EEE7`.
  - Focus: `border-color: #B4661C; box-shadow: 0 0 0 3px rgba(180,102,28,0.16)`.
  - Planner event left bar: `inset 3px 0 0 <ink>` (use `inset-inline-start` equivalent: in RTL use `inset -3px 0 0`).
- Scrollbar: `::-webkit-scrollbar { width: 9px; height: 9px }`, thumb `#D5CFC2`, `border-radius: 5px`, `border: 2px solid transparent; background-clip: content-box`, hover `#BDB6A4`, track transparent.

### 1.6 Animations

```
@keyframes kslide { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
@keyframes kfade  { from { opacity: 0 } to { opacity: 1 } }
```
- Detail side panel: `kslide 0.16s ease-out` (RTL: from `translateX(-20px)`).
- Notification popover: `kfade 0.12s ease-out`.
- Palette backdrop: `kfade 0.1s ease-out`.
- Toast: `kfade 0.14s ease-out`.
- Sidebar group caret: `transition: transform 0.14s`, rotate 0 → −90deg when collapsed.
- Issue group caret: rotate 90deg open / 0 collapsed (no transition specified).
- Hover states are instant (no transition declared); adding `transition: background-color 80ms` is acceptable.

### 1.7 Token block (paste into Tailwind v4 `@theme` / `:root`)

```css
:root {
  /* paper */
  --kern-canvas: #E9E6DD;
  --kern-shell: #F0EEE7;
  --kern-surface: #FBFAF7;
  --kern-surface-raised: #FFFFFF;
  --kern-surface-header: #F7F5EF;
  --kern-surface-input: #F5F2EA;
  --kern-surface-popover-hover: #F3F0E8;
  --kern-surface-hover: #F0EDE4;
  --kern-surface-chip: #EFEBE1;
  --kern-surface-switcher-hover: #EAE7DE;
  --kern-surface-active: #E9E5DB;
  --kern-surface-card-hover: #EFEFF1;
  --kern-surface-planner-hover: #EDE9DE;
  /* lines */
  --kern-border: #E4E0D6;
  --kern-border-hairline: #EAE6DC;
  --kern-border-strong: #DCD7C9;
  --kern-border-muted: #D5CFC2;
  --kern-border-hover: #C8C1B0;
  --kern-scrollbar: #D5CFC2;
  --kern-scrollbar-hover: #BDB6A4;
  --kern-caret: #B5AD9B;
  --kern-priority-off: #CFC8B8;
  /* ink */
  --kern-ink-900: #1C1A17;
  --kern-ink-800: #2A2721;
  --kern-ink-700: #3A362E;
  --kern-ink-650: #413D35;
  --kern-ink-600: #474339;
  --kern-ink-580: #4E4940;
  --kern-ink-550: #575247;
  --kern-ink-520: #5B564B;
  --kern-ink-500: #615B4F;
  --kern-ink-450: #6B6459;
  --kern-ink-400: #7A7365;
  --kern-ink-350: #8A8375;
  --kern-ink-330: #8E8779;
  --kern-ink-300: #97907F;
  --kern-ink-280: #9A9285;
  --kern-ink-250: #A79F8E;
  --kern-ink-hover: #38332B;
  --kern-ink-inverse: #FBFAF7;
  /* accent */
  --kern-accent: #B4661C;
  --kern-accent-text: #A85A18;
  --kern-accent-deep: #8A4512;
  --kern-accent-tint: #F3E9DA;
  --kern-accent-tint-2: #F5EADA;
  --kern-ring: rgba(180,102,28,0.16);
  /* semantic */
  --kern-danger: #A63D26;
  --kern-danger-tint: #F7DEDA;
  --kern-success: #4F7A55;
  --kern-success-chip: #3D9A63;
  --kern-success-group: #3D8A5F;
  --kern-success-tint: #DEEDE4;
  --kern-success-tint-2: #E8EFE8;
  --kern-success-ink: #3E6144;
  --kern-info: #3A69B8;
  --kern-info-bar: #4474C4;
  --kern-info-tint: #DCE6F5;
  --kern-slate: #4A5C6A;
  --kern-slate-tint: #EAEEF1;
  --kern-purple: #7A55B5;
  --kern-purple-status: #6E5A8C;
  --kern-purple-tint: #E7DDF7;
  --kern-purple-tint-2: #EDE9F3;
  --kern-purple-ink: #584571;
  --kern-warning: #B5742A;
  --kern-warning-tint: #F7E9D8;
  --kern-neutral-flag: #8A8A8F;
  /* overlays */
  --kern-overlay: rgba(0,0,0,0.2);
  --kern-btn-secondary-bg: rgba(0,0,0,0.02);
  --kern-btn-secondary-hover: rgba(0,0,0,0.05);
  --kern-ghost-hover-dark: rgba(0,0,0,0.08);
  /* identity */
  --kern-av-1: #7E6A93; --kern-av-2: #5F7383; --kern-av-3: #B7714E; --kern-av-4: #6E8B62;
  --kern-av-5: #85947A; --kern-av-6: #B4661C; --kern-av-7: #A05A48; --kern-av-8: #B49A5F; --kern-av-0: #8E8779;
  /* type */
  --kern-font-sans: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --kern-font-mono: 'DM Mono', ui-monospace, monospace;
  /* radii */
  --kern-r-xs: 4px; --kern-r-sm: 5px; --kern-r-md: 6px; --kern-r-md2: 7px; --kern-r-lg: 8px;
  --kern-r-xl: 9px; --kern-r-2xl: 10px; --kern-r-card: 11px; --kern-r-dialog: 12px; --kern-r-full: 999px;
  /* layout */
  --kern-rail-w: 60px; --kern-sidebar-w: 268px; --kern-header-h: 60px; --kern-toolbar-h: 52px;
  --kern-detail-w: 440px; --kern-inbox-list-w: 380px; --kern-planner-side-w: 300px; --kern-board-col-w: 284px;
  /* shadows */
  --kern-shadow-panel: -8px 0 24px #EAE6DC;
  --kern-shadow-popover: 0 8px 24px rgba(0,0,0,0.2);
  --kern-shadow-dialog: 0 24px 48px rgba(0,0,0,0.28);
  --kern-shadow-toast: 0 8px 24px rgba(0,0,0,0.24);
  --kern-shadow-segment: 0 1px 2px #D5CFC2;
}
```

### 1.8 Dark mode counterpart **(proposed — not in source)**

Derived by inverting the paper scale to warm charcoal while keeping the same hue family and contrast steps. Accent stays burnt orange but one step lighter for text.

```css
.dark {
  --kern-canvas: #121110;
  --kern-shell: #181715;
  --kern-surface: #1C1A17;
  --kern-surface-raised: #23211D;
  --kern-surface-header: #201E1A;
  --kern-surface-input: #26231F;
  --kern-surface-popover-hover: #2A2722;
  --kern-surface-hover: #2A2722;
  --kern-surface-chip: #2E2B25;
  --kern-surface-switcher-hover: #262320;
  --kern-surface-active: #312D27;
  --kern-surface-card-hover: #2B2926;
  --kern-surface-planner-hover: #2C2923;
  --kern-border: #2F2C26;
  --kern-border-hairline: #292621;
  --kern-border-strong: #3A362E;
  --kern-border-muted: #413D35;
  --kern-border-hover: #5B564B;
  --kern-scrollbar: #413D35;
  --kern-scrollbar-hover: #575247;
  --kern-caret: #6B6459;
  --kern-priority-off: #4E4940;
  --kern-ink-900: #F5F2EA;
  --kern-ink-800: #EDE9DE;
  --kern-ink-700: #DCD7C9;
  --kern-ink-650: #CFC8B8;
  --kern-ink-600: #C8C1B0;
  --kern-ink-580: #BDB6A4;
  --kern-ink-550: #B5AD9B;
  --kern-ink-520: #A79F8E;
  --kern-ink-500: #A79F8E;
  --kern-ink-450: #9A9285;
  --kern-ink-400: #8E8779;
  --kern-ink-350: #8A8375;
  --kern-ink-330: #7A7365;
  --kern-ink-300: #7A7365;
  --kern-ink-280: #6B6459;
  --kern-ink-250: #615B4F;
  --kern-ink-hover: #E4E0D6;     /* primary button is light-on-dark in dark mode: bg = ink-900 (#F5F2EA), fg = #1C1A17 */
  --kern-ink-inverse: #1C1A17;
  --kern-accent: #C97A2E;
  --kern-accent-text: #D98A3D;
  --kern-accent-deep: #E59A52;
  --kern-accent-tint: #3A2A18;
  --kern-accent-tint-2: #3E2D1A;
  --kern-ring: rgba(201,122,46,0.28);
  --kern-danger: #D2553A; --kern-danger-tint: #3C211C;
  --kern-success: #6FA076; --kern-success-chip: #5DB47F; --kern-success-group: #5DB47F;
  --kern-success-tint: #1F3226; --kern-success-tint-2: #1E2C21; --kern-success-ink: #9CC7A3;
  --kern-info: #6F95D8; --kern-info-bar: #6F95D8; --kern-info-tint: #1F2A3D;
  --kern-slate: #9FB0BE; --kern-slate-tint: #242C33;
  --kern-purple: #A88AD9; --kern-purple-status: #A08BC0; --kern-purple-tint: #2E2640; --kern-purple-tint-2: #2A2536; --kern-purple-ink: #C0AEDC;
  --kern-warning: #D59548; --kern-warning-tint: #3A2C1C;
  --kern-neutral-flag: #8A8A8F;
  --kern-overlay: rgba(0,0,0,0.5);
  --kern-btn-secondary-bg: rgba(255,255,255,0.03);
  --kern-btn-secondary-hover: rgba(255,255,255,0.07);
  --kern-ghost-hover-dark: rgba(255,255,255,0.1);
  --kern-shadow-panel: -8px 0 24px rgba(0,0,0,0.5);
  --kern-shadow-popover: 0 8px 24px rgba(0,0,0,0.55);
  --kern-shadow-dialog: 0 24px 48px rgba(0,0,0,0.6);
  --kern-shadow-toast: 0 8px 24px rgba(0,0,0,0.5);
  --kern-shadow-segment: 0 1px 2px rgba(0,0,0,0.4);
}
```
(Avatar colours stay as-is in dark mode; they read fine on charcoal. Inverse avatar text stays `#FBFAF7`.)

---

## 2. Layout

### 2.1 App frame

```
height: 100vh; display: grid; grid-template-columns: 60px 268px minmax(0,1fr); overflow: hidden;
background: #F0EEE7; color: #3A362E; font-family: Instrument Sans; -webkit-font-smoothing: antialiased;
```
Column 1 = icon rail, column 2 = sidebar, column 3 = content (`position: relative; display:flex; flex-direction:column; overflow:hidden; background:#FBFAF7; min-width:0`). Overlays (detail panel, popover, palette, toast) are absolutely positioned **inside the content column**, not the viewport.

### 2.2 Icon rail (60px)

- `border-inline-end: 1px solid #E4E0D6; display:flex; flex-direction:column; align-items:center; padding: 12px 0 14px`.
- Logo: 36×36, `border-radius:10px; background:#1C1A17`, contains "K" (16px, w600, `#FBFAF7`, tracking −0.03em, lh 1) + a 2×14px bar (`border-radius:1px; background:#B4661C`) with gap 3px. Click → Home.
- Divider: 22×1px `#D5CFC2`, margin `14px 0 10px` (top) and `10px 0 10px` (bottom).
- Rail items: 34×34, `border-radius:9px; display:grid; place-items:center; position:relative`, icon 18px stroke 1.5. Inactive `color:#8E8779`, hover `background:#E4E0D6`, active `background:#1C1A17; color:#FBFAF7`. Gap 3px, overflow hidden (no scroll).
- Notification dot on rail item: 6×6, `position:absolute; top:4px; inset-inline-end:4px; border-radius:999px; background:#A63D26; box-shadow: 0 0 0 2px #F0EEE7`.
- Rail order: My work (target), Inbox (bell, dot), Tracker (check), Chat (chat, dot), Planner (calendar), Documents (doc), Milestones (flag), Meetings (video), Office (building), People (users), Activity (activity). Bottom: Preferences (sliders icon) 34×34 r9 `color:#8A8375`, hover `background:#E4E0D6; color:#3A362E`.

### 2.3 Sidebar (268px)

- `border-inline-end: 1px solid #E4E0D6; display:flex; flex-direction:column; overflow:hidden`.
- **Workspace switcher**: height 60, `padding: 0 14px; gap:10px; border-bottom:1px solid #E4E0D6`, hover `background:#EAE7DE`. Name 15px w600 `#1C1A17` tracking −0.015em; sub-line DM Mono 11px `#97907F` tracking −0.01em margin-top 2 ("Platform · 14 people"); trailing up/down chevron 13px stroke `#A79F8E` 1.6.
- **Control strip** (`padding: 12px 12px 4px; gap: 6px`), two variants:
  - Tracker views (home/issues/board/milestones): Primary button "New issue" — `flex:1; height:34px; border-radius:9px; background:#1C1A17; color:#FBFAF7; font-size:13.5px; font-weight:500; gap:8px`, plus icon 13px stroke 1.9, hover `#38332B`. Next to it the **cmd-K button**: 34×34, `border-radius:9px; border:1px solid #DCD7C9; color:#7A7365`, command-key icon 15px stroke 1.6, hover `background:#E9E5DB; color:#1C1A17`. (Other views in the prototype show no strip; the data model carries `navActionLabel` — "New document", "New channel", "New room", "Add person", "New event", "New view", "New notification rule" — so render the same primary button with that label.)
  - Chat / Docs: **search box** — height 34, `border-radius:9px; background:#F5F2EA; border:1px solid #E4E0D6; padding:0 11px; gap:8px`, magnifier 14px `#A79F8E` stroke 1.7, placeholder 13.5px `#A79F8E` "Search this space".
- **Nav scroll area**: `flex:1; overflow-y:auto; padding: 0 0 14px`. Each group `padding: 4px 12px 6px`.
  - Group title row (when titled): height 30, gap 10, label DM Mono 10.5px w500 uppercase tracking 0.16em `#97907F`, then flex 1px rule `#E4E0D6`, then chevron 11×11 stroke `#B5AD9B` 2px (rotates −90deg when collapsed, transition 0.14s). Hover `opacity:0.75`. The first (untitled) group takes the section name (e.g., "TRACKER", "CHAT", "OFFICE", "HR", "PLANNER", "ACTIVITY", "INBOX", "DOCUMENTS"). Other titles seen: "YOUR PROJECTS", "CHANNELS", "GROUP CHATS", "DIRECT MESSAGES", "AROUND NOW", "TEAMS", "CALENDARS", "FILTERS", "NORTHSTAR DOCS", "SHARED WITH ME".
  - Items stack `gap:1px`.
- **Nav item**: `display:flex; align-items:center; gap:10px; height:34px; padding: 0 10px 0 (10 + indent)px; border-radius:9px; font-size:13.5px`. Inactive `color:#413D35`, icon wrap 16×16 `color:#8E8779`, hover `background:#E4E0D6`. Active `background:#1C1A17; color:#FBFAF7`, icon `#FBFAF7`, label w600. Label `flex:1; ellipsis; letter-spacing:-0.005em`. Sub-items indent 22px (padding-inline-start 32).
  - Icon variant: 16px SVG stroke 1.5.
  - Colour-square variant (teams/projects): 14×14 r4 solid project colour.
  - DM variant: 18×18 r6 avatar with 8px w600 initials.
  - **Badge**: DM Mono 10.5px w500 `padding:1px 6px; border-radius:5px`. Normal `background:#E9E5DB; color:#7A7365`; "glow" (unread/urgent) `background:#A63D26; color:#FBFAF7`.
  - **Project pill** (sidebar "Your projects" headers): `inline-flex; height:26px; margin:6px 0 3px; padding:0 9px; border-radius:7px; gap:8px; background:#EFEBE1` (active `#1C1A17`), 13×13 r4 colour square, label DM Mono 11px w500 uppercase tracking 0.1em `#7A7365` (active `#FBFAF7`).
- **User footer**: `border-top:1px solid #E4E0D6; height:52px; padding:0 14px; gap:10px`. Avatar 26×26 r8 with 10px w600 initials; presence dot 9×9 r999 `#4F7A55` `border:2px solid #F0EEE7` at `bottom:-2px; inset-inline-end:-2px`. Name 12.5px w500 `#3A362E` ellipsis. Trailing **⌘K chip**: DM Mono 10.5px `#8A8375; border:1px solid #DCD7C9; border-radius:6px; padding:2px 6px`, hover `background:#E9E5DB; color:#1C1A17`.

### 2.4 Content header

`flex:none; padding: 20px 28px 0; background:#FBFAF7`.
- Row 1 (`gap:16px`): breadcrumb DM Mono 11.5px `#A79F8E` tracking −0.01em, ellipsis, `flex:1` ("Northstar / Tracker / Board"); **search**: 210×32 `border-radius:9px; border:1px solid #E4E0D6; background:#F5F2EA; padding:0 11px; gap:8px`, magnifier 14px `#A79F8E`, input 13px `#3A362E` transparent; **notification bell button**: height 32 `padding:0 10px; border-radius:9px; border:1px solid #E4E0D6; color:#575247; gap:8px`, bell 15px stroke 1.5, count DM Mono 11px w500 `#A63D26`, hover `background:#F0EDE4`.
- Row 2 (`margin-top:10px; align-items:baseline; gap:12px`): heading 25px w600 `#1C1A17` tracking −0.025em lh 1.1 nowrap; subheading DM Mono 12px `#97907F` tracking −0.01em ellipsis (e.g. "Sprint 24 · ends in 4 days", "Assigned · 8 issues · 29 pts").
- Row 3 **measure**: in tracker views a 3px track `margin-top:16px; background:#E9E5DB; border-radius:2px; overflow:hidden` with a fill `width:68%; background:#B4661C; border-radius:2px` (sprint progress); in other views a plain 1px `#E4E0D6` rule with `margin-top:16px`.

Total header height ≈ 20 + 32 + 10 + 28 + 16 + 3 = ~109px (not a fixed 60px; the 60px "header" is the sidebar switcher).

### 2.5 Toolbar (issues / board only)

`height:52px; padding:0 28px; gap:10px; border-bottom:1px solid #E4E0D6; background:#FBFAF7`.
- View-mode icon buttons (List, Board): 30×30 r8, icon 16px stroke 1.6; inactive `color:#8A8375`, hover `background:#F0EDE4`, active `background:#1C1A17; color:#FBFAF7`. Gap 2px.
- Vertical divider 1×18 `#E4E0D6` margin `0 4px`.
- "Filter" ghost button: height 30 `padding:0 11px; border-radius:8px; gap:7px; font-size:13px; color:#575247`, funnel icon 14px, hover `#F0EDE4`.
- "by Status" group-by button: same, gap 8; prefix "BY" DM Mono 10.5px uppercase tracking 0.1em `#A79F8E`. Click cycles Status → Priority → Assignee.
- Active filter chip: height 30 `padding:0 8px 0 11px; border-radius:8px; background:#F3E9DA; color:#8A4512; font-size:13px; font-weight:500; gap:8px` + X 12px opacity 0.6.
- Right: **preset tabs** (Assigned / Active / Backlog / Created / Subscribed): `align-items:stretch; height:100%; gap:18px`; each 13.5px with `border-bottom:2px solid` `#1C1A17` active / transparent; active `color:#1C1A17; font-weight:600`, inactive `#8A8375`.

### 2.6 Scroll body

`flex:1; overflow-y:auto; overflow-x:hidden; background:#FBFAF7` — each view renders inside.

---

## 3. Per-view component inventory

### 3.0 Shared primitives

**Section label row** (used everywhere): `display:flex; align-items:center; gap:10px; height:32px` → DM Mono 10.5px w500 uppercase tracking 0.16em `#97907F` label, optional count DM Mono 11.5px `#A79F8E` ("3 of 5"), then `flex:1; height:1px; background:#E4E0D6`, then optional trailing tabs / button.

**Uppercase sub-label** (sans variant): 11px w600 tracking 0.06em uppercase `#8A8375` (or `#9A9285` for table headers).

**Tabs / filter pills** (`tab()`): height 24 `padding:0 9px; border-radius:6px; font-size:12.5px`; active `background:#E9E5DB; color:#1C1A17; font-weight:600`; inactive `color:#97907F` (no bg). Gap 4px when stacked horizontally.

**Chip / pill** (`chip(bg,fg)`): `inline-flex; font-size:12px; padding:3px 9px; border-radius:6px; white-space:nowrap`. Grey chip = `#EFEBE1` / `#5B564B`. Semantic chips per §1.1.

**Buttons**
- Primary: `background:#1C1A17; color:#FBFAF7 (or white); font-weight:500; border-radius:6px` (9px for the 34px sidebar button); heights 26 (Schedule, 12.5px, pad 11), 28 (Approve/Join, 12.5px, pad 12), 32 (Open issue, 13.5px, pad 13), 34 (New issue, 13.5px). Hover `#38332B`.
- Secondary/outline: `border:1px solid #DCD7C9; background:rgba(0,0,0,0.02); color:#413D35; border-radius:6px`; heights 28 (12.5px, pad 11) / 32 (13.5px, pad 11–12, gap 7 with 14px icon). Hover `rgba(0,0,0,0.05)`. White variant for Decline/Enter: `background:#FFFFFF; color:#474339`, hover `#F0EDE4`.
- Ghost icon button: square 22–30px, r5–8, `color:#7A7365`/`#A79F8E`, hover `background:#F0EDE4` (content) or `#E4E0D6` (sidebar/panel) with `color:#1C1A17`/`#3A362E`.
- Text link button: 13px `#A85A18` ("Book", "Convert to issue" at 12.5px with opacity 0.8→1).

**Inputs**: transparent inside a bordered container (search), or standalone: `height:36px; border:1px solid #DCD7C9; border-radius:8px; padding:0 12px; font-size:13.5px; color:#2A2721; background:#FFFFFF`; focus `border-color:#B4661C; box-shadow:0 0 0 3px rgba(180,102,28,0.16)`. Placeholder `#A79F8E` / `#8A8375`.

**Avatar** (`av(size)`): square, `border-radius: round(size*0.3)`, `font-size: max(9, round(size*0.38))`, w600, tracking −0.01em, fg `#FBFAF7`, bg = identity colour. Sizes used: 18 (sidebar DM), 22 (rows, board cards, mention cards, inbox rows, detail assignee), 24 (doc author, meetings, leave cards, conversation members), 26 (footer, room list), 28 (room cards, HR rows, detail thread), 30 (activity feed), 32 (inbox thread), 36 (chat messages, desks). Stacked: `box-shadow:0 0 0 2px #FFFFFF; margin-inline-start:-6px` after the first.

**Presence dot**: 7×7 r999 `#4F7A55` (online), hidden via `opacity:0` when offline (keeps layout).

**Status icon** (16×16 viewBox): `<rect x=1.7 y=1.7 w=12.6 h=12.6 rx=4 fill=none stroke={color} stroke-width=1.5 stroke-dasharray={dash}/>` + `<path d={fill} fill={color}/>`:
- Triage: colour `#9A9285`, dash `2.2 2`, no fill.
- Todo: `#8A8375`, solid, no fill.
- In progress: `#B4661C`, fill `M8 5.2h2.8v5.6H8z` (right half), tint `#F3E9DA`.
- In review: `#6E5A8C`, fill `M8 5.2h2.8v5.6H5.2V8H8z` (three-quarter), tint `#EDE9F3`.
- Done: `#4F7A55`, fill `M5.2 5.2h5.6v5.6H5.2z` (full), tint `#E8EFE8`.

**Priority glyph** (16×16): bg rect rx4 + three bars `x=1.5 y=9 h=5.5`, `x=6.5 y=5.5 h=9`, `x=11.5 y=2 h=12.5` (w=3, rx1).
- Urgent: bg `#A63D26`, all bars `#FBFAF7`.
- High: bg transparent, bars all `#4E4940`.
- Medium: on, on, off (`#CFC8B8`).
- Low: on, off, off.

**Due date**: 12.5px nowrap; `#A63D26` if Today/Tomorrow else `#8A8375`.

**Empty state** (not explicitly drawn; derive): centre a 11px uppercase sub-label + 13.5px `#8A8375` sentence inside a dashed `1px dashed #D5CFC2` r10 box (as the free-desk pattern).

**Keyboard hint**: DM Mono 12px `#A79F8E` ("G then H", "↵", "C") in palette; ⌘K chip as in footer.

### 3.1 Home ("My work")

Grid `padding:20px 24px 40px; grid-template-columns: minmax(0,1fr) 320px; gap:20px; align-items:start`.
- **Stat tiles** (3 across, gap 10): white r10 `border:1px solid #E4E0D6; padding:14px 16px`; label 12px `#6B6459`; value 28px w600 tracking −0.03em lh1 `#1C1A17` with optional delta 12.5px `#3D9A63` ("+3") baseline-aligned gap 8 at margin-top 10; note 12.5px `#8A8375` margin-top 8.
- **"ASSIGNED TO YOU" list**: section label row with count + trailing tabs (All / In progress / In review / Due soon). Rows: grid `18px 62px minmax(0,1fr) auto auto auto 24px; gap:10px; height:44px; padding:0 12px; border-bottom:1px solid #EAE6DC`, hover `#FFFFFF`. Cells: priority glyph 15px; key 13px `#8A8375`; title 14px `#2A2721` ellipsis; project grey chip; status (icon 15 + 13px `#575247` text, gap 6); due; avatar 22.
- Right column (320): **"WAITING ON YOU"** mention cards (gap 2): white r10 bordered `padding:11px 12px`, hover `#EFEFF1`; header row avatar 22 + author 13px w500 `#1C1A17` + time 12px `#9A9285`; text 13px `#474339` lh1.5 mt6; where 12px `#A85A18` mt6. **"TODAY"** agenda rows: `padding:10px 4px; border-bottom:1px solid #EAE6DC; gap:12px`; time 13px `#7A7365` width 42; title 13.5px `#2A2721`; meta 12.5px `#8A8375` mt3.

### 3.2 Issues list

No extra padding top (group headers flush under toolbar); `padding-bottom:40px`.
- **Group header**: height 42 `padding:0 28px; gap:10px; border-bottom:1px solid #E4E0D6; background:#F7F5EF`; caret (filled triangle `M8 5l9 7-9 7z`) 9×9 `#8A8375` rotated 90° when open; status icon 16 (when grouped by Status); name 13.5px w600 `#1C1A17` tracking −0.01em; count DM Mono 11.5px `#A79F8E`; spacer; points DM Mono 11.5px `#A79F8E` ("12 pts"); "+" 22×22 r5 `#7A7365` hover `rgba(0,0,0,0.08)`.
- **Issue row**: grid `18px 62px 18px minmax(0,1fr) auto auto auto 24px; gap:10px; height:40px; padding:0 16px; border-bottom:1px solid #EAE6DC`, hover `#FFFFFF`. Cells: priority glyph · key 13px `#8A8375` · status icon 15 · title 14px `#2A2721` ellipsis · project grey chip · estimate 12.5px `#8A8375` ("3 pts") · due · avatar 22. Click opens detail panel.
- Groups with zero rows are hidden. Order: Status = Triage, In progress, In review, Done; Priority = Urgent, High, Medium, Low; Assignee = people.

### 3.3 Board

`padding:22px 28px 30px; display:flex; gap:20px; overflow-x:auto; align-items:flex-start`.
- **Column** 284px: header height 30 gap 9 → status icon 15, name 13.5px w600 `#1C1A17` tracking −0.01em, count DM Mono 11.5px `#A79F8E`, "+" 22×22 r6 `#A79F8E` hover `#F0EDE4`/`#1C1A17`. Under header a 2px rule: `linear-gradient(to right, {statusColor} 0 34px, #E4E0D6 34px)` r1 (34px colour stub then hairline; in RTL use `to left`). Cards stack `gap:10px; margin-top:14px; min-height:80px`.
- **Card**: white r11 `border:1px solid #E4E0D6; overflow:hidden`, hover `border-color:#C8C1B0`. Body `padding:13px 14px 14px`: top row (gap 7) status icon 15 + key DM Mono 11.5px `#A79F8E` + spacer + presence dot 7 + avatar 22; title 14px lh1.42 `#1C1A17` tracking −0.005em mt9; chip row mt10 gap5 — each chip height 26 r6 `background:#EFEBE1`: priority (pad 0 7, glyph 14px), project (pad 0 8, diamond icon 12 + 12.5px `#4E4940`), milestone (flag icon + text). Footer: height 38 `padding:0 14px; border-top:1px solid #EFEBE1`, DM Mono 11.5px `#97907F`, gap 14: clock 13px + logged time ("0h"), estimate, spacer, comment icon 13 + count (hidden if 0).

### 3.4 Planner

Grid `grid-template-columns: 300px minmax(0,1fr); height:100%`.
- Left pane: `border-inline-end:1px solid #E4E0D6; background:#F0EEE7; padding:16px 12px; overflow-y:auto`. Sub-label "Unplanned · drag to a slot". Cards (gap 8): r8 `padding:10px 12px; background:#F5F2EA; cursor:grab`, hover `#EDE9DE`; title 13.5px lh1.4 `#2A2721`; meta row mt8 gap7: priority glyph 14 + key 12.5px `#8A8375` + spacer + estimate.
- Right pane `padding:16px 24px 40px`: **week-day chips** (gap 6, mb 16): 58px wide `padding:7px 0; border-radius:9px; text-align:center`; inactive `background:#F0EDE4; color:#474339`, active `#1C1A17`/`#FBFAF7`; dow 11px uppercase tracking 0.05em opacity 0.65; number 16px w500 mt2.
- **Hour grid**: rows `grid-template-columns:48px 1fr; height:54px`; label 12px `#9A9285` `translateY(-6px)`; line `border-top:1px solid #EAE6DC`. 08:00–19:00.
- **Events** absolutely positioned: `inset-inline-start:56px; inset-inline-end:4px; top:(start-8)*54+1px; height:dur*54-4px; border-radius:8px; padding:8px 11px; box-shadow: inset 3px 0 0 {ink}` (RTL: `inset -3px 0 0`); title 13px w500 lh1.3; meta 12px opacity 0.7. Palettes: slate `#EAEEF1`/`#4A5C6A`, accent `#F5EADA`/`#8A4512`, purple `#EDE9F3`/`#584571`, green `#E8EFE8`/`#3E6144`.

### 3.5 Milestones

`padding:18px 24px 44px; max-width:920px; gap:10px` stacked cards. Card: white r10 bordered `padding:16px 18px`. Header gap 10: flag icon 16 stroke 1.7 in state colour (`#4474C4` in progress, `#3D9A63` done, `#8A8A8F` planned) · name 15px w500 `#1C1A17` · state chip (In progress `#DCE6F5`/`#3A69B8`, Done `#DEEDE4`/`#3D9A63`, Planned `#EFEBE1`/`#6B6459`) · spacer · dates 12.5px `#8A8375`. Goal 13.5px `#615B4F` lh1.5 mt8. Progress row mt14 gap12: track `height:6px; border-radius:999px; background:#DCD7C9`, fill `#4474C4` (or `#3D9A63` done); label 12.5px `#6B6459` width 92 text-align end ("5/8 · 63%"). Chips row mt12 gap6 grey chips.

### 3.6 Docs

`padding:28px 32px 48px; max-width:780px`. Title 30px w600 tracking −0.03em lh1.2 `#1C1A17`. Byline mt14 pb20 `border-bottom:1px solid #EAE6DC` gap 9: avatar 24 + 13px `#7A7365` ("Ines Okafor · edited 2 days ago · 3 live embeds"). Blocks stack `gap:16px; margin-top:22px`: H2 17px w600 tracking −0.01em mt10; paragraph 15px lh1.7 `#3A362E`; **issue embed** white r10 bordered `padding:11px 13px; gap:11px`, hover `#EFEFF1`: status icon 15 + key 12.5px `#8A8375` + title 14px `#2A2721` flex1 + status 12.5px `#7A7365`.

### 3.7 Chat

Column `height:100%`.
- **Conversation header**: height 56 `padding:0 24px; border-bottom:1px solid #E4E0D6; gap:11px`. Kind icon tile 32×32 r8 (channel `#DCE6F5`/`#3A69B8` hash; DM `#E7DDF7`/`#7A55B5` user; group `#DEEDE4`/`#3D8A5F` users) icon 16 stroke 1.7. Name 15px w500 `#1C1A17` + kind label 12.5px `#8A8375` ("14 members"); topic 12.5px `#8A8375` mt1 ellipsis. Right: stacked member avatars 24 (ring white, −6px overlap) margin-inline-end 8; "Huddle" secondary button (video icon 14); pin icon button 32×32 secondary `color:#615B4F` margin-inline-start 6.
- **Messages** `padding:20px 24px 8px; gap:18px`: grid `36px minmax(0,1fr); gap:12px`; avatar 36; header baseline gap 9: author 14px w500 `#1C1A17`, time 12px `#9A9285`, "Convert to issue" action 12.5px `#A85A18` with 12px check icon, opacity 0.8→1 on hover (show always in prototype; recommend reveal on row hover); body 14px lh1.55 `#3A362E` mt3. **Ref card** mt9: white r10 bordered `padding:10px 12px; max-width:460px; gap:10px`, hover `#EFEFF1`: status icon 15 + key 12.5px `#8A8375` + title 13.5px `#2A2721` ellipsis.
- **Composer** `padding:10px 24px 20px`: white r10 bordered `padding:10px 12px 8px`; input 14px `#2A2721` full width transparent, placeholder "Message # eng-core — ⏎ to send"; tool row mt8 gap4: 26×26 r5 icon buttons (emoji, clip, at, slash) `color:#7A7365` hover `#E4E0D6`/`#413D35` icon 15; typing indicator 12.5px `#9A9285` flex1 margin-inline-start 6 ("Ines is typing…"); send button 28×28 r6 `#1C1A17` white up-arrow icon 14 stroke 2, hover `#38332B`.

### 3.8 Inbox

Grid `380px minmax(0,1fr); height:100%`.
- List pane: `border-inline-end:1px solid #E4E0D6; background:#F0EEE7; padding:8px; overflow-y:auto`. **Item**: `padding:11px 12px; border-radius:8px`, selected `background:#F3E9DA`, hover `#F0EDE4`. Row 1 gap 8: avatar 22, author 13px w500 `#1C1A17`, kind chip (mention `#E7DDF7`/`#7A55B5`; assigned `#DCE6F5`/`#3A69B8`; huddle `#DEEDE4`/`#3D9A63`; thread/doc/review `#EFEBE1`/`#615B4F`), spacer, time 12px `#9A9285`, unread dot 7 `#A63D26` (transparent when read). Title 13.5px w500 `#2A2721` mt7 ellipsis; snippet 12.5px `#7A7365` lh1.45 mt3 clamp 2 lines.
- Detail pane `padding:24px 28px 40px`, inner `max-width:660px`: kind chip + where 12.5px `#A85A18`; title 22px w600 tracking −0.02em lh1.3 mt10; thread (mt20 pt18 `border-top:1px solid #EAE6DC` gap18) rows grid `32px 1fr gap12` with author 14px w500 / time 12px / text 14px lh1.55; actions mt24 gap8: "Open issue" primary 32 + "Archive" secondary 32 (archive icon 14).

### 3.9 Activity

`padding:18px 24px 40px; max-width:840px`. Filter tabs row (All / Issues / Chat / Docs) gap4 mb12. Feed rows grid `30px minmax(0,1fr) auto; gap:12px; padding:12px 4px; border-bottom:1px solid #EAE6DC`: avatar 30; sentence 13.5px lh1.5 `#575247` with author w500 `#1C1A17` and target `#A85A18`; detail 12.5px `#8A8375` mt3; time 12.5px `#9A9285` pt2.

### 3.10 Meetings

`padding:18px 24px 44px; grid-template-columns: minmax(0,1fr) 300px; gap:22px; max-width:1180px`.
- "TODAY" section label + date DM Mono 11.5px + rule + "Schedule" primary 26. Rows grid `72px 1fr auto auto; gap:14px; height:56px; padding:0 12px; border-bottom hairline`: time 13.5px `#2A2721` / length 12px `#9A9285`; title 14px w500 + state chip (Live `#DCE6F5`/`#3A69B8`, Done `#DEEDE4`/`#3D9A63`, Upcoming `#EFEBE1`/`#6B6459`); where 12.5px `#7A7365`; avatars 24 gap 5; join button (Live → primary "Join"; else outline white "Notes"/"Open").
- "RECENT · NOTES & RECORDINGS": grid `96px 1fr auto`: when 13px `#8A8375`; title/outcome; two secondary 28px buttons "Notes", "Recording · 18 min".
- Right: "This week" white card `padding:15px 16px` title 13.5px w500; 2-col grid `1fr auto; gap:9px 10px; font-size:13px` label `#6B6459` / value `#2A2721` w500. "ROOMS FREE NOW" rows height 40 hairline: dot 7 `#4F7A55` + name 13.5px `#3A362E` + "Book" link 13px `#A85A18`.

### 3.11 Office

`padding:16px 24px 44px`. Top row mb18 gap10: **segmented control** (`padding:2px; gap:2px; background:#F0EDE4; border-radius:7px`) items height 26 `padding:0 12px; border-radius:5px; font-size:13px`, active `background:#FFFFFF; box-shadow:0 1px 2px #D5CFC2; font-weight:500; color:#1C1A17`, inactive `#6B6459`; note 13px `#7A7365` ("6 people around · 2 rooms live"); spacer; "Edit office" secondary 32 with pencil icon.
- **Floor**: grid `300px minmax(0,1fr); gap:18px; max-width:1000px`. Desks sub-label; 2-col grid gap 8 of **desk tiles** height 104 r10 `padding:10px; flex column center`: occupied `background:#FFFFFF; border:1px solid #E4E0D6`; free `transparent; border:1px dashed #D5CFC2`; hover `border-color:rgba(0,0,0,0.2)`. Name 12px w500 `#3A362E` (free: `#A79F8E` "Free desk"); avatar 36 (free: 36px circle `#F0EDE4`) mt9; status 11.5px mt8 (`#3D9A63` In a call, `#A79F8E` Away, else `#8A8375`).
  Rooms sub-label; big room card (min-height 132) then 2-col grid gap10 of small room cards: white r10 `padding:14px 15px; border:1px solid` `#B4661C` when live else `#E4E0D6`. Header gap8: icon 15 stroke `#8A8375` (video or mic), name 14/13.5px w500, badge chip (live `#DEEDE4`/`#3D9A63`; idle `#EFEBE1`/`#6B6459`; "video · 30 seats"), spacer, join button (live → primary 28 "Join"; idle → outline white "Enter"). Note 12.5px `#7A7365` mt6; people avatars 28 gap6 mt12 min-height 28.
- **Rooms list** (`max-width:880px`): rows grid `16px 1fr auto auto; gap:12px; height:56px; padding:0 12px` hairline: dot 8 (`#4F7A55` live / `#C8C1B0`), name 14px w500 + note 12.5px `#7A7365` mt2, avatars 26 gap5, join button.

### 3.12 HR / People

`padding:18px 24px 44px; max-width:1180px; gap:20px`.
- 4 stat tiles (value 26px).
- Grid `minmax(0,1fr) 320px; gap:20px`. Left: "PEOPLE" section label + team tabs (All/Platform/Design/Product). **Table header** grid `minmax(0,1.4fr) minmax(0,1fr) 92px 88px 96px; gap:12px; height:34px; padding:0 12px; border-bottom hairline; font-size:11px; font-weight:600; letter-spacing:0.06em; uppercase; color:#9A9285` (Name / Role / Team / Started / Status). **Rows** same grid, height 48, hover `#FFFFFF`: avatar 28 + name 13.5px w500 `#1C1A17` + location 12px `#8A8375`; role 13px `#474339`; team 13px `#6B6459`; started 13px `#8A8375`; status chip (Active `#DEEDE4`/`#3D9A63`, On leave `#F7E9D8`/`#B5742A`, Onboarding `#DCE6F5`/`#3A69B8`).
- Right: "TIME OFF TO APPROVE" leave cards white r10 `padding:12px 13px` gap8: avatar 24 + name 13.5px w500 flex1 + kind grey chip; dates 12.5px `#7A7365` mt7; buttons mt11 gap6: Approve (primary 28) / Decline (outline white 28) or decision chip (Approved `#DEEDE4`/`#3D9A63`, Declined `#F7DEDA`/`#A63D26`). "OPEN ROLES" rows `padding:11px 4px` hairline: title 13.5px w500; stage 12.5px `#7A7365` + candidates 12.5px `#8A8375`.

### 3.13 Issue detail side panel

`position:absolute; top:0; inset-inline-end:0; bottom:0; width:440px; background:#FFFFFF; border-inline-start:1px solid #DCD7C9; box-shadow:-8px 0 24px #EAE6DC; z-index:20; animation: kslide .16s ease-out`.
- Header height 56 `padding:0 18px; border-bottom:1px solid #E4E0D6; background:#F7F5EF; gap:10px`: status icon 16, key DM Mono 12px `#97907F`, status 13px `#575247`, spacer, close 28×28 r6 `#7A7365` hover `#E4E0D6`/`#3A362E`.
- Body `padding:18px 20px` scroll: title 19px w600 lh1.32 tracking −0.02em; property grid `84px 1fr; gap:10px 12px; font-size:13px; margin-top:18px` labels `#8A8375` (Assignee, Priority, Due date, Component, Estimation), values `#3A362E` with avatar 22 / priority glyph 15; description 14px lh1.6 `#3A362E` mt18 pt18 hairline-top; "ACTIVITY" sub-label mt22 pt16 hairline-top mb14; thread rows grid `28px 1fr gap10` author 13.5px w500 / time 12px / text 13.5px lh1.55 gap16.
- Footer `border-top:1px solid #E4E0D6; padding:12px 16px`: reply input (36px, see Inputs) placeholder "Add a comment — ⏎ to send".

### 3.14 Notifications popover

`position:absolute; top:46px; inset-inline-end:16px; width:340px; background:#FFFFFF; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.2); overflow:hidden; z-index:30; animation:kfade .12s`. Header height 40 `padding:0 14px; background:#F3F0E8` 13px w500 `#1C1A17` "Inbox". Rows `padding:11px 14px; border-bottom:1px solid #E4E0D6` hover `#F3F0E8`: "Author · where" 13px w500; text 12.5px `#6B6459` lh1.45 mt4. Toggled by bell; closes on Escape / navigation.

### 3.15 Command palette (⌘K)

Backdrop `position:absolute; inset:0; background:rgba(0,0,0,0.2); display:flex; justify-content:center; padding-top:84px; z-index:40; animation:kfade .1s`. Dialog `width:560px; background:#FFFFFF; border-radius:12px; box-shadow:0 24px 48px rgba(0,0,0,0.28); overflow:hidden`. Input row height 48 `padding:0 16px; border-bottom:1px solid #DCD7C9; gap:11px`: magnifier 16 `#9A9285` + placeholder 15px `#8A8375` "Jump to, or run a command…". Command rows height 42 `padding:0 16px; gap:12px` hover `#F3F0E8`: icon 16 `#7A7365` stroke 1.6, label 14px `#2A2721` flex1 ellipsis, hint DM Mono 12px `#A79F8E` ("G then H", "C", "↵"). Opens with ⌘/Ctrl+K (toggle), closes on Escape, backdrop click, or running a command.

### 3.16 Toast

`position:absolute; bottom:20px; left:50%; transform:translateX(-50%); background:#1C1A17; color:white; font-size:13px; padding:10px 16px; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.24); z-index:50; animation:kfade .14s`. Auto-dismiss 2200ms; a new toast replaces the previous. Single line, no icon, no close button.

### 3.17 Selection / bulk toolbar & filters

The source has no multi-select bulk bar. Filtering is expressed via the toolbar "Filter" toggle + active-filter chip (§2.5), preset tabs, and the per-section `tab()` pills. **(proposed)** for a bulk bar: reuse the toast geometry (bottom-centred, `#1C1A17`, r8) with 13px white text "3 selected", ghost white-on-dark actions separated by 1×16 `rgba(255,255,255,0.2)` dividers, and a close X.

---

## 4. Iconography

- All icons are 24×24 viewBox, `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`, single path, geometric and slightly rounded.
- Stroke widths by context: 1.5 (rail, sidebar nav, bell), 1.6 (toolbar, buttons, palette, composer), 1.7 (search, chat header icon, board chips, milestone flag), 1.8–2.0 (close X, plus in primary button 1.9, section caret 2, send 2).
- Rendered sizes: 18 (rail), 16 (nav, toolbar view modes, palette, conv header), 15 (bell, search-ish, rooms), 14 (buttons, filter), 13 (plus in primary, footer icons), 12 (chip icons, X in filter chip).
- Lucide equivalents: target → `target`; bell → `bell`; list → `list`; kanban → `kanban` / `columns-3`; check (square-check) → `square-check-big`; chat → `message-circle`; calendar → `calendar`; doc → `file-text`; milestone → `flag`; video → `video`; building → `building-2`; users → `users`; activity → `activity`; hash → `hash`; at → `at-sign`; user → `user`; bookmark → `bookmark`; thread → `message-square-text`; browse (db) → `database`; plus → `plus`; diamond → `diamond`; square → `square`; grid → `layout-grid`; play → `play`; dot → `circle` (filled small) / `dot`; emoji → `smile`; clip → `paperclip`; image → `image`; slash → `slash` (or `hash`) ; gear → `settings`; preferences sliders → `sliders-vertical`; search → `search`; filter → `filter`; command → `command`; chevrons-up-down → `chevrons-up-down`; chevron-down → `chevron-down`; x → `x`; archive → `archive`; pencil → `pencil` / `square-pen`; pin (bookmark) → `bookmark`; clock → `clock`; comment → `message-circle`; mic → `mic`; arrow-up (send) → `arrow-up`. Use `stroke-width` 1.5 default, 1.6–1.7 at ≤16px.
- Status and priority glyphs are custom 16×16 SVGs (see §3.0), not Lucide.

---

## 5. Interaction conventions

- Hover: sidebar/rail items `#E4E0D6`; content ghost buttons `#F0EDE4`; rows `#FFFFFF` (on `#FBFAF7`); white link-cards `#EFEFF1`; popover/palette rows `#F3F0E8`; primary `#38332B`; secondary `rgba(0,0,0,0.05)`; board cards border `#C8C1B0`; desks border `rgba(0,0,0,0.2)`.
- Active: solid `#1C1A17` with `#FBFAF7` text for nav, rail, view-mode, week-day; `#E9E5DB` for tabs; underline 2px `#1C1A17` for preset tabs; `#F3E9DA` for selected inbox row and active filter chip.
- Cursor `pointer` on every clickable div; `grab` on draggable planner cards.
- Keyboard: ⌘/Ctrl+K toggles palette; Escape closes palette, popover and detail panel; Enter sends chat draft / comment reply; palette hints suggest `G then <key>` chords and `C` for new issue.
- Clicking an issue anywhere (row, card, embed, ref, mention, palette) opens the right-side detail panel (kslide). Creating an issue opens the panel, switches to Board, and shows toast "Draft issue created". "Convert to issue" in chat creates a Triage issue with the message as first thread entry, toast "Issue created from message — thread linked".
- Toasts bottom-centre of the content column, 2.2s.
- Notification popover anchored under the bell (top 46px, inline-end 16px of content).
- Sidebar groups collapsible (caret rotates −90°); issue groups collapsible (caret 0/90°).
- Unread = `#A63D26` dot (7px) or "glow" badge; presence = `#4F7A55` dot.
- No transitions on hover in source; motion is limited to the four enter animations.

---

## 6. RTL notes (fa / ar)

Use logical properties everywhere; the following are the specific flips:
- Grid column order `60px 268px 1fr` naturally mirrors under `dir="rtl"` with CSS grid — keep `grid-template-columns` but do not use `order`. Rail/sidebar `border-right` → `border-inline-end`.
- Nav item `padding: 0 10px 0 (10+indent)px` → `padding-inline: (10+indent)px 10px`.
- Active filter chip `padding: 0 8px 0 11px` → `padding-inline: 11px 8px`.
- Avatar stack `margin-left:-6px` → `margin-inline-start:-6px`. Chat header `margin-right:8px` / `margin-left:6px` → `margin-inline-end` / `margin-inline-start`. Composer typing `margin-left:6px` → `margin-inline-start`.
- Detail panel: `right:0; border-left` → `inset-inline-end:0; border-inline-start`; shadow `-8px 0 24px` → `8px 0 24px` in RTL (or use `0 0 24px` symmetric); `kslide` from `translateX(20px)` → `translateX(-20px)` in RTL (define `kslide-rtl` or use `[dir=rtl]` override).
- Popover `right:16px` → `inset-inline-end:16px`; rail dot `right:4px` → `inset-inline-end:4px`; footer presence dot `right:-2px` → `inset-inline-end:-2px`.
- Planner events `left:56px; right:4px` → `inset-inline-start:56px; inset-inline-end:4px`; inset shadow `inset 3px 0 0` → `inset -3px 0 0` in RTL. Hour label column stays first (`grid-template-columns: 48px 1fr` mirrors automatically).
- Board column rule gradient `to right` → `to inline-end` is not supported; use `[dir=rtl] { background: linear-gradient(to left, …) }`.
- Milestone progress label `text-align:right` → `text-align:end`.
- Carets: sidebar chevron-down rotates to −90° (points inline-end in LTR = right); in RTL rotate +90°. Issue group filled triangle points right when collapsed → mirror with `scaleX(-1)` in RTL.
- Breadcrumb separators " / " fine; numbers/keys ("NS-412", times) should stay LTR: wrap in `<bdi>` or `unicode-bidi: isolate; direction: ltr` for keys, times, mono counts.
- Letter-spacing on uppercase Latin labels (0.16em) should be reset to 0 for Arabic/Persian script (tracking breaks connected letters); keep mono labels in Latin where they are identifiers.
- Fonts: Instrument Sans and DM Mono lack Arabic glyphs — add `Vazirmatn` (fa/ar UI) and a mono fallback (`Vazir Code`/system) to the stacks: `--kern-font-sans: 'Instrument Sans', 'Vazirmatn', …`. Slightly increase line-height (1.6–1.75) for Arabic-script body text.
- Toast and palette are centred; no change. Scrollbars follow the browser side.

---

## 7. Mapping to shadcn-svelte / Tailwind v4

### 7.1 shadcn CSS variable overrides (light)

```css
:root {
  --background: #FBFAF7;          /* content surface */
  --foreground: #3A362E;          /* ink-700 base text */
  --card: #FFFFFF;
  --card-foreground: #1C1A17;
  --popover: #FFFFFF;
  --popover-foreground: #2A2721;
  --primary: #1C1A17;             /* ink-900 solid buttons */
  --primary-foreground: #FBFAF7;
  --secondary: #EFEBE1;           /* grey chip / secondary fills */
  --secondary-foreground: #5B564B;
  --muted: #F0EDE4;               /* hover / muted surfaces */
  --muted-foreground: #8A8375;
  --accent: #F3E9DA;              /* selected/active tint (burnt-orange tint) */
  --accent-foreground: #8A4512;
  --destructive: #A63D26;
  --destructive-foreground: #FBFAF7;
  --border: #E4E0D6;
  --input: #DCD7C9;               /* input & outline-button borders */
  --ring: #B4661C;                /* plus a 3px rgba(180,102,28,0.16) halo */
  --radius: 0.5625rem;            /* 9px — nav/buttons; cards use 10–11px, dialog 12px */
  --sidebar: #F0EEE7;
  --sidebar-foreground: #413D35;
  --sidebar-primary: #1C1A17;
  --sidebar-primary-foreground: #FBFAF7;
  --sidebar-accent: #E4E0D6;      /* nav hover */
  --sidebar-accent-foreground: #1C1A17;
  --sidebar-border: #E4E0D6;
  --sidebar-ring: #B4661C;
  --chart-1: #B4661C; --chart-2: #4474C4; --chart-3: #3D9A63; --chart-4: #7A55B5; --chart-5: #A63D26;
}
```
Dark: map from the **(proposed)** palette in §1.8 (`--background: #1C1A17`, `--foreground: #DCD7C9`, `--card: #23211D`, `--primary: #F5F2EA`, `--primary-foreground: #1C1A17`, `--muted: #2A2722`, `--accent: #3A2A18`, `--accent-foreground: #E59A52`, `--border: #2F2C26`, `--input: #3A362E`, `--ring: #C97A2E`, `--sidebar: #181715`).

In `app.css` (Tailwind v4):
```css
@import "tailwindcss";
@theme inline {
  --color-background: var(--background); /* …standard shadcn-svelte mapping… */
  --font-sans: var(--kern-font-sans);
  --font-mono: var(--kern-font-mono);
  --color-kern-shell: var(--kern-shell);
  --color-kern-accent: var(--kern-accent);
  /* expose every --kern-* as --color-kern-* so `bg-kern-surface-hover`, `text-kern-ink-350` work */
  --radius-xl: 9px; --radius-2xl: 10px; --radius-card: 11px; --radius-dialog: 12px;
  --animate-kslide: kslide .16s ease-out; --animate-kfade: kfade .12s ease-out;
}
```

### 7.2 Component-level notes

- **Button**: `default` = ink-900 / `#FBFAF7`, hover `#38332B`, w500, r6 (r9 for the 34px sidebar CTA), sizes h26/h28/h32/h34, no shadow. `outline` = border `#DCD7C9`, bg `rgba(0,0,0,0.02)`, text `#413D35`, hover `rgba(0,0,0,0.05)`; a `white` outline variant bg `#FFFFFF` text `#474339` hover `#F0EDE4`. `ghost` = text `#575247`/`#7A7365`, hover `#F0EDE4` (content) or `#E4E0D6` (sidebar). `link` = `#A85A18` hover `#8A4512` underline. Icon buttons 22/26/28/30/32/34 square.
- **Badge**: three variants — `chip` (12px, pad 3/9, r6, tint/fg pairs), `count` (DM Mono 10.5px, pad 1/6, r5, `#E9E5DB`/`#7A7365`), `glow` (same as count, `#A63D26`/`#FBFAF7`).
- **Tabs**: use the 24px pill style (`#E9E5DB` active) for section filters; the 2px-underline style inside the 52px toolbar for presets. Both should be custom classes over shadcn Tabs triggers.
- **Input**: h36 r8 border `#DCD7C9` bg white; focus ring `0 0 0 3px rgba(180,102,28,0.16)` + border `#B4661C`. Search inputs are the 32–34px `#F5F2EA` bordered container with a 14px magnifier.
- **Avatar**: rounded-square (not circle) — override shadcn Avatar radius to `round(size*0.3)`; fallback initials w600 `#FBFAF7` on identity colour.
- **Card**: r10 (11 for board cards), border `#E4E0D6`, no shadow, padding 14–16 / 16–18.
- **Sheet** (detail panel): side=end, width 440, no backdrop (the source has none), white, `border-inline-start #DCD7C9`, shadow `-8px 0 24px #EAE6DC`, slide 160ms.
- **Popover** (notifications): w340 r10 shadow `0 8px 24px rgba(0,0,0,0.2)`, header strip `#F3F0E8`.
- **Command** (palette): w560 r12 shadow `0 24px 48px rgba(0,0,0,0.28)`, overlay `rgba(0,0,0,0.2)`, top offset 84px, input row h48 with `#DCD7C9` rule, items h42, hint in DM Mono `#A79F8E`.
- **Sonner/Toast**: bottom-center, `#1C1A17` bg, white 13px, r8, 2.2s, no icon.
- **DropdownMenu / Select** (not drawn; derive): white r10 bordered `#E4E0D6`, shadow `0 8px 24px rgba(0,0,0,0.2)`, items h34 13.5px `#2A2721` hover `#F3F0E8`, separators `#EAE6DC`.
- **Table**: header 11px w600 uppercase tracking 0.06em `#9A9285` h34; rows h40–48 hairline `#EAE6DC`, hover `#FFFFFF`; no vertical borders; no zebra.
- **Separator**: `#E4E0D6` (structural) vs `#EAE6DC` (within lists).
- **Tooltip** (not drawn; derive): `#1C1A17` bg, white 12px, r6.
- **Progress**: h6 r999 track `#DCD7C9`, fill `#4474C4`/`#3D9A63`; header measure h3 track `#E9E5DB` fill `#B4661C`.
- **Segmented control** (Office Floor/Rooms): custom — track `#F0EDE4` r7 p2, active white r5 with `0 1px 2px #D5CFC2`.
- **Scrollbars**: apply the global webkit styles from §1.5; for Firefox `scrollbar-width: thin; scrollbar-color: #D5CFC2 transparent`.
- Utility classes to add: `.kern-section-label` (DM Mono 10.5 upper 0.16em `#97907F`), `.kern-sublabel` (11px w600 upper 0.06em `#8A8375`), `.kern-mono-meta` (DM Mono 11.5 `#A79F8E` −0.01em), `.kern-key` (13px `#8A8375`), `.kern-hairline` (`border-bottom:1px solid #EAE6DC`).
