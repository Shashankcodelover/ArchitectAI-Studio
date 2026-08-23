require('dotenv').config();
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

async function test() {
    try {
        console.log("Starting test...");
        const llm = new ChatGoogleGenerativeAI({
            model: "gemini-3-flash-preview", 
            temperature: 0.2,
            apiKey: process.env.GOOGLE_API_KEY.trim(), 
        });
        
        console.log("LLM initialized, invoking...");
        const response = await llm.invoke([
            new SystemMessage("You are an expert Systems Architect."),
            new HumanMessage("Hello")
        ]);
        console.log("Response:", response);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
