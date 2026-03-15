import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { }
        }

        const { mood, category, preferences, history, location, userHour } = body || {};
        const apiKey = process.env.GEMINI_API_KEY || "";
        
        if (!apiKey) {
            return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
        }

        // --- Context Persistence Fix ---
        let weather = "Clear";
        let timeOfDay = "Day";
        const hour = (userHour !== undefined && userHour !== null) ? userHour : new Date().getHours();

        if (hour >= 5 && hour < 12) timeOfDay = "Morning";
        else if (hour >= 12 && hour < 17) timeOfDay = "Afternoon";
        else if (hour >= 17 && hour < 21) timeOfDay = "Evening";
        else timeOfDay = "Late Night";

        try {
            const weatherRes = await axios.get(`https://wttr.in/${encodeURIComponent(location || "London")}?format=%C`, { timeout: 3000 });
            weather = weatherRes.data || "Clear";
        } catch (e) {
            console.error("wttr fetch failed, using Clear");
        }

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
            Recommend 12 ${category} based on:
            Mood: ${mood}
            Location: ${location || "Unknown"}
            Time: ${timeOfDay} (${hour}:00)
            Weather: ${weather}
            Preferences: ${(preferences || []).join(", ")}
            
            RULES:
            - If it's Morning, suggest breakfast/coffee. 
            - If Evening/Night, suggest bars/dinner.
            - If Raining/Stormy, suggest indoor activities.
            
            Format: Raw JSON array of 12 objects following this exact schema:
            {
              "id": "string",
              "title": "string",
              "description": "string",
              "category": "string",
              "reason": "string",
              "details": {
                "rating": "string",
                "year": "string",
                "address": "string",
                "tags": ["string"],
                "link": "string"
              }
            }
            NO markdown, NO extra text.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.7
            }
        });

        const text = response.text || "[]";
        let recommendations = [];
        try {
            recommendations = JSON.parse(text);
        } catch (e) {
            const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) recommendations = JSON.parse(match[0]);
        }

        return res.status(200).json({ 
            recommendations: Array.isArray(recommendations) ? recommendations : [],
            context: { weather, timeOfDay }
        });

    } catch (error: any) {
        console.error("API ERROR:", error);
        return res.status(500).json({ error: error.message || "Internal failure" });
    }
}
