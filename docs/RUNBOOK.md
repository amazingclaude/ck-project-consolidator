# CK Project Consolidator Runbook

## Purpose

This runbook covers deployment, verification, monitoring, incident diagnosis, recovery, and routine maintenance for CK Project Consolidator on Azure App Service.

Architecture and implementation details are in [TECHNICAL_HANDOVER.md](TECHNICAL_HANDOVER.md). User procedures are in [USER_GUIDE.md](USER_GUIDE.md).

## Service Dependencies

| Dependency | Impact if unavailable |
|---|---|
| Azure App Service | Entire application unavailable |
| Azure SQL Database | Plans, rows, portfolio, metrics, and AI context unavailable |
| Main Azure Blob Storage | Plan creation, replacement, original download, and deletion fail |
| Assumptions JSON file | Application may fail at startup; updates or calculations may fail |
| MPP converter input storage | MPP uploads fail |
| External MPP converter | Uploaded MPP files remain unconverted |
| MPP converter output storage | Forecast-gate refresh fails |
| Azure AI Foundry | AI Assistant and plan AI analysis fail; core planning remains available |

## Required Access

Operators should have:

- App Service configuration, deployment, restart, and log access.
- Azure SQL query and backup/restore access.
- Read/write access to the main plan Blob container.
- Read/write access to the MPP input container.
- Read access to the MPP output container.
- AI Foundry deployment or project-agent access.
- Access to the source repository and deployment method.

## Production Configuration

Set these App Service application settings:

```text
ENV=production
ASSUMPTIONS_PATH=data/assumptions.json
AZURE_SQL_CONNECTION_STRING=<ODBC connection string>
AZURE_STORAGE_CONNECTION_STRING=<plan storage connection string>
AZURE_STORAGE_CONTAINER=plans
AZURE_STORAGE_CONNECTION_STRING_MPP_CONVERTER=<converter storage connection string>
AZURE_STORAGE_CONTAINER_MPP_CONVERTER_IN=mppinputnew
AZURE_STORAGE_CONTAINER_MPP_CONVERTER_OUT=<actual output container>
AI_FOUNDRY_ENDPOINT=<endpoint>
AI_FOUNDRY_API_KEY=<direct mode only>
AI_FOUNDRY_DEPLOYMENT=<direct mode where required>
AI_FOUNDRY_AGENT_NAME=<agent mode only>
AI_FOUNDRY_AGENT_VERSION=<agent mode only>
AI_FOUNDRY_API_VERSION=2024-05-01-preview
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

Do not rely on the default MPP output-container name. `app.py` defaults to `mppoutput`, while repository documentation and the environment template use `mppoutputnew`.

The startup command must be:

```bash
gunicorn -k uvicorn.workers.UvicornWorker app:app --bind=0.0.0.0:$PORT
```

Do not point the App Service startup command at `/home/site/wwwroot/start.sh`; an Oryx-built application may run from an extracted temporary directory.

## First Deployment

### 1. Initialize Azure SQL

Run `db_schema.sql` against the target database.

Verify these tables exist:

```sql
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN (
    'plans',
    'plan_rows',
    'stage_gate_plans',
    'stage_gate_rows'
);
```

For an older database, confirm the AI analysis columns exist:

```sql
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'plans'
  AND COLUMN_NAME IN ('ai_analysis', 'ai_analysis_generated_at');
