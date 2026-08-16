# BookMyLoad Full-Application UI Diagnostic

**Audit date:** August 16, 2026  
**Scope:** landing page, authenticated operations workspace, all navigation tabs, dialogs, dropdowns, tables, mobile rules, and driver portal.

## Executive summary

The application compiles successfully and the backend workflows are healthy, but the frontend has a systemic theme problem: legacy dark Tailwind classes are converted to a light theme through broad CSS overrides. Radix dropdowns and dialogs are rendered in portals outside their original page container, so they receive a different combination of styles than the visible page.

The invisible role text reported in **Settings → Invite member → Role** is confirmed. It is not isolated to Settings; the same white-on-white failure is possible in Fleet and Trips dropdown menus.

### Validation results

- Production frontend build: **passed**
- Backend workflow and authorization suite: **38/38 passed**
- Frontend automated UI tests: **none configured**
- Static full-page/component audit: **completed**
- Authenticated browser screenshot audit: **not automated in the current repository**

## Severity summary

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 0 | No data-loss or security-breaking UI defect confirmed |
| High | 2 | Important controls are unreadable or misleading |
| Medium | 4 | Inconsistent interaction/readability or demo-quality problem |
| Low | 3 | Maintainability, polish, or test-coverage issue |

## Confirmed findings

### UI-01 — Role dropdown options are white on white

**Severity:** High  
**Status:** Confirmed  
**Affected areas:** Settings → Invite member; Settings → change member role

The role dropdown explicitly gives each option `text-white` and the dropdown container `bg-slate-800`. A later global rule changes every Radix listbox background to white but does not override each option’s explicit white text.

Relevant code:

- `frontend/src/components/OrganizationAccessPanel.js`: role `SelectContent` uses `bg-slate-800`; role `SelectItem` uses `text-white`.
- `frontend/src/index.css`: `body:has(.app-shell) ... [role="listbox"]` forces `background: #fff` and dark inherited text.

Because the option has its own `text-white`, inherited dark text cannot take effect.

**Recommended repair:** remove page-level color classes from Radix options and define foreground/background states in the shared `Select` component. Add explicit light-workspace portal styles for normal, highlighted, selected, and disabled options.

### UI-02 — The same portal contrast bug affects Fleet and Trips

**Severity:** High  
**Status:** Confirmed by code path  
**Affected areas:**

- Fleet → Add/Edit Vehicle → Vehicle Type
- Fleet → Add/Edit Vehicle → Fuel Type
- Trips → Create Trip → Vehicle Type
- Trips → status filter → “All Status”
- Trips → Assign Resources → driver options
- Trips → Assign Resources → vehicle options

These menus use the same `bg-slate-800` content plus `text-white` items. When opened inside the authenticated application, the portal listbox is forced to a white background by the global workspace rule.

Status options using green/orange/blue text are usually visible on white, but their contrast and hover states are inconsistent. Items using `text-white` can disappear completely.

**Recommended repair:** fix the shared `SelectContent` and `SelectItem` primitives once, then remove per-page dark-theme color classes.

### UI-03 — Dialog theming is only partially converted to light mode

**Severity:** Medium  
**Status:** Confirmed  
**Affected areas:** operational create/edit dialogs across Loads, Fleet, Drivers, Trips, Compliance, Finance, Trip Costs, and Settings.

The workspace dialog rule changes the dialog, inputs, and selected `text-white` elements, but labels commonly retain legacy `text-slate-300`. Because dialogs are portaled outside `.app-content`, the normal `.app-content label` rule does not apply.

Possible results:

- very light grey labels on white dialog backgrounds;
- inconsistent button foregrounds;
- status and helper text retaining dark-theme colors;
- different rendering between inline forms and dialog forms.

**Recommended repair:** give `DialogContent` a deliberate workspace theme instead of recoloring arbitrary descendant utility classes. Define dialog label, input, textarea, select, helper, error, and action styles centrally.

### UI-04 — Settings “Quick Actions” look clickable but have no behavior

**Severity:** High  
**Status:** Confirmed  
**Affected area:** Settings → Quick Actions

The following buttons have no `onClick`, link, route, or disabled state:

- Appearance
- Security
- Notifications

They invite interaction but do nothing. This is especially risky during a client demo.

**Recommended repair:** either connect them to real sections/features or remove them. A disabled “Coming soon” treatment is acceptable only if deliberately communicated.

### UI-05 — Notification Preferences are static, not preferences

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** Settings → Notification Preferences

Trip Updates, Driver Alerts, Maintenance Reminders, and Licence Expiry are hardcoded as enabled badges. The user cannot change them, although the section title implies editable preferences.

There is a separate functional email/reminder panel below, which makes the static section more confusing.

**Recommended repair:** either bind these rows to stored settings or rename the section to “Enabled Notification Types” and clearly state that they are informational.

### UI-06 — Placeholder support information is visible to clients

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** Settings → Need Help?

The application displays:

- `support@bookmyload.in`
- `1800-XXX-XXXX`

