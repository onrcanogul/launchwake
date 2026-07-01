# Design system — LaunchWake

Goal: look like a tool a real product team shipped (Linear / Vercel / Resend grade).
**Avoid the "AI-generated" tells:** no emoji icons, no neon gradient text, no glow/halo,
no oversized rounded "card soup", nothing centered-hero inside the app.

## Principles

1. **One restrained accent** (teal). Use it only for: active nav marker, primary button,
   key metric, focus ring, small meters. Everything else neutral.
2. **Hairline borders** (`rgba(255,255,255,.07)`) instead of heavy shadows.
3. **Typography discipline:** Inter, tight tracking (-0.01em), `tabular-nums` for numbers,
   monospace for technical strings/IDs.
4. **Density with purpose**, 8px grid. Line icons only (1.6px stroke, `currentColor`).

## Tokens (from the mock — keep exact)

```css
--bg:#0A0B0F;  --bg1:#0D0F14;  --bg2:#111318;  --bg3:#15181E;  --hover:#161922;
--line:rgba(255,255,255,.07);  --line2:rgba(255,255,255,.11);
--tx:#E7E9ED;  --tx2:#9CA3B0;  --tx3:#646B79;      /* text: primary / secondary / tertiary */
--ac:#3ECFB6;  --ac2:#4ee0c6;  --acd:rgba(62,207,182,.14);  --acb:rgba(62,207,182,.35);
--ok:#3ECF8E;  --warn:#E3B341;  --bad:#F0616D;  --vi:#8B93F8;
--radius:7px;
```
Ship-type tags: LAUNCH=teal, FEATURE=violet, BLOG=amber (muted, 14% bg).
Ban risk dots: Low=`--ok`, Medium=`--warn`, High=`--bad`.

Type scale (px): page title 19/600, section 13/600, body 13/450, label 11.5/550 (uppercase 10.5 for table headers), meta 11.5.

Spacing: content padding 28/40; card padding 16–20; radius 7 (buttons/inputs), 10 (panels/cards).

## Light theme (optional, later)

Provide a light variant with the same structure (near-white bg, same teal accent, darker text).
Keep tokens swappable via a `data-theme` attribute.

## Components to build (`/components`)

- `Sidebar`, `SidebarNav`, `WorkspaceSwitcher`, `TopBar` (breadcrumb + search + hamburger)
- `Button` (primary / secondary / ghost, sizes), `Badge` (default / accent / with status dot)
- `StatStrip` / `Stat`
- `Panel` (header + rows), `ListRow`
- `ChannelCard` (icon, name, audience, FitMeter, why, ban-risk + time + rule footer, action)
- `FitMeter` (bar + number), `RiskDot`
- `Tabs`, `DraftCard` (body + copy + safety note)
- `DataTable` (scroll-x on mobile), `ConversionBar`
- `Segmented`, `Input`, `Textarea`, `EmptyState` (icon + line + CTA), `Checklist` (getting-started)
- `Icon` — a single line-icon set (inline SVG, 1.6 stroke). NO emoji.

## Icon set (line, stroke 1.6, currentColor)

grid, plus, target/where, edit/kit, chart/results, channels(concentric circles), settings(gear),
search, chevron, calendar, list/rules, shield(ban-safety), copy, refresh, github, external-link, wave(logo).

## Don'ts (hard rules)

- No emoji as UI icons.
- No `linear-gradient` text fills or box glows.
- No border-radius > 12px on containers.
- No more than one accent hue.
- No centered marketing-style hero inside the app shell.
