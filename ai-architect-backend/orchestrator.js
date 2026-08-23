/**
 * orchestrator.js — The LangGraph State Machine
 *
 * This is the BRAIN of the system. It defines:
 *   1. GraphState — what data flows between nodes
 *   2. Nodes — the "workers" (Architect AI, Writer AI, Tool Executor)
 *   3. Edges — how the graph routes between workers
 *   4. Persistence — MemorySaver for in-memory conversation history
 *
 * Architecture Pattern: Actor Model via Directed Graph
 *   - Each node is an actor that reads state and returns partial updates
 *   - The graph runtime merges updates back into the global state
 *   - Conditional edges replace if/else chains with a clean routing function
 *
 * Import chain: orchestrator.js → llm.js → tools.js (no circular deps)
 */

const {
    StateGraph,
    Annotation,
    MemorySaver,
} = require("@langchain/langgraph");

// PostgresSaver is optional — only loaded if DATABASE_URL is configured
let PostgresSaver, pg;
try {
    ({ PostgresSaver } = require("@langchain/langgraph-checkpoint-postgres"));
    pg = require("pg");
} catch (e) {
    console.warn("[Graph] PostgreSQL packages not available, MemorySaver will be used.");
}

const { SystemMessage, HumanMessage, ToolMessage, AIMessage } = require("@langchain/core/messages");
const { llm, llmWithTools } = require("./llm.js");
const { fetchApiStructure, generateDatabaseSchema, writeTechnicalDocumentation } = require("./tools.js");
const { spawnMockServer } = require("./mockServer.js");

// ─── 1. GLOBAL STATE DEFINITION ───────────────────────────────────────────────
// This is the "shared whiteboard" that all nodes read from and write to.
// Annotation.Root() is how LangGraph defines a typed, reducer-managed state.

const GraphState = Annotation.Root({
    // messages: accumulates the full conversation history
    // reducer: (existing, new) => concat them together
    messages: Annotation({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),

    // mode: controls routing. "blueprint" → Architect, "writer" → Writer
    // reducer: (existing, new) => prefer new value (y), fall back to existing (x)
    mode: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => "blueprint",
    }),

    // draftedBlueprint: stores the AI's first-pass architectural blueprint
    // so the Writer node can access it directly without parsing message history
    draftedBlueprint: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // retryCount: tracks how many times we've retried a malformed tool call
    // prevents infinite loops on persistent AI errors
    retryCount: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => 0,
    }),

    // isChaosMode: triggers the SRE emergency failover logic
    isChaosMode: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => false,
    }),

    // mockServerUrl: the address of the dynamically spawned mock API
    mockServerUrl: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // performanceAudit: Array of Big O complexities from the Auditor
    performanceAudit: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // securityStatus: 'CLEAN' or 'REJECTED'
    securityStatus: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => "CLEAN",
    }),

    // securityReport: Markdown string of vulnerabilities found
    securityReport: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // securityRejectionCount: prevents infinite loops between Architect and Hacker
    securityRejectionCount: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => 0,
    }),

    // capPreference: CAP Theorem constraint ('CP', 'balanced', or 'AP')
    capPreference: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => "balanced",
    }),

    // Multi-verse Branching: SQL branch output
    blueprintSQL: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // Multi-verse Branching: NoSQL branch output
    blueprintNoSQL: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // Multi-verse Branching: User's selected winner ('SQL' or 'NoSQL')
    selectedUniverse: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
});

// ─── 2. SYSTEM PROMPTS ────────────────────────────────────────────────────────
// Extracted as constants so they're easy to tune without touching node logic

