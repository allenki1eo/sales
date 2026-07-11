-- Turso / SQLite schema for East African Spirit Sales System
-- Run this via: turso db shell <db-name> < schema.sql
-- Or paste into Turso dashboard SQL shell

PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,
  full_name   TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'sales_officer'
                CHECK (role IN ('admin','accountant','sales_officer')),
  signature_path TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Customers (extended with EFD fields)
CREATE TABLE IF NOT EXISTS customers (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  name                   TEXT    NOT NULL,
  location               TEXT,
  phone                  TEXT,
  is_export              INTEGER NOT NULL DEFAULT 0,
  charges_efd            INTEGER NOT NULL DEFAULT 0,
  efd_profit_per_carton  REAL    NOT NULL DEFAULT 0,
  created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  default_price REAL    NOT NULL DEFAULT 0,
  carton_weight REAL    NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Customer-specific prices (overrides default_price)
CREATE TABLE IF NOT EXISTS customer_prices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  price       REAL    NOT NULL,
  UNIQUE (customer_id, product_id)
);

-- Sales requests
CREATE TABLE IF NOT EXISTS requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  user_id        INTEGER NOT NULL REFERENCES users(id),
  truck_number   TEXT,
  driver_name    TEXT,
  route          TEXT,
  vat_percentage REAL    NOT NULL DEFAULT 18,
  status         TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','dispatched','rejected')),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Request line items
CREATE TABLE IF NOT EXISTS request_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL,
  unit_price  REAL    NOT NULL,
  total_price REAL    NOT NULL
);

-- Approval signatures
CREATE TABLE IF NOT EXISTS request_signatures (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id     INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  signature_type TEXT    NOT NULL
                   CHECK (signature_type IN ('prepared_by','requested_by','authorised_by','approved_by')),
  signed_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Credit notes (reduce what a customer owes: returns, damages, overcharges)
-- NOTE: also created automatically at runtime by src/lib/finance-schema.ts
CREATE TABLE IF NOT EXISTS credit_notes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_no TEXT    NOT NULL UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  request_id     INTEGER REFERENCES requests(id),
  user_id        INTEGER NOT NULL REFERENCES users(id),
  reason         TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  credit_date    TEXT    NOT NULL,
  approved_by    INTEGER REFERENCES users(id),
  approved_at    TEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_id INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id),
  description    TEXT,
  quantity       INTEGER NOT NULL DEFAULT 1,
  unit_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price    NUMERIC(12,2) NOT NULL
);

-- Opening balance columns on customers (pre-system debt, settled first by FIFO)
-- NOTE: added automatically at runtime by src/lib/finance-schema.ts
-- ALTER TABLE customers ADD COLUMN opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0;
-- ALTER TABLE customers ADD COLUMN opening_balance_date TEXT;

