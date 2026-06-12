# CK Project Consolidator Technical Handover

## Purpose

This document gives a new engineering owner enough context to maintain and extend CK Project Consolidator. For user workflows, see [USER_GUIDE.md](USER_GUIDE.md). For deployment and production support, see [RUNBOOK.md](RUNBOOK.md).

## System Summary

CK Project Consolidator is a single-page React application backed by a FastAPI service. It manages EV infrastructure business plans, calculates delivery and CapEx metrics, tracks stage-gate health, imports converted Microsoft Project data, and calls Azure AI Foundry for plan analysis and chat.

The production deployment is a single Azure App Service:

```text
Browser
  |
  | HTTPS
  v
Azure App Service
  |- FastAPI API (/api/*)
  |- Built React application (dist/)
  |
  +--> Azure SQL Database
  |      plans, plan_rows, stage_gate_plans, stage_gate_rows
  |
  +--> Azure Blob Storage
  |      original business-plan files
  |
  +--> MPP converter storage account
  |      input .mpp files and output .csv files
  |
  +--> Azure AI Foundry
         chat completions or project agent
```

The MPP converter itself is external to this repository. This application uploads `.mpp` files to its input container and later reads converted CSV files from its output container.

## Technology

| Area | Implementation |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Charts and icons | Recharts, Lucide React |
| Backend | Python 3.11, FastAPI, Uvicorn/Gunicorn |
| Data processing | pandas, NumPy, openpyxl |
| Database | Azure SQL through pyodbc |
| File storage | Azure Blob Storage |
| AI | Azure AI Foundry |

There is no ORM, migration framework, automated test suite, CI/CD definition, or infrastructure-as-code in the repository.

## Repository Map

| Path | Responsibility |
|---|---|
| `app.py` | FastAPI application, API routes, calculations, ingestion, AI integration, and production static serving |
| `db.py` | Azure SQL connection and query helpers |
| `db_schema.sql` | Initial database schema and manual migration notes |
| `src/App.tsx` | Frontend route definitions |
| `src/pages/` | User-facing application screens |
| `src/components/` | Shared UI, charts, metrics, assumptions, and plan controls |
| `src/api/` | Browser API clients and TypeScript response types |
| `src/context/PlansContext.tsx` | Frontend plan state and CRUD orchestration |
| `data/ck_business_planning.xlsx` | Business-plan upload template |
| `data/ck_stage_gates_planning.xlsx` | Stage-gate upload template |
| `data/assumptions.example.json` | Example calculation assumptions |
| `notebook/` | Exploratory/reference notebooks for MPP and CapEx logic |
| `dist/` | Generated frontend build, ignored by Git |

## Runtime and Routing

During local development:

- Vite runs on `http://localhost:5173`.
- FastAPI runs on `http://localhost:8000`.
- Vite proxies `/api/*` to FastAPI.
- CORS permits only `http://localhost:5173` when `ENV` is not `production`.

In production:

- `npm run build` creates `dist/`.
- FastAPI serves `/assets` and falls back to `dist/index.html` for React routes.
- API routes remain under `/api`.
- Gunicorn starts the ASGI application with a Uvicorn worker.

## Persistence and Data Ownership

### Azure SQL

Azure SQL is the source of truth for operational records:

- `plans`: plan metadata, archive status, Blob path, and cached AI analysis.
- `plan_rows`: one row per business-plan work package.
- `stage_gate_plans`: one uploaded stage-gate plan per planning year.
- `stage_gate_rows`: work-package planned and forecast weeks for gates 1-4.

Foreign keys use `ON DELETE CASCADE` for plan rows and stage-gate rows.

All database helpers open a new pyodbc connection per operation. The `get_db()` context manager commits successful operations and rolls back exceptions within that operation.

### Blob Storage

The main Blob container stores original business-plan uploads under:

```text
{plan_id}/{original_filename}
```

The database holds the parsed plan rows. Re-downloading the original file and exporting current backend data are separate actions:

- `/api/plans/{plan_id}/file` returns the original uploaded file.
- `/api/plans/{plan_id}/export` builds a new workbook from current SQL data, metrics, incurred CapEx, and assumptions.

### Assumptions File

Assumptions are loaded from `ASSUMPTIONS_PATH` when `app.py` starts and held in the process-level `ASSUMPTIONS` dictionary. Updates rewrite the JSON file and then mutate the in-memory dictionary.

This has important consequences:

- Assumptions are global, not plan-specific.
- Multiple web workers would each have independent in-memory copies.
- An App Service filesystem may be deployment-scoped or replaced during deployment.
- A read-only or non-persistent path causes assumption updates to fail or disappear.

Production should use one worker unless this design is changed, and the assumptions file must be backed up before deployment.

## Core Workflows