const ARCHITECT_SYSTEM_PROMPT = `You are a Senior Systems Architect with 20 years of experience designing scalable, production-grade software systems.

## Your Responsibilities:
1. Analyze the user's requirements thoroughly before responding
2. Design complete, opinionated system architectures with clear justification
3. Use your available tools to research technologies and generate schemas
4. Structure ALL responses in clean, professional Markdown

## Tool Usage Rules:
- ALWAYS use fetch_api_structure FIRST to gather research before designing
- Use generate_database_schema to produce actual SQL schema code
- Use write_technical_documentation for formal documentation sections
- Call ONE tool at a time. Wait for its result before proceeding.
- NEVER wrap tool calls in code blocks like \`\`\`python print(...) \`\`\`

## Response Format:
Every final response MUST include:
- ## Overview — what the system does
- ## Architecture Diagram (ASCII or Mermaid)
- ## Tech Stack — justified choices
- ## Database Schema — actual SQL
- ## API Endpoints — REST contract
- ## Scalability Considerations
- ## Next Steps`;

// ── Bug #1 Fix: New prompts for 'analysis' and 'scaffold' modes ───────────────
const ANALYSIS_SYSTEM_PROMPT = `You are a Senior Systems Architect specializing in architecture review and critique.

## Your Responsibilities:
1. Carefully analyze the provided architecture or design for weaknesses
2. Identify scalability bottlenecks, security vulnerabilities, and anti-patterns
3. Suggest concrete, actionable improvements with clear justification
4. Rate overall design quality with a scorecard

## Tool Usage Rules:
- Use fetch_api_structure to look up best practices for any technology mentioned
- Call ONE tool at a time

## Response Format:
Every review MUST include:
- ## Architecture Summary — what you understood
- ## ✅ Strengths — what is well-designed
- ## ⚠️ Issues & Risks — ranked Critical / Major / Minor
- ## 🔧 Recommended Improvements — concrete fixes with examples
- ## 📊 Quality Scorecard — rate scalability, security, maintainability, performance (1-10)
- ## Next Steps — prioritized action list`;

const SCAFFOLD_SYSTEM_PROMPT = `You are a Senior Full-Stack Developer specializing in generating production-ready project scaffolds.

## Your Responsibilities:
1. Generate a complete, runnable project structure from a blueprint or description
2. Write actual, production-quality code — NOT pseudocode or placeholders
3. Include all config files: package.json, .env.example, Dockerfile, docker-compose.yml
4. Follow modern best practices for the chosen tech stack

## Tool Usage Rules:
- Use fetch_api_structure to verify correct package names and versions
- Use generate_database_schema to generate actual SQL migration files
- Call ONE tool at a time

## Response Format:
Every scaffold MUST include:
- ## Project Structure — full directory tree
- \`\`\`json package.json — all real dependencies and npm scripts
- Core source files — actual runnable code for each
- \`\`\`env .env.example — all required environment variables
- ## Setup Instructions — numbered steps to run locally
- ## Docker Compose — for local dev environment`;

const WRITER_SYSTEM_PROMPT = `You are a Senior Technical Writer specializing in software architecture documentation.

Your job is to take the architect's blueprint and transform it into:
- Clear, professional prose a new developer can follow
- Step-by-step implementation guides
- Well-structured README files
- Architecture Decision Records (ADRs)

Always maintain technical accuracy while being readable.`;

const CHAOS_SYSTEM_PROMPT = `CRITICAL ALERT: The primary PostgreSQL database in the current architecture has suffered a catastrophic failure. 
You are the Site Reliability Engineer (SRE). 

## Your Responsibilities:
1. Immediately design a failover architecture to restore system availability.
2. Implement a Redis Cache layer to serve read traffic while the DB is down.
3. Write the Node.js Circuit Breaker logic (using Opossum or similar patterns) to handle DB timeouts and prevent cascading failures.
4. Set up a Dead Letter Queue (DLQ) for writes that failed during the outage.
5. Output the updated schema and emergency fallback code.

## Response Format:
- ## EMERGENCY FAILOVER BLUEPRINT
- ### Fault Analysis — what failed and why
- ### Resiliency Architecture — Redis + Circuit Breaker + DLQ
- ### Updated Schema & Code — provide actual runnable snippets
- ### Recovery Steps — how to restore the primary DB`;

