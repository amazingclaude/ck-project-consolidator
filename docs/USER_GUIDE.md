# CK Project Consolidator User Guide

## Overview

CK Project Consolidator helps teams manage EV charging infrastructure business plans, review delivery and cost projections, monitor stage-gate health, and explore planning data with AI.

Use the navigation on the left to open:

- **Home** - shortcuts to the main areas of the application.
- **Business Planning** - create, review, edit, archive, export, and delete plans.
- **Portfolio Overview** - monitor stage-gate performance by planning year.
- **AI Assistant** - ask questions about planning, costs, schedules, and delivery.
- **Settings** - upload source data or delete stage-gate plans.

## Getting Started

For the best results:

1. Download the relevant template before preparing a new file.
2. Keep work package names consistent across business plans, stage-gate files, and Microsoft Project files.
3. Select the correct planning year when creating or uploading data.
4. Review calculated metrics and assumptions after each upload.

## Business Planning

### Create a Plan

1. Open **Business Planning**.
2. Select **Download Template** and complete the spreadsheet.
3. Select **New Plan**.
4. Enter a plan name and business planning year.
5. Upload the completed file.
6. Select **Create Plan**.

The new plan appears under **Active Plans**. Select its name or **View** from its menu to open the plan dashboard.

### Review a Plan

The plan dashboard includes:

- Target sockets and estimated sites.
- Total CapEx and average CapEx per socket.
- Senior Delivery Manager and CK Delivery Manager requirements.
- Estimated asset value.
- Monthly and cumulative socket targets.
- Total monthly CapEx.
- Monthly BOM, connection, and installation costs.
- AI-generated plan analysis.

Charts and metrics are calculated from the uploaded plan rows and the current assumptions.

### Modify Plan Data

1. Open a plan.
2. Select **Modify**.
3. Update the plan name, CapEx-per-socket values, or monthly socket targets.
4. Select **Save** to remain on the edit screen, or **Done** to save and return to the dashboard.

Changing a CapEx component recalculates total CapEx per socket. Changing monthly targets recalculates the row's total target sockets.

### Modify Assumptions

1. Open a plan.
2. Expand the assumptions section.
3. Select the modify control.
4. Update delivery capacity, installer resource, average sockets per site, asset value, or CapEx timing.
5. Save the changes.

The dashboard refreshes its calculations after the assumptions are saved. Assumptions are shared application settings, so changes may affect calculations for other plans.

### Generate AI Analysis

On a plan dashboard, find **AI Analysis** and select **Generate**. Select **Regenerate** after changing plan data or assumptions to produce an updated analysis.

AI features require the application's AI service to be configured and available.

### Download, Archive, or Delete a Plan

Open the plan card's menu in **Business Planning**:

- **Download Excel** exports the current plan data.
- **Archive** moves the plan to **Archived Plans** without deleting it.
- **Unarchive** returns an archived plan to active plans.
- **Delete** permanently removes the plan after confirmation.

Deletion cannot be undone.

## Stage Gates and Portfolio Health

### Upload a Stage-Gate Plan

1. Open **Settings** and select **Data Ingestion**.
2. In **Stage Gates Planning upload**, select **Download Template**.
3. Enter the **Stage Gate Plan Year**.
4. Drop the completed Excel file into the upload area or select **Choose Excel file**.
5. Confirm that the success message shows the expected number of work packages.

Open **Portfolio Overview** and select the same planning year to review the uploaded data.

### Upload Microsoft Project Files

1. Open **Settings** and select **Data Ingestion**.
2. In **Microsoft Project upload**, drop one or more `.mpp` files into the upload area or select **Choose MPP files**.
3. Confirm that every file was accepted for conversion.

Each `.mpp` filename must match a work package in the stage-gate rows. All selected files are validated before any of them are uploaded.

After conversion has completed:

1. Open **Portfolio Overview**.
2. Select the relevant planning year.
3. Select **Refresh forecast gates from MPP**.
4. Confirm the refresh.
5. Review the reported number of updated rows.

### Interpret Health Status

A gate is assessed only when both planned and forecast weeks are available.

| Gate status | Forecast delay |
|---|---|
| Green / Healthy | At most 1 week later than planned |
| Amber / Warning | 2 weeks later than planned |
| Red / Critical | 3 or more weeks later than planned |

Work package health is based on the number of gates delayed by more than one week:

| Work package status | Gate deviations |
|---|---|
| Healthy | 0 |
| Warning | 1 |
| Critical | 2 or more |

For the current planning year, **Gate Deviations (Current)** only assesses forecast gates in the current or a future week.

### Correct Stage-Gate Weeks Manually

1. Open **Portfolio Overview** and choose the planning year.
2. Select **Modify** above the project health table.
3. Edit planned or forecast week numbers.
4. Select **Save**, or select **Cancel** to discard the changes.

### Delete a Stage-Gate Plan

1. Open **Settings**.
2. Select **Data Deletion**.
3. Enter the stage-gate plan year.
4. Select **Delete plan**.
5. Review the warning and select the confirmation button.

This permanently removes the selected stage-gate plan and all related stage-gate rows. It does not delete business plans.

## AI Assistant

Open **AI Assistant** to ask natural-language questions about delivery, costs, schedules, risks, and reporting.

- Select a starter prompt or enter a question.
- Press **Enter** to send; use **Shift+Enter** for a new line.
- Select **New chat** to begin a separate conversation.
- Use **History** to reopen or delete previous conversations.

Up to 20 chat sessions are stored in the current browser's local storage. They are not automatically shared across browsers or devices.

For clearer answers, include the planning year, plan, region, contract, or work package name in the question.

## Troubleshooting

### A plan upload fails

- Start from the downloadable business-planning template.
- Confirm that the planning year is valid.
- Check that required spreadsheet columns and values have not been removed.
- Try the upload again after correcting the file.

### A stage-gate upload fails

- Enter the stage-gate plan year before selecting the file.
- Use an `.xlsx` or `.xls` file.
- Start from the downloadable stage-gate template.

### An MPP upload or refresh does not update a work package

- Confirm that the `.mpp` filename matches the work package name.
- Confirm that stage-gate rows already exist for the selected planning year.
- Allow the external conversion process to complete before refreshing forecast gates.
- Check the upload and refresh messages for rejected files or zero updated rows.

### Metrics or charts look incorrect

- Check the plan's monthly socket targets and CapEx values.
- Review the shared assumptions.
- Confirm that the plan was created with the correct planning year.
- Regenerate the AI analysis after correcting data.

### AI features fail

- Retry the request.
- Confirm that the rest of the application can load data.
- Contact the application administrator if the AI service remains unavailable.