### Business Plan Creation

1. The browser sends plan name, year, and file to `POST /api/plans`.
2. The API uploads the original file to Blob Storage.
3. Plan metadata is inserted into Azure SQL.
4. `Sheet1` is parsed with pandas.
5. Existing rows for the new plan ID are deleted and parsed rows are inserted.

Expected source columns include:

- `region_name` or legacy `custom_region_name`
- `contract_name`
- `work_package_name`
- `capex_bom_per_socket`
- `capex_installation_per_socket`
- `capex_connection_per_socket`
- `total_capex_per_socket`
- `target_sockets`
- `target_sockets_1` through `target_sockets_18`

Missing columns are generally defaulted to blank or zero. Non-numeric CapEx and socket values are coerced to zero.

Replacing a plan file deletes the old plan blobs, uploads the replacement, and replaces all SQL rows for that plan.

### Metrics

`compute_metrics_from_rows()` calculates:

- Target sockets from the stored `target_sockets` values.
- Peak installer resource from the highest monthly socket target in months 1-12.
- CapEx by multiplying target sockets by each row's stored cost per socket.
- Workforce by dividing total sockets by global annual capacity and rounding up.
- Asset value from total sockets multiplied by the global asset value per socket.

Although plans store 18 monthly targets, the peak installer metric currently considers only months 1-12.

### Incurred CapEx

`compute_incurred_capex_from_rows()` uses all 18 target months and the plan year's January as month 1.

Current rules:

- BOM: 100% before the midpoint of the first installation month.
- Connection: 40% before the first installation month and 60% distributed by installation month.
- Installation: 25% at the 25% cumulative threshold, 25% at 50%, 30% at 100%, and 20% after the final installation month.

Timing offsets come from global assumptions. The notebooks are useful references, but `app.py` is the production source of truth.

### Stage-Gate Upload

The API reads `Sheet1` and requires a `Work Package` column. Numeric week columns contain gate numbers 1-4. `_transform_stage_gates()` converts these cells into `planned_gate_1` through `planned_gate_4`.

Uploading a stage-gate file for an existing year deletes the old plan and its rows before creating the replacement.

### MPP Conversion and Forecast Sync

1. `.mpp` files are validated against any matching stage-gate work package, case-insensitively.
2. Valid files are uploaded to the converter input container using their original filenames.
3. An external service converts them into CSV files in the output container.
4. `POST /api/stage-gates/sync-mpp` scans every output CSV.
5. Rows matching `N. Gate M` in `TaskName` are extracted.
6. `FinishDate` is filtered to the selected planning year.
7. `WeekOfYear` is pivoted into forecast gates and matched to stage-gate work packages.

Required converted CSV columns are:

- `TaskName`
- `StartDate`
- `FinishDate`
- `WeekOfYear`

The CSV filename stem becomes the work package name.

### AI

There are two modes:

- Direct chat-completions mode uses `AI_FOUNDRY_API_KEY`.
- Project-agent mode is selected when the endpoint contains `/api/projects/` and uses `DefaultAzureCredential`, agent name, and agent version.

Per-plan AI analysis is cached in Azure SQL. It is not automatically invalidated when rows or assumptions change; users must regenerate it.

The AI Assistant builds a system prompt containing metrics for all plans with rows. Browser chat history is stored in local storage and is not stored server-side.

## API Summary

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Process-level liveness response |
| `GET, PUT /api/assumptions` | Read or update global assumptions |
| `POST /api/ai-assistant/chat` | Send a contextual AI chat request |
| `GET /api/plans` | List plans |
| `POST /api/plans` | Create and parse a plan |
| `GET, PATCH, DELETE /api/plans/{id}` | Read, update, archive, replace, or delete a plan |
| `GET /api/plans/{id}/rows` | Read parsed plan rows |
| `PUT /api/plans/{id}/rows/{row_id}` | Update a plan row |
| `GET /api/plans/{id}/metrics` | Calculate plan metrics |
| `GET /api/plans/{id}/capex-incurred` | Calculate incurred CapEx |
| `GET /api/plans/{id}/export` | Export current backend data |
| `GET /api/plans/{id}/file` | Download the original upload |
| `GET, POST /api/plans/{id}/ai-analysis` | Read or regenerate cached AI analysis |
| `POST /api/data-ingestion/stage-gates` | Replace the stage-gate plan for a year |
| `POST /api/data-ingestion/mpp` | Validate and upload MPP files |
| `GET /api/stage-gates/rows` | Read stage-gate rows by year |
| `PUT /api/stage-gates/rows/{row_id}` | Update planned or forecast weeks |
| `POST /api/stage-gates/sync-mpp` | Refresh forecast weeks from converted CSVs |
| `DELETE /api/stage-gates/plans/{year}` | Delete a stage-gate plan and rows |

