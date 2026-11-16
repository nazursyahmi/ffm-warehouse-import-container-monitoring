# Data configuration and calculation contract

## Import workflow

Open **Data source · Import, map & validate** on any page. Upload UTF-8 comma-separated
CSV or unencrypted XLSX (20 MB maximum; XLSX uncompressed content limited to 100 MB;
100,000 data records maximum). Choose an Excel worksheet, inspect the original
50-row preview, and map original columns to canonical fields. Exact canonical
header matches are suggestions shown in the selectors; you must validate and
review them before activation. No fuzzy column mapping is performed.

Choose one text date format for the file: ISO YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY or
DD-MM-YYYY. Real Excel datetime cells are accepted. Store identifiers as Excel
text to preserve leading zeros: zeros already lost by Excel numeric storage cannot
be recovered. Dates represent calendar dates, not elapsed business hours. Excel
time components are ignored in the analytics date copy; retain the source for
full timestamp detail. CSV text timestamps and Excel numeric date serials should
be explicitly converted to supported date text or actual Excel date cells first.

Select which source status values mean Delivered and Pending; all unselected,
missing or unfamiliar values become **Unknown**, never Pending. A status cannot
mean both. Capitalization is preserved and matching is exact after whitespace
trimming. The original source frame is retained in the session, not overwritten.

Press **Validate import**. Review/download findings and quarantined rows, then
acknowledge the review and press **Activate validated data**. Changed mappings
invalidate the staged report. Missing required mappings or zero eligible records
prevent activation. A failed or unfinished import leaves the existing source active.
Activation replaces the source and resets global filters, detail searches and
DEM/DET calculation assumptions. Navigation preserves active global filters.

## Counting and validation

Required mappings: **Container Number** and **BL Number**. Unit of counting is
the exact, trimmed (BL Number, Container Number) pair, with one row per pair.
Case is not normalized. Reuse of a container across different BLs counts separately.
If a BL can be reused, preprocess with an agreed shipment identifier before use.

- All rows sharing a duplicate pair are quarantined, including exact duplicates.
  Nothing is arbitrarily kept as the latest record. Resolve event history upstream.
- Missing keys, invalid nonblank dates/rates, negative or nonfinite rates,
  delivery before arrival, gate-out before discharge, return before gate-out,
  and Pending with a recorded actual delivery date quarantine the row.
- Unknown statuses and missing optional information produce warnings and remain
  eligible. Delivered without actual delivery date counts as delivered but has
  no measured lead time. Pending without a target has unknown deadline risk.
- CSV record width mismatches, empty/duplicate headers and unreadable files are
  rejected. Blank CSV records remain present and are quarantined for missing keys.
- Source Row is a 1-based logical data-record position plus the header row. For
  quoted multiline CSV fields it is a logical row, not a physical text line number.
- Normalized dates, trimmed text and missing-value interpretation are disclosed
  in this workflow and validation findings; source fields remain inspectable in
  Shipment Explorer. Report totals may exceed row counts because each row can
  have multiple findings.

## Canonical fields

| Field | Use |
|---|---|
| Container Number, BL Number | Required counting key, text |
| Vessel Name, Shipping Line | Optional grouping and filters |
| Delivery Status | Explicit Delivered/Pending mapping; otherwise Unknown |
| RFC Status | Recorded value only; its business definition must be supplied |
| Return Status | Recorded value only; actual Return Date determines closed DET exposure |
| Arrival Date | Default global date scope, monthly volume and lead-time start |
| Discharge Date, Gate Out Date | Alternative lead-time starts; optional DEM/DET start events |
| Delivery Deadline | Operational delivery target, never substituted for DEM/DET deadline |
| Delivery Date | Actual delivery event; measurement only for Delivered status |
| Return Date | Actual empty-container return; DET exposure stop |
| DEM Deadline, DET Deadline | Explicit last free dates, used before any derived rule |
| DEM Daily Rate, DET Daily Rate | Non-negative flat per-day rates; no default rate |
| Currency | Required for charge estimate; grouped exactly, no FX conversion |
| Delay Category, Root Cause | Recorded attribution only, never inferred |
| Source Updated At | Optional source update **date**, distinct from upload/load time |

