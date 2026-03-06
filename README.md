# Electa | AI Recommendations

Electa is a personalized, context-aware artificial intelligence application designed to seamlessly recommend activities, places, and media tailored entirely to your current emotional state, real-time location, and unique personal preferences. Built as a sleek, dynamic web interface, Electa abstracts away the complexity of AI prompting by giving users an intuitive, mood-driven dashboard.

The overarching goal of Electa is to serve as an intelligent, proactive companion. Rather than forcing you to decide what to do and type it out into a chat box, Electa simply asks how you are feeling right now. By combining that feeling with where you are in the world, it leverages the cutting-edge **Gemini 1.5 Flash** model to instantaneously generate a highly curated, visually appealing list of suggestions—ranging from nearby restaurants and parks to specific movies, books, or hobbies that match your exact vibe.

### Key Features
*   **Mood-Driven Interface**: Generate recommendations simply by selecting how you feel (e.g., Happy, Stressed, Adventurous, Focused) from a beautifully animated UI.
*   **Context Aware**: Electa asks for your browser's location data to automatically filter recommendations so they are physically accessible to you. It completely understands both global generic recommendations and hyper-local activities.
*   **Deep Personalization**: A robust user profile system allows you to define your core preferences through dynamic tags—including your favorite *Genres*, specific *Dietary Restrictions*, and broad *Interests*. These preferences are automatically bundled into the AI's logic engine every single time you request a recommendation.
*   **Native Authentication**: Securely log in using real OAuth 2.0 integration with Google or GitHub, allowing you to access your personal profile from any device securely.
*   **Persistent Bookmarking**: When the AI generates a recommendation you love, simply click the bookmark icon. Electa permanently saves that card to your account's interactive "Saved Bookmarks" database.
*   **Native Photo Uploads**: Customize your profile presence by natively uploading any `.jpg` or `.png` from your computer directly into your account's cloud avatar.

### Technical Architecture
Electa operates on a robust full-stack architecture built for speed and realtime inference:
1.  **Frontend Interface**: Built with **React** and **TypeScript** using the incredibly fast **Vite** bundler. The UI is completely styled with **Tailwind CSS v4** allowing for seamless light and dark mode toggling.
2.  **Backend Server**: Powered by a custom **Node.js / Express** server handling OAuth token generation and custom API endpoints.
3.  **Relational Database**: Relies on a lightning-fast **SQLite** database (`better-sqlite3`) to securely persist your encrypted user profile, preference tags, native Base64 avatar images, and bookmarked recommendation JSONs.
4.  **AI Engine**: Integrates directly with the `@google/genai` SDK, utilizing system instructions and explicitly structured JSON schemas to force Gemini to return perfectly formatted, predictable recommendation cards every time.

## Running Locally

**Prerequisites:** Node.js (v18+)

1. Install all required dependencies:
   ```bash
   npm install
   ```
2. Create your environment configuration:
   ```bash
   cp .env.example .env.local
   ```
   *You must edit your `.env.local` to include your `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`/`SECRET`, and `GITHUB_CLIENT_ID`/`SECRET` for authentication to function.*
3. Start the application stack (Server & Frontend):
   ```bash
   npm run dev
   ```
4. Access Electa at `http://localhost:5173`