// ── Feature #5: Red Team Prompt ───────────────────────────────────────────
const RED_TEAM_SYSTEM_PROMPT = `You are a malicious Hacker and Security Auditor (Red Team).
Your goal is to find ONE critical vulnerability in the drafted architecture.
Look for: No Password Hashing, SQL Injection vectors, lack of CORS policy, Plaintext JWTs, or missing Authorization logic.

## Response Format
If you find a flaw:
1. Start your response exactly with "REJECTED" on the first line.
2. Below that, provide a 'Vulnerability Report' detailing the flaw and how an attacker exploits it.

If the architecture is completely secure against the OWASP Top 10:
1. Start your response exactly with "CLEAN" on the first line.
2. Below that, provide a short 'All Clear' message.`;

// ── Feature #4: Auditor Prompt ─────────────────────────────────────────────
const AUDITOR_SYSTEM_PROMPT = `You are a Performance Engineer. Analyze the provided database schema and API logic.
Identify the Big O algorithmic complexity for the primary operations.
If you find a 'Full Table Scan' or a 'Nested Loop' in the logic, flag it as O(N^2) or higher.

## Response Format
You MUST output a markdown code block tagged as \`\`\`json containing an array of objects:
[
  {
    "operation": "Name of the API endpoint or DB query",
    "complexity": "O(1), O(log N), O(N), or O(N^2)",
    "suggestion": "Specific optimization (e.g., 'Add a B-Tree Index' or 'Use a Redis Hash')"
  }
]
Output ONLY the JSON block. Do not include any other text.`;

/**
 * getArchitectPrompt — Returns the correct system prompt for the current mode.

 * Bug #1 Fix: architectNode is now fully mode-aware.
 */
const getArchitectPrompt = (mode) => {
    switch (mode) {
        case "analysis": return ANALYSIS_SYSTEM_PROMPT;
        case "scaffold": return SCAFFOLD_SYSTEM_PROMPT;
        default:         return ARCHITECT_SYSTEM_PROMPT; // blueprint + fallback
    }
};

// ─── 3. NODE DEFINITIONS ─────────────────────────────────────────────────────

/**
 * architectNode — The primary AI agent.
 * Receives the full conversation history, generates a response (possibly with tool calls).
 */
const architectNode = async (state) => {
    console.log(`\n[Graph] 🏗️  Architect Node | mode: ${state.mode} | Messages: ${state.messages.length}`);

    // Bug #1 Fix: Use mode-specific system prompt instead of a hardcoded one
    let systemPrompt = getArchitectPrompt(state.mode);

    // Feature #6: Dynamic CAP Theorem Injection
    if (state.capPreference === "CP") {
        systemPrompt += "\n\nCRITICAL SYSTEM CONSTRAINT: The user demands Strict Consistency (CP). You MUST design a relational schema (PostgreSQL). You MUST implement transactional boundaries and mention Two-Phase Commits (2PC) if microservices are used. Absolutely no NoSQL allowed.";
    } else if (state.capPreference === "AP") {
        systemPrompt += "\n\nCRITICAL SYSTEM CONSTRAINT: The user demands High Availability (AP). You MUST design a distributed NoSQL schema (e.g., Cassandra or DynamoDB). You MUST implement eventual consistency patterns, message queues (Kafka/RabbitMQ), and conflict resolution strategies. Do not use strict relational constraints.";
    }

    const response = await llmWithTools.invoke([
        new SystemMessage(systemPrompt),
        ...state.messages,
    ]);

    // Log what the AI decided to do (text response vs tool call)
    if (response.tool_calls?.length > 0) {
        console.log(`[Graph] AI wants to call tools:`, response.tool_calls.map(t => t.name));
    } else {
        console.log(`[Graph] AI produced final text response (${response.content?.length || 0} chars)`);
    }

    // Extract blueprint text for potential use by the writer node
    const draftedBlueprint = typeof response.content === "string"
        ? response.content
        : response.content?.map?.(p => p.text || "").join("") || null;

    return {
        messages: [response],
        draftedBlueprint,
    };
};

/**
 * sqlArchitectNode — The Parallel SQL Universe
 */
