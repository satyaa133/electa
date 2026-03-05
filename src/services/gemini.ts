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

    Act as an Agentic AI Recommendation Engine. Based on the user's current mood, preferences, and location, 
    recommend 6 items in the ${category} category. 
    
    CRITICAL LOCATION INSTRUCTION: 
    The user is currently at coordinates: ${location || "a major city"}.
    If category is 'restaurants', you MUST recommend REAL, SPECIFIC places that exist in the city corresponding to these coordinates. 
    Do not give generic names. Provide actual addresses and names of establishments that would be found in that area.
    If coordinates are near San Francisco (37.77, -122.41), recommend SF spots. If they are elsewhere, adapt accordingly.
    
    For each item, provide:
    - title
    - short description
    - category
    - 'reason' (why it fits their current mood/location)
    - details (rating, year/opening hours, address if applicable, tags)

    Return the result as a JSON array of objects.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            reason: { type: Type.STRING },
            details: {
              type: Type.OBJECT,
              properties: {
                rating: { type: Type.STRING },
                year: { type: Type.STRING },
                address: { type: Type.STRING },
                tags: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                link: { type: Type.STRING },
                imageUrl: { type: Type.STRING, description: "A real, direct image URL for this specific item found via search." },
              }
            }
          },
          required: ["id", "title", "description", "category", "reason", "details"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) return [];

  const rawRecs = JSON.parse(text);
  
  return rawRecs.map((rec: any) => {
    // Clean up the image URL if it's a search result or provide a high-quality fallback
    let finalImageUrl = rec.details.imageUrl;
    
    if (!finalImageUrl || finalImageUrl.includes("example.com") || !finalImageUrl.startsWith("http")) {
      // Use a more descriptive seed for better Unsplash/Picsum results
      const seed = encodeURIComponent(`${rec.title} ${rec.category}`);
      
      // Fallback to picsum if unsplash source is unreliable in this environment
      finalImageUrl = `https://picsum.photos/seed/${rec.title.replace(/\s+/g, '')}/800/600`;
    }
    
    return {
      ...rec,
      imageUrl: finalImageUrl
    };
  });
}
