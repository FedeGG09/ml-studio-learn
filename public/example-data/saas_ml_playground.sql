-- SaaS ML Playground example database
PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
    customer_id TEXT PRIMARY KEY,
    signup_date TEXT NOT NULL,
    industry TEXT NOT NULL,
    region TEXT NOT NULL
);

CREATE TABLE subscriptions (
    subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    seats INTEGER NOT NULL,
    mrr_usd REAL NOT NULL,
    account_age_months INTEGER NOT NULL,
    active_users_ratio REAL NOT NULL,
    monthly_logins INTEGER NOT NULL,
    feature_usage_score REAL NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES accounts(customer_id)
);

CREATE TABLE support_activity (
    support_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL,
    support_tickets INTEGER NOT NULL,
    avg_response_time_hours REAL NOT NULL,
    billing_delay_days INTEGER NOT NULL,
    nps INTEGER NOT NULL,
    churn INTEGER NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES accounts(customer_id)
);