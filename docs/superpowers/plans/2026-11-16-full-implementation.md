# FFM Logistics Full Implementation Plan

> Native execution in the existing project, as authorized by the user. Use executing-plans and test-driven-development. No second directory, git push or deployment.

**Goal:** Complete the seven-page system, verification and deployment preparation.
**Architecture:** Original source data stays separate from a canonical analytics frame. Explicit column/status/date mapping produces a validation report and quarantines ambiguous keys and invalid records. All pages consume the same filtered frame and calculations. Session-only storage avoids server-side shipment persistence.
**Tech stack:** Python 3.12, Streamlit, Pandas, Plotly, OpenPyXL.
**Spec:** Original master prompt, approved design in docs/design-preview.md, and full implementation approval of 16 November 2026.

## Constraints
- Preserve the current project directory and Phase 2 functionality.
- No invented tariff, free-day allowance or cause data; unknowns remain visible.
- No deployment or publishing. No confidential files committed or logged.

## Review focus
- Duplicate container events and missing identities must not inflate totals.
- Ambiguous dates, negative durations and conflicting statuses require visible reports.
- Empty and optional-field-only inputs must render every page without errors.
- Exposure needs known deadlines, closure/open-state and configured rates/currency; currencies must never be summed together.
- Dataset replacement must reset stale filters while navigation preserves current filters.

## Tasks
1. [x] Write failing service tests for imports/exports, validation, counting, lead time, deadline boundaries and exposure; run with unittest.
2. [x] Implement services/data_validation.py (canonical schema, ValidationResult, normalize), services/data_loader.py (CSV/XLSX reading), services/calculations.py (consistent rules), services/analytics.py (grouped summaries), services/exports.py (safe CSV/XLSX).
3. [x] Run the service suite, fix confirmed failures and add regression checks.
4. [x] Extend app.py and components/data_management.py with explicit import preview, mapping, validation/quarantine, activation and source freshness. Extend shared filters and settings with persistent session state and dataset reset.
5. [x] Implement all seven page render functions, shared charts/tables/alerts, real exports, details, comparisons and configuration gaps. Retain the current navigation and vessel/BL controls.
6. [x] Extend AppTest checks for every page, empty/incomplete datasets, filtering/reset/navigation, configurations, searches and real analytics branches. Run full suite and Python compilation.
7. [x] Check desktop/mobile layout if a browser is available. Document actual evidence and limits; review implementation against the requirements.
8. [x] Update README, data dictionary/configuration documentation, requirements, ignore rules and cloud instructions. Confirm local health without deploying.

Run: `.venv/Scripts/python -m unittest discover -s tests -v`.
Expected final result: all tests pass with no application exceptions. Report any unverified browser behavior separately.

## Execution ledger

- All eight tasks completed, with browser inspection attempted but unavailable.
- Ruling: work directly in the supplied project, without a worktree or git
  operations, as explicitly requested; the directory is not a git checkout.
- Service and UI tests were added before their implementations. Regression tests
  reproduced malformed CSV/XML, export-header formulas, pending-only delay loss
  and future-start exposure; fixes passed the complete suite.
- Independent read-only code review completed; its four important findings are
  fixed and covered by tests. No unrelated files were changed or pushed.
- Final executed result: 32 tests pass; compileall exit 0; pip check clean; local
  health returns ok. Full evidence/limits in docs/verification.md.
- Pinned requirements, config, ignore patterns, README and data configuration
  documentation prepared. Official Streamlit deployment instructions checked.
- Ruling: desktop/mobile visual QA cannot be claimed because the browser access
  host is unavailable. Cloud build and actual contract validation remain untested.
- No deployment performed. Waiting for the user's final review.
