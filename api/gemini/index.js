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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      }),
    }
  );

  const data = await response.json();

  console.log("Gemini status:", response.status);
  console.log("Gemini response:", JSON.stringify(data, null, 2));

  if (!data?.candidates?.length) {
    return res.status(500).json({
      summary: "AI service unavailable",
      sentiment: "Neutral",
      upside: "N/A",
    });
  }

  const text = data.candidates[0].content.parts
    .map(p => p.text)
    .join("\n")
    .trim();

  res.status(200).json({
    summary: text,
    sentiment: "Neutral",
    upside: "N/A",
  });
}