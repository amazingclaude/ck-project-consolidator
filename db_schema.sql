-- Azure SQL schema for CK Project Consolidator (v2)
-- Blob storage holds only uploaded Excel files.
-- All plan metadata and row data live here.
-- Run once against a fresh Azure SQL database.

CREATE TABLE plans (
    plan_id                  NVARCHAR(36)   NOT NULL PRIMARY KEY,
    plan_name                NVARCHAR(255)  NOT NULL,
    blob_path                NVARCHAR(500)  NULL,
    file_name                NVARCHAR(255)  NULL,
    file_size                BIGINT         NULL,
    file_type                NVARCHAR(100)  NULL,
    created_at               DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    plan_year                INT            NOT NULL,
    status                   NVARCHAR(20)   NOT NULL DEFAULT 'active',
    ai_analysis              NVARCHAR(MAX)  NULL,
    ai_analysis_generated_at DATETIME2      NULL
);

-- Migration for existing databases (run once if upgrading from a schema without AI analysis columns):
-- ALTER TABLE plans ADD ai_analysis NVARCHAR(MAX) NULL;
-- ALTER TABLE plans ADD ai_analysis_generated_at DATETIME2 NULL;

-- One row per work package per plan.
-- Source columns only — no derived/computed fields stored here.
-- Metrics and chart data are calculated dynamically by the API.
CREATE TABLE plan_rows (
    row_id                        INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    plan_id                       NVARCHAR(36)  NOT NULL,
    region_name                   NVARCHAR(255) NULL,
    contract_name                 NVARCHAR(255) NULL,
    work_package_name             NVARCHAR(255) NULL,
    capex_bom_per_socket          DECIMAL(18,2) NOT NULL DEFAULT 0,
    capex_installation_per_socket DECIMAL(18,2) NOT NULL DEFAULT 0,
    capex_connection_per_socket   DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_capex_per_socket        DECIMAL(18,2) NOT NULL DEFAULT 0,
    target_sockets                INT           NOT NULL DEFAULT 0,
    target_sockets_1              INT           NOT NULL DEFAULT 0,
    target_sockets_2              INT           NOT NULL DEFAULT 0,
    target_sockets_3              INT           NOT NULL DEFAULT 0,
    target_sockets_4              INT           NOT NULL DEFAULT 0,
    target_sockets_5              INT           NOT NULL DEFAULT 0,
    target_sockets_6              INT           NOT NULL DEFAULT 0,
    target_sockets_7              INT           NOT NULL DEFAULT 0,
    target_sockets_8              INT           NOT NULL DEFAULT 0,
    target_sockets_9              INT           NOT NULL DEFAULT 0,
    target_sockets_10             INT           NOT NULL DEFAULT 0,
    target_sockets_11             INT           NOT NULL DEFAULT 0,
    target_sockets_12             INT           NOT NULL DEFAULT 0,
    target_sockets_13             INT           NOT NULL DEFAULT 0,
    target_sockets_14             INT           NOT NULL DEFAULT 0,
    target_sockets_15             INT           NOT NULL DEFAULT 0,
    target_sockets_16             INT           NOT NULL DEFAULT 0,
    target_sockets_17             INT           NOT NULL DEFAULT 0,
    target_sockets_18             INT           NOT NULL DEFAULT 0,
    CONSTRAINT fk_plan_rows_plan
        FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
);

CREATE INDEX ix_plan_rows_plan_id ON plan_rows (plan_id);


-- ── Stage Gate Plans (independent of business planning) ──────────────────────
-- One row per uploaded Stage Gates Excel file.
CREATE TABLE stage_gate_plans (
    sg_plan_id  NVARCHAR(36)  NOT NULL PRIMARY KEY,
    file_name   NVARCHAR(255) NOT NULL,
    plan_year   INT           NOT NULL,
    created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT uq_stage_gate_plans_year UNIQUE (plan_year)
);

-- One row per work package per stage gate plan.
CREATE TABLE stage_gate_rows (
    row_id             INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    sg_plan_id         NVARCHAR(36)  NOT NULL,
    work_package_name  NVARCHAR(255) NULL,
    planned_gate_1     INT           NULL,
    planned_gate_2     INT           NULL,
    planned_gate_3     INT           NULL,
    planned_gate_4     INT           NULL,
    forecast_gate_1      INT           NULL,
    forecast_gate_2      INT           NULL,
    forecast_gate_3      INT           NULL,
    forecast_gate_4      INT           NULL,
    CONSTRAINT fk_stage_gate_rows_plan
        FOREIGN KEY (sg_plan_id) REFERENCES stage_gate_plans(sg_plan_id) ON DELETE CASCADE
);

CREATE INDEX ix_stage_gate_rows_sg_plan_id ON stage_gate_rows (sg_plan_id);
