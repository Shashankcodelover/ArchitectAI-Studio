/**
 * mockDataGenerator.js
 *
 * Deterministic mock data engine.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pattern: Strategy Pattern for value generation.
 *   - parseDDL()        → extracts { name, columns[] } per table from DDL text
 *   - mockValue()       → dispatches to the right mock strategy by column name/type
 *   - generateInserts() → builds batched INSERT SQL strings (100 rows/batch)
 *
 * RAM Budget:
 *   - 1,000 rows × 10 cols × ~30 bytes avg = ~300 KB of SQL string per table
 *   - Built lazily in a loop, never all in memory at once
 *   - GC-eligible immediately after db.run() consumes each batch string
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── 1. DDL PARSER ─────────────────────────────────────────────────────────────
/**
 * parseDDL — Extracts table definitions from a PostgreSQL DDL string.
 * Handles: quoted identifiers, IF NOT EXISTS, multi-line column lists.
 *
 * @param   {string}  ddl  — Raw SQL DDL text
 * @returns {Array<{ name: string, columns: Array<{name,type}> }>}
 */
export function parseDDL(ddl) {
  const tables = [];

  // Match: CREATE TABLE [IF NOT EXISTS] ["schema".]"tablename" ( ... );
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'`]?\w+["'`]?\.)?\s*["'`]?(\w+)["'`]?\s*\(([\s\S]*?)\)\s*;/gi;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(ddl)) !== null) {
    const tableName = tableMatch[1];
    const columnBlock = tableMatch[2];

    const columns = [];

    // Split on commas — but not commas inside parentheses (e.g. NUMERIC(10,2))
    const lines = splitColumns(columnBlock);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Skip table-level constraints
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|INDEX|EXCLUDE)/i.test(line)) continue;

      // Match: [optionally quoted] column_name  data_type
      const colMatch = line.match(/^["'`]?(\w+)["'`]?\s+(\w+)/);
      if (colMatch) {
        columns.push({
          name: colMatch[1].toLowerCase(),
          type: colMatch[2].toLowerCase(),
        });
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
    }
  }

  return tables;
}

