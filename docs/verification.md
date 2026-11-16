# Verification — Streamlit application

## Public GitHub preparation — 17 November 2026

**Local readiness: Ready for a synthetic public demonstration.** Publishing and
deployment remain subject to explicit approval. Intended repository:
`nazursyahmi/ffm-warehouse-import-container-monitoring`; entrypoint: `app.py`;
Python version: **3.12**. No GitHub repository was created or queried, and no
files were committed, uploaded, pushed or deployed.

### Git and publication scope

`git rev-parse`, `git status` and `git remote -v` reported that the project is
not a Git repository. There is no local `.git`, tracked-file list, Git history,
branch or origin remote to audit. No exposure in history can be established or
ruled out for a future/imported repository. Repeat the staged-file and history
review before publishing. The project remains uninitialized.

Expanded `.gitignore` exclusions cover virtual environments, caches, local editor
and agent state, cloud credentials, secret files, private keys, operational
datasets, uploads, workbooks, databases, logs, archives and temporary files.
The only data exception is the audited `data/demo_shipments.csv`. A temporary,
isolated Git repository was used to execute `git check-ignore --no-index` against
24 excluded sample paths and 9 includable application/demo paths: all passed.
The temporary repository was removed; it was never connected to a remote.

### Security and privacy findings

- Inspected 51 files outside local dependency/cache directories. The only
  dataset/workbook/archive/private-key candidate was `data/demo_shipments.csv`.
  All 24 fixture rows have synthetic container, BL, vessel and shipping-line
  identifiers. No operational source workbook or project credential was found.
- A heuristic credential scan found 7 matches in the vendored Plotly JavaScript.
  Context review identified library URL construction and example/error-message
  strings rather than project-supplied credentials. No project secret was
  identified. This local pattern scan is not a guarantee or an online security
  advisory/dependency-vulnerability audit.
- Runtime imports use Streamlit, Pandas, Plotly, OpenPyXL and Python's standard
  library; `tzdata` supplies timezone data. All five requirement pins match the
  installed environment. No local path, editable install or URL dependency is
  required. All seven Streamlit render modules are present.
- Uploads, original rows, validation reports and generated export bytes stay in
  session memory. No application shipment logging, disk persistence, global
  data cache, database or external-service integration was found. CSV/Excel
  exports intentionally include the current session's matching data and escape
  spreadsheet formula-like values and headers. They do not anonymize records.
- On Streamlit hosting, uploads travel to the server. There is no application
  authentication or guaranteed immediate memory erasure. Unexpected errors may
  reach hosting logs. Use synthetic/anonymized data for public demonstrations;
  do not treat this as an approved confidential-data hosting environment.
- Disabled browser exception details and static-directory serving in
  `.streamlit/config.toml`; usage telemetry remains disabled. No secrets are
  required for the demonstration. Streamlit's existing UI/theme was preserved;
  the separately maintained animated red/black HTML UI is not the Python UI.

### Executed local checks

- Python 3.12.10; all **32 Python unit/AppTest tests passed**. Coverage includes
  all seven pages, navigation, filters, empty/incomplete inputs, validation,
  calculations, CSV/XLSX processing and export preparation.
- `compileall` for the app, components, services, pages and tests: exit 0.
- `pip check`: **No broken requirements found**.
- Configuration TOML and installed dependency pins checked successfully.
- AppTest launched `app.py` while the working directory was outside the project:
  no exceptions and the 24-row demo loaded correctly.
- Two independent AppTest sessions retained distinct active datasets; loading
  a synthetic single-row dataset in one did not replace the other's demo.
- Headless Streamlit startup on loopback: health endpoint returned **200 / ok**.
  The temporary server was stopped after verification.

No clean Linux install, registry resolution, GitHub access, browser visual review
or actual Community Cloud build/deployment was performed during preparation.
These are remaining verification limits, not claims of successful deployment.
The README now leads with Streamlit launch/deployment and public-data guidance;
the offline HTML documentation and functionality remain available below it.

