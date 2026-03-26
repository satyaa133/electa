# 🏛️ Electa: Your Mood-Driven AI Companion

Electa is a premium, AI-powered discovery platform that recommends movies, music, books, restaurants, and games tailored to your current mood and location. Built with a focus on speed, resilience, and elegance.

![Electa Hero](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200)

## ✨ Features

- **🎭 Mood-Centric Discovery**: Select your current vibe (Happy, Stressed, Bored, etc.) and get instant, context-aware recommendations.
- **📍 Location Awareness**: Automatic geolocation and IP fallback to suggest real-world physical venues like restaurants and cafes near you.
- **🍣 Contextual Food Subcategories**: When looking for food, choose between Breakfast, Lunch, Dinner, Dessert, or Snacks for targeted suggestions.
- **💬 Ask AI (Follow-up)**: Deep-dive into any recommendation with a built-in AI chat to ask specific questions (e.g., "Is this good for a date?").
- **🛡️ API Resilience & Caching**: 
    - **Dual-Layer Cache**: Leverages both a Neon (PostgreSQL) server-side cache and browser `localStorage` for near-instant load times.
    - **Key Rotation**: Supports multiple Gemini API keys to distribute load and maximize quota.
    - **Hybrid Freshness**: Uses probabilistic revalidation to ensure suggestions evolve over time while preserving API credits.
- **🌙 Premium UI**: A glassmorphic, responsive design with full dark mode support and smooth micro-animations.
- **👤 User Profiles**: Secure authentication with persistent bookmarks and personalized preferences.

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend API**: [Express](https://expressjs.com/) (Node.js)
- **Database**: [Neon PostgreSQL](https://neon.tech/) (Serverless)
- **AI Engine**: [Google Gemini 2.0 Flash](https://ai.google.dev/)

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- A [Google AI Studio](https://aistudio.google.com/) API Key.
- A [Neon](https://neon.tech/) database connection string.

### 2. Environment Setup
Create a `.env.local` file in the root directory:

```env
# Gemini API Keys (Supports comma-separated rotation)
GEMINI_API_KEY=your_api_key_1,your_api_key_2

# Database Connection (Neon PostgreSQL)
DATABASE_URL=postgres://user:pass@host/db?sslmode=require

# Google Maps API Key (Optional, for advanced location)
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 3. Installation
```bash
npm install
```

### 4. Running the Development Server
You need to run both the frontend and the API proxy:

```bash
# Terminal 1: Frontend (Vite)
npm run dev

# Terminal 2: API Server (Express)
npm run api
```

## 📂 Project Structure

- `/src/App.tsx`: The main application logic and UI.
- `/api/index.ts`: The Express server-side logic (Location, Auth, Gemini Proxy).
- `/src/services/gemini.ts`: Client-side service for Gemini API communication.
- `/src/context/ThemeContext.tsx`: Dark/Light mode management.

## 📄 License
This project is for personal discovery and prototyping purposes.
