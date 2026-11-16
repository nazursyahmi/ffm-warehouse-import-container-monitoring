# FFM Logistics — Phase 1 review and Phase 2 proposal

Historical Phase 1/2 proposal. Full implementation was subsequently approved;
see README.md, data-configuration.md and verification.md for current capabilities.

## Evidence and scope

No screenshot was attached or present in the workspace. Visual analysis of the
reference is therefore pending. Confirmed features come from the written brief:
seven pages, six operational KPIs, vessel/BL inspection, shared filters, corporate
navy styling and explicit demo labels. The reference figures (520/446/74/85.8%)
are not used as data. No existing application was found in the workspace.

This is a working design prototype for approval, not Phase 3 implementation.
The requested structure is retained; unimplemented pages and services will be
added in Phase 3 rather than filled with misleading empty implementations.

## Layout proposal

    Sidebar                         Full-width workspace
    FFM Logistics                   DEMO DATA badge / page title
    Seven page destinations         Source and fixed snapshot date
    Arrival date range              Total | Delivered | Pending
    Vessel / BL / status / line     Rate  | Overdue   | Approaching
    Reset filters / match count     Critical and warning messages
    Demo alert settings             Vessel and BL inspection
                                    Shipment summary / searchable register
                                    CSV download / calculation notes

Operations-first is the recommended approach: deadlines and actionable records
are visible before secondary analytics. An executive chart-first approach gives
faster trend scanning but less direct access to container details; it belongs on
Overview. A dense spreadsheet-first approach offers more rows above the fold
but weakens alert visibility and tablet readability. These are proposals, not
previously approved decisions.

## Visual system and interaction

- Navy #102D4D for headings; blue #164E87 for primary actions.
- White cards on #F4F7FB; green #16805D, amber #B37500, red #C33B40.
- Grey text for unavailable information; alerts also contain written severity.
- Native sans-serif typography, consistent rounded cards and subtle shadows.
- Two rows of three KPIs preserve readable labels on tablets. Streamlit handles
  narrow layouts; mobile and tablet presentation still need visual review.
- Sidebar radio navigation and shared session-state filters. Filters persist
  across preview destinations; Reset clears global filters, not alert settings.
- Vessel/BL inspection only affects the detail panel, explicitly labelled;
  KPI scope always matches the global filters.
- Native sortable tables, literal search and CSV export of searched rows.
- Source/snapshot indication makes the frozen demo time explicit. It is not a
  live freshness claim. No fragile Streamlit internal CSS selectors are used.

## Data requirements and proposed semantics

The 24 fictional records use three demo vessels and two fictional shipping lines.
Identifiers are labelled DEMO and are not valid operational container numbers.
Demo snapshot: 16 November 2026, Asia/Kuala_Lumpur; no moving deadlines on refresh.
RFC labels are illustrative; the meaning and allowed states require confirmation.

Counting unit for this preview: unique (BL Number, Container Number), with one
row per pair. The demo loader rejects duplicate pairs and invalid date formats.
For real imports, versioned events, reused BL numbers and container reuse require
an agreed shipment key and explicit duplicate-resolution workflow.

Delivered = explicit Delivered status; pending = explicit Pending status. Rate =
delivered / total, or Not Available for zero containers. Overdue = pending with
delivery target strictly before snapshot. Approaching = pending target between
snapshot and snapshot + configurable warning days, inclusive. These are proposed
delivery-target rules only. Unknown dates cannot establish lateness.

Phase 3 needs actual column names, representative anonymized files, date formats,
timezone conventions, source update timestamp, status vocabulary, RFC definition,
shipment key, delivery target definition, and which date global filters should use.
Arrival Date is the preview default. Lead time is proposed as delivery minus
arrival, in calendar days; confirm the actual business start/end fields before use.

DEM/DET requires actual free-time start events, separate DEM/DET allowances,
calendar rules, discharge/gate-out/empty-return dates as applicable, tariff tiers,
currency and shipping-line rules. None can be inferred from delivery targets.
Root-cause analysis requires recorded cause/category fields and delay baselines.
Missing rules will show Requires Configuration; missing measurements Not Available.

## Approval boundary

Implemented in prototype: navigation, persistent demo filters, reset, six KPIs,
demo warning threshold, alerts, vessel/BL summary, searchable/sortable register,
CSV download, empty state and calculation notes.

Planned only: six analytics/explorer pages, charts, real uploads, explicit column
mapping, validation reports, Excel export, DEM/DET calculations, production data
freshness, automated production tests and cloud deployment. No database or external
notifications. Plotly and OpenPyXL are reserved dependencies for the approved stack.

Phase 3 must wait for user approval. The screenshot can be supplied later to refine
visual fidelity without claiming an analysis that has not happened.