FastAPI also exposes generated OpenAPI documentation at `/docs` unless disabled by the hosting environment.

## Configuration

| Variable | Required for | Notes |
|---|---|---|
| `ENV` | Production hosting | Set to `production` to disable local-development CORS middleware |
| `AZURE_SQL_CONNECTION_STRING` | All plan and stage-gate data | Requires ODBC Driver 18 and initialized schema |
| `AZURE_STORAGE_CONNECTION_STRING` | Plan file upload/download | Main plan Blob account |
| `AZURE_STORAGE_CONTAINER` | Plan file storage | Defaults to `plans` |
| `ASSUMPTIONS_PATH` | Application startup and calculations | File must exist and be writable for UI updates |
| `AZURE_STORAGE_CONNECTION_STRING_MPP_CONVERTER` | MPP ingestion and sync | Converter storage account |
| `AZURE_STORAGE_CONTAINER_MPP_CONVERTER_IN` | MPP upload | Defaults to `mppinputnew` |
| `AZURE_STORAGE_CONTAINER_MPP_CONVERTER_OUT` | Forecast sync | Set explicitly; repository defaults are inconsistent |
| `AI_FOUNDRY_ENDPOINT` | AI features | Endpoint format selects direct or agent mode |
| `AI_FOUNDRY_API_KEY` | Direct AI mode | Not used by project-agent mode |
| `AI_FOUNDRY_DEPLOYMENT` | Direct AI mode | Required for deployment-style endpoints |
| `AI_FOUNDRY_AGENT_NAME` | Agent mode | Required with agent version |
| `AI_FOUNDRY_AGENT_VERSION` | Agent mode | Required with agent name |
| `AI_FOUNDRY_API_VERSION` | Direct AI mode | Defaults to `2024-05-01-preview` |

`app.py` defaults the MPP output container to `mppoutput`, while `.env.example` and `README.md` use `mppoutputnew`. Always set `AZURE_STORAGE_CONTAINER_MPP_CONVERTER_OUT` explicitly.

## Security Model

This repository contains no application authentication, authorization, user roles, CSRF protection, or audit logging. It assumes access control is enforced outside the application, for example by App Service Authentication, a private network, or an authenticated reverse proxy.

All users who can reach the application can currently:

- Read all plans and planning context.
- Change shared assumptions.
- Replace or delete plan data.
- Delete stage-gate plans.
- Send plan context to the configured AI service.

Uploaded file size is not capped in application code. Secrets must remain in App Service configuration or an external secret store and must never be committed.

## Known Risks and Technical Debt

1. **Shallow health check:** `/api/health` does not test SQL, Blob Storage, assumptions, the MPP converter, or AI.
2. **No automated tests:** Calculation, ingestion, API, and UI regressions rely on manual verification.
3. **No schema migration tooling:** Database changes are applied manually from `db_schema.sql`.
4. **Non-atomic cross-service writes:** Blob and SQL operations are not one transaction. A failure can leave orphaned blobs, metadata without rows, or a replaced file with stale metadata.
5. **Stage-gate replacement window:** The existing year is deleted before the replacement plan is created and populated.
6. **Assumption persistence:** File-backed global assumptions are fragile under multiple workers and deployment replacement.
7. **Row ownership checks:** Row update endpoints accept a plan ID in the URL but update by `row_id` only.
8. **No request logging or telemetry:** Troubleshooting depends mainly on platform logs and returned errors.
9. **MPP output scans:** Every sync scans all CSV blobs in the output container.
10. **Cached AI staleness:** Plan analysis is not invalidated by data or assumption changes.
11. **Encoding artifacts:** Several source comments and strings contain mojibake characters and should be normalized carefully.
12. **Duplicated dead calculation code:** An alternative metrics implementation remains inside a triple-quoted block in `app.py`.

## Recommended Engineering Priorities

1. Add App Service authentication and role-based authorization.
2. Move assumptions into Azure SQL or durable configuration with concurrency control.
3. Add unit tests for metrics, incurred CapEx, and stage-gate transformation.
4. Add API integration tests using dependency-injected storage and database adapters.
5. Add database migrations and a version table.
6. Make plan and stage-gate replacement workflows recoverable and idempotent.
7. Add dependency-aware readiness checks and structured telemetry.
8. Add CI/CD that builds the frontend, runs tests, and deploys an immutable artifact.

## Change Checklist

Before changing calculations or ingestion:

1. Confirm whether the production rule is in `app.py`, not only a notebook.
2. Update frontend TypeScript types if API response shapes change.
3. Preserve template compatibility or publish a versioned replacement.
4. Test both new uploads and replacement uploads.
5. Verify current exports and AI context reflect the new calculation.
6. Document required SQL migration and rollback steps.

