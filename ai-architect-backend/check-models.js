const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.error("❌ GOOGLE_API_KEY is missing in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listAvailableModels() {
    console.log("🔍 Fetching available models for your API Key...\n");
    try {
        // We use fetch directly since the LangChain SDK obscures the models.list() method sometimes
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error.message);
            return;
        }

        const models = data.models || [];
        const generateContentModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

        console.log("✅ Models available for text/code generation:");
        generateContentModels.forEach(m => {
            console.log(`   - ${m.name.replace('models/', '')}`);
        });

        console.log("\n💡 ACTION REQUIRED:");
        console.log("Copy one of the names above (e.g., gemini-2.5-flash) and paste it into your .env file as GEMINI_MODEL=...");

    } catch (error) {
        console.error("❌ Network Error:", error.message);
    }
}

listAvailableModels();
