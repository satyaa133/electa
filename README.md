# Electa | AI Recommendations

**Electa** is an intelligent, context-aware web application that delivers highly personalized recommendations based on your current emotional state, real-time location, and unique preferences. Powered by **Gemini 1.5 Flash 8B**, it's optimized for sub-second responses and snappy interaction.

### Key Features
*   **Mood-Driven UI**: Select your vibe (Happy, Stressed, Adventurous, etc.) for instant hyper-relevant suggestions.
*   **Context-Aware Engine**: Blends geographic location with AI logic for physically accessible recommendations (Food category).
*   **Intelligent Performance**: Features built-in frontend caching and request debouncing to maximize speed and protect API quotas.
*   **Real-time Image Integration**: Automatically pulls high-quality thumbnails from Wikipedia, TMDB, and IMDB with a fallback to AI-generated visuals.
*   **Persistent Bookmarking**: Save your favorite recommendations to your interactive profile grid.
*   **Native Photo uploads**: Custom profile avatars with native web FileReaders.
*   **Auth Ready**: Modern UI patterns for login/signup flows with localStorage persistence.

### Technical Architecture
1.  **Frontend**: React 19, Vite, TypeScript, Framer Motion, and Tailwind CSS.
2.  **API Layer**: Vercel Serverless Functions (Node.js/Express) with `@google/genai` integration.
3.  **Model**: Gemini 1.5 Flash 8B (Latency Optimized).
4.  **Imagery**: Wikipedia API, TMDB, and Pollinations.ai.