The telephone number is visibly unfinished. Verify that the email is also a monitored mailbox before presenting it.

**Recommended repair:** replace with approved client/company contact information or remove the card for the demo.

### UI-07 — Driver portal uses a separate, incomplete theme path

**Severity:** Medium  
**Status:** Confirmed architectural risk; primary card text currently protected by the shared Card foreground

The driver page receives `.driver-workspace` overrides, but driver dialogs are portaled outside `.driver-workspace`. Unlike the operations workspace, there is no portal theme selector for the driver experience.

Current driver dialogs remain legacy dark and are generally readable because `DialogContent` explicitly uses dark background and white text. However, any move toward the light driver design—or any shared dialog change—can immediately produce the same contrast failures seen in Settings.

Additional driver observations:

- Browser location errors only produce a toast and console warning; there is no persistent “tracking disabled” state on the trip card.
- Proof-of-delivery supports a captured image internally, but the visible form currently presents a “Delivery photo URL” field rather than an obvious camera/file control.
- Dense action buttons can wrap unpredictably on narrow phones.

**Recommended repair:** create an explicit driver portal/dialog theme and add mobile viewport tests at 320, 375, and 430 pixels.

### UI-08 — No automated frontend interaction or visual-regression tests

**Severity:** Low  
**Status:** Confirmed

The repository has strong backend tests but no frontend tests for:

- opening each dropdown and reading options;
- dialog form contrast and field labels;
- mobile navigation;
- driver portal actions;
- role-based route behavior;
- keyboard navigation and focus states.

This is why a shared CSS regression can reach several pages unnoticed while the production build still passes.

**Recommended repair:** add Playwright or Cypress smoke tests with screenshots for owner, dispatcher, viewer, and driver at desktop and mobile sizes.

### UI-09 — Theme implementation is fragile and difficult to maintain

**Severity:** Low  
**Status:** Confirmed

The light workspace is implemented by rewriting broad legacy utility selectors such as `.bg-slate-900`, `.bg-slate-800`, `.text-white`, and `.border-slate-800` under `.app-content`. This causes:

- context-dependent component appearance;
- portals escaping their intended theme;
- high-specificity `!important` conflicts;
- new components inheriting unexpected colors;
- a fix on one page creating a regression elsewhere.

**Recommended repair:** migrate reusable components and pages to semantic theme tokens (`background`, `card`, `popover`, `foreground`, `muted`, `border`, `primary`) and reduce/remove utility-class rewriting.

## Page-by-page audit

| Area | Diagnostic result |
|---|---|
| Landing page | No blocking static issue found; responsive/mobile menu code is present |
| Google sign-in dialog | Uses its own explicit light palette; no reported contrast collision found |
| Overview | No blocking control issue found; mostly read-only cards and links |
| Loads | Native selects are readable through dialog overrides; dialog label consistency remains at risk |
| Trips | Multiple Radix dropdowns affected by portal contrast issue |
| Live Tracking | No static contrast blocker found; runtime depends on browser GPS/location permission |
| Fleet | Vehicle/fuel/status Radix menus affected or inconsistent |
| Drivers | Status menu uses colored options; dialog styling remains inconsistent |
| Compliance | Upload dialog exposed to partial portal light-theme conversion |
| Finance | Quote/invoice/payment dialogs exposed to partial portal theme conversion |
| Trip Costs | Expense dialog exposed to partial portal theme conversion |
| Reports | Build passes; native filters are styled consistently inside page content |
| Settings | Role dropdown failure, inert Quick Actions, static preferences, placeholder phone |
| Notifications | Explicit light palette; no blocking static contrast issue found |
| Driver portal | Main cards are readable; dialog theme and narrow-screen actions need dedicated tests |

## Recommended repair order

1. Fix shared `Select` portal colors and remove `text-white`/`bg-slate-800` from individual dropdowns.
2. Define a shared light dialog theme covering labels, fields, helper text, buttons, and close control.
3. Give the driver portal and its portaled dialogs an explicit theme.
4. Remove or implement Settings Quick Actions.
5. Correct Notification Preferences wording/behavior and replace placeholder support details.
6. Add automated desktop/mobile screenshot smoke tests for every route and role.
7. Gradually replace legacy dark-class overrides with semantic design tokens.

## Test evidence

### Frontend production build

```text
Compiled successfully.
main JavaScript: 362.28 kB gzip
main CSS: 23.69 kB gzip
```

The build reports an outdated Browserslist database (eight months old). This is maintenance noise, not the cause of the contrast bug.

### Backend tests

```text
Ran 38 tests
OK
```

The passing suite covers organization isolation, roles, authentication, load-to-trip execution, driver milestones, tracking, compliance, commercial workflow, expenses, reporting, geocoding, and email reminders.

## Conclusion

The core business workflows are stable according to the automated backend suite. The main demo risk is frontend presentation consistency, especially portal-based dropdowns and dialogs. The role dropdown is one symptom of a shared theme boundary problem, so it should be repaired centrally rather than patched only in Settings.
