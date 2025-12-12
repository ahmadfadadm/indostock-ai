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

  // Prompt yang dioptimalkan agar Gemini membalas dengan JSON murni
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
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
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Validasi respons dari Gemini
    if (!data.candidates || data.candidates.length === 0) {
      return { summary: "Tidak ada data dari AI.", sentiment: "Neutral", upside: "N/A" };
    }

    const rawText = data.candidates[0].content.parts[0].text;
    
    // Bersihkan format Markdown jika Gemini mengirim ```json ... ```
    const cleanJson = rawText.replace(/```json|```/g, '').trim();

    try {
      const parsedData = JSON.parse(cleanJson);
      return {
        summary: parsedData.summary || "Analisis selesai.",
        sentiment: parsedData.sentiment || "Neutral",
        upside: parsedData.upside || "N/A"
      };
    } catch (parseError) {
      // Fallback jika Gemini gagal mengirim JSON valid
      console.warn("Gemini did not return valid JSON, using raw text fallback.");
      return {
        summary: cleanJson.substring(0, 150) + "...", // Ambil teks mentah
        sentiment: change >= 0 ? "Positive" : "Negative",
        upside: "N/A"
      };
    }

  } catch (error) {
    console.error("Gemini Fetch Error:", error);
    return {
      summary: "Mode Offline: Gagal terhubung ke AI server.",
      sentiment: "Neutral",
      upside: "N/A"
    };
  }
};