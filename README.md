# Electa | AI Recommendations

# Electa | AI Recommendations

**Electa** is an intelligent, context-aware web application that delivers highly personalized recommendations based on your current emotional state, real-time location, and unique preferences. Simply click how you're feeling, and let **Gemini 1.5 Flash** curate your perfect matches.

### Key Features
*   **Mood-Driven UI**: Select your vibe (Happy, Stressed, Adventurous, etc.) to instantly generate hyper-relevant suggestions.
*   **Context-Aware Engine**: Blends your browser's geographic location with global logic for physically accessible recommendations.
*   **Deep Personalization**: Set custom tags for *Genres*, *Dietary Restrictions*, and *Interests* to perfectly align the AI with your tastes.
*   **Persistent Bookmarking**: Save any recommendation you love, beautifully stored in your profile's interactive grid.
*   **Native Photo Uploads**: Instantly upload custom Base-64 `.png` or `.jpg` profile avatars using native web FileReaders.
*   **Secure Authentication**: Log in securely using modern OAuth 2.0 integration with Google or GitHub.

### Technical Architecture
1.  **Frontend Interface**: React, Vite, TypeScript, and Tailwind CSS v4.
2.  **Backend Server**: Node.js and Express handling OAuth and AI proxy routing.
3.  **Database**: Fast, local SQLite (`better-sqlite3`) for persisting users and bookmarks.
4.  **AI Integration**: `@google/genai` SDK using structured JSON schema prompting.
