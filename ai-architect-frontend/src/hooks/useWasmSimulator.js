/**
 * useWasmSimulator.js — The WASM Dry-Run Simulator Hook
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture Pattern: Custom Hook with Lazy Resource Acquisition
 *
 * Why lazy?
 *   sql.js WASM binary is ~1.3 MB. Loading it eagerly on app start would
 *   delay the initial paint for every user — even those who never use the
 *   simulator. Lazy-loading via dynamic import() defers this until the first
 *   "done" SSE event, i.e. only when it's actually needed.
 *
 * Memory Model:
 *   - WASM heap:  sql.js allocates ~1.5 MB of WASM linear memory for the engine
 *   - JS heap:    Generated INSERT strings are ephemeral — consumed by db.run()
 *                 then eligible for GC. Never accumulate.
 *   - db.close(): Called before each new simulation run to release WASM memory.
 *   - Total peak: ~8–12 MB (WASM engine + active DB pages). Well within budget.
 *
 * Phases:
 *   idle → loading → creating → seeding → benchmarking → done | error
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react';
import { parseDDL, generateInserts } from '../utils/mockDataGenerator';

/** Rows seeded per table. 1000 is the benchmark standard. */
const ROWS_PER_TABLE = 1000;

/**
 * useWasmSimulator
 *
 * @returns {{
 *   status:        'idle'|'loading'|'creating'|'seeding'|'benchmarking'|'done'|'error',
 *   stats:         SimulatorStats | null,
 *   error:         string | null,
 *   runSimulation: (ddl: string) => Promise<void>,
 *   reset:         () => void,
 * }}
 */
export function useWasmSimulator() {
  const [status, setStatus] = useState('idle');
  const [stats,  setStats]  = useState(null);
  const [error,  setError]  = useState(null);

  // Persistent refs — survive re-renders, avoid re-initialization
  const dbRef  = useRef(null); // Active in-memory SQLite DB instance
  const sqlRef = useRef(null); // sql.js SQL module (loaded once, reused)

  // ── Step 0: Lazy-load the WASM engine ────────────────────────────────────
  const initSQL = useCallback(async () => {
    if (sqlRef.current) return sqlRef.current; // Already loaded — reuse

    // Dynamic import: Vite bundles sql.js separately, loads it on demand
    const initSqlJs = (await import('sql.js')).default;

    // locateFile: tells sql.js where to find sql-wasm.wasm at runtime.
    // Vite serves files from /public at the root path '/', so this resolves
    // to http://localhost:5173/sql-wasm.wasm — matching our copied .wasm file.
    const SQL = await initSqlJs({
      locateFile: (filename) => `/${filename}`,
    });

    sqlRef.current = SQL;
    return SQL;
  }, []);

  // ── Main entry point ─────────────────────────────────────────────────────
  const runSimulation = useCallback(async (rawDDL) => {
    if (!rawDDL?.trim()) return;

    setStatus('loading');
    setStats(null);
    setError(null);

    try {
      // ── Phase 1: Init WASM engine ───────────────────────────────────────
      const SQL = await initSQL();

      // ── Phase 2: Fresh in-memory DB ────────────────────────────────────
      // Close previous DB to release WASM-allocated memory before starting
      if (dbRef.current) {
        try { dbRef.current.close(); } catch (_) { /* DB may already be closed */ }
      }
      const db = new SQL.Database(); // Allocates new WASM heap for this DB
      dbRef.current = db;

      // ── Phase 3: Parse DDL ──────────────────────────────────────────────
      const tables = parseDDL(rawDDL);

      if (tables.length === 0) {
        throw new Error(
          'No valid CREATE TABLE statements were found. ' +
          'Ensure the AI generated a PostgreSQL schema with explicit column definitions.'
        );
      }

      // ── Phase 4: Apply sanitized DDL ────────────────────────────────────
      setStatus('creating');
      const sanitizedDDL = sanitizeForSQLite(rawDDL);

      // Run each statement individually for granular error reporting
      const ddlStatements = sanitizedDDL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 10 && /CREATE\s+TABLE/i.test(s));

      for (const stmt of ddlStatements) {
        try {
          db.run(stmt + ';');
        } catch (ddlErr) {
          // Non-fatal: some statements may fail (e.g. unsupported PG extensions)
          console.warn('[WASM] DDL statement failed:', ddlErr.message, '\n→', stmt.slice(0, 80));
        }
      }

      // ── Phase 5: Seed mock data ──────────────────────────────────────────
      setStatus('seeding');
      const insertBatches = generateInserts(tables, ROWS_PER_TABLE);
      let rowsSuccessfullyInserted = 0;

      for (const batchSQL of insertBatches) {
        // Run each INSERT-batch statement
        const stmts = batchSQL.split(';\n\n').map(s => s.trim()).filter(Boolean);
        for (const stmt of stmts) {
          try {
            db.run(stmt.endsWith(';') ? stmt : stmt + ';');
            // Count rows from this batch (each stmt = BATCH_SIZE rows)
            rowsSuccessfullyInserted += 100;
          } catch (insertErr) {
            // Skip rows that violate FK or NOT NULL constraints gracefully
            console.warn('[WASM] Insert batch skipped:', insertErr.message.slice(0, 60));
          }
        }
      }

      // ── Phase 6: Benchmark SELECT ────────────────────────────────────────
      setStatus('benchmarking');
      const benchQuery = buildBenchmarkQuery(tables);

      const t0 = performance.now();
      let queryResult = null;
      let queryError  = null;

      try {
        queryResult = db.exec(benchQuery); // Returns [{ columns: [], values: [[]] }]
      } catch (qErr) {
        queryError = qErr.message;
        console.warn('[WASM] Benchmark query failed:', qErr.message);
      }

      const queryTimeMs = (performance.now() - t0).toFixed(2);

      // ── Phase 7: Gather final stats ─────────────────────────────────────
      // Check actual row counts from the DB (source of truth)
      const verifiedCounts = {};
      for (const t of tables) {
        try {
          const res = db.exec(`SELECT COUNT(*) FROM "${t.name}";`);
          verifiedCounts[t.name] = res?.[0]?.values?.[0]?.[0] ?? 0;
        } catch (_) {
          verifiedCounts[t.name] = 0;
        }
      }

      const totalVerified = Object.values(verifiedCounts).reduce((a, b) => a + Number(b), 0);

      setStats({
        tablesCreated:  tables.length,
        tableNames:     tables.map(t => t.name),
        tableCounts:    verifiedCounts,
        rowsInserted:   totalVerified,
        queryTimeMs,
        benchmarkQuery,
        queryResult:    queryResult?.[0] ?? null, // { columns: [], values: [] }
        queryError,
        totalColumns:   tables.reduce((acc, t) => acc + t.columns.length, 0),
      });

      setStatus('done');

    } catch (err) {
      console.error('[WASM Simulator] Fatal error:', err);
      setError(err.message);
      setStatus('error');
    }
  }, [initSQL]);

  // ── Reset: clears all state + frees WASM memory ──────────────────────────
  const reset = useCallback(() => {
    if (dbRef.current) {
      try { dbRef.current.close(); } catch (_) {}
      dbRef.current = null;
    }
    setStatus('idle');
    setStats(null);
    setError(null);
  }, []);

  return { status, stats, error, runSimulation, reset };
}

