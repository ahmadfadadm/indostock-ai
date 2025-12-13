import os
import json
import google.generativeai as genai

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")

def handler(request):
    try:
        body = request.json()

        prompt = f"""
Analyze Indonesian stock strictly.

Code: {body['code']}
Price: {body['price']}
Change: {body['change']}%

Return JSON ONLY:
{{
  "summary": "max 30 words Bahasa Indonesia",
  "sentiment": "Positive | Neutral | Negative",
  "upside": "+x% - +y%"
}}
"""

        res = model.generate_content(prompt)
        text = res.text.replace("```json", "").replace("```", "").strip()

        return {
            "statusCode": 200,
            "headers": { "Content-Type": "application/json" },
            "body": text
        }

    except:
        return {
            "statusCode": 200,
            "body": json.dumps({
                "summary": "AI sedang sibuk.",
                "sentiment": "Neutral",
                "upside": "N/A"
            })
        }
