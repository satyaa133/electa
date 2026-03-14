import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

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
                    "link": "..."
                }
            }
            ]
        `;

        console.log("Calling Gemini API with model: gemini-2.5-flash");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
                thinkingConfig: {
                    includeThoughts: false,
                    thinkingBudget: 0
                } as any
            },
        });

        const text = response.text || "";
        if (!text) return res.status(500).json({ error: "AI returned empty response" });

        let rawRecs = [];
        const cleanText = text.replace(/```json|```/g, "").trim();

        try {
            // Attempt 1: Direct parse
            const parsed = JSON.parse(cleanText);
            rawRecs = Array.isArray(parsed) ? parsed : (parsed.recommendations || []);
        } catch (e) {
            // Attempt 2: Extract array with regex
            const match = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) {
                try {
                    rawRecs = JSON.parse(match[0]);
                } catch (e2) {
                    console.error("Failed to parse matched JSON segment:", e2);
                }
            }
        }

        if (!rawRecs || rawRecs.length === 0) {
            console.error("AI response failed to parse into recommendations. Full raw text:", text);
            return res.status(500).json({
                error: "AI returned malformed or empty recommendations",
                debug_hint: "Check server logs for the raw AI response."
            });
        }

        return res.status(200).json({ recommendations: rawRecs, version: "v6-no-images" });

    } catch (error: any) {
        console.error("Gemini API error:", error);
        if (error.status === 429) {
            return res.status(429).json({ error: "RATE_LIMIT" });
        }
        return res.status(500).json({
            error: error.message || "Failed to generate recommendations",
            details: error.toString()
        });
    }
}
