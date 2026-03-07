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
    
    CRITICAL VARIETY INSTRUCTION:
    Ensure HIGHLY UNIQUE, less obvious, and varied results for every single request. DO NOT just recommend the most popular or mainstream items. Provide a mix of hidden gems, unexpected concepts, and highly specific niche items. Every time a user asks, give them COMPLETELY DIFFERENT results from the ones before.
    Random seed to enforce uniqueness: ${Math.random()}
    
    CRITICAL LOCATION INSTRUCTION: 
    User coordinates: ${location || "major city"}.
    If category='restaurants', recommend ONLY REAL places AT THIS LOCATION. 
    
    CRITICAL IMAGE INSTRUCTION:
    You MUST provide a REAL, WORKING direct image URL for each item in the "imageUrl" field. 
    The image must be the exact official item (e.g. the official movie poster, exact book cover, or photograph).
    - EXTREMELY IMPORTANT FOR PERFORMANCE: You MUST use low-resolution, compressed, or thumbnail size URLs to ensure lightning-fast loading! 
    - For TMDB/IMDB images, use "w500" or "w300" in the path, NEVER "original".
    - For Wikipedia/Wikimedia, use the scaled thumbnail URLs (e.g., upload.wikimedia.org/.../thumb/.../300px-...).
    - DO NOT EVER use massive high-resolution images or placeholder URLs. If you know the item, you know its thumbnail URL.
    - DO NOT EVER use placeholder URLs or random image generators for "imageUrl". If you know the item, you know its image URL.

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
    let finalImageUrl = rec.details?.imageUrl || rec.imageUrl;

    if (!finalImageUrl || finalImageUrl.includes("example.com") || finalImageUrl.includes("placeholder")) {
      console.log("AI failed to provide real image for", rec.title, "- falling back to generated image");
      // Use an AI image generation endpoint to at least generate an image of the specific target
      finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(rec.title + ' ' + rec.category + ' official photo')}`;
    }

    return {
      ...rec,
      imageUrl: finalImageUrl
    };
  });
}
