PRAGMA foreign_keys = ON;

-- Limpieza para que el seed sea rerunnable
DELETE FROM artifacts;
DELETE FROM metrics;
DELETE FROM model_configs;
DELETE FROM model_runs;
DELETE FROM experiments;
DELETE FROM sql_queries;
DELETE FROM dataset_columns;
DELETE FROM datasets;

DELETE FROM sqlite_sequence
WHERE name IN (
  'datasets',
  'dataset_columns',
  'sql_queries',
  'experiments',
  'model_runs',
  'model_configs',
  'metrics',
  'artifacts'
);

DROP TABLE IF EXISTS retail_sales;
DROP TABLE IF EXISTS saas_churn;

-- =========================
-- Metadata base
-- =========================

INSERT INTO datasets (
  id, name, description, source_type, storage_key, preview_key,
  row_count, column_count, target_column, created_at
) VALUES
  (
    1,
    'Retail Sales Forecasting',
    'Dataset sintético de ventas minoristas para regresión',
    'csv',
    'example-data/retail_sales_forecasting.csv',
    'example-data/retail_sales_forecasting.csv',
    1200,
    18,
    'units_sold',
    CURRENT_TIMESTAMP
  ),
  (
    2,
    'SaaS Churn Classification',
    'Dataset sintético de churn para clasificación',
    'csv',
    'example-data/saas_churn_classification.csv',
    'example-data/saas_churn_classification.csv',
    1500,
    16,
    'churn',
    CURRENT_TIMESTAMP
  );

INSERT INTO dataset_columns (
  dataset_id, column_name, data_type, is_target,
  has_nulls, null_count, unique_count
) VALUES
  -- Retail Sales Forecasting
  (1, 'sale_date', 'TEXT', 0, 0, 0, 730),
  (1, 'store_id', 'INTEGER', 0, 0, 0, 20),
  (1, 'region', 'TEXT', 0, 0, 0, 4),
  (1, 'product_category', 'TEXT', 0, 0, 0, 5),
  (1, 'day_of_week', 'INTEGER', 0, 0, 0, 7),
  (1, 'month', 'INTEGER', 0, 0, 0, 12),
  (1, 'holiday_flag', 'INTEGER', 0, 0, 0, 2),
  (1, 'promo_flag', 'INTEGER', 0, 0, 0, 2),
  (1, 'discount_pct', 'REAL', 0, 0, 0, 31),
  (1, 'ad_spend', 'REAL', 0, 0, 0, 180),
  (1, 'web_traffic', 'INTEGER', 0, 0, 0, 420),
  (1, 'competitor_price_index', 'REAL', 0, 0, 0, 90),
  (1, 'inventory_level', 'INTEGER', 0, 0, 0, 200),
  (1, 'avg_temp_c', 'REAL', 0, 0, 0, 120),
  (1, 'unit_price', 'REAL', 0, 0, 0, 60),
  (1, 'units_sold', 'INTEGER', 1, 0, 0, 220),
  (1, 'revenue', 'REAL', 0, 0, 0, 500),
  (1, 'profit', 'REAL', 0, 0, 0, 500),

  -- SaaS Churn Classification
  (2, 'customer_id', 'TEXT', 0, 0, 0, 1500),
  (2, 'signup_date', 'TEXT', 0, 0, 0, 1200),
  (2, 'account_age_months', 'INTEGER', 0, 0, 0, 60),
  (2, 'plan', 'TEXT', 0, 0, 0, 4),
  (2, 'industry', 'TEXT', 0, 0, 0, 5),
  (2, 'region', 'TEXT', 0, 0, 0, 4),
  (2, 'seats', 'INTEGER', 0, 0, 0, 180),
  (2, 'active_users_ratio', 'REAL', 0, 0, 0, 320),
  (2, 'monthly_logins', 'INTEGER', 0, 0, 0, 420),
  (2, 'feature_usage_score', 'REAL', 0, 0, 0, 520),
  (2, 'support_tickets', 'INTEGER', 0, 0, 0, 8),
  (2, 'avg_response_time_hours', 'REAL', 0, 0, 0, 140),
  (2, 'billing_delay_days', 'INTEGER', 0, 0, 0, 8),
  (2, 'mrr_usd', 'REAL', 0, 0, 0, 380),
  (2, 'nps', 'INTEGER', 0, 0, 0, 120),
  (2, 'churn', 'INTEGER', 1, 0, 0, 2);

