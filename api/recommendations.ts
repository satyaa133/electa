import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Safely parse body if Vercel hasn't natively done so
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { }
    }

    const { mood, category, preferences, history, location } = body || {};

    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing from Vercel Environment Variables." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
            User Mood: ${mood}
            Category: ${category}
            Preferences: ${(preferences || []).join(", ")}
            Recent History: ${(history || []).join(", ")}
            User Location: ${location || "Unknown"}

            Act as a precise recommendation engine. Recommend exactly 12 items in the ${category} category based on mood: ${mood}.
            
            CRITICAL VARIETY INSTRUCTION: Ensure HIGHLY UNIQUE, less obvious, and varied results. DO NOT just recommend the most popular items.
            Random seed: ${Math.random()}
            
            CRITICAL LOCATION INSTRUCTION: User coordinates: ${location || "major city"}. If category='restaurants', recommend ONLY REAL places AT THIS LOCATION. 
            
            CRITICAL IMAGE INSTRUCTION: You MUST provide a REAL, WORKING direct image URL for each item. 
            - Use "w500" or "w300" for TMDB/IMDB imagery.
            - DO NOT NEVER use massive high-res images or placeholder URLs.

            Format: Raw JSON array of exactly 12 objects. NO markdown.
            [
            {
                "id": "item1",
                "title": "...",
                "description": "1 sentence max",
                "category": "...",
                "reason": "1 short sentence max",
                "details": {
                "rating": "...",
                "year": "...",
                "address": "...",
                "tags": ["..."],
                "link": "...",
                "imageUrl": "..."
                }
            }
            ]
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" },
        });

        const text = response.text || "";
        if (!text) return res.status(500).json({ error: "AI returned empty response" });

        let rawRecs = [];
        try {
            const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) {
                rawRecs = JSON.parse(match[0]);
            } else {
                return res.status(500).json({ error: "AI returned malformed JSON" });
            }
        } catch (e) {
            return res.status(500).json({ error: "AI returned unparseable JSON" });
        }

        const enrichedRecs = rawRecs.map((rec: any) => {
            let finalImageUrl = rec.details?.imageUrl || rec.imageUrl;
            if (!finalImageUrl || finalImageUrl.includes("example.com") || finalImageUrl.includes("placeholder")) {
                finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(rec.title + ' ' + rec.category + ' official photo')}`;
            }
            return { ...rec, imageUrl: finalImageUrl };
        });

        return res.status(200).json({ recommendations: enrichedRecs });

    } catch (error: any) {
        console.error("Gemini API error:", error);
        if (error.status === 429) {
            return res.status(429).json({ error: "RATE_LIMIT" });
        }
        return res.status(500).json({ error: error.message || "Failed to generate recommendations" });
    }
}
