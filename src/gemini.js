// src/gemini.js

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const getGeminiInsight = async (stockCode, price, change) => {
  if (!API_KEY) {
    console.error("VITE_GEMINI_API_KEY is missing in .env");
    return {
      summary: "API Key missing. Cek konfigurasi .env Anda.",
      sentiment: "Neutral",
      upside: "N/A"
    };
  }

  // Gunakan model 'gemini-1.5-flash-latest' atau 'gemini-pro' (lebih stabil)
  // Jika 404 terus, ganti MODEL_NAME jadi 'gemini-pro'
  const MODEL_NAME = "gemini-1.5-flash-latest"; 
  
  const prompt = `
    Analyze this Indonesian stock data strictly.
    Code: ${stockCode}
    Current Price: Rp ${price}
    Change: ${change}%

    Return a valid JSON object ONLY (no markdown formatting, no code blocks).
    The JSON must match this structure:
    {
      "summary": "One concise paragraph (max 30 words) analyzing the stock movement based on the price change in Bahasa Indonesia.",
      "sentiment": "Positive" or "Negative" or "Neutral",
      "upside": "Estimated percentage range (e.g., +2.5% - +5.0%) based on technical volatility"
    }
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        }),
      }
    );

    if (!response.ok) {
      // Jika error 404, berarti model salah nama. Coba fallback ke gemini-pro
      if (response.status === 404) {
         console.warn("Model 1.5 Flash not found (404), trying gemini-pro...");
         return getGeminiFallback(stockCode, price, change, prompt);
      }
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    return parseGeminiResponse(data, change);

  } catch (error) {
    console.error("Gemini Fetch Error:", error);
    return {
      summary: "Mode Offline: Gagal terhubung ke AI server.",
      sentiment: "Neutral",
      upside: "N/A"
    };
  }
};

// Fungsi Cadangan jika Model Utama Gagal
const getGeminiFallback = async (stockCode, price, change, prompt) => {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
        );
        if (!response.ok) throw new Error(`Fallback Error: ${response.status}`);
        const data = await response.json();
        return parseGeminiResponse(data, change);
    } catch (err) {
        return { summary: "AI Error (Fallback failed)", sentiment: "Neutral", upside: "N/A" };
    }
}

// Helper untuk parsing data
const parseGeminiResponse = (data, change) => {
    if (!data.candidates || data.candidates.length === 0) {
      return { summary: "Tidak ada data dari AI.", sentiment: "Neutral", upside: "N/A" };
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json|```/g, '').trim();

    try {
      const parsedData = JSON.parse(cleanJson);
      return {
        summary: parsedData.summary || "Analisis selesai.",
        sentiment: parsedData.sentiment || "Neutral",
        upside: parsedData.upside || "N/A"
      };
    } catch (parseError) {
      return {
        summary: cleanJson.substring(0, 150) + "...",
        sentiment: change >= 0 ? "Positive" : "Negative",
        upside: "N/A"
      };
    }
}