/**
 * test_client.js — Manual API Test Script
 * 
 * Run this to verify the backend is working correctly:
 *   node test_client.js
 *
 * Tests:
 *   1. Health check
 *   2. Execute in blueprint mode
 *   3. Retrieve conversation history
 */

const BASE_URL = "http://localhost:3035";
// Generate a stable UUID for testing so history can be retrieved
const TEST_THREAD_ID = "550e8400-e29b-41d4-a716-446655440000";

const log = (label, data) => {
    console.log("\n" + "─".repeat(60));
    console.log(`  ${label}`);
    console.log("─".repeat(60));
    if (typeof data === "string") {
        console.log(data.substring(0, 500) + (data.length > 500 ? "\n...[truncated]" : ""));
    } else {
        console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    }
};

async function testHealthCheck() {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    log("1. HEALTH CHECK", data);
    return data.status === "ok";
}

async function testExecute() {
    console.log("\n⏳ Sending prompt to AI (this may take 15-30 seconds)...");

    const res = await fetch(`${BASE_URL}/api/architect/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: "Design a simple REST API backend for a todo list application using Node.js and PostgreSQL. Include the database schema.",
            mode: "blueprint",
            thread_id: TEST_THREAD_ID,
            stream: false,
        }),
    });

    const data = await res.json();
    log("2. EXECUTE (blueprint mode)", data.output || data.error);
    return data.status === "complete";
}

async function testHistory() {
    const res = await fetch(`${BASE_URL}/api/architect/history/${TEST_THREAD_ID}`);
    const data = await res.json();
    log("3. HISTORY RETRIEVAL", {
        totalMessages: data.totalMessages,
        firstMessage: data.messages?.[0]?.content?.substring(0, 200),
    });
}

async function run() {
    console.log("🧪 AI Architect Backend — Test Client");
    console.log(`   Server: ${BASE_URL}`);
    console.log(`   Thread: ${TEST_THREAD_ID}\n`);

    try {
        const healthOk = await testHealthCheck();
        if (!healthOk) {
            console.error("❌ Health check failed. Is the server running?");
            return;
        }

        await testExecute();
        await testHistory();

        console.log("\n✅ All tests completed!");
    } catch (err) {
        console.error("❌ Test failed:", err.message);
        console.error("   Make sure the server is running: npm run dev");
    }
}

run();