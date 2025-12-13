import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("VITE_GEMINI_API_KEY is missing in .env file");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const insightCache = new Map();

// List of priority models based on availability
const MODELS_TO_TRY = [
  "gemini-2.5-flash",      // Priority 1: Main model
  "gemini-2.5-flash-lite"  // Priority 2: Backup model
];

// Helper delay function to avoid consecutive 429 errors
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function tryGenerateContent(modelName, prompt) {
    const model = genAI.getGenerativeModel({ model: modelName });
    return await model.generateContent(prompt);
}

export const getGeminiInsight = async (stockCode, price, change) => {
  const cacheKey = `${stockCode}-${new Date().getHours()}`; 
  
  if (insightCache.has(cacheKey)) {
    return insightCache.get(cacheKey);
  }

  // Updated prompt: Requesting slightly longer summary (2-3 sentences)
  const prompt = `
    Bertindaklah sebagai analis saham senior Indonesia. Analisis data berikut:
    Saham: ${stockCode}
    Harga Saat Ini: ${price}
    Perubahan: ${change}%

    Berikan output HANYA dalam format JSON valid tanpa markdown, tanpa backticks:
    {
      "summary": "Analisis teknikal 2-3 kalimat (sekitar 30-45 kata) bahasa Indonesia yang actionable, padat, dan berbobot."
    }
  `;

  // Loop through models: Try Flash -> If failed -> Try Lite
  for (const modelName of MODELS_TO_TRY) {
    try {
        const result = await tryGenerateContent(modelName, prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown formatting
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(cleanText);
        
        console.log(`[AI] SUCCESS using model: ${modelName}`);
        insightCache.set(cacheKey, data);
        return data; 

    } catch (error) {
        console.warn(`[AI] Failed on ${modelName}: ${error.message}`);
        
        // If error is due to rate limit (429), pause briefly
        if (error.message?.includes("429")) {
            await sleep(1000); 
        }
    }
  }

  // If all models fail
  return {
    summary: "AI server is currently busy. Please refresh later.",
  };
};