```

Apply the migration comments in `db_schema.sql` if required.

### 2. Prepare Assumptions

Create `data/assumptions.json` from `data/assumptions.example.json` and enter approved production values.

Treat this file as production data:

- Back it up outside the deployment artifact.
- Confirm the runtime path is writable.
- Restore it after deployment if the deployment process replaces it.

### 3. Build the Frontend

From the repository root:

```bash
npm install
npm run build
```

The build must create `dist/index.html` and `dist/assets/`.

### 4. Deploy

Deploy the repository with the generated `dist/` directory included. Ensure `.python-version` remains present so Oryx recognizes Python 3.11.

If `SCM_DO_BUILD_DURING_DEPLOYMENT` was newly enabled, redeploy. Restarting alone does not trigger an Oryx build.

## Routine Deployment

### Pre-deployment

1. Record the currently deployed commit or artifact version.
2. Back up `data/assumptions.json`.
3. Confirm recent Azure SQL point-in-time restore coverage.
4. Confirm Blob soft delete or another recovery mechanism is enabled.
5. Review SQL schema changes and apply them before code only when backward compatible.
6. Run:

```bash
npm install
npm run build
```

There is currently no automated test suite. Manually verify critical workflows in a non-production environment.

### Post-deployment Smoke Test

1. Check the process endpoint:

```bash
curl -i https://<app-host>/api/health
```

Expected response:

```json
{"status":"ok"}
```

2. Open the application and verify the React shell loads.
3. Open **Business Planning** and confirm plans load from SQL.
4. Open an existing plan and confirm metrics and charts load.
5. Download the business-plan template.
6. Open **Portfolio Overview** and load a known planning year.
7. Download the stage-gate template.
8. If AI is enabled, send a harmless test question.
9. If MPP ingestion changed, test it with a non-production work package.

`/api/health` is not a readiness check. A successful health response does not prove any external dependency works.

## Monitoring

At minimum, configure:

- App Service availability checks against `/api/health`.
- HTTP 5xx and latency alerts.
- App restart and memory alerts.
- Azure SQL availability, connection, CPU, storage, and deadlock alerts.
- Blob Storage availability and authorization-failure alerts.
- MPP input backlog and converter failures.
- AI Foundry request failures and quota/rate-limit alerts.

The application has no structured logging or custom telemetry. Enable App Service application logging and retain platform logs long enough for incident review.

## Backup and Recovery

### Azure SQL

Use Azure SQL automated backups and point-in-time restore. Periodically test restoration to a separate database.

Before destructive schema or bulk-data work, take an additional export or restore point according to organizational policy.

### Plan Blob Storage

Enable Blob soft delete and, where appropriate, versioning. SQL stores Blob paths but is not a backup of the uploaded files.

### Assumptions

Back up the exact production `assumptions.json` before every deployment and after approved assumption changes. The example file is not a production backup.

### MPP Converter Storage

Retention depends on the external converter design. Preserve source `.mpp` files long enough to reprocess them and retain converted CSVs long enough to investigate forecast-sync issues.

## Incident Triage

### Entire Site Returns 5xx or Does Not Start

Check:

1. App Service deployment and startup logs.
2. Startup command.
3. Presence of `requirements.txt`, `.python-version`, and `dist/`.
4. Whether Oryx created the Python environment.
5. Whether `ASSUMPTIONS_PATH` exists and contains valid JSON.
6. Whether required App Settings are present.

Common signatures:

```text
ModuleNotFoundError: No module named 'uvicorn'
Could not find virtual environment directory .../antenv
Could not find build manifest file
```

Response:

1. Confirm `.python-version` is deployed.
2. Confirm `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.
3. Redeploy after setting it.
4. Use the direct Gunicorn startup command.

### UI Loads but API Calls Fail

Check `/api/health`, then call a dependency-backed endpoint:

```bash
curl -i https://<app-host>/api/plans
```

Interpret common errors:

- `503 AZURE_SQL_CONNECTION_STRING is not configured`: restore the SQL setting.
- pyodbc or driver error: confirm Oryx installed Python packages and the App Service image provides ODBC Driver 18.
- `500 AZURE_STORAGE_CONNECTION_STRING is not configured`: restore plan storage configuration.
- Browser-only failures in production: confirm frontend and API use the same host and `ENV=production`.

### Plans Do Not Load

1. Check Azure SQL connectivity.
2. Verify `plans` and `plan_rows` exist.
3. Query counts:

```sql
SELECT COUNT(*) AS plan_count FROM plans;
SELECT COUNT(*) AS row_count FROM plan_rows;
```

4. Check for plans without rows:

```sql
SELECT p.plan_id, p.plan_name, COUNT(r.row_id) AS row_count
FROM plans p
LEFT JOIN plan_rows r ON r.plan_id = p.plan_id
GROUP BY p.plan_id, p.plan_name
HAVING COUNT(r.row_id) = 0;
```

A failed upload can leave plan metadata and a Blob without parsed rows. Validate the workbook's `Sheet1`, then replace the file or delete and recreate the plan.

### Plan File Upload Fails

Check:

- Main Blob connection string and container access.
- Azure SQL connectivity.
- Workbook has a readable `Sheet1`.
- App Service request-size and timeout limits.
- File is a valid Excel workbook even though the UI accepts other extensions.

The backend always parses uploads with `pandas.read_excel`; CSV and PDF uploads offered by the current file picker will fail parsing.

### Original Plan Download Is Missing

1. Read the plan's expected Blob path:

```sql
SELECT plan_id, plan_name, blob_path, file_name
FROM plans
WHERE plan_id = '<plan-id>';
```

2. Check for blobs under `<plan-id>/`.
3. Recover the blob from soft delete/versioning or restore the original upload.
4. If restored under a different path, update `plans.blob_path` carefully.

The download endpoint currently selects the first Blob under the plan prefix rather than reading `blob_path` directly.

### Metrics or Charts Are Wrong

1. Export the current backend workbook from the plan.
2. Check `target_sockets`, monthly targets 1-18, and per-socket CapEx.
3. Check current assumptions.
4. Confirm the plan year.
5. Remember peak installer resource uses months 1-12, while incurred CapEx uses months 1-18.
6. Regenerate AI analysis after correcting source data.

Do not edit derived values only in the original uploaded workbook; SQL rows are the operational source of truth after ingestion.

### Assumption Updates Fail or Revert

