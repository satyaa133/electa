# 🏛️ Electa: Your Mood-Driven AI Companion

Electa is a premium AI discovery platform that recommends movies, music, books, restaurants, and games tailored to your current mood and location. Built for speed and elegance.

## ✨ Core Features

- **🎭 Mood-Centric Discovery**: Instant, context-aware recommendations based on your current vibe.
- **📍 Location Awareness**: Automatic geolocation to suggest real-world venues like restaurants and cafes near you.
- **🍣 Contextual Search**: Specific sub-categories (Breakfast, Lunch, Dinner) for pinpoint accuracy in food discovery.
- **💬 Ask AI**: Deep-dive into any recommendation with a built-in AI chat for specific follow-up questions.
- **🛡️ API Resilience**: 
    - **Dual-Layer Cache**: Neon (PostgreSQL) and browser storage for near-instant load times.
    - **Key Rotation**: Multi-key support to distribute load and maximize uptime.
    - **Hybrid Freshness**: Probabilistic revalidation to keep suggestions dynamic.
- **🌙 Premium UI**: Responsive glassmorphic design with full dark mode support.
- **👤 Persistence**: Secure authentication with personal bookmarks and preference synchronization.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Motion
- **Backend**: Node.js (Express), Vercel Serverless
- **AI**: Google Gemini 2.0 Flash
- **Database**: Neon PostgreSQL