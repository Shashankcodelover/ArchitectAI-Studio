/**
 * demoData.js — Pre-recorded Demo Agent Run
 *
 * This plays back a full realistic agent execution without touching the API.
 * Used when Gemini free-tier quota is exhausted, or for offline demos.
 *
 * The sequence mimics exactly what happens when you submit:
 * "Design a Node.js REST API for a Todo app with PostgreSQL"
 */

export const DEMO_PROMPT = "Design a Node.js REST API for a Todo app with PostgreSQL";

export const DEMO_EVENTS = [
  // ── Stage 1: Architect node activates ──────────────────────────────────────
  { type: "start",      delay: 0   },
  { type: "node_enter", node: "architectNode", delay: 400 },

  // ── Stage 2: AI calls research tool ────────────────────────────────────────
  { type: "tool_call",  tool: "fetch_api_structure",
    args: { keywords: "Express.js REST API best practices" }, delay: 1200 },

  // ── Stage 3: Tools node activates ──────────────────────────────────────────
  { type: "node_enter", node: "tools", delay: 1600 },
  { type: "node_exit",  node: "tools", delay: 2800 },

  // ── Stage 4: Back to Architect with schema tool ─────────────────────────────
  { type: "node_enter", node: "architectNode", delay: 3000 },
  { type: "tool_call",  tool: "generate_database_schema",
    args: { schemaDescription: "todos, users tables" }, delay: 3400 },
  { type: "node_enter", node: "tools",          delay: 3800 },
  { type: "node_exit",  node: "tools",          delay: 5200 },
  { type: "node_enter", node: "architectNode",  delay: 5400 },

  // ── Stage 5: AI streams the final response ─────────────────────────────────
  { type: "token", content: "# Todo App — System Architecture\n\n", delay: 5800 },
  { type: "token", content: "## Overview\n\nA production-grade REST API built with ", delay: 6200 },
  { type: "token", content: "**Node.js + Express**, backed by **PostgreSQL**, ", delay: 6500 },
  { type: "token", content: "following clean architecture principles.\n\n", delay: 6800 },
  { type: "token", content: "## Tech Stack\n\n", delay: 7200 },
  { type: "token", content: "| Layer | Technology | Reason |\n|---|---|---|\n", delay: 7500 },
  { type: "token", content: "| Runtime | Node.js 20 | Non-blocking I/O, huge ecosystem |\n", delay: 7800 },
  { type: "token", content: "| Framework | Express.js | Minimal, flexible, battle-tested |\n", delay: 8100 },
  { type: "token", content: "| Database | PostgreSQL 15 | ACID compliance, JSON support |\n", delay: 8400 },
  { type: "token", content: "| Auth | JWT + bcrypt | Stateless, scalable |\n", delay: 8700 },
  { type: "token", content: "| Validation | Zod | Runtime type safety |\n\n", delay: 9000 },
  { type: "token", content: "## Database Schema\n\n```sql schema.sql\n", delay: 9400 },
  { type: "token", content: "-- Users table\nCREATE TABLE users (\n", delay: 9700 },
  { type: "token", content: "  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n", delay: 9900 },
  { type: "token", content: "  email       VARCHAR(255) UNIQUE NOT NULL,\n", delay: 10100 },
  { type: "token", content: "  password    VARCHAR(255) NOT NULL,\n", delay: 10300 },
  { type: "token", content: "  name        VARCHAR(100) NOT NULL,\n", delay: 10500 },
  { type: "token", content: "  created_at  TIMESTAMPTZ DEFAULT NOW(),\n", delay: 10700 },
  { type: "token", content: "  updated_at  TIMESTAMPTZ DEFAULT NOW()\n);\n\n", delay: 10900 },
  { type: "token", content: "-- Todos table\nCREATE TABLE todos (\n", delay: 11200 },
  { type: "token", content: "  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n", delay: 11400 },
  { type: "token", content: "  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n", delay: 11600 },
  { type: "token", content: "  title       VARCHAR(500) NOT NULL,\n", delay: 11800 },
  { type: "token", content: "  description TEXT,\n", delay: 12000 },
  { type: "token", content: "  completed   BOOLEAN DEFAULT FALSE,\n", delay: 12200 },
  { type: "token", content: "  priority    SMALLINT DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),\n", delay: 12400 },
  { type: "token", content: "  due_date    TIMESTAMPTZ,\n", delay: 12600 },
  { type: "token", content: "  created_at  TIMESTAMPTZ DEFAULT NOW(),\n", delay: 12800 },
  { type: "token", content: "  updated_at  TIMESTAMPTZ DEFAULT NOW()\n);\n\n", delay: 13000 },
  { type: "token", content: "-- Indexes for query performance\nCREATE INDEX idx_todos_user_id ON todos(user_id);\n", delay: 13300 },
  { type: "token", content: "CREATE INDEX idx_todos_completed ON todos(completed);\n```\n\n", delay: 13600 },
  { type: "token", content: "## API Routes\n\n```js server.js\n", delay: 14000 },
  { type: "token", content: "const express = require('express');\n", delay: 14200 },
  { type: "token", content: "const cors    = require('cors');\n", delay: 14400 },
  { type: "token", content: "const helmet  = require('helmet');\n\n", delay: 14600 },
  { type: "token", content: "const app = express();\n", delay: 14800 },
  { type: "token", content: "app.use(cors());\n", delay: 15000 },
  { type: "token", content: "app.use(helmet());\n", delay: 15200 },
  { type: "token", content: "app.use(express.json());\n\n", delay: 15400 },
  { type: "token", content: "// Auth routes\n", delay: 15700 },
  { type: "token", content: "app.post('/api/auth/register', authController.register);\n", delay: 15900 },
  { type: "token", content: "app.post('/api/auth/login',    authController.login);\n\n", delay: 16100 },
  { type: "token", content: "// Todo routes (protected)\n", delay: 16400 },
  { type: "token", content: "app.get   ('/api/todos',      authMiddleware, todoController.list);\n", delay: 16600 },
  { type: "token", content: "app.post  ('/api/todos',      authMiddleware, todoController.create);\n", delay: 16800 },
  { type: "token", content: "app.patch ('/api/todos/:id',  authMiddleware, todoController.update);\n", delay: 17000 },
  { type: "token", content: "app.delete('/api/todos/:id',  authMiddleware, todoController.remove);\n\n", delay: 17200 },
  { type: "token", content: "app.listen(3000, () => console.log('Server running on :3000'));\n```\n\n", delay: 17400 },
  { type: "token", content: "## Scalability Considerations\n\n", delay: 17800 },
  { type: "token", content: "- **Connection Pooling** via `pg-pool` (max: 20 connections)\n", delay: 18100 },
  { type: "token", content: "- **Redis caching** for frequent list queries (TTL: 60s)\n", delay: 18400 },
  { type: "token", content: "- **Rate limiting** via `express-rate-limit` (100 req/min per IP)\n", delay: 18700 },
  { type: "token", content: "- **Horizontal scaling** — stateless JWT means any instance handles any request\n", delay: 19000 },
  { type: "token", content: "- **Database indexing** on `user_id` and `completed` columns\n\n", delay: 19300 },
  { type: "token", content: "## Next Steps\n\n", delay: 19600 },
  { type: "token", content: "1. Add input validation with Zod schemas\n", delay: 19900 },
  { type: "token", content: "2. Implement soft deletes (`deleted_at` column)\n", delay: 20200 },
  { type: "token", content: "3. Add WebSocket support for real-time todo sync\n", delay: 20500 },
  { type: "token", content: "4. Set up CI/CD with GitHub Actions + Docker\n", delay: 20800 },

  // ── Stage 6: Done ───────────────────────────────────────────────────────────
  { type: "done", delay: 21500,
    fullContent: `# Todo App — System Architecture\n\n## Overview\n\nA production-grade REST API built with **Node.js + Express**, backed by **PostgreSQL**, following clean architecture principles.\n\n## Tech Stack\n\n| Layer | Technology | Reason |\n|---|---|---|\n| Runtime | Node.js 20 | Non-blocking I/O, huge ecosystem |\n| Framework | Express.js | Minimal, flexible, battle-tested |\n| Database | PostgreSQL 15 | ACID compliance, JSON support |\n| Auth | JWT + bcrypt | Stateless, scalable |\n| Validation | Zod | Runtime type safety |\n\n## Database Schema\n\n\`\`\`sql schema.sql\n-- Users table\nCREATE TABLE users (\n  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  email       VARCHAR(255) UNIQUE NOT NULL,\n  password    VARCHAR(255) NOT NULL,\n  name        VARCHAR(100) NOT NULL,\n  created_at  TIMESTAMPTZ DEFAULT NOW(),\n  updated_at  TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- Todos table\nCREATE TABLE todos (\n  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  title       VARCHAR(500) NOT NULL,\n  description TEXT,\n  completed   BOOLEAN DEFAULT FALSE,\n  priority    SMALLINT DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),\n  due_date    TIMESTAMPTZ,\n  created_at  TIMESTAMPTZ DEFAULT NOW(),\n  updated_at  TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- Indexes for query performance\nCREATE INDEX idx_todos_user_id ON todos(user_id);\nCREATE INDEX idx_todos_completed ON todos(completed);\n\`\`\`\n\n## API Routes\n\n\`\`\`js server.js\nconst express = require('express');\nconst cors    = require('cors');\nconst helmet  = require('helmet');\n\nconst app = express();\napp.use(cors());\napp.use(helmet());\napp.use(express.json());\n\n// Auth routes\napp.post('/api/auth/register', authController.register);\napp.post('/api/auth/login',    authController.login);\n\n// Todo routes (protected)\napp.get   ('/api/todos',      authMiddleware, todoController.list);\napp.post  ('/api/todos',      authMiddleware, todoController.create);\napp.patch ('/api/todos/:id',  authMiddleware, todoController.update);\napp.delete('/api/todos/:id',  authMiddleware, todoController.remove);\n\napp.listen(3000, () => console.log('Server running on :3000'));\n\`\`\`\n\n## Scalability Considerations\n\n- **Connection Pooling** via \`pg-pool\` (max: 20 connections)\n- **Redis caching** for frequent list queries (TTL: 60s)\n- **Rate limiting** via \`express-rate-limit\` (100 req/min per IP)\n- **Horizontal scaling** — stateless JWT means any instance handles any request\n- **Database indexing** on \`user_id\` and \`completed\` columns\n\n## Next Steps\n\n1. Add input validation with Zod schemas\n2. Implement soft deletes (\`deleted_at\` column)\n3. Add WebSocket support for real-time todo sync\n4. Set up CI/CD with GitHub Actions + Docker\n`
  },
];
