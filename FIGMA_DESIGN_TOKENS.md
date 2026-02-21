# Figma Design Tokens Extracted

## Typography

### Header Logo ("Popouts")
- Font: `Inter:Regular` (font-weight: 400)
- Size: `13px`
- Line height: `19.5px`
- Letter spacing: `-0.4012px`
- Color: `#0a0a0a`

### Header Tabs (Meetings/Actions)
- Font: `Inter:Medium` (font-weight: 500)
- Size: `11px`
- Line height: `16.5px`
- Letter spacing: `0.0645px`
- Color: `#0a0a0a` (active), `#717182` (inactive)
- Tab count badge: `8px`, line-height `12px`, letter-spacing `0.2057px`

### Sidebar "Meetings" Title
- Font: `Inter:Regular`
- Size: `11px`
- Line height: `16.5px`
- Letter spacing: `0.0645px`
- Color: `#717182`
- Padding: `10px` top, `12px` horizontal

### Category Headers (1:1s, Recurring, Ad Hoc)
- Font: `Inter:Medium`
- Size: `12px`
- Line height: `18px`
- Color: `#0a0a0a`
- Category count badge: `9px`, line-height `13.5px`, letter-spacing `0.167px`, color `#717182`
- Gap between icon and text: `8px`

### Add Button (in category header)
- Font: `Inter:Medium`
- Size: `10px`
- Line height: `15px`
- Letter spacing: `0.1172px`
- Color: `#030213`
- Padding: `6px` horizontal, `2px` gap between icon and text

### Meeting Item Name
- Font: `Inter:Regular`
- Size: `11px`
- Line height: `16.5px`
- Letter spacing: `0.0645px`
- Color: `#030213` (selected), `#0a0a0a` (unselected)
- Padding: `11px` left, `39px` right, `1px` vertical
- Gap between items: `2px`

### Meeting Item Meta (date, badges, notes count)
- Date: `Inter:Regular`, `9px`, line-height `13.5px`, letter-spacing `0.167px`, color `#717182`
- Badge ("X open"): `Inter:Regular`, `8px`, line-height `12px`, letter-spacing `0.2057px`, color `#030213`, background `rgba(3,2,19,0.1)`
- Notes count: `Inter:Regular`, `8px`, line-height `12px`, letter-spacing `0.2057px`, color `rgba(113,113,130,0.5)`
- Gap between meta items: `6px`

### Meeting Detail Header
- Title: `Inter:Medium`, `14px`, line-height `21px`, letter-spacing `-0.1504px`, color `#0a0a0a`
- Last date: `Inter:Regular`, `10px`, line-height `15px`, letter-spacing `0.1172px`, color `#717182`
- Padding: `12px` top, `16px` horizontal
- Gap: `2px` between title and meta

### Meeting Tabs (Agenda/Notes/Actions)
- Font: `Inter:Medium`
- Size: `11px`
- Line height: `16.5px`
- Letter spacing: `0.0645px`
- Color: `#030213` (active), `#717182` (inactive)
- Tab badge: `Inter:Medium`, `8px`, line-height `12px`, letter-spacing `0.2057px`
- Active badge background: `rgba(3,2,19,0.15)`, color `#030213`
- Inactive badge background: `#ececf0`, color `#717182`
- Icon size: `13px`
- Icon position: `16px` from left, `9.75px` from top
- Active underline: `2px` height, `#030213`, `8px` from left/right

### Agenda Filters
- Font: `Inter:Medium`
- Size: `10px`
- Line height: `15px`
- Letter spacing: `0.1172px`
- Color: `#030213` (active), `#717182` (inactive)
- Filter count: same font, opacity `0.5`
- Padding: `2px` top, `8px` left
- Gap between filters: `6px`
- Background: `rgba(3,2,19,0.1)` (active), transparent (inactive)

### Agenda Input
- Placeholder: `Inter:Regular`, `12px`, color `rgba(113,113,130,0.3)`
- Padding: `7px` vertical, `6px` horizontal
- Icon: `16px`, `6px` from left, `7px` from top

### Agenda Items
- Font: `Inter:Regular`
- Size: `12px`
- Line height: `16.5px`
- Color: `#0a0a0a` (open), `rgba(113,113,130,0.6)` (closed, with line-through)
- Padding: `7px` vertical, `6px` horizontal
- Gap between items: `2px`
- Checkbox: `16px`

### Modal
- Title: `Inter:Medium`, `13px`, line-height `19.5px`, letter-spacing `-0.0762px`, color `#0a0a0a`
- Input placeholder: `Inter:Regular`, `12px`, color `rgba(113,113,130,0.6)`
- Button text: `Inter:Medium`, `11px`, line-height `16.5px`, letter-spacing `0.0645px`
- Cancel: color `#717182`
- Submit: color `white`, background `#030213`, opacity `0.4` when disabled

## Spacing

- Header padding: `16px` horizontal
- Sidebar padding: `12px` horizontal, `10px` top
- Meeting item padding: `11px` left, `39px` right, `1px` vertical
- Meeting item gap: `2px`
- Category header padding: `12px` horizontal
- Category gap: `8px` between icon and text
- Tab gap: `4px` between tabs
- Tab padding: `12px` horizontal
- Agenda filter padding: `2px` top, `8px` left
- Agenda filter gap: `6px`
- Agenda item padding: `7px` vertical, `6px` horizontal
- Agenda item gap: `2px`

## Colors

- Primary text: `#0a0a0a`
- Secondary text: `#717182`
- Selected text: `#030213`
- Background: `white`
- Border: `rgba(0,0,0,0.1)`
- Selected meeting background: `rgba(3,2,19,0.08)`
- Selected meeting border: `rgba(3,2,19,0.2)`
- Badge background: `rgba(3,2,19,0.1)`
- Tab background: `rgba(236,236,240,0.5)`
- Active tab background: `white`
- Filter active background: `rgba(3,2,19,0.1)`

## Sizes

- Header height: `49.5px`
- Tab container height: `32.5px`
- Tab button height: `28.5px`
- Sidebar width: `240px`
- Sidebar header height: `37.5px`
- Category header height: `35px`
- Meeting item height: `50.5px` (with meta), `48.5px` (without meta)
- Meeting detail header height: `63px`
- Meeting tabs height: `33.5px`
- Tab button height: `32.5px`
- Agenda filter height: `37px`
- Filter button height: `19px`
- Agenda input height: `29px`
- Agenda item height: `28px`
