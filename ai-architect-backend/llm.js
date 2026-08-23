/**
 * llm.js — The Brain Initializer
 *
 * This module is the SINGLE SOURCE OF TRUTH for the LLM instance.
 * It initializes the model ONCE and exports it. Every other module
 * imports from here — preventing duplicate instances and config drift.
 *
 * Design Pattern: Singleton + Dependency Injection via module caching.
 * Node.js caches require() calls, so this file only runs once per process.
 */

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { fetchApiStructure, generateDatabaseSchema, writeTechnicalDocumentation } = require("./tools.js");
const dotenv = require("dotenv");

dotenv.config();

// ─── Guard: Fail fast if API key is missing ───────────────────────────────────
const apiKey = process.env.GOOGLE_API_KEY?.trim();
if (!apiKey) {
    console.error("❌ FATAL: GOOGLE_API_KEY is missing from .env");
    process.exit(1);
}

// ─── Initialize the LLM ───────────────────────────────────────────────────────
// Model Priority (Based on Validated API Key):
//   1. gemini-2.5-flash      → Validated stable model for this key
//   2. gemini-2.0-flash      → Great speed, but currently Quota 0
//   3. gemini-3.1-pro-preview→ Complex reasoning & deep architecture
//
// Switch MODEL below if you hit a quota. 
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
console.log(`[LLM] Using model: ${MODEL}`);

const llm = new ChatGoogleGenerativeAI({
    model: MODEL,
    temperature: 0.2,
    maxOutputTokens: 8192,
    apiKey,
});

// ─── Bind Tools to the LLM ───────────────────────────────────────────────────
// bindTools() tells Gemini about our available functions.
// The model will automatically decide WHEN and HOW to call them.
const llmWithTools = llm.bindTools([
    fetchApiStructure,
    generateDatabaseSchema,
    writeTechnicalDocumentation,
]);

console.log(`[LLM] Model ${MODEL} initialized with`, 3, "tools bound.");

module.exports = { llm, llmWithTools };