INSERT INTO sql_queries (dataset_id, query_name, query_text, created_at) VALUES
  (
    1,
    'Retail - revenue by region',
    'SELECT region, ROUND(SUM(revenue), 2) AS total_revenue FROM retail_sales GROUP BY region ORDER BY total_revenue DESC;',
    CURRENT_TIMESTAMP
  ),
  (
    1,
    'Retail - average units by category',
    'SELECT product_category, ROUND(AVG(units_sold), 2) AS avg_units FROM retail_sales GROUP BY product_category ORDER BY avg_units DESC;',
    CURRENT_TIMESTAMP
  ),
  (
    2,
    'SaaS - churn rate by plan',
    'SELECT plan, ROUND(AVG(churn) * 100, 2) AS churn_rate_pct FROM saas_churn GROUP BY plan ORDER BY churn_rate_pct DESC;',
    CURRENT_TIMESTAMP
  ),
  (
    2,
    'SaaS - average MRR by region',
    'SELECT region, ROUND(AVG(mrr_usd), 2) AS avg_mrr FROM saas_churn GROUP BY region ORDER BY avg_mrr DESC;',
    CURRENT_TIMESTAMP
  );

INSERT INTO experiments (
  id, dataset_id, experiment_name, problem_type, target_column,
  train_size, test_size, random_state, created_at
) VALUES
  (
    1,
    1,
    'Retail baseline regression',
    'regression',
    'units_sold',
    0.80,
    0.20,
    42,
    CURRENT_TIMESTAMP
  ),
  (
    2,
    2,
    'SaaS churn baseline classification',
    'classification',
    'churn',
    0.80,
    0.20,
    42,
    CURRENT_TIMESTAMP
  );

INSERT INTO model_runs (
  id, experiment_id, model_name, status,
  started_at, finished_at, duration_ms, error_message
) VALUES
  (
    1,
    1,
    'random_forest_regressor',
    'done',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    1840,
    NULL
  ),
  (
    2,
    2,
    'logistic_regression',
    'done',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    920,
    NULL
  );

INSERT INTO model_configs (id, run_id, params_json) VALUES
  (1, 1, '{"n_estimators": 200, "max_depth": 8, "random_state": 42}'),
  (2, 2, '{"C": 1.0, "solver": "lbfgs", "max_iter": 1000, "random_state": 42}');

INSERT INTO metrics (run_id, metric_name, metric_value) VALUES
  (1, 'rmse', 12.84),
  (1, 'mae', 9.31),
  (1, 'r2', 0.87),
  (2, 'accuracy', 0.84),
  (2, 'f1', 0.81),
  (2, 'roc_auc', 0.89);

INSERT INTO artifacts (run_id, artifact_type, artifact_key, created_at) VALUES
  (1, 'chart', 'artifacts/retail_regression_pred_vs_real.json', CURRENT_TIMESTAMP),
  (1, 'report', 'artifacts/retail_regression_report.html', CURRENT_TIMESTAMP),
  (2, 'chart', 'artifacts/saas_churn_confusion_matrix.json', CURRENT_TIMESTAMP),
  (2, 'report', 'artifacts/saas_churn_report.html', CURRENT_TIMESTAMP);

-- =========================
-- Tabla sintética 1: Retail
-- =========================

CREATE TABLE IF NOT EXISTS retail_sales (
  sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_date TEXT NOT NULL,
  store_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  product_category TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  month INTEGER NOT NULL,
  holiday_flag INTEGER NOT NULL,
  promo_flag INTEGER NOT NULL,
  discount_pct REAL NOT NULL,
  ad_spend REAL NOT NULL,
  web_traffic INTEGER NOT NULL,
  competitor_price_index REAL NOT NULL,
  inventory_level INTEGER NOT NULL,
  avg_temp_c REAL NOT NULL,
  unit_price REAL NOT NULL,
  units_sold INTEGER NOT NULL,
  revenue REAL NOT NULL,
  profit REAL NOT NULL
);

WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 1200
),
base AS (
  SELECT
    date('2023-01-01', printf('+%d day', n % 730)) AS sale_date,
    ((n - 1) % 20) + 1 AS store_id,
    CASE (n - 1) % 4
      WHEN 0 THEN 'North'
      WHEN 1 THEN 'South'
      WHEN 2 THEN 'West'
      ELSE 'East'
    END AS region,
    CASE (n - 1) % 5
      WHEN 0 THEN 'Beverages'
      WHEN 1 THEN 'Snacks'
      WHEN 2 THEN 'Dairy'
      WHEN 3 THEN 'Cleaning'
      ELSE 'Personal Care'
    END AS product_category,
    (n - 1) % 7 AS day_of_week,
    ((n - 1) % 12) + 1 AS month,
    CASE WHEN n % 13 = 0 THEN 1 ELSE 0 END AS holiday_flag,
    CASE WHEN n % 3 = 0 THEN 1 ELSE 0 END AS promo_flag,
    ROUND(0.03 + ((n % 10) * 0.02) + CASE WHEN n % 3 = 0 THEN 0.05 ELSE 0 END, 3) AS discount_pct,
    ROUND(100 + (n % 25) * 18 + CASE WHEN n % 3 = 0 THEN 120 ELSE 0 END, 2) AS ad_spend,
    1800 + (n % 40) * 75 + CASE WHEN n % 3 = 0 THEN 650 ELSE 0 END AS web_traffic,
    ROUND(0.92 + ((n % 9) * 0.01), 3) AS competitor_price_index,
    700 + (n % 15) * 35 AS inventory_level,
    ROUND(12 + ((n % 12) * 0.7), 1) AS avg_temp_c,
    ROUND(
      CASE (n - 1) % 5
        WHEN 0 THEN 15.8
        WHEN 1 THEN 13.4
        WHEN 2 THEN 11.6
        WHEN 3 THEN 9.8
        ELSE 10.7
      END + ((n % 4) * 0.35),
      2
    ) AS unit_price,
    CAST(
      40 + ((n % 6) * 9) + (n % 12)
      + CASE WHEN n % 3 = 0 THEN 20 ELSE 0 END
      - CASE WHEN n % 4 = 0 THEN 8 ELSE 0 END
      AS INTEGER
    ) AS units_sold
  FROM seq
)
INSERT INTO retail_sales (
  sale_date, store_id, region, product_category, day_of_week, month,
  holiday_flag, promo_flag, discount_pct, ad_spend, web_traffic,
  competitor_price_index, inventory_level, avg_temp_c, unit_price,
  units_sold, revenue, profit
)
SELECT
  sale_date,
  store_id,
  region,
  product_category,
  day_of_week,
  month,
  holiday_flag,
  promo_flag,
  discount_pct,
  ad_spend,
  web_traffic,
  competitor_price_index,
  inventory_level,
  avg_temp_c,
  unit_price,
  units_sold,
  ROUND(units_sold * unit_price * (1 - discount_pct), 2) AS revenue,
  ROUND(units_sold * unit_price * (1 - discount_pct) * 0.42 - ad_spend * 0.08, 2) AS profit
FROM base;

-- =========================
-- Tabla sintética 2: SaaS
-- =========================

CREATE TABLE IF NOT EXISTS saas_churn (
  customer_id TEXT PRIMARY KEY,
  signup_date TEXT NOT NULL,
  account_age_months INTEGER NOT NULL,
  plan TEXT NOT NULL,
  industry TEXT NOT NULL,
  region TEXT NOT NULL,
  seats INTEGER NOT NULL,
  active_users_ratio REAL NOT NULL,
  monthly_logins INTEGER NOT NULL,
  feature_usage_score REAL NOT NULL,
  support_tickets INTEGER NOT NULL,
  avg_response_time_hours REAL NOT NULL,
  billing_delay_days INTEGER NOT NULL,
  mrr_usd REAL NOT NULL,
  nps INTEGER NOT NULL,
  churn INTEGER NOT NULL
);

WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 1500
),
base AS (
  SELECT
    printf('CUST-%05d', n) AS customer_id,
    date('2021-01-01', printf('+%d day', n % 1200)) AS signup_date,
    CAST(
      (julianday('2026-04-01') - julianday(date('2021-01-01', printf('+%d day', n % 1200))))
      / 30
      AS INTEGER
    ) AS account_age_months,
    CASE (n % 4)
      WHEN 0 THEN 'Starter'
      WHEN 1 THEN 'Pro'
      WHEN 2 THEN 'Business'
      ELSE 'Enterprise'
    END AS plan,
    CASE (n % 5)
      WHEN 0 THEN 'Retail'
      WHEN 1 THEN 'Education'
      WHEN 2 THEN 'Services'
      WHEN 3 THEN 'Healthcare'
      ELSE 'Manufacturing'
    END AS industry,
    CASE (n % 4)
      WHEN 0 THEN 'LATAM'
      WHEN 1 THEN 'NA'
      WHEN 2 THEN 'EU'
      ELSE 'APAC'
    END AS region,
    CASE (n % 4)
      WHEN 0 THEN 6 + (n % 5)
      WHEN 1 THEN 18 + (n % 12)
      WHEN 2 THEN 42 + (n % 25)
      ELSE 120 + (n % 80)
    END AS seats,
    ROUND(
      MAX(
        0.05,
        MIN(
          1.0,
          CASE (n % 4)
            WHEN 0 THEN 0.58
            WHEN 1 THEN 0.72
            WHEN 2 THEN 0.82
            ELSE 0.91
          END - ((n % 7) * 0.02)
        )
      ),
      3
    ) AS active_users_ratio,
    CASE (n % 4)
      WHEN 0 THEN 18 + (n % 15)
      WHEN 1 THEN 34 + (n % 25)
      WHEN 2 THEN 58 + (n % 30)
      ELSE 95 + (n % 60)
    END AS monthly_logins,
    ROUND(
      CASE (n % 4)
        WHEN 0 THEN 44
        WHEN 1 THEN 58
        WHEN 2 THEN 71
        ELSE 83
      END + ((n % 9) * 1.6) - CASE WHEN n % 11 = 0 THEN 12 ELSE 0 END,
      1
    ) AS feature_usage_score,
    CASE (n % 6)
      WHEN 0 THEN 5
      WHEN 1 THEN 2
      WHEN 2 THEN 1
      WHEN 3 THEN 3
      WHEN 4 THEN 0
      ELSE 4
    END AS support_tickets,
    CASE
      WHEN n % 13 = 0 THEN 7
      WHEN n % 9 = 0 THEN 4
      WHEN n % 5 = 0 THEN 2
      ELSE 0
    END AS billing_delay_days,
    ROUND(
      CASE (n % 4)
        WHEN 0 THEN 49
        WHEN 1 THEN 149
        WHEN 2 THEN 480
        ELSE 2200
      END + ((n % 8) * CASE (n % 4)
        WHEN 0 THEN 2
        WHEN 1 THEN 7
        WHEN 2 THEN 18
        ELSE 35
      END),
      2
    ) AS mrr_usd,
    CAST(
      68
      - (
        CASE (n % 6)
          WHEN 0 THEN 5
          WHEN 1 THEN 2
          WHEN 2 THEN 1
          WHEN 3 THEN 3
          WHEN 4 THEN 0
          ELSE 4
        END * 6
      )
      - CASE WHEN n % 4 = 0 THEN 8 ELSE 0 END
      + CASE WHEN n % 4 = 3 THEN 5 ELSE 0 END
      AS INTEGER
    ) AS nps
  FROM seq
)
INSERT INTO saas_churn (
  customer_id, signup_date, account_age_months, plan, industry, region,
  seats, active_users_ratio, monthly_logins, feature_usage_score,
  support_tickets, avg_response_time_hours, billing_delay_days,
  mrr_usd, nps, churn
)
SELECT
  customer_id,
  signup_date,
  account_age_months,
  plan,
  industry,
  region,
  seats,
  active_users_ratio,
  monthly_logins,
  feature_usage_score,
  support_tickets,
  ROUND(
    2.0
    + support_tickets * 1.9
    + CASE plan
      WHEN 'Starter' THEN 2.4
      WHEN 'Pro' THEN 1.4
      WHEN 'Business' THEN 0.8
      ELSE 0.5
    END,
    1
  ) AS avg_response_time_hours,
  billing_delay_days,
  mrr_usd,
  nps,
  CASE
    WHEN support_tickets >= 4
      OR billing_delay_days >= 4
      OR active_users_ratio < 0.6
      OR monthly_logins < 35
      OR feature_usage_score < 55
    THEN 1
    ELSE 0
  END AS churn
FROM base;