const sqlArchitectNode = async (state) => {
    console.log(`\n[Graph] 🔱  Multiverse Branch: SQL Universe`);
    const prompt = ARCHITECT_SYSTEM_PROMPT + "\n\nCRITICAL MULTIVERSE RULE: You MUST design a strictly RELATIONAL architecture using PostgreSQL. Use Foreign Keys, Joins, and 3rd Normal Form. Do not use NoSQL.";
    
    const response = await llm.invoke([
        new SystemMessage(prompt),
        ...state.messages,
    ]);
    
    return { blueprintSQL: response.content };
};

/**
 * nosqlArchitectNode — The Parallel NoSQL Universe
 */
const nosqlArchitectNode = async (state) => {
    console.log(`\n[Graph] 🔱  Multiverse Branch: NoSQL Universe`);
    const prompt = ARCHITECT_SYSTEM_PROMPT + "\n\nCRITICAL MULTIVERSE RULE: You MUST design a strictly DOCUMENT-based architecture (e.g. MongoDB/Cassandra). Focus on denormalization, embedded arrays, and high-throughput scalability. Do not use relational SQL.";
    
    const response = await llm.invoke([
        new SystemMessage(prompt),
        ...state.messages,
    ]);
    
    return { blueprintNoSQL: response.content };
};

/**
 * multiverseDecisionNode — The Convergence Point (Fan-In)
 * This node marks the point where we wait for human input.
 */
const multiverseDecisionNode = async (state) => {
    console.log(`\n[Graph] 🏁 Multiverse Convergence — Waiting for Human Selection...`);
    return {};
};

// ── Feature #5: Security Red Team Node ─────────────────────────────────────────
const securityRedTeamNode = async (state) => {
    console.log(`\n[Graph] 🕵️  Red Team Node Activated`);

    const response = await llm.invoke([
        new SystemMessage(RED_TEAM_SYSTEM_PROMPT),
        new HumanMessage(`Analyze this architecture for vulnerabilities:\n\n${state.draftedBlueprint || ""}`)
    ]);

    const content = response.content || "";
    const isRejected = content.trim().startsWith("REJECTED");
    
    // Prevent infinite loops: cap rejections at 3
    const currentRejections = state.securityRejectionCount || 0;
    const finalStatus = (isRejected && currentRejections < 3) ? "REJECTED" : "CLEAN";

    console.log(`[Graph] Red Team Status: ${finalStatus} (Rejections: ${currentRejections})`);

    const stateUpdate = {
        securityStatus: finalStatus,
        securityReport: content,
        securityRejectionCount: isRejected ? currentRejections + 1 : currentRejections,
    };

    if (isRejected) {
        stateUpdate.messages = [new HumanMessage(`SECURITY REJECTION:\n${content}\n\nPlease fix these vulnerabilities.`)];
    }

    return stateUpdate;
};

// ── Feature #4: Performance Auditor Node ───────────────────────────────────────
const performanceAuditorNode = async (state) => {
    console.log(`\n[Graph] ⚡ Auditor Node Activated`);

    const response = await llm.invoke([
        new SystemMessage(AUDITOR_SYSTEM_PROMPT),
        new HumanMessage(`Analyze the complexity of this architecture:\n\n${state.draftedBlueprint || ""}`)
    ]);

    let performanceAudit = null;
    try {
        // Extract JSON from markdown code block
        const match = response.content.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
            performanceAudit = JSON.parse(match[1]);
        } else {
            // Fallback attempt if no code block
            performanceAudit = JSON.parse(response.content);
        }
        console.log(`[Graph] Auditor extracted ${performanceAudit?.length || 0} complexity metrics.`);
    } catch (e) {
        console.warn(`[Graph] ⚠️ Auditor failed to parse JSON:`, e.message);
    }

    return { performanceAudit };
};

/**
 * writerNode — The documentation agent.
 * Takes the drafted blueprint and produces polished technical writing.
 */
