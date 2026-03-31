# Leggo ✈

> **Let's go, planned.**

A personal travel planning system — one private dashboard, one page per trip, fully shareable via URL.

Built with vanilla HTML/CSS/JS. Hosted on Vercel. No backend, no database, no login.

---

## Structure

```
leggo/
├── index.html              ← Your private dashboard (never share this URL)
├── scotland-2026.html      ← Scotland & Ireland 2026 (shareable)
├── assets/
│   ├── style.css           ← Shared design system (tokens, buttons, badges)
│   └── trip.css            ← Trip page layout and components
└── README.md
```

---

## How to Deploy

### 1. Create GitHub repo
```bash
git init
git add .
git commit -m "init: leggo travel planner"
git remote add origin https://github.com/YOUR_USERNAME/leggo.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `leggo` repository
4. Leave all settings as default (it's a static site)
5. Click **Deploy**
6. Your site is live at `leggo.vercel.app` (or set a custom name)

### 3. Update share URLs
Once deployed, update the share URL in each trip page:
- Open `scotland-2026.html`
- Find `leggo.vercel.app/scotland-2026` and replace with your actual URL
- Do the same in the `copyURL()` function at the bottom of the file

---

## How to Add a New Trip

### Step 1 — Copy the trip template
```bash
cp scotland-2026.html morocco-2026.html
```

### Step 2 — Update the new file
Open the new file and update every section marked with `<!-- UPDATE: ... -->`:

| What to update | Where |
|---|---|
| `<title>` tag | Line ~9 |
| Trip label, destination, dates | Hero section |
| Meta strip (route, fly from, families, status) | Hero section |
| Route timeline stops + nights | Section 1 |
| Night-by-night stays table | Section 1 |
| Transport between cities | Section 1 |
| Logistics (visa, insurance status) | Section 1 |
| Budget rows (add/remove items) | Section 2 |
| Day cards (dates, titles, activities) | Section 3 |
| Family cards | Section 4 |
| Share URL | Share banner + copyURL() |

### Step 3 — Add a card on index.html
Open `index.html` and duplicate the trip card block. Update:
- Flag emoji
- Destination name and subtitle
- Date range
- Status badge (`badge--confirmed` / `badge--planning` / `badge--dreaming`)
- Tags
- Night count
- `href` link to the new file
- Add 🔒 icon and `trip-card--private` class if it's family-only

### Step 4 — Update hero stats
In `index.html`, update the stats manually:
- Total trips count
- Total countries count
- Total nights count
- Countdown departure date and trip name (in the `<script>` block at the bottom)

### Step 5 — Commit and push
```bash
git add .
git commit -m "add: morocco-2026 trip page"
git push
```
Vercel auto-deploys on every push. Your new page is live in ~30 seconds.

---

## Day Card Types

Each day in the itinerary is one of two types:

**Key day** — expandable, shows morning/afternoon/evening blocks:
```html
<div class="day-card is-key" id="day-1">
  <div class="day-card__header" onclick="toggleDay('day-1')">
    ...
  </div>
  <div class="day-card__body">
    <div class="day-blocks"> ... </div>
  </div>
</div>
```
Use for: arrival day, major activity days, travel/moving days.

**Light day** — one-liner, no expand:
```html
<div class="day-card is-light">
  <div class="day-card__header">
    ...
    <span class="day-card__summary">Free explore — markets and lunch</span>
  </div>
</div>
```
Use for: rest days, free exploration, simple days.

---

## Budget

Each budget row has:
- **Paid checkbox** — click to mark as paid (= booking confirmed)
- **Description** + optional note in `<small>`
- **Estimated** — your best guess before booking
- **Actual** — fill in when you have the real number

Categories are collapsible — click any category header to expand/collapse.

The **Total Paid** and **Still to Pay** boxes at the bottom are currently manual labels. Update them as you go, or leave them as reference markers.

---

## Sharing

| Trip type | What to do |
|---|---|
| **Shared trip** | Send `leggo.vercel.app/your-trip-name` |
| **Family-only trip** | Don't share the URL — it won't appear on the index for others |
| **Index page** | Keep `leggo.vercel.app` private — don't share this |

Recipients see the full trip page: snapshot, budget, itinerary, families. No other trips are visible.

---

## Status Badges

```html
<span class="badge badge--confirmed">Confirmed</span>
<span class="badge badge--planning">Planning</span>
<span class="badge badge--dreaming">Dreaming</span>
<span class="badge badge--private">Private</span>
```

---

## Logistics Status Colours

```html
<span class="logistics-val logistics-ok">✓ Confirmed</span>    <!-- green -->
<span class="logistics-val logistics-warn">⚠ Not booked</span> <!-- gold/amber -->
<span class="logistics-val" style="color:var(--accent)">⚠ Note</span> <!-- terracotta -->
```

---

## Future Features (Backlog)

See `leggo-prd.md` for the full feature backlog including:
- PDF/print export
- Map embed
- Photo gallery (planner → memory book)
- Password protection per page
- Mobile-first layout
- Post-trip journal section

---

*Built by Ersalina · Leggo · Let's go, planned.*
