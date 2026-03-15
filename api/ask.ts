import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

export default async function handler(req: any, res: any) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { recommendation, question, chatHistory } = req.body || {};

    if (!recommendation || !question) {
        return res.status(400).json({ error: "Recommendation and question are required." });
    }

    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const historyContext = (chatHistory || []).map((msg: any) => 
            `${msg.role === 'user' ? 'User' : 'Electa'}: ${msg.content}`
        ).join("\n");

        const context = `
            Context: The user is looking at a recommendation for:
            Title: ${recommendation.title}
            Description: ${recommendation.description}
            Reason: ${recommendation.reason}
            Category: ${recommendation.category}
            Details: ${JSON.stringify(recommendation.details)}

            Instructions: Answer the user's follow-up question about THIS specific recommendation. 
            Be helpful, concise, and stay in character as a premium personal assistant named Electa.
            If the question is unrelated to the recommendation, politely guide them back.

            GOOGLE LINKS:
            - Always try to provide 1-2 helpful external links at the end of your response.
            - For Restaurants/Places: Provide a Google Maps search link: [Find on Google Maps](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(recommendation.title + " " + (recommendation.details.address || ""))})
            - For Movies/Books/Other: Provide a Google Search link: [Search on Google](https://www.google.com/search?q=${encodeURIComponent(recommendation.title + " " + recommendation.category)})
            - Format the link clearly using markdown.

            Previous Conversation:
            ${historyContext}

            User Question: ${question}
        `;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: context,
            config: {
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        });

        console.log("Follow-up result received");
        const responseText = result.text || "I'm sorry, I couldn't generate an answer.";

        return res.status(200).json({ 
            answer: responseText,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("Ask API error:", error);
        return res.status(500).json({ error: error.message || "Failed to get answer" });
    }
}
