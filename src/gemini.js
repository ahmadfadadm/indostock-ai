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

  // --- PERBAIKAN DI SINI: Ganti nama model ke yang paling standar ---
  // Hapus '-latest' karena sering menyebabkan 404 di v1beta
  const MODEL_NAME = "gemini-1.5-flash"; 
  
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
      console.warn(`Model ${MODEL_NAME} failed (${response.status}). Trying fallback...`);
      // Fallback ke model gemini-1.5-pro (biasanya lebih stabil jika flash error)
      return getGeminiFallback(stockCode, price, change, prompt);
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

// Fungsi Cadangan: Menggunakan 'gemini-1.5-pro' (bukan gemini-pro biasa)
const getGeminiFallback = async (stockCode, price, change, prompt) => {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`,
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
        console.error("Fallback failed:", err);
        return { summary: "AI sedang sibuk. Coba refresh sebentar lagi.", sentiment: "Neutral", upside: "N/A" };
    }
}

// Helper parsing data (Sama seperti sebelumnya)
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