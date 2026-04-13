-- Retail ML Playground example database
PRAGMA foreign_keys = ON;

CREATE TABLE stores (
    store_id INTEGER PRIMARY KEY,
    store_name TEXT NOT NULL,
    region TEXT NOT NULL,
    city TEXT NOT NULL,
    open_date TEXT NOT NULL
);

CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_cost REAL NOT NULL,
    base_price REAL NOT NULL
);

CREATE TABLE sales (
    sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_date TEXT NOT NULL,
    store_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    promo_flag INTEGER NOT NULL,
    discount_pct REAL NOT NULL,
    units_sold INTEGER NOT NULL,
    revenue REAL NOT NULL,
    profit REAL NOT NULL,
    FOREIGN KEY(store_id) REFERENCES stores(store_id),
    FOREIGN KEY(product_id) REFERENCES products(product_id)
);