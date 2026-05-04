-- Azure SQL schema for CK Project Consolidator (v2)
-- Blob storage holds only uploaded Excel files.
-- All plan metadata and row data live here.
-- Run once against a fresh Azure SQL database.

CREATE TABLE plans (
    plan_id    NVARCHAR(36)   NOT NULL PRIMARY KEY,
    plan_name  NVARCHAR(255)  NOT NULL,
    blob_path  NVARCHAR(500)  NULL,
    file_name  NVARCHAR(255)  NULL,
    file_size  BIGINT         NULL,
    file_type  NVARCHAR(100)  NULL,
    created_at DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    status     NVARCHAR(20)   NOT NULL DEFAULT 'active'
);

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
    planned_gate_1                INT           NULL,
    planned_gate_2                INT           NULL,
    planned_gate_3                INT           NULL,
    planned_gate_4                INT           NULL,
    actual_gate_1                 INT           NULL,
    actual_gate_2                 INT           NULL,
    actual_gate_3                 INT           NULL,
    actual_gate_4                 INT           NULL,
    CONSTRAINT fk_plan_rows_plan
        FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
);

CREATE INDEX ix_plan_rows_plan_id ON plan_rows (plan_id);