// ─── HELPER: Build the benchmark SELECT query ──────────────────────────────────
/**
 * Selects the most informative query based on schema structure:
 *   - 2+ tables → JOIN + GROUP BY (exercises query planner)
 *   - 1 table with text+num → GROUP BY + AVG (exercises aggregation)
 *   - Fallback → simple ordered scan
 */
function buildBenchmarkQuery(tables) {
  // Helper: find first text-like column
  const textCol = (t) =>
    t.columns.find(c =>
      !c.name.endsWith('_id') && c.name !== 'id' &&
      (c.type.includes('text') || c.type.includes('varchar') || c.type === 'text')
    );

  // Helper: find first numeric column
  const numCol = (t) =>
    t.columns.find(c =>
      c.type.includes('int') || c.type.includes('real') ||
      c.type.includes('numeric') || c.type.includes('decimal')
    );

  // Scenario A: JOIN across two tables
  if (tables.length >= 2) {
    const [t1, t2] = tables;
    const tc1 = textCol(t1);
    const nc2 = numCol(t2);
    // Look for a FK column in t2 that references t1
    const fkCol = t2.columns.find(c =>
      c.name === `${t1.name.toLowerCase().replace(/s$/, '')}_id` ||
      c.name === `${t1.name.toLowerCase()}_id`
    );

    if (tc1 && fkCol) {
      return (
        `-- WASM Benchmark: LEFT JOIN + GROUP BY\n` +
        `SELECT t1."${tc1.name}", COUNT(t2.rowid) AS joined_count${nc2 ? `, AVG(t2."${nc2.name}") AS avg_val` : ''}\n` +
        `FROM "${t1.name}" t1\n` +
        `LEFT JOIN "${t2.name}" t2 ON t2."${fkCol.name}" = t1."id"\n` +
        `GROUP BY t1."${tc1.name}"\n` +
        `ORDER BY joined_count DESC\n` +
        `LIMIT 10;`
      );
    }
  }

  // Scenario B: Single table — GROUP BY + AVG aggregation
  const t = tables[0];
  const tc = textCol(t);
  const nc = numCol(t);

  if (tc && nc) {
    return (
      `-- WASM Benchmark: GROUP BY + AVG\n` +
      `SELECT "${tc.name}", COUNT(*) AS cnt, AVG("${nc.name}") AS avg_val\n` +
      `FROM "${t.name}"\n` +
      `GROUP BY "${tc.name}"\n` +
      `ORDER BY avg_val DESC\n` +
      `LIMIT 10;`
    );
  }

  // Scenario C: Fallback — ordered range scan (still exercises the B-tree)
  return (
    `-- WASM Benchmark: Ordered Range Scan\n` +
    `SELECT * FROM "${t.name}"\n` +
    `WHERE rowid BETWEEN 400 AND 600\n` +
    `ORDER BY rowid DESC\n` +
    `LIMIT 10;`
  );
}