const writerNode = async (state) => {
    console.log(`\n[Graph] ✍️  Writer Node Activated`);

    // Bug #12 Fix: Writer should use plain llm — it never needs to call tools.
    // Using llmWithTools here caused the Writer to hallucinate tool calls.
    const response = await llm.invoke([
        new SystemMessage(WRITER_SYSTEM_PROMPT),
        new HumanMessage(
            `Please write comprehensive technical documentation based on this architectural blueprint:\n\n${state.draftedBlueprint || "No blueprint available yet."}\n\nFull conversation history follows:`
        ),
        ...state.messages,
    ]);

    return { messages: [response] };
};

/**
 * chaosNode — The emergency SRE agent.
 * Triggered when isChaosMode is true. Designs failover systems.
 */
const chaosNode = async (state) => {
    console.log(`\n[Graph] 🚨 CHAOS MONKEY ACTIVATED | SRE Node`);

    const response = await llm.invoke([
        new SystemMessage(CHAOS_SYSTEM_PROMPT),
        new HumanMessage(
            `The system is DOWN. Here is the current architecture we need to fix:\n\n${state.draftedBlueprint || "No blueprint available."}`
        ),
        ...state.messages,
    ]);

    return { 
        messages: [response],
        isChaosMode: false // Reset after handling
    };
};

/**
 * mockServerNode — Spawns a live mock API based on the AI's design.
 */
const mockServerNode = async (state, config) => {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return {};

    console.log(`\n[Graph] 🌐 Mock Server Node Activated | thread: ${threadId}`);

    // We use the draftedBlueprint (the AI's last markdown response) to parse endpoints
    const blueprint = state.draftedBlueprint;
    if (!blueprint) {
        console.log("[Graph] No blueprint available to mock.");
        return {};
    }

    try {
        const mockInfo = await spawnMockServer(blueprint, threadId);
        
        if (mockInfo) {
            console.log(`[Graph] ✅ Mock Server Ready at ${mockInfo.url}`);
            return {
                mockServerUrl: mockInfo.url
            };
        }
    } catch (err) {
        console.error("[Graph] ❌ Failed to spawn mock server:", err.message);
    }

    return {};
};

/**
 * toolNode — Executes tool calls requested by the AI.
 * This is a CUSTOM implementation (not the built-in ToolNode) for maximum reliability.
 * It handles malformed calls gracefully and dispatches to the correct tool.
 */
const toolNode = async (state) => {
    console.log(`\n[Graph] 🔧 Tool Node Activated`);
    const lastMessage = state.messages[state.messages.length - 1];

    // ── Malformed Call Recovery ──────────────────────────────────────────────
    // Gemini sometimes sends a MALFORMED_FUNCTION_CALL when the schema is too complex.
    // We detect this and send corrective feedback back to the AI instead of crashing.
    if (lastMessage.additional_kwargs?.finishReason === "MALFORMED_FUNCTION_CALL") {
        const currentRetries = state.retryCount || 0;

        if (currentRetries >= 2) {
            console.error("[Graph] ❌ Max retries reached. Sending error to client.");
            return {
                messages: [new HumanMessage(
                    "System Error: The AI repeatedly failed to form a valid tool call. Please simplify your request."
                )],
                retryCount: currentRetries + 1,
            };
        }

        console.warn(`[Graph] ⚠️  Malformed tool call detected (retry ${currentRetries + 1}/2). Sending feedback...`);
        return {
            messages: [new HumanMessage(
                "System: Your last tool call was malformed. Use ONE simple tool at a time. Do NOT wrap calls in code blocks. Ensure all required fields are strings, not objects."
            )],
            retryCount: currentRetries + 1,
        };
    }

    // ── No Tool Calls Found ──────────────────────────────────────────────────
    if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
        console.log("[Graph] Tool node found no tool calls, passing through.");
        return { messages: [] };
    }

    // ── Execute Each Tool Call ───────────────────────────────────────────────
    const toolMap = {
        fetch_api_structure: fetchApiStructure,
        generate_database_schema: generateDatabaseSchema,
        write_technical_documentation: writeTechnicalDocumentation,
    };

    const toolResults = [];

    for (const toolCall of lastMessage.tool_calls) {
        console.log(`[Graph] Executing tool: "${toolCall.name}" with args:`, toolCall.args);

        const selectedTool = toolMap[toolCall.name];

        if (!selectedTool) {
            console.warn(`[Graph] ⚠️  Unknown tool: "${toolCall.name}"`);
            toolResults.push(new ToolMessage({
                tool_call_id: toolCall.id,
                content: `Error: Tool "${toolCall.name}" does not exist. Available tools: ${Object.keys(toolMap).join(", ")}`,
            }));
            continue;
        }

        try {
            // LangChain's tool.invoke() handles schema validation via Zod automatically
            const output = await selectedTool.invoke(toolCall);
            const outputStr = typeof output === "string" ? output : JSON.stringify(output, null, 2);

            console.log(`[Graph] ✅ Tool "${toolCall.name}" returned ${outputStr.length} chars`);

            toolResults.push(new ToolMessage({
                tool_call_id: toolCall.id,
                content: outputStr,
            }));
        } catch (toolError) {
            console.error(`[Graph] ❌ Tool "${toolCall.name}" threw an error:`, toolError.message);
            toolResults.push(new ToolMessage({
                tool_call_id: toolCall.id,
                content: `Error executing tool: ${toolError.message}. Please try again with different arguments.`,
            }));
        }
    }

    return { messages: toolResults };
};

