import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  reason: string;
  imageUrl: string;
  details: {
    rating?: string;
    year?: string;
    address?: string;
    tags?: string[];
    link?: string;
  };
}

export async function getRecommendations(
  mood: string,
  category: string,
  preferences: string[],
  history: string[],
  location?: string
): Promise<Recommendation[]> {
  const prompt = `
    User Mood: ${mood}
    Category: ${category}
    Preferences: ${preferences.join(", ")}
    Recent History: ${history.join(", ")}
    User Location: ${location || "Unknown"}

    Act as a precise recommendation engine. Recommend exactly 12 items in the ${category} category based on mood: ${mood}.
    
    CRITICAL LOCATION INSTRUCTION: 
    User coordinates: ${location || "major city"}.
    If category='restaurants', recommend ONLY REAL places AT THIS LOCATION. 
    
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

  let text = "";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    text = response.text || "";
  } catch (error: any) {
    console.error("Gemini API error:", error);
    if (error.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    return [];
  }

  if (!text) return [];

  let rawRecs = [];
  try {
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      rawRecs = JSON.parse(match[0]);
    } else {
      console.error("No JSON array found in Gemini response:", text);
      return [];
    }
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", text);
    return [];
  }

  return rawRecs.map((rec: any) => {
    // Extract the imageUrl from the AI's response details
    let finalImageUrl = rec.details?.imageUrl || rec.imageUrl;

    // Only fallback if the AI blatantly failed to provide a real URL despite strict instructions
    if (!finalImageUrl || finalImageUrl.includes("example.com") || finalImageUrl.includes("placeholder") || !finalImageUrl.startsWith("http")) {
      console.log("AI failed to provide real image for", rec.title, "- using deterministic fallback");
      const seed = encodeURIComponent(`${rec.title} ${rec.category}`);
      finalImageUrl = `https://picsum.photos/seed/${seed}/800/600`;
    }

    return {
      ...rec,
      imageUrl: finalImageUrl
    };
  });
}
