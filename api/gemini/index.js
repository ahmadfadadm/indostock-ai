export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY missing" });
  }

  const { stock, price, change } = req.body;

  const prompt = `
Analyze Indonesian stock:
Code: ${stock}
Price: ${price}
Change: ${change}%

Give:
1. Short market insight
2. Sentiment
3. Upside %
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();

  // 🚨 Guard error Gemini
  if (!response.ok) {
    console.error("Gemini API error:", data);
    return res.status(500).json({ error: "Gemini API failed" });
  }

  // ✅ PARSING YANG BENAR (INI KUNCINYA)
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      .join("\n")
      .trim() || "No response from Gemini";

  res.status(200).json({
    summary: text,
    sentiment: "Neutral",
    upside: "N/A",
  });
}