Check:

1. `ASSUMPTIONS_PATH` resolves to the expected file.
2. The App Service process can write to the file.
3. The file is valid JSON.
4. Only one Gunicorn worker is running.
5. A deployment has not replaced the file.

Recovery:

1. Restore the approved assumptions backup.
2. Restart the app so the in-memory dictionary reloads.
3. Verify `GET /api/assumptions`.

### Stage-Gate Upload Fails

Check:

- File extension is `.xlsx` or `.xls`.
- Workbook contains `Sheet1`.
- `Sheet1` contains `Work Package`.
- Week headers are numeric.
- Gate cells contain values 1-4.
- Azure SQL is available.

Warning: replacement deletes the existing year before inserting the new plan. If replacement fails after deletion, restore by uploading the last known-good stage-gate workbook.

### MPP Upload Is Rejected

Check:

- Every selected file ends in `.mpp`.
- Each filename stem exactly matches a stage-gate work package after trimming and case normalization.
- At least one stage-gate plan contains that work package.
- Converter input Blob settings are correct.

The validation searches work packages across all stage-gate years, not only the year later selected for sync.

### MPP Forecast Refresh Finds No Data

1. Confirm the stage-gate plan exists for the selected year.
2. Confirm `.mpp` files reached the input container.
3. Confirm the external converter completed.
4. Confirm CSV files exist in the configured output container.
5. Confirm CSVs contain `TaskName`, `StartDate`, `FinishDate`, and `WeekOfYear`.
6. Confirm task names match the `N. Gate M` pattern.
7. Confirm gate `FinishDate` values fall in the selected year.
8. Confirm each CSV filename stem matches the stage-gate work package.

If the API reports zero updated rows, conversion succeeded but names did not match.

### AI Assistant or AI Analysis Fails

Direct mode:

- Check endpoint, API key, deployment name, API version, outbound connectivity, quota, and rate limits.

Agent mode:

- Check the endpoint includes `/api/projects/`.
- Check agent name and version.
- Confirm the App Service managed identity has access.
- Confirm `DefaultAzureCredential` can resolve the intended identity.

AI failures do not require taking the planning application offline. Communicate the degraded feature and continue monitoring core workflows.

## Data Repair Procedures

### Remove Orphaned Plan Rows

Foreign keys should prevent normal orphan creation. Verify before any repair:

```sql
SELECT r.row_id, r.plan_id
FROM plan_rows r
LEFT JOIN plans p ON p.plan_id = r.plan_id
WHERE p.plan_id IS NULL;
```

Do not delete data without a backup and confirmed incident scope.

### Find Missing Plan Blobs

Export this SQL inventory:

```sql
SELECT plan_id, plan_name, blob_path, file_name, created_at
FROM plans
ORDER BY created_at DESC;
```

Compare it with Blob prefixes. Restore missing files from Blob recovery or the original source.

### Restore a Deleted Stage-Gate Year

There is no application undo.

1. Locate the last approved workbook.
2. Upload it through **Settings > Data Ingestion** with the original planning year.
3. Re-run MPP forecast refresh after conversion outputs are available.
4. Verify work-package counts and health metrics.

For exact historical recovery, restore Azure SQL to a separate database and extract the relevant `stage_gate_plans` and `stage_gate_rows` records.

## Rollback

### Application Rollback

1. Redeploy the previous known-good artifact or use an App Service deployment slot swap.
2. Restore the matching assumptions file if it changed.
3. Restart the app.
4. Run the post-deployment smoke test.

### Database Rollback

Prefer forward-fix migrations. If rollback is unavoidable:

1. Stop writes or put the application into a controlled maintenance state.
2. Restore Azure SQL to a separate server/database.
3. Validate row counts and critical records.
4. Switch the connection string only after approval.
5. Retain the original database for investigation.

Code rollback alone does not reverse schema or data changes.

## Routine Maintenance

Weekly:

- Review App Service 5xx responses and restarts.
- Review SQL health and storage.
- Review failed MPP conversions and input backlog.
- Review AI failures and quota.

Monthly:

- Test plan and stage-gate template downloads.
- Test a non-production plan upload and export.
- Confirm backup retention and Blob recovery settings.
- Review stale converted CSVs and storage growth.
- Confirm assumptions backup matches production.

Before rotating credentials:

1. Update App Service settings.
2. Restart the app.
3. Test the affected dependency.
4. Revoke the old credential only after verification.

## Escalation Information to Capture

When escalating an incident, include:

- UTC start time and latest occurrence.
- App Service name, deployment version, and region.
- Affected URL and HTTP status.
- Relevant App Service log excerpt.
- Whether `/api/health` succeeds.
- Whether Azure SQL and Blob Storage are healthy.
- Planning year, plan ID, or work package involved.
- Recent deployment, credential, assumption, schema, or data changes.
- Steps already attempted and their outcomes.