-- Customer payments received
-- NOTE: also created automatically at runtime by src/lib/finance-schema.ts
CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  amount       NUMERIC(12,2) NOT NULL,
  payment_date TEXT    NOT NULL,
  method       TEXT    NOT NULL DEFAULT 'cash'
                 CHECK (method IN ('cash','bank','mobile_money','cheque','other')),
  reference    TEXT,
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- Seed data  (password = "password" — bcrypt hash)
-- ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO users (id, username, password, full_name, role) VALUES
(1, 'admin',       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSm5cqi', 'System Admin',    'admin'),
(2, 'richard',     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSm5cqi', 'Richard Mugisha', 'sales_officer'),
(3, 'accountant1', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSm5cqi', 'Jane Doe',        'accountant');

INSERT OR IGNORE INTO products (id, name, default_price, carton_weight) VALUES
(1, 'D-PET',                   42372.88, 0),
(2, 'D GLASS',                     0.00, 0),
(3, 'H - 200ml',               72033.90, 0),
(4, 'H 500ml',                     0.00, 0),
(5, 'H-750ml',                 86440.68, 0),
(6, 'GOLDBERG PREMIUM LAGER',  25495.55, 0),
(7, 'MBOGO BANANA WINE BOX',   13789.99, 0);

INSERT OR IGNORE INTO customers (id, name, location, phone) VALUES
(1,  'EMANUEL CHONJO',                'DODOMA',               '0764 935 115'),
(2,  'JAPHET MASUKE',                 'SHINYANGA',            '0754 764 968'),
(3,  'MINJA SEVERINI',                'SHINYANGA',            '0658 828 432'),
(4,  'BOZRA NDETI',                   'SHINYANGA',            '0755 716 520'),
(5,  'B. S LIQUORS STORE',            'SHINYANGA',            '0756 716 520'),
(6,  'DOHAKI LTD',                    'ARUSHA',               ''),
(7,  'JOJONO ENTERPRISES',            'DAR ES SALAAM',        '0713 242 229'),
(8,  'B. P. K COMPANY',               'DAR ES SALAAM',        ''),
(9,  'S.D VASANT',                    'TANGA MJINI',          '0713 437 537'),
(10, 'ALEX GERVAS NDABATINYA',        'MPANDA- KATAVI',       '0765 504 290'),
(11, 'YUDA MAKINDA',                  'MPANDA- KATAVI',       '0753 353 523'),
(12, 'ALEX JOHN MILINGA/NGUSA SHOP',  'MPANDA- KATAVI',       '0753 984 542'),
(13, 'JOEL MVANGA',                   'MASWA & MEATU',        '0758 004 083'),
(14, 'GRAMBA STORE',                  'MWANZA',               '0784 800 744'),
(15, 'STELLA KIZIGA',                 'KIJITONYAMA BRANCH-DAR', ''),
(16, 'TAKAWEDO',                      'DODOMA',               ''),
(17, 'JULIO',                         'SUMBAWANGA',           '0762 147 046'),
(18, 'MAMA GOOD',                     'SUMBAWANGA',           '0762 465 804'),
(19, 'KURWA SHOP',                    'MPANDA',               '0755 572 605'),
(20, 'OBAMA',                         'DODOMA',               '0755 897 355'),
(21, 'OBAMA',                         'MBEYA',                '0786 670 754'),
(22, 'MARWA PATRICK',                 'MBEYA',                ''),
(23, 'SIMON GWERA',                   'MUSOMA/SERENGETI',     ''),
(24, 'MAMA NKAMBA',                   'BARIADI',              ''),
(25, 'SULUBA',                        'DUTWA',                ''),
(26, 'SHULI',                         'MASWA',                ''),
(27, 'MACHA',                         'MWANHUZI',             ''),
(28, 'KABAGO',                        'BUKOBA',               ''),
(29, 'MARK AUGUSTIN MMASSY',          'MOROGORO',             ''),
(30, 'MAWIBO BEVERAGE',               'MBEYA',                ''),
(31, 'SAIYE MINJA',                   '',                     ''),
(32, 'LEGO STORE',                    'SHINYANGA',            ''),
(33, 'FREDRICK S MLELWA',             'MWANZA',               ''),
(34, 'EMANUEL JOEL MTOKOMA',          'MAFINGA',              ''),
(35, 'ESTAM AFRICA ENTERPRISES',      'DODOMA',               ''),
(36, 'KILEMA INVESTMENT',             'MOROGORO',             ''),
(37, 'SWEET TEST',                    'IRINGA',               ''),
(38, 'MARK A MMASSY',                 'IFAKARA',              ''),
(39, 'LUCAS URIO',                    'DAR ES SALAAM',        ''),
(40, 'WAKARA',                        'MUSOMA',               ''),
(41, 'LUSTE',                         'MOSHI',                ''),
(42, 'JANGALA',                       'NZEGA',                ''),
(43, 'LEONARD MUSHI',                 '',                     ''),
(44, 'MANKA INFINITY',                'BABATI',               ''),
(45, 'RICHARD MUGISHA',               'SHINYANGA',            ''),
(46, 'KALIWABHO BEVERAGES',           'KAHAMA',               ''),
(47, 'ZAKARIA KISUMO',                'TABORA',               '0625 626 006'),
(48, 'PAUL WILLIAM KANSIGO',          'KAHAMA',               ''),
(49, 'NTINDOGO NZIKU J MZULINGI',     'KAHAMA',               ''),
(50, 'UMULIZA',                       'BUKOBA',               ''),
(51, 'RICHARD MUGISHA',               '',                     '');

INSERT OR IGNORE INTO customer_prices (customer_id, product_id, price) VALUES
(1,1,43220.34),(1,3,72033.90),(1,5,86440.68),
(3,1,43644.07),(3,3,72033.90),(3,5,86440.68),
(5,1,42372.88),(5,3,72033.90),(5,5,86440.68),
(6,1,42372.88),(6,3,72033.90),(6,5,86440.68),
(7,1,42372.88),(7,3,71610.17),(7,5,86016.95),
(8,3,72033.90),(8,5,86440.68),
(9,3,72033.90),(9,5,86440.68),
(10,1,44067.80),
(11,1,44067.80),(11,3,72033.90),(11,5,86440.68),
(12,1,44067.80),(12,3,72033.90),(12,5,86440.68),
(13,1,42796.61),(13,3,72033.90),(13,5,86440.68),
(14,3,71610.17),(14,5,86016.95),
(15,1,42372.88),
(16,3,72033.90),(16,5,86440.68),
(28,3,72033.90),(28,5,86440.68),
(31,1,43644.07),
(32,1,43644.07),
(33,1,43220.34),(33,3,72033.90),(33,5,86440.68),
(34,1,44067.80),(34,3,72881.36),(34,5,87288.14),
(35,1,43220.34),(35,3,71610.17),(35,5,86016.95),
(36,3,72033.90),(36,5,86440.68),
(37,1,43220.34),(37,3,72033.90),
(38,3,72033.90),
(39,3,72033.90),(39,5,86440.68),
(41,1,42372.88),(41,3,72033.90),(41,5,86440.68),
(43,1,42372.88),(43,3,71610.17),(43,5,86016.95),
(44,3,72033.90),(44,5,86440.68),
(45,3,73728.81),(45,5,88135.59),
(50,3,72033.90),(50,5,86440.68);
