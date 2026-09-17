/**
 * server.js — The Express API Gateway
 *
 * This is the entry point and HTTP interface of the AI Architect backend.
 * It exposes a clean REST API that the React frontend communicates with.
 *
 * Import Order (critical to avoid circular dependencies):
 *   server.js → orchestrator.js → llm.js → tools.js
 *
 * Key Routes:
 *   GET  /                              → Welcome HTML page
 *   GET  /health                        → Health check + system status
 *   POST /api/architect/execute         → Main AI orchestration (with SSE streaming)
 *   GET  /api/architect/history/:id     → Retrieve conversation history
 *   GET  /api/architect/visualize       → Mermaid graph visualization
 *
 * Design Patterns:
 *   - Zod validation middleware (validate input before touching the AI)
 *   - Server-Sent Events (SSE) for real-time token streaming
 *   - Structured logging with timestamps
 */

// ─── 1. ENVIRONMENT SETUP (Must happen FIRST) ─────────────────────────────────
const dotenv = require("dotenv");
dotenv.config();

// ─── 2. DEPENDENCY VALIDATION (Fail fast) ────────────────────────────────────
const apiKey = process.env.GOOGLE_API_KEY?.trim();
if (!apiKey || !apiKey.startsWith("AIzaSy")) {
    console.error("❌ FATAL: GOOGLE_API_KEY is missing or invalid in .env");
    console.error("   Expected format: AIzaSy...");
    process.exit(1);
}
console.log("[Boot] ✅ API Key validated.");

// ─── 3. IMPORTS ───────────────────────────────────────────────────────────────
const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const { HumanMessage } = require("@langchain/core/messages");
const { appGraph, initPostgresCheckpointer } = require("./orchestrator.js");
const { terminateMockServer } = require("./mockServer.js");
const {
    CollaborativeWorkspaceState,
    sandboxCompileAndRun,
    compileGitDiffRevision,
    validateWorkspaceDiagram,
    exportSchemaJSON,
    getWorkspaceTelemetry,
} = require("./collaborative_state.js");

const workspaceState = new CollaborativeWorkspaceState();

// ─── 4. APP INITIALIZATION ────────────────────────────────────────────────────
const app = express();

// ── Middleware Stack ──────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        "http://localhost:5173",  // Vite dev server
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",  // CRA / Next.js dev server
        "http://localhost:4173",  // Vite preview
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "15mb" }));
app.use(express.text({ limit: "15mb", type: ["text/plain", "text/csv", "application/csv"] }));

// ── Structured Request Logger ─────────────────────────────────────────────────
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? "❌" : "✅";
        console.log(`[${new Date().toISOString()}] ${statusColor} ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ─── 5. VALIDATION MIDDLEWARE ─────────────────────────────────────────────────
// Generic Zod validation middleware factory.
// Usage: router.post('/path', validate(mySchema), handler)
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: "Invalid request body",
            details: result.error.flatten(),
        });
    }
    req.body = result.data; // Replace with parsed + typed data
    next();
};

// ─── 6. REQUEST SCHEMAS ───────────────────────────────────────────────────────
const executeSchema = z.object({
    prompt: z.string()
        .min(10, "Prompt must be at least 10 characters")
        .max(10000, "Prompt cannot exceed 10,000 characters"),
    // Bug #1 Fix: Accept all 4 UI modes (previously only "blueprint" | "writer")
    mode: z.enum(["blueprint", "analysis", "writer", "scaffold"]).default("blueprint"),
    thread_id: z.string().uuid("thread_id must be a valid UUID"),
    stream: z.boolean().default(false), // Set to true for SSE streaming
});

// ─── 7. ROUTES ────────────────────────────────────────────────────────────────

/**
 * GET / — Welcome Page
 * A friendly HTML page for developers who hit the backend URL directly.
 */
app.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Architect.ai Backend</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0b0e14;
            color: white;
            font-family: 'Segoe UI', system-ui, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 1.5rem;
        }
        h1 { color: #10b981; font-size: 2rem; }
        p { color: #94a3b8; }
        .badge {
            background: #10b98120;
            border: 1px solid #10b981;
            color: #10b981;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.8rem;
        }
        .links { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
        a {
            color: #6366f1;
            font-weight: 600;
            text-decoration: none;
            border: 1px solid #6366f140;
            padding: 10px 20px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        a:hover { background: #6366f120; border-color: #6366f1; }
        .endpoints {
            background: #1e2433;
            border: 1px solid #2a3147;
            border-radius: 12px;
            padding: 1.5rem 2rem;
            text-align: left;
            min-width: 400px;
        }
        code {
            font-family: 'Cascadia Code', monospace;
            background: #0b0e14;
            padding: 2px 6px;
            border-radius: 4px;
            color: #10b981;
        }
        .method { color: #f59e0b; font-weight: bold; }
    </style>
</head>
<body>
    <span class="badge">● LIVE</span>
    <h1>Architect.ai Backend</h1>
    <p>AI-powered system design engine running on Node.js + LangGraph</p>
    <div class="links">
        <a href="http://localhost:5173">→ Open Frontend (5173)</a>
        <a href="/health">→ Health Check</a>
        <a href="/api/architect/visualize">→ Graph Visualizer</a>
    </div>
    <div class="endpoints">
        <h3 style="margin-bottom: 1rem; color: #94a3b8;">API Endpoints</h3>
        <p><span class="method">POST</span> <code>/api/architect/execute</code> — Run AI agent</p>
        <br/>
        <p><span class="method">GET</span> <code>/api/architect/history/:thread_id</code> — Get chat history</p>
        <br/>
        <p><span class="method">GET</span> <code>/health</code> — System status</p>
    </div>
</body>
</html>`);
});

