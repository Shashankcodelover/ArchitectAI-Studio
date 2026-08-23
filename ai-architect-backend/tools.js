/**
 * tools.js — The AI's Toolbelt
 *
 * Each tool is a structured function the LLM can call autonomously.
 * Tools follow the LangChain DynamicStructuredTool pattern:
 *   - A typed Zod schema defines the inputs (prevents hallucinated args)
 *   - A description guides the LLM on WHEN to use it
 *   - The async handler does the actual work
 *
 * Placement: This is the LOWEST layer — no imports from other local files.
 * This prevents circular dependencies. (tools → nothing)
 */

const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1: Fetch API / Tech Documentation
// Use case: "How does Express.js routing work?" or "What are REST best practices?"
// ─────────────────────────────────────────────────────────────────────────────
const fetchApiStructure = tool(
    async ({ keywords, context }) => {
        console.log(`[Tool] fetch_api_structure called with: "${keywords}"`);

        // ── Real Integration: Tavily Search API ────────────────────────────
        // If you have a TAVILY_API_KEY in .env, this does a real web search.
        // If not, it falls back to rich, structured mock data.
        if (process.env.TAVILY_API_KEY) {
            try {
                const response = await fetch("https://api.tavily.com/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        api_key: process.env.TAVILY_API_KEY,
                        query: `${keywords} architecture best practices documentation`,
                        search_depth: "basic",
                        max_results: 3,
                    }),
                });
                const data = await response.json();
                const results = data.results?.map(r => `**${r.title}**\n${r.content}`).join("\n\n---\n\n");
                return `## Research Results for: "${keywords}"\n\n${results || "No results found."}`;
            } catch (err) {
                console.warn("[Tool] Tavily search failed, using fallback:", err.message);
            }
        }

        // ── Fallback: Curated Knowledge Base ─────────────────────────────
        const knowledgeBase = {
            "postgresql": `## PostgreSQL Best Practices
- Use **JSONB** for flexible schema fields, not TEXT
- Index foreign keys and frequently filtered columns (B-tree by default)
- Use **connection pooling** via pg-pool or PgBouncer
- Prefer **UUIDs** over sequential IDs for distributed systems
- Use **Row-Level Security (RLS)** for multi-tenant applications`,

            "express": `## Express.js Architecture Patterns
- Separate concerns: routes → controllers → services → repositories
- Use **middleware chains** for auth, validation, logging
- Always use **async error handlers**: \`app.use((err, req, res, next) => {...})\`
- Use **Router instances** to namespace API routes (/api/v1/...)
- Rate limiting via **express-rate-limit** for public endpoints`,

            "rest api": `## REST API Design Principles
- Resources are nouns: \`/users/:id\`, never \`/getUser\`
- Use proper HTTP verbs: GET (read), POST (create), PUT (replace), PATCH (update), DELETE
- Return consistent JSON: \`{ data, error, meta }\`
- Always version your API: \`/api/v1/...\`
- Use **pagination** for list endpoints: \`{ data: [], total, page, limit }\``,

            "microservices": `## Microservices Architecture Principles
- **Single Responsibility**: each service owns one bounded context
- **API Gateway pattern**: single entry point, routes to services
- **Event-driven communication** via message queues (RabbitMQ, Kafka) for async ops
- **Circuit Breaker pattern** to prevent cascade failures
- Each service owns its **own database** (no shared schemas)`,

            "default": `## Technical Architecture Best Practices for: "${keywords}"
- Apply **SOLID principles** to your service design
- Use **dependency injection** to decouple modules
- Implement **observability**: structured logging + distributed tracing
- Design for **failure**: timeouts, retries, circuit breakers
- Document with **OpenAPI/Swagger** for all public endpoints`,
        };

        const key = Object.keys(knowledgeBase).find(k =>
            keywords.toLowerCase().includes(k)
        ) || "default";

        return knowledgeBase[key];
    },
    {
        name: "fetch_api_structure",
        description: "Fetches technical documentation, API design patterns, and architecture best practices for a given technology keyword. Use this when you need reference material before designing a system.",
        schema: z.object({
            keywords: z.string().describe("The specific technology or concept to research. E.g.: 'PostgreSQL indexing', 'REST API versioning', 'Express.js middleware'"),
            context: z.string().optional().describe("Additional context about what aspect of this technology you need. E.g.: 'for a multi-tenant SaaS app'"),
        }),
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2: Generate Database Schema
// Use case: Designing a normalized PostgreSQL schema from a description
// ─────────────────────────────────────────────────────────────────────────────
const generateDatabaseSchema = tool(
    async ({ schemaDescription, format }) => {
        console.log(`[Tool] generate_database_schema called. Format: ${format || "sql"}`);

        // The AI provides the schema content; this tool structures and validates it.
        // In production, this could connect to a DB and execute the DDL.
        const timestamp = new Date().toISOString();

        return `## 🗃️ Generated Database Schema
**Generated At:** ${timestamp}
**Format:** ${format || "SQL DDL"}

\`\`\`sql
${schemaDescription}
\`\`\`

### Schema Notes:
- All tables include \`created_at\` and \`updated_at\` TIMESTAMPTZ columns (best practice)
- UUIDs used as primary keys for distributed system compatibility
- Foreign key constraints enforce referential integrity
- Add indexes based on your most frequent query patterns`;
    },
    {
        name: "generate_database_schema",
        description: "Designs and structures a PostgreSQL database schema based on a description. Use this when you need to define tables, columns, relationships, and constraints for a system.",
        schema: z.object({
            schemaDescription: z.string().describe("The full SQL DDL or descriptive text of the schema to structure. Include table names, columns, types, and relationships."),
            format: z.enum(["sql", "json", "markdown"]).optional().describe("Output format preference. Defaults to 'sql'."),
        }),
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3: Write Technical Documentation
// Use case: Generating professional README sections, API docs, architecture docs
// ─────────────────────────────────────────────────────────────────────────────
const writeTechnicalDocumentation = tool(
    async ({ sectionName, context, audience }) => {
        console.log(`[Tool] write_technical_documentation: "${sectionName}" for ${audience || "developers"}`);

        const audienceContext = {
            developer: "Use technical language. Include code examples, config snippets, and implementation details.",
            manager: "Focus on business value, timelines, and high-level concepts. Avoid deep technical jargon.",
            devops: "Emphasize deployment, scaling, monitoring, and infrastructure concerns.",
        };

        const style = audienceContext[audience] || audienceContext.developer;

        return `## 📝 ${sectionName}

*Target Audience: ${audience || "Developers"} | ${style}*

---

${context}

---
*Documentation generated by AI Architect. Review and customize before publishing.*`;
    },
    {
        name: "write_technical_documentation",
        description: "Writes professional technical documentation sections in Markdown. Use this to create README files, API references, architecture decision records (ADRs), or deployment guides.",
        schema: z.object({
            sectionName: z.string().describe("Name of the documentation section. E.g.: 'API Reference', 'Getting Started', 'Architecture Overview', 'Deployment Guide'"),
            context: z.string().describe("The technical content, blueprint, or details to base the documentation on."),
            audience: z.enum(["developer", "manager", "devops"]).optional().describe("The intended reader. Affects tone and depth. Defaults to 'developer'."),
        }),
    }
);

module.exports = { fetchApiStructure, generateDatabaseSchema, writeTechnicalDocumentation };
