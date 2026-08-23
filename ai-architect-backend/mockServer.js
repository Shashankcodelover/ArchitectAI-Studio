/**
 * mockServer.js — Dynamic Express Server Manager
 * 
 * This utility handles spawning and terminating lightweight Express servers
 * that simulate the API designed by the AI. It uses a singleton-style manager
 * to ensure we don't leak ports or processes.
 */

const express = require('express');
const cors = require('cors');

// Try to load faker, fall back to simple random generator if not installed
let faker;
try {
    const { faker: f } = require('@faker-js/faker');
    faker = f;
    console.log("[Mock] ✅ @faker-js/faker loaded for synthetic data.");
} catch (e) {
    console.warn("[Mock] ⚠️  @faker-js/faker not found. Using basic fallback generator.");
}

// In-memory registry of active mock servers: { threadId: { server, port, endpoints } }
const activeServers = new Map();

/**
 * generateSyntheticData — Creates realistic JSON based on field names.
 */
function generateSyntheticData(fieldName) {
    if (!faker) {
        // Fallback generator
        const name = ["Alice", "Bob", "Charlie", "Diana"][Math.floor(Math.random() * 4)];
        if (fieldName.includes('id')) return Math.floor(Math.random() * 10000).toString();
        if (fieldName.includes('email')) return `${name.toLowerCase()}@example.com`;
        if (fieldName.includes('name')) return name;
        if (fieldName.includes('price')) return (Math.random() * 100).toFixed(2);
        return "mock_value";
    }

    const lower = fieldName.toLowerCase();
    if (lower.includes('email')) return faker.internet.email();
    if (lower.includes('username')) return faker.internet.userName();
    if (lower.includes('name')) return faker.person.fullName();
    if (lower.includes('uuid') || lower.includes('id')) return faker.string.uuid();
    if (lower.includes('avatar')) return faker.image.avatar();
    if (lower.includes('price')) return faker.commerce.price();
    if (lower.includes('title')) return faker.commerce.productName();
    if (lower.includes('description')) return faker.commerce.productDescription();
    if (lower.includes('date') || lower.includes('created')) return faker.date.recent().toISOString();
    
    return faker.lorem.word();
}

/**
 * parseEndpoints — Extracts routes from AI markdown.
 * Look for patterns like: - GET /api/users
 */
function parseEndpoints(markdown) {
    const endpoints = [];
    // Regex matches "- METHOD /path" or "METHOD /path"
    const re = /(?:-\s*)?(GET|POST|PUT|DELETE|PATCH)\s+([\/a-zA-Z0-9_\-\{\}]+)/gi;
    let match;
    while ((match = re.exec(markdown)) !== null) {
        endpoints.push({
            method: match[1].toUpperCase(),
            path: match[2]
        });
    }
    // Filter duplicates
    return endpoints.filter((v, i, a) => a.findIndex(t => t.path === v.path && t.method === v.method) === i);
}

/**
 * terminateMockServer — Gracefully closes a server for a specific thread.
 */
async function terminateMockServer(threadId) {
    if (activeServers.has(threadId)) {
        const { server, port } = activeServers.get(threadId);
        console.log(`[Mock] Terminating server on port ${port} for thread ${threadId}`);
        return new Promise((resolve) => {
            server.close(() => {
                activeServers.delete(threadId);
                resolve();
            });
        });
    }
}

/**
 * spawnMockServer — Spawns a new Express instance for a thread.
 */
async function spawnMockServer(markdown, threadId) {
    // 1. Clean up old server if it exists
    await terminateMockServer(threadId);

    const endpoints = parseEndpoints(markdown);
    if (endpoints.length === 0) {
        console.log("[Mock] No API endpoints found in blueprint. Skipping server spawn.");
        return null;
    }

    const app = express();
    app.use(cors());
    app.use(express.json());

    // 2. Register dynamic routes
    endpoints.forEach(ep => {
        const handler = (req, res) => {
            console.log(`[Mock Server] ${ep.method} ${ep.path} called`);
            
            // Generate a response object with 3 items if it looks like a list
            const isList = ep.path.endsWith('s') || ep.path.includes('list');
            
            const createItem = () => ({
                id: generateSyntheticData('id'),
                name: generateSyntheticData('name'),
                email: generateSyntheticData('email'),
                created_at: generateSyntheticData('date'),
                status: 'active'
            });

            const response = isList ? [createItem(), createItem(), createItem()] : createItem();
            res.json(response);
        };

        // Register with Express (normalize path: remove trailing slash if present)
        const path = ep.path.replace(/\/$/, "");
        app[ep.method.toLowerCase()](path, handler);
    });

    // 3. Find an available port starting from 4001
    let port = 4001;
    const usedPorts = Array.from(activeServers.values()).map(s => s.port);
    while (usedPorts.includes(port)) port++;

    return new Promise((resolve, reject) => {
        try {
            const server = app.listen(port, () => {
                console.log(`[Mock] 🟢 Server live on http://localhost:${port} for thread ${threadId}`);
                activeServers.set(threadId, { server, port, endpoints });
                resolve({
                    url: `http://localhost:${port}`,
                    port,
                    endpoints
                });
            });

            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`[Mock] Port ${port} in use, retrying...`);
                    // This case is handled by our port incrementer but added for safety
                    resolve(spawnMockServer(markdown, threadId)); 
                } else {
                    reject(err);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

module.exports = {
    spawnMockServer,
    terminateMockServer
};
