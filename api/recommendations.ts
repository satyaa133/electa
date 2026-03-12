import { GoogleGenAI } from "@google/genai";
import axios from "axios";

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
            
            VARIETY: Ensure UNIQUE, less obvious results. DO NOT just recommend the most popular items.
            Random seed: ${Math.random()}
            
            LOCATION: User coordinates: ${location || "major city"}. If category='restaurants', recommend REAL places HERE with REAL addresses. Else, leave "address" empty.
            
            IMAGES: Provide REAL working thumbnail URLs (Wikipedia/TMDB/IMDB). Scaled 200px-400px only. NEVER use high-res.

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
            model: "gemini-1.5-flash-8b",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            },
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

        const enrichedRecs = await Promise.all(rawRecs.map(async (rec: any) => {
            let finalImageUrl = rec.details?.imageUrl || rec.imageUrl;

            // If the AI didn't provide a URL, or hallucinated a fake placeholder,
            // query Wikipedia's public API to get the EXACT real image for the item.
            if (!finalImageUrl || finalImageUrl.includes("example.com") || finalImageUrl.includes("placeholder")) {
                try {
                    const wikiRes = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=400&titles=${encodeURIComponent(rec.title)}`);
                    const pages = wikiRes.data.query?.pages;
                    if (pages) {
                        const pageData = Object.values(pages)[0] as any;
                        if (pageData && pageData.thumbnail && pageData.thumbnail.source) {
                            finalImageUrl = pageData.thumbnail.source;
                        } else {
                            // Absolute last resort if Wikipedia has no image for this specific title
                            finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(rec.title + ' ' + rec.category + ' high quality')}`;
                        }
                    }
                } catch (e) {
                    finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(rec.title + ' ' + rec.category + ' high quality')}`;
                }
            }
            return { ...rec, imageUrl: finalImageUrl };
        }));

        return res.status(200).json({ recommendations: enrichedRecs });

    } catch (error: any) {
        console.error("Gemini API error:", error);
        if (error.status === 429) {
            return res.status(429).json({ error: "RATE_LIMIT" });
        }
        return res.status(500).json({ error: error.message || "Failed to generate recommendations" });
    }
}