// ─── 4. ROUTING FUNCTIONS ─────────────────────────────────────────────────────

/**
 * routeRequest — Entry router. Runs once at the start.
 * Decides whether to send the request to Architect or Writer mode.
 */
const routeRequest = (state) => {
    if (state.isChaosMode) {
        console.log(`[Graph] 🚨 Routing to: chaosNode (CHAOS MODE)`);
        return "chaosNode";
    }
    const destination = state.mode === "writer" ? "writerNode" : "architectNode";

    // Feature #7: Parallel Branching for Multiverse mode
    if (state.mode === "multiverse") {
        console.log(`[Graph] 🔱  Fanning out to Parallel Universes: [sqlArchitectNode, nosqlArchitectNode]`);
        return ["sqlArchitectNode", "nosqlArchitectNode"];
    }

    console.log(`[Graph] 🔀 Routing to: ${destination} (mode: ${state.mode})`);
    return destination;
};

/**
 * shouldContinue — Post-AI router. Runs after each AI response.
 * Decides whether to call tools, end, or handle errors.
 */
const shouldContinue = (state) => {
    const lastMessage = state.messages[state.messages.length - 1];

    // If the AI requested tool calls → execute them
    if (lastMessage.tool_calls?.length > 0) {
        console.log(`[Graph] 🔀 Routing to: tools (${lastMessage.tool_calls.length} calls pending)`);
        return "tools";
    }

    // If the AI sent a malformed call → handle in tool node
    if (lastMessage.additional_kwargs?.finishReason === "MALFORMED_FUNCTION_CALL") {
        console.warn("[Graph] 🔀 Routing to: tools (malformed call recovery)");
        return "tools";
    }

    // Max retries exceeded → end the graph to prevent infinite loops
    if ((state.retryCount || 0) >= 3) {
        console.error("[Graph] 🔀 Max retries exceeded → __end__");
        return "__end__";
    }

    // Normal text response → we're done!
    console.log("[Graph] 🔀 Routing to: __end__ (final response ready)");
    return "__end__";
};

// ─── 5. GRAPH COMPILATION ─────────────────────────────────────────────────────