/** Splits a column definition block on commas, respecting nested parens */
function splitColumns(block) {
  const lines = [];
  let depth = 0;
  let current = '';
  for (const ch of block) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { lines.push(current); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

// ─── 2. MOCK VALUE STRATEGY ─────────────────────────────────────────────────────
/**
 * mockValue — Returns a SQL-safe literal string for a given column at row `i`.
 *
 * Strategy: column-name signals take priority over data-type signals.
 * This mimics real-world tooling like Mockaroo or Faker.js — but in 100 lines
 * of pure JS with zero dependencies and zero random() calls (deterministic).
 *
 * @param {string} colName
 * @param {string} colType  — SQLite-compatible type after sanitization
 * @param {number} i        — 1-indexed row number
 */
function mockValue(colName, colType, i) {
  const n = colName.toLowerCase();
  const t = colType.toLowerCase();

  // ── UUID / ID columns ────────────────────────────────────────────────────
  if (n === 'id' || n.endsWith('_id') || t === 'uuid') {
    // Fake UUID-shaped value, deterministic per row
    const hex = i.toString(16).padStart(8, '0');
    return `'${hex}-abcd-4${hex.slice(0,3)}-8000-000000000000'`;
  }

  // ── TEXT / VARCHAR patterns ──────────────────────────────────────────────
  if (t.includes('text') || t.includes('varchar') || t.includes('char') || t === 'text') {
    if (n.includes('email'))                     return `'user${i}@architect.dev'`;
    if (n.includes('first') && n.includes('name')) return `'First${i}'`;
    if (n.includes('last')  && n.includes('name')) return `'Last${i}'`;
    if (n.includes('username'))                  return `'user_${i}'`;
    if (n.includes('name'))                      return `'Record ${i}'`;
    if (n.includes('title'))                     return `'Title ${i}'`;
    if (n.includes('slug'))                      return `'slug-${i}'`;
    if (n.includes('url') || n.includes('link')) return `'https://example.com/item/${i}'`;
    if (n.includes('phone'))                     return `'+1-555-${String(i).padStart(4, '0')}'`;
    if (n.includes('address'))                   return `'${i} Architecture Blvd'`;
    if (n.includes('city'))                      return `'${['Austin', 'Denver', 'Seattle', 'Chicago', 'Boston'][i % 5]}'`;
    if (n.includes('country'))                   return `'${['US', 'UK', 'CA', 'DE', 'JP'][i % 5]}'`;
    if (n.includes('status'))                    return `'${['active', 'inactive', 'pending'][i % 3]}'`;
    if (n.includes('role'))                      return `'${['admin', 'user', 'viewer'][i % 3]}'`;
    if (n.includes('type'))                      return `'type_${i % 5}'`;
    if (n.includes('description') || n.includes('bio') || n.includes('content'))
                                                 return `'Auto-generated description for row ${i}. Lorem ipsum short.'`;
    if (n.includes('color'))                     return `'#${((i * 1234567) & 0xFFFFFF).toString(16).padStart(6, '0')}'`;
    if (n.includes('token') || n.includes('secret') || n.includes('hash'))
                                                 return `'tok_${Math.abs((i * 2654435761) >>> 0).toString(36)}'`;
    if (n.includes('currency'))                  return `'${['USD', 'EUR', 'GBP', 'JPY', 'INR'][i % 5]}'`;
    if (n.includes('language') || n.includes('locale')) return `'${['en', 'de', 'fr', 'es', 'ja'][i % 5]}'`;
    if (n.includes('category'))                  return `'category_${i % 8}'`;
    if (n.includes('tag'))                       return `'tag_${i % 10}'`;
    return `'value_${i}'`;
  }

  // ── INTEGER / BIGINT ─────────────────────────────────────────────────────
  if (t.includes('int') || t.includes('serial')) {
    if (n.includes('age'))                       return `${20 + (i % 50)}`;
    if (n.includes('price') || n.includes('cost') || n.includes('amount')) return `${i * 10}`;
    if (n.includes('count') || n.includes('quantity')) return `${i % 100}`;
    if (n.includes('year'))                      return `${2018 + (i % 7)}`;
    if (n.includes('rating'))                    return `${1 + (i % 5)}`;
    if (n.includes('score'))                     return `${i % 100}`;
    if (n.includes('rank') || n.includes('position') || n.includes('order')) return `${i}`;
    if (n.includes('views') || n.includes('clicks') || n.includes('hits')) return `${i * 37}`;
    return `${i}`;
  }

  // ── REAL / DECIMAL / NUMERIC ─────────────────────────────────────────────
  if (t.includes('real') || t.includes('numeric') || t.includes('decimal') ||
      t.includes('float') || t.includes('double')) {
    if (n.includes('price') || n.includes('amount') || n.includes('cost')) return `${(i * 9.99).toFixed(2)}`;
    if (n.includes('lat'))  return `${(37.7749 + i * 0.0001).toFixed(6)}`;
    if (n.includes('lng') || n.includes('lon')) return `${(-122.4194 + i * 0.0001).toFixed(6)}`;
    if (n.includes('rating') || n.includes('score')) return `${((i % 5) + 1).toFixed(1)}`;
    if (n.includes('discount') || n.includes('tax') || n.includes('rate')) return `${(i % 30 * 0.01).toFixed(4)}`;
    return `${(i * 1.5).toFixed(2)}`;
  }

  // ── BOOLEAN / INTEGER (SQLite stores bool as 0/1) ───────────────────────
  if (t === 'integer' && (n.includes('active') || n.includes('enabled') ||
      n.includes('verified') || n.includes('published') || n.includes('is_'))) {
    return i % 5 === 0 ? '0' : '1';
  }

  // ── TIMESTAMP / DATE (stored as TEXT in SQLite after sanitization) ───────
  if (t === 'text' && (n.includes('created') || n.includes('updated') ||
      n.includes('deleted') || n.includes('at') || n.includes('date') || n.includes('time'))) {
    const d = new Date(2024, 0, 1);
    d.setDate(d.getDate() + (i % 365));
    return `'${d.toISOString().slice(0, 19)}'`;
  }

  // ── BLOB / BYTEA ─────────────────────────────────────────────────────────
  if (t === 'blob') return `X'DEADBEEF${i.toString(16).padStart(4, '0')}'`;

  // ── JSON / JSONB (TEXT after sanitization) ───────────────────────────────
  if (n.includes('meta') || n.includes('json') || n.includes('data') || n.includes('config')) {
    return `'{"key":"value_${i}","index":${i}}'`;
  }

  // ── Generic TEXT fallback ─────────────────────────────────────────────────
  return `'text_${i}'`;
}

// ─── 3. INSERT BATCH BUILDER ───────────────────────────────────────────────────
/**
 * generateInserts — Builds batched multi-value INSERT statements.
 *
 * Why batches of 100?
 *   SQLite's default page size fits ~100 rows comfortably per statement.
 *   Larger batches can hit SQLITE_MAX_VARIABLE_NUMBER limits.
 *   Smaller batches add overhead per statement. 100 is the industry sweet spot.
 *
 * @param   {Array}   tables    — output of parseDDL()
 * @param   {number}  rowCount  — rows per table (default 1000)
 * @returns {string[]}          — one batch-string per table (may contain multiple INSERTs)
 */
export function generateInserts(tables, rowCount = 1000) {
  const BATCH_SIZE = 100; // rows per INSERT statement

  return tables.map((table) => {
    // Skip tables with no usable columns (e.g. pure constraint tables)
    if (table.columns.length === 0) return '';

    const colNames = table.columns.map((c) => `"${c.name}"`).join(', ');

    // Pre-generate all row value-tuples as strings
    const allRows = [];
    for (let i = 1; i <= rowCount; i++) {
      const vals = table.columns.map((c) => mockValue(c.name, c.type, i)).join(', ');
      allRows.push(`(${vals})`);
    }

    // Chunk into batches — each batch is one INSERT statement
    const statements = [];
    for (let b = 0; b < allRows.length; b += BATCH_SIZE) {
      const chunk = allRows.slice(b, b + BATCH_SIZE).join(',\n  ');
      statements.push(`INSERT OR IGNORE INTO "${table.name}" (${colNames})\nVALUES\n  ${chunk};`);
    }

    return statements.join('\n\n');
  }).filter(Boolean);
}
