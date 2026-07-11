import db from "@/lib/db";

// Credit notes, credit note items, and customer payments live in tables
// created lazily so no manual migration is needed on the Turso database.
let ensured: Promise<void> | null = null;

export function ensureFinanceTables(): Promise<void> {
  if (!ensured) {
    ensured = db
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS credit_notes (
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
           )`,
          `CREATE TABLE IF NOT EXISTS credit_note_items (
             id             INTEGER PRIMARY KEY AUTOINCREMENT,
             credit_note_id INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
             product_id     INTEGER REFERENCES products(id),
             description    TEXT,
             quantity       INTEGER NOT NULL DEFAULT 1,
             unit_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
             total_price    NUMERIC(12,2) NOT NULL
           )`,
          `CREATE TABLE IF NOT EXISTS payments (
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
           )`,
        ],
        "write"
      )
      .then(() => undefined)
      .catch((err) => {
        ensured = null; // allow retry on next request
        throw err;
      });
  }
  return ensured;
}

export async function nextCreditNoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CN-${year}-`;
  const result = await db.execute({
    sql: `SELECT credit_note_no FROM credit_notes
          WHERE credit_note_no LIKE ?
          ORDER BY id DESC LIMIT 1`,
    args: [`${prefix}%`],
  });
  const last = result.rows[0]?.credit_note_no as string | undefined;
  const seq = last ? parseInt(last.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