const workflow = new StateGraph(GraphState)
    // Register nodes
    .addNode("architectNode", architectNode)
    .addNode("sqlArchitectNode", sqlArchitectNode)
    .addNode("nosqlArchitectNode", nosqlArchitectNode)
    .addNode("multiverseDecisionNode", multiverseDecisionNode)
    .addNode("writerNode", writerNode)
    .addNode("chaosNode", chaosNode)
    .addNode("mockServerNode", mockServerNode)
    .addNode("securityRedTeamNode", securityRedTeamNode)
    .addNode("performanceAuditorNode", performanceAuditorNode)
    .addNode("tools", toolNode)
    // Entry point: route based on mode or chaos
    .addConditionalEdges("__start__", routeRequest)
    // Fan-in: Multiverse branches converge here
    .addEdge("sqlArchitectNode", "multiverseDecisionNode")
    .addEdge("nosqlArchitectNode", "multiverseDecisionNode")
    // After decision is made, proceed to security/auditing
    .addEdge("multiverseDecisionNode", "securityRedTeamNode")
    // After architect responds: check if tools needed, or if we should spawn mock server
    .addConditionalEdges("architectNode", (state) => {
        const next = shouldContinue(state);
        // Feature #5: Route to Red Team instead of ending directly
        if (next === "__end__" && state.mode === "blueprint") {
            return "securityRedTeamNode";
        }
        return next;
    })
    // Feature #5 & #4: Security Loop and Auditor routing
    .addConditionalEdges("securityRedTeamNode", (state) => {
        if (state.securityStatus === "REJECTED") {
            return "architectNode";
        }
        return "performanceAuditorNode";
    })
    .addEdge("performanceAuditorNode", "mockServerNode")
    // After writer responds: check if tools needed or done
    .addConditionalEdges("writerNode", shouldContinue)
    // After chaos responds: we're done with the emergency fix
    .addConditionalEdges("chaosNode", shouldContinue)
    // After mock server is ready: we are officially done
    .addEdge("mockServerNode", "__end__")
    // After tools run: always return to the architect for synthesis
    .addEdge("tools", "architectNode");

// ─── 6. PERSISTENCE (Checkpointer) ────────────────────────────────────────────
// MemorySaver: in-memory, resets on restart. Default for dev.
// PostgresSaver: persistent across restarts. Used when DATABASE_URL is set.

let checkpointer = new MemorySaver();
console.log("[Graph] Using MemorySaver for session persistence.");

// Multiverse Feature: List of nodes that require human-in-the-loop selection
const INTERRUPT_NODES = ["multiverseDecisionNode"];

// Internal mutable graph reference — swapped when Postgres is ready
let _compiledGraph = workflow.compile({ checkpointer, interruptBefore: INTERRUPT_NODES });

/**
 * appGraph — JavaScript Proxy wrapping _compiledGraph.
 *
 * Bug #3 Fix: Previously, initPostgresCheckpointer() returned a new checkpointer
 * but never recompiled the graph with it. The destructured `appGraph` in server.js
 * held a stale reference forever — Postgres persistence silently never activated.
 *
 * Solution: Export a Proxy that always delegates to the CURRENT _compiledGraph.
 * When Postgres init succeeds, it reassigns _compiledGraph. The Proxy means
 * server.js automatically uses the new graph with ZERO code changes there.
 */
const appGraph = new Proxy({}, {
    get(_, prop) {
        const val = _compiledGraph[prop];
        return typeof val === "function" ? val.bind(_compiledGraph) : val;
    },
});

// Async setup for PostgreSQL — runs in the background after server starts
const initPostgresCheckpointer = async () => {
    if (!process.env.DATABASE_URL || !PostgresSaver || !pg) return;

    try {
        const pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            connectionTimeoutMillis: 3000,
            max: 10,
        });

        await pool.query("SELECT 1"); // Test connection before committing

        const pgSaver = PostgresSaver.fromConnString(process.env.DATABASE_URL);
        await pgSaver.setup(); // Creates checkpoint tables if they don't exist

        // Bug #3 Fix: Recompile AND update the internal reference.
        // The Proxy automatically picks up the new _compiledGraph.
        _compiledGraph = workflow.compile({ checkpointer: pgSaver, interruptBefore: INTERRUPT_NODES });
        console.log("[Graph] ✅ PostgreSQL ready. Graph recompiled with persistent checkpointer.");

        return pgSaver;
    } catch (err) {
        console.warn(`[Graph] ⚠️  PostgreSQL unavailable (${err.message}). Keeping MemorySaver.`);
        return null;
    }
};

// ─── 7. EXPORT ────────────────────────────────────────────────────────────────
module.exports = {
    appGraph,       // Proxy — always points to current compiled graph
    GraphState,
    initPostgresCheckpointer,
    workflow,
};
