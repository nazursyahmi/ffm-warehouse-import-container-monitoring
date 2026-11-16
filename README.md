# FFM Logistics — Warehouse Import Container Monitoring

## Streamlit application and public repository preparation

The Streamlit application entrypoint is **`app.py`**. The intended public GitHub
repository is **`nazursyahmi/ffm-warehouse-import-container-monitoring`**.
The repository has not been created or connected by this preparation work.
The separate offline HTML interface below is also preserved; Community Cloud
runs the Python application and does not run `index.html` as its entrypoint.

### Run Streamlit locally

Use **Python 3.12** from the project directory:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m streamlit run app.py
```

On Linux/macOS, use `.venv/bin/python` in place of `.venv\Scripts\python`.
No hardcoded machine path, API key, database, external service, or persistent
disk storage is required. Runtime dependencies are pinned in `requirements.txt`.
The startup fixture is **24 synthetic containers**, clearly labelled DEMO DATA,
with a fixed assessment date of 16 November 2026. The offline HTML simulation
described below is different: it has 180 animated random containers. Its recent
red/black styling and animation changes do not change the preserved Python UI.

### Public data and privacy

Publish code, static assets, configuration, documentation, tests and only the
audited `data/demo_shipments.csv` fixture. `.gitignore` excludes local environments,
editor/agent state, credentials, secrets, logs, temporary files, uploaded workbooks,
databases and other datasets. Ignore rules do not remove previously tracked files
or secrets from history. Review staged files and repeat the history audit if a
Git repository is initialized or imported later; do not upload the whole folder
as an archive, which bypasses ignore rules.

**Use synthetic or anonymized data on a public deployment.** This app has no
authentication. Streamlit uploads are transmitted to the app server and held in
the current session's memory; they are not browser-only. The app does not write
them to disk, cache them globally, log shipment rows, or deliberately share them
between sessions. Tables, original-source views, validation reports and exports
include the active session's data and are not anonymization tools. Users can
download the records they upload. Closing a tab does not guarantee immediate
memory erasure; hosting/session retention policies still apply. Unexpected
exceptions can appear in hosting logs, so confidential input is unsuitable for
this public demo. Detailed exception messages are disabled in the browser via
`client.showErrorDetails = "none"`. Telemetry and static-directory serving are
disabled. Hosting administrators retain their normal infrastructure access.

### Community Cloud deployment, after explicit approval

1. Create the approved PUBLIC repository named
   `nazursyahmi/ffm-warehouse-import-container-monitoring` only after approval.
2. Initialize/connect Git separately, inspect staged paths and contents, check
   history for secrets, then publish only reviewed files. No remote is configured
   by this preparation work.
3. In Streamlit Community Cloud, choose that repository and its actual published
   branch. Set **Main file path: `app.py`** and select **Python 3.12**.
4. No application secrets or `packages.txt` system packages are required. Keep
   `.streamlit/config.toml`, `requirements.txt`, `assets/styles.css`, all seven
   `pages/*.py`, `components/`, `services/`, and the demo CSV in the repository.
5. Once deployment is approved, check the cloud build logs and verify DEMO labels,
   all seven pages, navigation/filters and synthetic CSV/XLSX import/export.
   Sessions are temporary; restarts do not preserve uploads or user settings.

Local preparation does not verify a fresh Linux dependency installation, package
registry availability, GitHub repository permissions, or a Community Cloud build.
No repository, push, commit, remote change, or deployment was performed.

## Offline HTML dashboard

## Open the dashboard

**Double-click `index.html`** in this directory. Use a current Chrome or Edge
browser. Keep the `assets` folder beside `index.html`.

No server, terminal command, Python, Node.js, installation, account or internet
connection is needed to operate the HTML dashboard. All styles, icons, demo data
and charts are local. No shipment data is sent to a server or saved to browser
storage. Closing or refreshing the tab resets the active data and filters.

## Current interface

- Red/black dark theme, responsive sidebar and layout, minimum 14px interface
  text, professional SVG icons, static vessel illustration and delivery gauge.
- All seven pages: Container Monitoring, Overview, DEM / DET Analysis, Lead-Time
  Analysis, Performance Comparison, Root-Cause Analysis and Shipment Explorer.
- Global date/vessel/BL/status/line filters remain selected during navigation.
  Vessel/BL inspection narrows its own tables; KPI scope stays global.
- Literal search, sortable tables, pagination, source-row details and CSV/XLSX
  exports. Exports include all local search matches, not just the visible page.
- CSV/XLSX import, worksheet selection, explicit column/date/status mapping,
  validation report, all-member duplicate quarantine and reviewed activation.
- RANDOM DEMO DATA is labelled throughout the initial synthetic snapshot. Load time and
  supplied source update date are distinct. Missing freshness remains unavailable.
- DEM/DET deadlines and configured flat daily estimates retain separate
  currencies. Operational imports never receive invented tariffs or causes.

The HTML dashboard generates 180 random fictional containers on each opening and updates up to 54 containers (30% of the demo) every second, keeping identities stable. Wider randomized delivery-status swings make gauge and chart movement easier to see; they are fictional demonstration behavior. Gauges and charts retain their visual elements and draw intermediate values over 850 ms using animation frames. Gauge arcs and labels, bars, lines, pie segments and box samples interpolate instead of relying on Plotly transition support. Histogram counts are calculated before animation so bar heights can move smoothly. Reduced-motion preferences disable animation. These intermediate display values never change analytical results or exports. Automatic refresh pauses while the tab is hidden, a dialog is open, or filters and inputs are being edited. Selected filters and settings are preserved. Imported operational data does not auto-randomize.
Click **Randomize demo** for another dataset. It includes multiple vessels and
months, varied delivery times, sample delay categories and fictional MYR tariffs
to populate the illustrations and charts. DEM/DET flat-rate/open-end assumptions
are enabled only for this labelled simulation. Loading operational data resets
those assumptions and still requires actual configured inputs. Demo export
filenames include DEMO. The assessment date stays 16 November 2026 so generated
events and deadline calculations remain consistent; the shipment values vary.

## Import your data

1. Click **Import data**. Select a UTF-8 CSV or standard unencrypted XLSX, up to
   20 MB. Excel ZIP content is limited to 100 MB expanded, 100,000 data rows and
   1,024 columns. Choose the appropriate worksheet.
2. Inspect the source preview and map the fields. Container Number and BL Number
   are required. Choose text date format and source values meaning Delivered
   and Pending. Other statuses remain Unknown.
3. Click **Validate import**. Review the findings and quarantined rows. Nothing
   replaces the current dataset until you acknowledge the review and activate.
4. Configure assessment date, warning days and any confirmed DEM/DET rules using
   **Rules & alerts**. Activation resets previous filters and tariff assumptions.

Counting unit is one exact, trimmed BL/container pair. All duplicate members,
missing keys, malformed mapped dates/rates and contradictory chronology are
quarantined. Original source values remain visible in container details. Dates
are calendar dates; Excel time-of-day is ignored for actual date cells. Time-only
cells are not treated as shipment dates.

**Excel formulas are not evaluated.** Mapped formula cells are quarantined with
an explanation, including identifiers; cached results are not assumed current.
Paste values into a copy of the workbook before importing. Unmapped formula
columns are preserved as source metadata without affecting analytics. Headers
must contain literal names. Macros, .xls, encrypted files and ZIP64 are unsupported.

Compressed XLSX reading uses the browser's native ZIP decompression streams.
Use a current browser; if that feature is unavailable, CSV still works offline.
XLSX exports use a small local ZIP/XML writer. Numeric cells remain numeric and
formula-like strings/headers are escaped. XML control characters cause a readable
export error rather than silently removing text. Exported dates use ISO text.

For business definitions and formulas, see the in-app **Calculation rules**.
The existing [data configuration document](docs/data-configuration.md) also
records the canonical field meanings; its Streamlit-specific controls describe
only the retained Python version below.

## Verification and remaining review

Executed on 16 November 2026: **38 offline tests passed** and JavaScript syntax
checks passed. The Node test suite checks calculations, validation, CSV/XLSX bytes,
worksheet dates/metadata and generated markup for all seven pages. It uses the
existing local Python/OpenPyXL environment only for independent Excel/XML
interoperability checks. These tools are **not needed to run the dashboard**.

```powershell
node --test tests/motion.test.js tests/offline.test.js tests/offline-ui.test.js
node --check assets/dashboard.js
node --check assets/dashboard-core.js
node --check assets/workbook.js
```

Generated-page tests use a small document adapter; they are not browser visual
or click-through tests. Actual browser verification was blocked: the browser
access host was unavailable and Chrome native input reported **failed to activate
captured window** after a refreshed retry. Desktop/mobile rendering, browser file
picker and actual download gestures therefore still need manual review.

For manual review, double-click index.html, visit all seven pages, change and
reset filters, search/open a container, import an anonymized CSV and XLSX, review
quarantine messages and open both export formats. Check a narrow mobile-sized
window, long vessel/BL labels, chart readability and alert wording. Reconcile
actual contract examples before relying on charge estimates. Maximum-size
workbook performance has not been benchmarked.

## Local assets and unchanged files

Bootstrap **5.3.9 CSS** was downloaded once with explicit user approval and bundled
in `assets/bootstrap.min.css`. Its SHA384 was verified against the
[official Bootstrap download guide](https://getbootstrap.com/docs/5.3/getting-started/download/).
Its MIT license is bundled. Bootstrap JavaScript and Popper are not needed;
menus/dialogs use native browser controls and straightforward JavaScript.

Plotly.js **3.7.0** was copied from the already installed Plotly package; its
license is bundled. SVG icons are local inline drawings. `assets/workbook.js`
is isolated because ZIP/XML processing is necessary for Excel support without a
backend, build process or additional download. `assets/demo-data.js` generates random fictional shipments locally so file://
does not need fetch requests. The original CSV fixture remains available for
the preserved Streamlit version and reproducible tests.

The Python app, seven Streamlit page modules, data services, requirements and
configuration were preserved. No second project directory, external publication
or deployment was created. The older Streamlit verification results do not
establish that the new browser interface has passed visual testing.

<details>
<summary>Previous Streamlit application — preserved setup and documentation</summary>

# FFM Logistics — Import Container Monitoring System

A Python 3.12 Streamlit application for import container operations and management.
Starts with clearly labelled **DEMO DATA**; no live shipment connection is implied.
Full implementation stays in this project. Nothing has been published or deployed.

## Local setup and launch

In PowerShell:

```powershell
cd C:\Users\nazur.syahmi\ffm
python --version
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m streamlit run app.py --server.address 127.0.0.1
```

Open http://localhost:8501. Stop with Ctrl+C. Python must be 3.12; no shell
activation, credentials, database or external service is required. On Linux/macOS,
substitute `.venv/bin/python` for `.venv\Scripts\python`.

## Seven pages

| Page | Implemented functions |
|---|---|
| Container Monitoring | Six KPIs, deadline and data-quality alerts, vessel/BL selection, shipment counts/statuses/dates, searchable sortable register, exports |
| Overview | Status distribution, delivered throughput trend, monthly arrivals, delivery rate by arrival cohort, management alerts, shipment summary |
| DEM / DET Analysis | Separate deadline monitoring, remaining days, potential risk, return/movement states, optional confirmed free-day rule, flat-rate estimates by currency, vessel/BL/line breakdowns |
| Lead-Time Analysis | Actual start-event selection, average/min/max/sample count, histogram, monthly trend, vessel comparison, independently measured delays |
| Performance Comparison | Vessel, shipping line, arrival month and delivery status groups; selected-group comparisons, counts/rates/pending/overdue/available lead time |
| Root-Cause Analysis | Measured delays, container-day impact, recorded categories/causes, recurring causes across BLs and vessel patterns; no inferred causes |
| Shipment Explorer | Literal search, multi-column filters, explicit sorting, pagination, shipment details, original source row view, full-match CSV/Excel export |

Global date/vessel/BL/status/line filters persist across navigation; reset is
available. Date field is configurable and missing dates are explicitly included
or excluded. Six KPI cards use the global scope; inspection/explorer controls
only narrow their own tables. Alerts contain severity words as well as colors.

## Data import and business configuration

Read [Data configuration and formulas](docs/data-configuration.md) before loading
operational files. Use the Data source expander to upload UTF-8 CSV or XLSX,
choose a sheet, map columns, map statuses, select date format, validate and review
findings, then activate. Required fields are Container Number and BL Number.

The source is preserved in session memory. Duplicate keys, invalid nonblank
dates/rates, missing keys and inconsistent chronology are quarantined with
reports. Unsupported statuses remain Unknown; missing data is not zero-filled.
Exports escape formula-like text and headers. CSVs/XLSX files are not written to
the server. Source freshness is reported separately from load time.

DEM/DET requires real deadlines or an explicitly enabled start + free-day rule.
Charge estimates require confirmed flat daily rates, currency and a known end
or an explicit open-state assumption. No rates or allowances are pre-enabled.
Tiered, combined, business-day or inclusive-start contracts need externally
calculated deadlines or a future tariff extension. RFC and root-cause fields
are recorded source values; the demo supplies no real root-cause information.

## Tests and evidence

```powershell
.venv\Scripts\python -m unittest discover -s tests -v
.venv\Scripts\python -m compileall -q app.py components services pages tests
.venv\Scripts\python -m pip check
```

See [verification results](docs/verification.md) for the executed suite, limits
and review fixes. Streamlit AppTest exercises actual pages and callbacks. Its
bare-mode ScriptRunContext warning is a test-runner notice, not an application
exception. Browser visual checks, mobile presentation and browser-native file
picker/download gestures are distinct from the automated data pipeline tests.

## Streamlit Community Cloud deployment preparation

**Prepared, not deployed. User approval is required before publishing.**

1. After approval, place the code, demo fixture, requirements and configuration
   in the approved GitHub repository. Keep operational datasets, secrets, local
   `.venv` and uploaded files out of the repository. `.gitignore` excludes data
   files except the synthetic fixture/template; inspect staged files yourself.
2. Sign in to Streamlit Community Cloud and choose Create app / existing app.
3. Select the approved repository and branch; set the entrypoint to `app.py`.
4. In Advanced settings select **Python 3.12**. No app secrets are required for
   the current session-only design. Dependencies are pinned in requirements.txt;
   `.streamlit/config.toml` controls the theme, 20 MB upload cap and telemetry.
5. Review access/sharing controls before using confidential data. This application
   does not implement its own authentication. A repository being private does
   not by itself establish the intended viewer access policy.
6. Deploy only after approval, then inspect build logs, confirm demo labels,
   test all pages with demo data, test filters, validate a non-confidential CSV
   and XLSX, and verify exports before allowing operational use.

The app uses only Python dependencies; no packages.txt or database is required.
Session state and uploads are lost on refresh/session expiry or server restart;
there is no durable history, scheduled refresh or multiuser shared dataset.

Deployment steps checked against official Streamlit documentation on 16 November
2026: [deploy an app](https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/deploy),
[dependencies](https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/app-dependencies),
and [file organization](https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/file-organization).

## Remaining business inputs and final UI review

Supply anonymized representative data, the real screenshot, confirmed counting
identity, status mappings, RFC semantics, operational targets, shipment date
conventions, actual DEM/DET contracts and tariffs, currencies, source freshness
and recorded delay categories. No source screenshot was available in this session.

For final UI review: check 1440 px desktop, tablet and 390 px mobile; sidebar
collapse, card label wrapping, chart legibility, long vessel/BL labels and large
registers. Review default date scope, warning window and missing-data wording
with operations staff. Validate charge examples against actual contracts.

No email/WhatsApp notifications, database, authentication, tiered tariffs,
automated ingestion or cloud deployment are claimed.

</details>
