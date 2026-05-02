export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  reason: string;
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
  location?: string,
  subCategory?: string | null,
): Promise<Recommendation[]> {
  try {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood,
        category,
        preferences,
        history,
        location,
        subCategory,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) throw new Error("RATE_LIMIT");
      throw new Error(`API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error("Failed to fetch recommendations from server proxy:", error);
    throw error;
  }
}

export async function askFollowUp(
  recommendation: Recommendation,
  question: string,
  chatHistory: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation, question, chatHistory }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.answer;
  } catch (error) {
    console.error("Failed to ask follow-up:", error);
    throw error;
  }
}