/**
 * GET /health — Health Check
 * Used by frontend to verify the server is alive and check its configuration.
 */
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        model: "gemini-2.0-flash",
        persistence: process.env.DATABASE_URL ? "postgresql" : "memory",
        uptime: Math.floor(process.uptime()),
        memory: {
            heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
    });
});

/**
 * POST /api/architect/execute — Main AI Execution Route
 *
 * Supports two modes:
 *   stream: false → Standard JSON response (waits for full completion)
 *   stream: true  → Server-Sent Events (streams tokens as they arrive)
 *
 * Body: { prompt, mode, thread_id, stream }
 */
app.post("/api/architect/execute", validate(executeSchema), async (req, res) => {
    const { prompt, mode, thread_id, stream } = req.body;

    console.log(`\n[API] 🚀 New request | thread: ${thread_id} | mode: ${mode} | stream: ${stream}`);
    console.log(`[API] Prompt (first 100 chars): "${prompt.substring(0, 100)}..."`);

    // Garbage Collection: Terminate existing mock server for this thread before starting new execution
    await terminateMockServer(thread_id).catch(e => console.warn(`[API] Terminate failed: ${e.message}`));

    const graphInput = {
        messages: [new HumanMessage(prompt)],
        mode,
    };

    const graphConfig = {
        configurable: { thread_id },
    };

    // ── STREAMING MODE: Server-Sent Events ────────────────────────────────────
    // Uses streamMode:"updates" so we get BOTH node-level events AND full text.
    // This lets the frontend graph animate in the correct node order.
    if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            sendEvent({ type: "start", thread_id, mode });

            // streamMode:"updates" → each chunk = { nodeName: { stateUpdate } }
            // This fires once per node completion with that node's state changes.
            const graphStream = appGraph.stream(graphInput, {
                ...graphConfig,
                streamMode: "updates",
            });

            let fullContent = "";

            for await (const chunk of await graphStream) {
                for (const [nodeName, stateUpdate] of Object.entries(chunk)) {
                    // 1. Announce which node just activated
                    sendEvent({ type: "node_enter", node: nodeName });

                    // 2. Extract messages from this node's output
                    const msgs = stateUpdate?.messages || [];
                    for (const msg of msgs) {
                        // Text content (AI response)
                        const textContent = typeof msg.content === "string"
                            ? msg.content
                            : Array.isArray(msg.content)
                                ? msg.content.map(p => p.text || "").join("")
                                : "";

                        if (textContent) {
                            fullContent += textContent;
                            // Stream text in ~50-char chunks for typewriter feel
                            const chunkSize = 50;
                            for (let i = 0; i < textContent.length; i += chunkSize) {
                                sendEvent({ type: "token", content: textContent.slice(i, i + chunkSize), node: nodeName });
                            }
                        }

                        // Tool calls this node made
                        if (msg.tool_calls?.length > 0) {
                            for (const tc of msg.tool_calls) {
                                sendEvent({ type: "tool_call", tool: tc.name, args: tc.args });
                            }
                        }
                    }

                    // 3. Handle specific state updates (like Mock Server)
                    if (stateUpdate.mockServerUrl) {
                        sendEvent({ type: "mock_server_ready", url: stateUpdate.mockServerUrl });
                    }
                    if (stateUpdate.performanceAudit) {
                        sendEvent({ type: "performance_audit", data: stateUpdate.performanceAudit });
                    }
                    if (stateUpdate.securityStatus) {
                        sendEvent({ 
                            type: "security_alert", 
                            status: stateUpdate.securityStatus,
                            report: stateUpdate.securityReport 
                        });
                    }

                    // 4. Signal node completion
                    sendEvent({ type: "node_exit", node: nodeName });
                }
            }

            sendEvent({ type: "done", fullContent });
            res.write("data: [DONE]\n\n");
            res.end();

        } catch (error) {
            console.error("[API] ❌ Streaming error:", error.message);
            sendEvent({ type: "error", message: error.message });
            res.write("data: [DONE]\n\n");
            res.end();
        }

        return;
    }

    // ── STANDARD MODE: Single JSON Response ────────────────────────────────────
    try {
        const result = await appGraph.invoke(graphInput, graphConfig);

        const lastMessage = result.messages[result.messages.length - 1];

        // Normalize content: Gemini can return a string or an array of content parts
        let finalOutput = lastMessage.content;
        if (Array.isArray(finalOutput)) {
            finalOutput = finalOutput.map(p => p.text || "").join("");
        }

        console.log(`[API] ✅ Completed. Response length: ${finalOutput?.length || 0} chars`);

        res.json({
            status: "complete",
            thread_id,
            mode,
            output: finalOutput || "The AI did not produce a text response.",
            toolCallsExecuted: result.messages.filter(m => m.tool_calls?.length > 0).length,
            totalMessages: result.messages.length,
        });

    } catch (error) {
        console.error("[API] ❌ Execution error:", error);

        // Parse common errors into helpful messages
        let userMessage = "Failed to process your request. Please try again.";
        if (error.message?.includes("429") || error.message?.includes("quota")) {
            userMessage = "API quota exceeded. Please wait a moment and try again.";
        } else if (error.message?.includes("model not found")) {
            userMessage = "AI model configuration error. Please contact support.";
        } else if (error.message?.includes("DEADLINE_EXCEEDED")) {
            userMessage = "The AI took too long to respond. Try a simpler prompt.";
        }

        res.status(500).json({
            status: "error",
            thread_id,
            error: userMessage,
            detail: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

/**
 * POST /api/architect/cap-update — Feature #6: CAP Theorem Mid-Flight Update
 * Updates the graph state with the new CAP preference and forces a re-architecture loop.
 */
app.post("/api/architect/cap-update", async (req, res) => {
    const { thread_id, capPreference } = req.body;
    
    if (!thread_id || !capPreference) {
        return res.status(400).json({ error: "thread_id and capPreference are required" });
    }

    console.log(`\n[API] ⚖️ CAP Theorem Update | thread: ${thread_id} | constraint: ${capPreference}`);

    // Update the state with the new capPreference
    await appGraph.updateState(
        { configurable: { thread_id } },
        { capPreference, mode: "blueprint" } // Force mode to blueprint for full rewrite
    );

    // The message we inject to force the AI to notice the constraint change
    const graphInput = {
        messages: [new HumanMessage(`CRITICAL CONSTRAINT UPDATE: Rewrite the entire architecture to strictly adhere to the ${capPreference} CAP Theorem constraint.`)],
    };

    const graphConfig = { configurable: { thread_id } };

    // Use SSE stream to return the live re-architecture
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        sendEvent({ type: "start", thread_id, mode: "blueprint" });

        const graphStream = appGraph.stream(graphInput, {
            ...graphConfig,
            streamMode: "updates",
        });

        let fullContent = "";

        for await (const chunk of await graphStream) {
            for (const [nodeName, stateUpdate] of Object.entries(chunk)) {
                sendEvent({ type: "node_enter", node: nodeName });

                const msgs = stateUpdate?.messages || [];
                for (const msg of msgs) {
                    const textContent = typeof msg.content === "string"
                        ? msg.content
                        : Array.isArray(msg.content)
                            ? msg.content.map(p => p.text || "").join("")
                            : "";

                    if (textContent) {
                        fullContent += textContent;
                        const chunkSize = 50;
                        for (let i = 0; i < textContent.length; i += chunkSize) {
                            sendEvent({ type: "token", content: textContent.slice(i, i + chunkSize) });
                        }
                    }

                    if (msg.tool_calls?.length > 0) {
                        for (const tc of msg.tool_calls) {
                            sendEvent({ type: "tool_call", tool: tc.name, args: tc.args });
                        }
                    }
                }

                if (stateUpdate.mockServerUrl) {
                    sendEvent({ type: "mock_server_ready", url: stateUpdate.mockServerUrl });
                }
                if (stateUpdate.performanceAudit) {
                    sendEvent({ type: "performance_audit", data: stateUpdate.performanceAudit });
                }
                if (stateUpdate.securityStatus) {
                    sendEvent({ 
                        type: "security_alert", 
                        status: stateUpdate.securityStatus,
                        report: stateUpdate.securityReport 
                    });
                }

                sendEvent({ type: "node_exit", node: nodeName });
            }
        }

        sendEvent({ type: "done", fullContent });
        res.write("data: [DONE]\n\n");
        res.end();

    } catch (error) {
        console.error("[API] ❌ Streaming error:", error.message);
        sendEvent({ type: "error", message: error.message });
        res.write("data: [DONE]\n\n");
        res.end();
    }
});

/**
 * POST /api/architect/multiverse-decide — Feature #7: Multiverse Convergence
 * Resumes the graph after human selection.
 */
app.post("/api/architect/multiverse-decide", async (req, res) => {
    const { thread_id, selection } = req.body;
    
    if (!thread_id || !selection) {
        return res.status(400).json({ error: "thread_id and selection are required" });
    }

    console.log(`\n[API] 🌌 Multiverse Decision | thread: ${thread_id} | Winner: ${selection}`);

    const graphConfig = { configurable: { thread_id } };

    // Get the current state to extract the winning blueprint
    const state = await appGraph.getState(graphConfig);
    
    if (!state || !state.values) {
        return res.status(404).json({ error: "Thread state not found" });
    }

    const winningBlueprint = selection === "SQL" ? state.values.blueprintSQL : state.values.blueprintNoSQL;

    // Update the state with the winner and clear the multiverses to save memory
    await appGraph.updateState(
        graphConfig,
        { 
            selectedUniverse: selection,
            draftedBlueprint: winningBlueprint, // Promote winner to main blueprint
            blueprintSQL: null, 
            blueprintNoSQL: null,
            mode: "blueprint" // Set back to normal mode so it routes to security/writer properly
        }
    );

    // Resume the graph from the interrupt
    // We send a Command to resume, passing null as we already updated state
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        sendEvent({ type: "start", thread_id, mode: "blueprint" });

        // Resume by calling stream with null input (it resumes from the last interrupt)
        const graphStream = appGraph.stream(null, {
            ...graphConfig,
            streamMode: "updates",
        });

        let fullContent = "";

        for await (const chunk of await graphStream) {
            for (const [nodeName, stateUpdate] of Object.entries(chunk)) {
                sendEvent({ type: "node_enter", node: nodeName });

                const msgs = stateUpdate?.messages || [];
                for (const msg of msgs) {
                    const textContent = typeof msg.content === "string"
                        ? msg.content
                        : Array.isArray(msg.content)
                            ? msg.content.map(p => p.text || "").join("")
                            : "";

                    if (textContent) {
                        fullContent += textContent;
                        const chunkSize = 50;
                        for (let i = 0; i < textContent.length; i += chunkSize) {
                            sendEvent({ type: "token", content: textContent.slice(i, i + chunkSize), node: nodeName });
                        }
                    }

                    if (msg.tool_calls?.length > 0) {
                        for (const tc of msg.tool_calls) {
                            sendEvent({ type: "tool_call", tool: tc.name, args: tc.args });
                        }
                    }
                }

                if (stateUpdate.mockServerUrl) {
                    sendEvent({ type: "mock_server_ready", url: stateUpdate.mockServerUrl });
                }
                if (stateUpdate.performanceAudit) {
                    sendEvent({ type: "performance_audit", data: stateUpdate.performanceAudit });
                }
                if (stateUpdate.securityStatus) {
                    sendEvent({ 
                        type: "security_alert", 
                        status: stateUpdate.securityStatus,
                        report: stateUpdate.securityReport 
                    });
                }

                sendEvent({ type: "node_exit", node: nodeName });
            }
        }

        sendEvent({ type: "done", fullContent });
        res.write("data: [DONE]\n\n");
        res.end();

    } catch (error) {
        console.error("[API] ❌ Streaming error:", error.message);
        sendEvent({ type: "error", message: error.message });
        res.write("data: [DONE]\n\n");
        res.end();
    }
});

/**
 * GET /api/architect/history/:thread_id — Retrieve Conversation History
 * Returns all messages for a given conversation thread.
 * Useful for the frontend to restore a previous session.
 */
app.get("/api/architect/history/:thread_id", async (req, res) => {
    const { thread_id } = req.params;

    if (!thread_id) {
        return res.status(400).json({ error: "thread_id is required" });
    }

    try {
        // Get the current state snapshot for this thread
        const state = await appGraph.getState({
            configurable: { thread_id },
        });

        if (!state || !state.values?.messages?.length) {
            return res.json({
                thread_id,
                messages: [],
                message: "No history found for this thread.",
            });
        }

        // Format messages for the frontend
        const formattedMessages = state.values.messages.map((msg, i) => ({
            index: i,
            role: msg.constructor.name.replace("Message", "").toLowerCase(), // "human", "ai", "tool"
            content: typeof msg.content === "string"
                ? msg.content
                : msg.content?.map?.(p => p.text || "").join("") || "",
            tool_calls: msg.tool_calls || [],
            timestamp: msg.additional_kwargs?.timestamp || null,
        }));

        res.json({
            thread_id,
            totalMessages: formattedMessages.length,
            mode: state.values.mode,
            messages: formattedMessages,
        });

    } catch (error) {
        console.error("[API] History fetch error:", error.message);
        res.status(500).json({ error: "Failed to retrieve conversation history." });
    }
});

/**
 * POST /api/architect/chaos — Unleash Chaos Monkey
 * Manually injects a database failure into the graph state.
 */
app.post("/api/architect/chaos", async (req, res) => {
    const { thread_id } = req.body;

    if (!thread_id) {
        return res.status(400).json({ error: "thread_id is required" });
    }

    console.log(`\n[API] 🚨 CHAOS TRIGGERED | thread: ${thread_id}`);

    try {
        // 1. Update the state to set isChaosMode: true
        // This is the "injection" step.
        await appGraph.updateState(
            { configurable: { thread_id } },
            { isChaosMode: true }
        );

        // 2. Resume execution using the SSE pattern
        // We trigger the graph with null input because we just want it to 
        // react to the state change and route via __start__
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent({ type: "start", thread_id, chaos: true });

        const graphStream = appGraph.stream(null, {
            configurable: { thread_id },
            streamMode: "updates",
        });

        let fullContent = "";

        for await (const chunk of await graphStream) {
            for (const [nodeName, stateUpdate] of Object.entries(chunk)) {
                sendEvent({ type: "node_enter", node: nodeName });

                const msgs = stateUpdate?.messages || [];
                for (const msg of msgs) {
                    const textContent = typeof msg.content === "string"
                        ? msg.content
                        : Array.isArray(msg.content)
                            ? msg.content.map(p => p.text || "").join("")
                            : "";

                    if (textContent) {
                        fullContent += textContent;
                        const chunkSize = 50;
                        for (let i = 0; i < textContent.length; i += chunkSize) {
                            sendEvent({ type: "token", content: textContent.slice(i, i + chunkSize) });
                        }
                    }
                }
                sendEvent({ type: "node_exit", node: nodeName });
            }
        }

        sendEvent({ type: "done", fullContent });
        res.write("data: [DONE]\n\n");
        res.end();

    } catch (error) {
        console.error("[API] ❌ Chaos error:", error.message);
        res.status(500).json({ error: "Chaos Monkey failed to unleash.", detail: error.message });
    }
});

/**
 * GET /api/architect/visualize — Mermaid Graph Visualization
 * Renders the LangGraph state machine as a Mermaid diagram.
 */
app.get("/api/architect/visualize", (req, res) => {
    try {
        const representation = appGraph.getGraph();
        const mermaid = representation.drawMermaid();

        res.setHeader("Content-Type", "text/html");
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AI Architect Graph</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body { background: #0f1117; color: white; font-family: sans-serif; padding: 2rem; }
        h1 { color: #10b981; margin-bottom: 1rem; }
        .mermaid { background: #1e2433; padding: 2rem; border-radius: 12px; }
        textarea {
            width: 100%; height: 200px;
            background: #1e2433; color: #94a3b8;
            border: 1px solid #2a3147; border-radius: 8px;
            padding: 1rem; margin-top: 1rem; font-family: monospace;
        }
    </style>
</head>
<body>
    <h1>🧠 AI Architect — LangGraph State Machine</h1>
    <div class="mermaid">${mermaid}</div>
    <p style="margin-top:1rem; color: #64748b">Raw Mermaid code (for mermaid.live):</p>
    <textarea readonly>${mermaid}</textarea>
    <script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
</body>
</html>`);
    } catch (e) {
        console.error("[API] Visualization error:", e);
        res.status(500).send("Error generating graph visualization.");
    }
});

// ─── 7B. REAL-TIME COLLABORATION & V21 ENDPOINTS ───────────────────────────
/**
 * GET /api/collaborative/telemetry — Workspace Status & Concurrency Metrics
 */
app.get("/api/collaborative/telemetry", (req, res) => {
    res.json(getWorkspaceTelemetry(workspaceState));
});

/**
 * POST /api/collaborative/lock — Acquire Exclusive Node Lock
 */
app.post("/api/collaborative/lock", (req, res) => {
    const { nodeId, userId } = req.body;
    if (!nodeId || !userId) {
        return res.status(400).json({ error: "nodeId and userId are required." });
    }
    workspaceState.activeUsers.add(userId);
    const result = workspaceState.acquireLock(nodeId, userId);
    res.json(result);
});

/**
 * POST /api/collaborative/unlock — Release Node Lock
 */
app.post("/api/collaborative/unlock", (req, res) => {
    const { nodeId, userId } = req.body;
    if (!nodeId || !userId) {
        return res.status(400).json({ error: "nodeId and userId are required." });
    }
    const success = workspaceState.releaseLock(nodeId, userId);
    res.json({ success, nodeId, unlockedBy: userId });
});

/**
 * POST /api/collaborative/node — Update Architecture Node with Lock Check
 */
app.post("/api/collaborative/node", (req, res) => {
    const { nodeId, nodeData, userId } = req.body;
    if (!nodeId || !nodeData || !userId) {
        return res.status(400).json({ error: "nodeId, nodeData, and userId are required." });
    }
    const result = workspaceState.updateNode(nodeId, nodeData, userId);
    res.json(result);
});

/**
 * POST /api/collaborative/validate-diagram — Diagram Topology Validation Engine
 */
app.post("/api/collaborative/validate-diagram", (req, res) => {
    const nodes = req.body.nodes || workspaceState.nodes;
    const validation = validateWorkspaceDiagram(nodes);
    res.json(validation);
});

/**
 * POST /api/collaborative/sandbox-run — Local Sandbox Code Compiler & Execution
 */
app.post("/api/collaborative/sandbox-run", (req, res) => {
    const { nodeId, sourceCode, inputParameters } = req.body;
    if (!sourceCode) {
        return res.status(400).json({ error: "sourceCode is required." });
    }
    const execution = sandboxCompileAndRun(nodeId || "anonymous", sourceCode, inputParameters || {});
    res.json(execution);
});

/**
 * POST /api/collaborative/diff — Interactive Git Diff Revision Generator
 */
app.post("/api/collaborative/diff", (req, res) => {
    const { originalCode, updatedCode } = req.body;
    if (originalCode === undefined || updatedCode === undefined) {
        return res.status(400).json({ error: "originalCode and updatedCode are required." });
    }
    const diff = compileGitDiffRevision(originalCode, updatedCode);
    res.json(diff);
});

/**
 * GET /api/collaborative/export-schema — Export Workspace Architecture Schema JSON
 */
app.get("/api/collaborative/export-schema", (req, res) => {
    const workspaceName = req.query.workspaceName || "ArchitectAI-Master-Workspace";
    const jsonStr = exportSchemaJSON(workspaceName, workspaceState.nodes);
    res.setHeader("Content-Type", "application/json");
    res.send(jsonStr);
});

// ─── RESILIENCY AUDITOR & TOPOLOGY SYNTHESIZER ──────────────────────────────
const systemTopologyAuditor = require("./systemTopologyAuditor.js");

/**
 * GET /api/architect/resilience-presets — Retrieve pre-configured topologies for testing
 */
app.get("/api/architect/resilience-presets", (req, res) => {
    res.json({
        presets: systemTopologyAuditor.getPresets(),
        defaultPreset: systemTopologyAuditor.getPresetById("e_commerce_checkout")
    });
});

/**
 * GET /api/architect/resilience-presets/:id — Retrieve specific preset details
 */
app.get("/api/architect/resilience-presets/:id", (req, res) => {
    const preset = systemTopologyAuditor.getPresetById(req.params.id);
    res.json(preset);
});

/**
 * POST /api/architect/audit-topology — Mathematically audit microservice topology
 */
app.post("/api/architect/audit-topology", (req, res) => {
    try {
        const topology = req.body.topology || req.body;
        if (!topology || !topology.nodes) {
            return res.status(400).json({ error: "Invalid topology payload. 'nodes' array required." });
        }
        const auditResult = systemTopologyAuditor.auditTopology(topology);
        res.json(auditResult);
    } catch (err) {
        console.error("[TopologyAuditor] Audit failed:", err);
        res.status(500).json({ error: "Failed to audit topology", details: err.message });
    }
});

// ─── 7D. ENTERPRISE TOPOLOGY CORRIDORS & BULK INGESTION ───────────────────
const { topologyRouter } = require("./topologyRoutes.js");
app.use("/api/architect", topologyRouter);
app.use("/api/topology", topologyRouter);

// ─── 8. 404 HANDLER ───────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        error: "Route not found",
        availableRoutes: [
            "GET /",
            "GET /health",
            "POST /api/architect/execute",
            "GET /api/architect/history/:thread_id",
            "GET /api/architect/visualize",
        ],
    });
});

// ─── 9. GLOBAL ERROR HANDLER ──────────────────────────────────────────────────
// Catches any error that wasn't handled by a route
app.use((err, req, res, next) => {
    console.error("[Server] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error.", detail: err.message });
});

// ─── 10. SERVER STARTUP ───────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3035;

const server = app.listen(PORT, async () => {
    console.log("\n" + "=".repeat(60));
    console.log(`  🏗️  AI Architect Backend`);
    console.log(`  🌐  http://localhost:${PORT}`);
    console.log(`  🔧  Mode: ${process.env.NODE_ENV || "development"}`);
    console.log(`  🧠  Model: gemini-2.0-flash`);
    console.log("=".repeat(60) + "\n");

    // Initialize PostgreSQL checkpointer in the background (non-blocking)
    // If it succeeds, future requests will use postgres. If not, MemorySaver continues.
    initPostgresCheckpointer().catch(err => {
        console.warn("[Boot] PostgreSQL init failed silently:", err?.message);
    });
});

// ─── 11. GRACEFUL SHUTDOWN ────────────────────────────────────────────────────
server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`   Run: npx kill-port ${PORT}  (or change PORT in .env)`);
    } else {
        console.error("❌ Server error:", error);
    }
    process.exit(1);
});

// Handle graceful shutdown on CTRL+C
process.on("SIGINT", () => {
    console.log("\n[Server] Shutting down gracefully...");
    server.close(() => {
        console.log("[Server] All connections closed. Goodbye!");
        process.exit(0);
    });
});

process.on("uncaughtException", (error) => {
    console.error("[Server] Uncaught Exception:", error);
    process.exit(1);
});

process.on("unhandledRejection", (reason) => {
    console.error("[Server] Unhandled Promise Rejection:", reason);
    process.exit(1);
});

module.exports = { app };