## Earlier implementation verification — 16 November 2026

## Executed environment and result

Project: `C:\Users\nazur.syahmi\ffm`. Python 3.12.10, Streamlit 1.67.0,
Pandas 2.3.3, Plotly 6.9.0, OpenPyXL 3.1.5; exact application dependencies
are recorded in requirements.txt.

Executed after the implementation/review fixes:

```text
.venv/Scripts/python -m unittest discover -s tests -v
Ran 32 tests in 24.547s
OK

.venv/Scripts/python -m compileall -q app.py components services pages tests
Exit 0

.venv/Scripts/python -m pip check
No broken requirements found.

GET http://127.0.0.1:8501/_stcore/health
ok
```

During the earlier verification the local app ran on port 8501; this is not a
claim that it is currently running. The health endpoint confirms server
availability; AppTest confirms actual application rendering, not just HTTP health.
Streamlit's test runner emits the expected bare-mode ScriptRunContext notice.
There were no application exceptions in the final test run.

## Automated coverage

- 8 application tests: all seven destinations; actual Plotly charts on supported
  demo analyses; minimal optional-field and empty datasets across all pages;
  supplied root causes; explorer search; on-demand Excel export; supplied DEM
  tariff calculation; dataset activation resets filters/rules; pending-only delay
  analysis even when no lead-time measurements exist.
- 7 calculation tests: actual lead times, due-today inclusivity, Unknown status
  exclusion from Pending, missing tariffs, known/future stops, confirmed derived
  free-day deadlines/open-state assumptions, delivery delay, future start and
  deadline-before-start contradictions.
- 15 validation/import/export tests: explicit aliases and status/date mapping,
  original-frame preservation, required columns, all-member duplicate quarantine,
  missing keys, invalid dates, unknown statuses, chronology, empty/header-only
  inputs, negative rates, exact row widths, preserved blank records, multiple
  Excel sheets, corrupt workbook XML, CSV/XLSX round trips and leading zeros,
  formula-like values and header escaping, complete unavailable optional schema.
- 2 preserved preview tests: exact demo KPIs and zero denominator, inclusive
  warning-window boundary, filtering, navigation to every destination, preserved
  filters, reset, literal search with no results and incompatible filter empty state.

## Confirmed issues resolved

An independent read-only code review found export headers could become formulas,
malformed XLSX XML escaped readable error handling, pending-only datasets lost
delay analysis on Lead-Time Analysis, and a future exposure start could still
produce an estimate. Each now has a regression test and passes. Additional
parser tests exposed Pandas implicitly treating extra CSV fields as an index and
dropping blank records; strict bounded CSV loading now rejects width errors and
retains blank records for explicit quarantine.

## Verification limits

Browser access inventory returned **browser access host unavailable** and native
app discovery timed out. Desktop/tablet/mobile visual review, browser file-picker
gestures and downloaded-file interactions were not exercised. AppTest covers
the page rendering/state and Excel prepare action; actual import/export bytes,
worksheets, mapping and normalization are tested directly with real CSV/XLSX
data. This is not a claim of browser end-to-end upload/download verification.

No actual operational workbook or screenshot was supplied. No shipping-line
contract reconciliation, user acceptance, 100,000-row load benchmark, Linux cloud
build, external notifications, authentication or cloud deployment was tested.
The source limits are enforced; real-world maximum-size performance remains
to be measured. There are no remaining confirmed test failures in the final run.

## Final UI/UX review checklist

Check desktop (1440 px), tablet and mobile (390 px): sidebar collapse/filter
discoverability, KPI wrapping, severity readability, chart labels/tooltips,
horizontal table scrolling, long vessel/BL names and export discoverability.
Use an anonymized representative workbook to review mapping, excluded-row
messages, missing-data states, source freshness and alert scope with operations.
Reconcile representative DEM/DET examples to actual contracts before relying
on estimated charges. Deployment remains subject to the user's approval.

The independent reviewer also confirmed all four review fixes and reran the final
suite separately: 32 tests passed. No files were edited by the reviewer.
