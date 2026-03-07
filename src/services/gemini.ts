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
  try {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood, category, preferences, history, location })
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("RATE_LIMIT");
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error("Failed to fetch recommendations from server proxy:", error);
    throw error;
  }
}