// ─── HELPER: Sanitize PostgreSQL DDL → SQLite-compatible DDL ──────────────────
/**
 * SQLite doesn't support many PostgreSQL types (UUID, JSONB, TIMESTAMPTZ, etc.).
 * This function maps them to SQLite's 5 type classes: INTEGER, REAL, TEXT, BLOB, NULL.
 *
 * Design: pure regex replacements in a chain (O(n) per replacement, fast on DDL).
 * No AST parsing needed because we're replacing type-name tokens, not structure.
 */
function sanitizeForSQLite(ddl) {
  return ddl
    // ── Serial types → INTEGER (SQLite ROWID handles autoincrement) ────────
    .replace(/\b(BIG|SMALL)?SERIAL\b/gi, 'INTEGER')
    // ── UUID → TEXT ────────────────────────────────────────────────────────
    .replace(/\bUUID\b/gi, 'TEXT')
    // ── JSON/JSONB → TEXT ───────────────────────────────────────────────────
    .replace(/\bJSONB?\b/gi, 'TEXT')
    // ── Timestamp variants → TEXT ───────────────────────────────────────────
    .replace(/\bTIMESTAMP(?:TZ| WITH TIME ZONE| WITHOUT TIME ZONE)?\b/gi, 'TEXT')
    // ── VARCHAR(n) / CHAR(n) → TEXT ─────────────────────────────────────────
    .replace(/\b(?:VAR)?CHAR\s*\(\s*\d+\s*\)/gi, 'TEXT')
    // ── NUMERIC(p,s) / DECIMAL(p,s) → REAL ──────────────────────────────────
    .replace(/\b(?:NUMERIC|DECIMAL)\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'REAL')
    .replace(/\b(?:NUMERIC|DECIMAL)\b/gi, 'REAL')
    // ── DOUBLE PRECISION / FLOAT(n) → REAL ──────────────────────────────────
    .replace(/\bDOUBLE PRECISION\b/gi, 'REAL')
    .replace(/\bFLOAT\s*\(\s*\d+\s*\)/gi, 'REAL')
    // ── BOOLEAN → INTEGER (SQLite has no native BOOL) ────────────────────────
    .replace(/\bBOOL(?:EAN)?\b/gi, 'INTEGER')
    // ── BYTEA → BLOB ─────────────────────────────────────────────────────────
    .replace(/\bBYTEA\b/gi, 'BLOB')
    // ── PG-specific types → TEXT ─────────────────────────────────────────────
    .replace(/\b(?:CITEXT|INET|CIDR|MACADDR|POINT|LINE|POLYGON|TSVECTOR|TSQUERY|XML|MONEY|BIT\s*\(\s*\d+\s*\))\b/gi, 'TEXT')
    // ── PG-specific DEFAULT functions → SQLite equivalent ───────────────────
    .replace(/DEFAULT\s+NOW\s*\(\)/gi, "DEFAULT (datetime('now'))")
    .replace(/DEFAULT\s+CURRENT_TIMESTAMP/gi, "DEFAULT (datetime('now'))")
    .replace(/DEFAULT\s+gen_random_uuid\s*\(\)/gi, "DEFAULT '00000000-0000-0000-0000-000000000000'")
    .replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '')
    // ── PG-only clauses to remove ────────────────────────────────────────────
    .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
    // ── DROP: CREATE INDEX (SQLite supports it but slows inserts; skip for bench)
    .replace(/CREATE\s+(?:UNIQUE\s+)?INDEX[^;]+;/gi, '')
    // ── DROP: ALTER TABLE (might reference types/sequences not in SQLite)
    .replace(/ALTER\s+TABLE[^;]+;/gi, '')
    // ── DROP: CREATE SEQUENCE
    .replace(/CREATE\s+SEQUENCE[^;]+;/gi, '')
    // ── DROP: PG-specific TABLESPACE / OWNER references
    .replace(/TABLESPACE\s+\w+/gi, '')
    .replace(/OWNER\s+TO\s+\w+/gi, '');
}