Missing optional fields are **Not Available** or **Requires Configuration**. No
fictional tariffs, free allowances, root causes or backend behavior are supplied.

## Shared formulas

All calculations consume the same validated, unique frame after global filters.
KPI cards keep this scope when vessel/BL inspection narrows only the detail panel.

- Total = eligible BL/container pairs. Delivered/Pending = corresponding explicit
  status counts. Unknown = all other statuses. Total = Delivered + Pending + Unknown.
- Delivery rate = Delivered / Total × 100; denominator zero = Not Available.
- Overdue = Pending and Delivery Deadline < assessment date.
- Approaching = Pending with deadline from assessment date through assessment
  date + configured warning days, inclusive. Zero warning days means due today.
- Lead time = actual Delivery Date − selected actual start date in calendar days;
  only Delivered and nonnegative durations with both dates qualify. Mean/min/max
  exclude unavailable measurements. Counts/sample sizes accompany averages.
- Delay = max(0, actual Delivery Date − target) for Delivered; max(0, assessment
  date − target) for Pending. Unknown status or missing endpoints = unavailable.
- Container-days of delay = sum of measured positive delays per container. It
  is not money, total distinct shipment-days, or a causal attribution.
- Overview monthly volume groups by Arrival Date. Throughput groups actual
  delivered containers by Delivery Date. Cohort rate groups current source
  statuses by Arrival Month; incomplete cohorts can have lower completion rates.
- Recurring recorded cause = a cause associated with at least two distinct BLs
  in the filtered delayed records; this describes association, not causation.

The assessment date controls deadline/open-exposure calculations. Changing it
does not reconstruct historical statuses or remove records from the loaded
snapshot. Global date fields can be selected separately; missing dates are included
by default and can be excluded explicitly. Reset clears global filters only.

## DEM / DET configuration

Each is independent. DEM stops at Gate Out Date; DET stops at Return Date.
Imported explicit deadlines take priority. With no explicit deadline, the user
may enable a rule and choose the actual start-event column and free calendar days:

`deadline = start + free days` (start day excluded; deadline is last free date).

This is an optional, user-confirmed convention, not an assumed contract. No
allowance is pre-enabled. A configured zero is zero free days. No holiday,
weekend, inclusive-start or tier-specific calculation is inferred.

`charge days = max(0, end − deadline)`; a deadline-day stop produces zero charge
days, the following day one. Actual stop dates after the assessment date are
labelled unknown and excluded from estimates. For missing stops, the user must
explicitly opt in to treat them as open through assessment date; otherwise charge
duration stays unknown. Return Status text alone does not fabricate a stop date.

`estimated charge = charge days × supplied daily rate`, only when the user confirms
flat daily tariff, rate/currency/deadline and usable end are available. Currency
totals remain separate. No combined DEM/DET totals, FX, tax, rounding, contractual
minimum, weekend rule, variable shipping-line default or tiered tariff is invented.
Use explicit contract-calculated deadlines for unsupported free-time conventions;
more complex tariffs require a future extension or calculation outside this app.

Remaining free days = deadline − assessment date for potentially open records;
closed rows display no remaining-free-day value. Potential deadline exceedance
does not establish liability: missing stops are labelled open/unconfirmed and
alerts explicitly request movement confirmation. Charts count potential risk, not
unverified chargeable containers. Estimates show measured-container coverage.

## Exports, freshness and storage

CSV exports are UTF-8 with BOM. Excel export is prepared on demand using OpenPyXL.
Both contain all matched rows regardless of pagination. Clicking a native table
header sorts the displayed table only; use Explorer's explicit Sort by to control
export order. Formula-like text is prefixed with an apostrophe in exports to
prevent spreadsheet evaluation; the original session values are preserved.

The app shows loaded time separately from the latest supplied source update date.
No update date means source freshness is unavailable; upload time is not used as
a substitute. Demo data uses a fixed 16 November 2026 snapshot and clear labels.

Uploads, active frame, mapping and rules live only in Streamlit session memory.
Browser session expiry/server restart loses them. No global cache, database,
scheduled refresh, authentication, email, WhatsApp or external notification system
is implemented. Operational data should only be used in an access-controlled
hosting setup approved by the organization.
