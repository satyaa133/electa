import React, { useState, useEffect } from 'react';
import {
  Smile,
  Frown,
  Zap,
  Coffee,
  Moon,
  Sun,
  Search,
  Heart,
  ThumbsDown,
  Bookmark,
  Sparkles,
  Film,
  Music,
  BookOpen,
  Utensils,
  Gamepad2,
  LogOut,
  Loader2,
  MapPin,
  ShieldCheck,
  X,
  Star,
  ExternalLink,
  Mail,
  Lock,
  ArrowRight,
  Github,
  Chrome,
  User as UserIcon,
  Settings,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { getRecommendations, Recommendation } from './services/gemini';
import { useTheme } from './context/ThemeContext';

// --- Constants ---

const MOODS = [
  { id: 'happy', label: 'Happy', icon: Smile, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/50' },
  { id: 'stressed', label: 'Stressed', icon: Zap, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50' },
  { id: 'bored', label: 'Bored', icon: Frown, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50' },
  { id: 'relaxed', label: 'Relaxed', icon: Coffee, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50' },
  { id: 'energetic', label: 'Energetic', icon: Sun, color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50' },
  { id: 'melancholic', label: 'Melancholic', icon: Moon, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50' },
];

const CATEGORIES = [
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'restaurants', label: 'Food', icon: Utensils },
  { id: 'games', label: 'Games', icon: Gamepad2 },
];

// --- Components ---

const Modal = ({ isOpen, onClose, children }: { isOpen: boolean, onClose: () => void, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none p-4"
        >
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl dark:shadow-2xl dark:shadow-black/50 pointer-events-auto flex flex-col max-h-[90vh] relative">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full z-50 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const MoodButton = ({ mood, isActive, onClick }: { mood: any, isActive: boolean, onClick: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
      isActive
        ? cn(mood.color, "border-current shadow-lg")
        : "bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-200 dark:hover:border-zinc-600"
    )}
  >
    <mood.icon size={32} className="mb-2" />
    <span className="text-sm font-bold">{mood.label}</span>
  </motion.button>
);

const RecCard = ({ rec, onClick, onFeedback }: { rec: Recommendation, onClick: () => void, onFeedback: (id: string, type: 'like' | 'dislike' | 'save') => void }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-zinc-800 rounded-3xl overflow-hidden border border-zinc-100 dark:border-zinc-700 shadow-sm hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black/30 transition-all group cursor-pointer flex flex-col"
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900 rounded-t-3xl">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-zinc-300 dark:text-zinc-700" />
          </div>
        )}
        <img
          src={rec.imageUrl}
          alt={rec.title}
          onLoad={() => setImageLoaded(true)}
          className={cn(
            "w-full h-full object-cover object-center group-hover:scale-105 transition-all duration-700",
            imageLoaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
          )}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-white shadow-sm">
            {rec.category}
          </span>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white line-clamp-1">{rec.title}</h3>
          {rec.details.rating && (
            <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
              <Star size={14} fill="currentColor" /> {rec.details.rating}
            </div>
          )}
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm line-clamp-2 mb-4">{rec.description}</p>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-700 rounded-xl mb-6">
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-300 uppercase tracking-widest mb-1">
            <Sparkles size={12} className="text-amber-500" /> AI Reasoning
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 italic leading-relaxed">"{rec.reason}"</p>
        </div>

        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onFeedback(rec.id, 'like')}
              className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 rounded-full transition-colors text-zinc-400 dark:text-zinc-500"
            >
              <Heart size={20} />
            </button>
            <button
              onClick={() => onFeedback(rec.id, 'dislike')}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors text-zinc-400 dark:text-zinc-500"
            >
              <ThumbsDown size={20} />
            </button>
          </div>
          <button
            onClick={() => onFeedback(rec.id, 'save')}
            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-500 rounded-full transition-colors text-zinc-400 dark:text-zinc-500"
          >
            <Bookmark size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main App ---

interface UserProfile {
  name: string;
  email: string;
  bio: string;
  preferences: {
    genres: string[];
    dietary: string[];
    interests: string[];
  };
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem('electa_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('electa_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('electa_user');
    }
  }, [user]);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [mood, setMood] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('movies');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [location, setLocation] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState("");
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ bio: '', preferences: { genres: [], dietary: [], interests: [] } });

  // Theme hook - must be at top level before any conditional returns
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (user) {
      setEditForm({ bio: user.bio, preferences: user.preferences });
    }
  }, [user]);

  const fetchIPLocation = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error("IP location failed");
      const data = await response.json();
      if (data.city) {
        const loc = data.region ? `${data.city}, ${data.region}` : data.city;
        console.log("IP Location found:", loc);
        setLocation(loc);
        return true;
      }
    } catch (err) {
      console.error("IP Location fetch failed:", err);
    }
    return false;
  };

  const requestLocation = () => {
    setIsLocating(true);
    console.log("Requesting location...");

    if (!navigator.geolocation) {
      console.log("Geolocation not supported, trying IP fallback...");
      fetchIPLocation().then(success => {
        if (!success) setLocation("Location not supported");
        setIsLocating(false);
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log(`Coordinates found: ${latitude}, ${longitude}`);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en-US,en;q=0.9',
              }
            }
          );

          if (!response.ok) throw new Error("Geocoding service error");

          const data = await response.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.suburb || addr.city_district || addr.county || "Unknown Location";
          const state = addr.state || addr.region || "";
          const country = addr.country || "";

          let locString = city;
          if (state) locString += `, ${state}`;
          else if (country) locString += `, ${country}`;

          setLocation(locString);
        } catch (err) {
          console.error("Geocoding failed, trying IP fallback...", err);
          const success = await fetchIPLocation();
          if (!success) {
            setLocation(`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`);
          }
        } finally {
          setIsLocating(false);
        }
      },
      async (err) => {
        console.warn("Location access error, trying IP fallback:", err.code, err.message);
        const success = await fetchIPLocation();
        if (!success) {
          if (err.code === 1) { // PERMISSION_DENIED
            setLocation("San Francisco, CA");
          } else {
            setLocation("Location unavailable");
          }
        }
        setIsLocating(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const handleFetchRecommendations = React.useCallback(async () => {
    if (!mood) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const prefs = user ? [...user.preferences.genres, ...user.preferences.dietary, ...user.preferences.interests] : [];
      const recs = await getRecommendations(mood, category, prefs, history, location || undefined);
      setRecommendations(recs);
    } catch (error: any) {
      console.error("Failed to fetch recommendations", error);
      if (error.message === "RATE_LIMIT") {
        setApiError("Limit reached. Try again after some time.");
      } else {
        setApiError("An unexpected error occurred while fetching recommendations.");
      }
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [mood, category, history, location, user]);

  useEffect(() => {
    if (mood) {
      handleFetchRecommendations();
    }
  }, [mood, category, location, user, history, handleFetchRecommendations]);

  useEffect(() => {
    if (recommendations.length > 0) {
      // Preload all incoming images to radically drop layout shift / blank load times
      recommendations.forEach(rec => {
        if (!rec.imageUrl) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = rec.imageUrl;
        // prevent duplicate preload links
        if (!document.head.querySelector(`link[href="\${rec.imageUrl}"]`)) {
          document.head.appendChild(link);
        }
      });
    }
  }, [recommendations]);

  const handleFeedback = (id: string, type: 'like' | 'dislike' | 'save') => {
    const item = recommendations.find(r => r.id === id);
    if (item && type === 'like') {
      setHistory(prev => [...prev, item.title].slice(-5));
    }
    console.log(`Feedback for ${id}: ${type}`);
  };

  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
        requestLocation();
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (newBio: string, newPrefs: any) => {
    if (!user) return;
    try {
      const response = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, bio: newBio, preferences: newPrefs }),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
      }
    } catch (err) {
      console.error("Failed to update profile", err);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();

      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        url,
        'google_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      setAuthError('Failed to initiate Google Sign-in');
      setIsLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(`/api/auth/github/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();

      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        url,
        'github_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      setAuthError('Failed to initiate GitHub Sign-in');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'OAUTH_SUCCESS') {
        setUser(event.data.user);
        requestLocation();
        setIsLoading(false);
      } else if (event.data?.type === 'OAUTH_ERROR') {
        setAuthError(event.data.error);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 flex flex-col font-sans relative">
        <header className="absolute top-0 left-0 w-full p-6 md:p-8 flex justify-between items-center z-10 pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl pointer-events-auto shadow-sm">
              <Sparkles size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white pointer-events-auto">Electa</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors pointer-events-auto"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-4 mt-16 md:mt-0 z-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] shadow-2xl shadow-zinc-200 dark:shadow-zinc-900/50 max-w-sm w-full border border-zinc-100 dark:border-zinc-800"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                {authMode === 'login' ? 'Sign in to access your personalized AI recommendations.' : 'Join Electa to get tailored suggestions based on your mood.'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all dark:text-white"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all dark:text-white"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all dark:text-white"
                />
              </div>

              {authError && (
                <p className="text-rose-500 text-xs font-bold text-center">{authError}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-95 shadow-lg shadow-zinc-200 dark:shadow-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : (authMode === 'login' ? 'Sign In' : 'Sign Up')} <ArrowRight size={18} />
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-100 dark:border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-zinc-900 px-4 text-zinc-400 dark:text-zinc-500 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 py-3 border border-zinc-100 dark:border-zinc-700 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-sm font-bold disabled:opacity-50 dark:text-white"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Chrome size={18} className="text-rose-500" />} Google
              </button>
              <button
                onClick={handleGithubSignIn}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 py-3 border border-zinc-100 dark:border-zinc-700 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-sm font-bold disabled:opacity-50 dark:text-white"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Github size={18} />} GitHub
              </button>
            </div>

            <button
              onClick={() => setUser({
                name: 'Guest User',
                email: 'guest@example.com',
                bio: 'Exploring Electa as a guest.',
                preferences: { genres: [], dietary: [], interests: [] }
              })}
              className="w-full mt-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-sm font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all border border-zinc-100 dark:border-zinc-700"
            >
              Continue as Guest
            </button>

            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {authMode === 'login' ? "Don't have an account?" : "Already have an account?"} {' '}
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-zinc-900 dark:text-white font-bold hover:underline"
              >
                {authMode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </motion.div>
        </div>

        <footer className="px-6 py-8 border-t border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-400 text-xs font-medium uppercase tracking-widest mt-auto">
          <div className="flex items-center gap-6">
            <span>© 2026 Electa</span>
            <span className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <span>Powered by Gemini 3.0</span>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} /> Privacy First
            </div>
            <div className="flex items-center gap-2">
              <Zap size={14} /> Real-time Inference
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl">
              <Sparkles size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">Electa</span>
          </div>

          <div className="flex items-center gap-6">
            {isLocating ? (
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-100 dark:border-zinc-700">
                <Loader2 size={12} className="animate-spin" /> Locating...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowManualLocation(true)}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors group"
                  title="Click to set location manually"
                >
                  <MapPin size={12} className={cn("transition-colors", location && !location.includes("unavailable") ? "text-rose-500" : "text-zinc-400 dark:text-zinc-500")} />
                  <span>{location || "Set Location"}</span>
                </button>
                <button
                  onClick={requestLocation}
                  className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-full transition-all"
                  title="Refresh automatic location"
                >
                  <Zap size={14} className={cn(isLocating ? "animate-pulse text-amber-500" : "text-zinc-400 dark:text-zinc-500")} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 pl-6 border-l border-zinc-100 dark:border-zinc-800">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {user.name[0]}
              </button>
              <button onClick={() => setUser(null)} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Mood Section */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">How are you feeling?</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Our AI uses your mood and location to suggest recommendations.</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Agentic Context Active
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {MOODS.map((m) => (
              <MoodButton
                key={m.id}
                mood={m}
                isActive={mood === m.id}
                onClick={() => setMood(m.id)}
              />
            ))}
          </div>
        </section>

        {/* Category Filter */}
        <section className="mb-12">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Select a Category</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all",
                  category === cat.id
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg shadow-zinc-200 dark:shadow-white/10"
                    : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                )}
              >
                <cat.icon size={18} />
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        {/* Recommendations Grid */}
        <section className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500"
              >
                <Loader2 size={48} className="animate-spin mb-4 text-zinc-900 dark:text-white" />
                <p className="font-mono text-xs uppercase tracking-widest">Agent reasoning in progress...</p>
              </motion.div>
            ) : mood ? (
              apiError === "Limit reached. Try again after some time." ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 rounded-full flex items-center justify-center text-rose-500 mb-6 border border-rose-100 dark:border-rose-900/50">
                    <Zap size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Limit Reached</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm mx-auto mt-2">
                    {apiError}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {recommendations.map((rec) => (
                    <RecCard
                      key={rec.id}
                      rec={rec}
                      onClick={() => setSelectedRec(rec)}
                      onFeedback={handleFeedback}
                    />
                  ))}
                </motion.div>
              )
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 dark:text-zinc-600 mb-6">
                  <Search size={40} />
                </div>
                <h3 className="text-xl font-bold text-zinc-500 dark:text-zinc-400">Select a mood to start</h3>
                <p className="text-zinc-400 dark:text-zinc-500 text-sm max-w-xs mx-auto mt-2">
                  Your recommendations will be generated in real-time based on your current emotional state and location.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedRec} onClose={() => setSelectedRec(null)}>
        {selectedRec && (
          <div className="flex flex-col bg-white dark:bg-zinc-900 min-h-full">
            <div className="h-64 flex-shrink-0 relative">
              <img
                src={selectedRec.imageUrl}
                alt={selectedRec.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-8 right-8">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-white border border-white/20 mb-3 inline-block">
                  {selectedRec.category}
                </span>
                <h2 className="text-3xl font-bold text-white tracking-tight">{selectedRec.title}</h2>
              </div>
            </div>
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  {selectedRec.details.rating && (
                    <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-900/50">
                      <Star size={18} fill="currentColor" /> {selectedRec.details.rating}
                    </div>
                  )}
                  {selectedRec.details.year && (
                    <span className="text-zinc-400 dark:text-zinc-500 text-sm font-medium">{selectedRec.details.year}</span>
                  )}
                </div>

              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Overview</h4>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{selectedRec.description}</p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section>
                    <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">AI Reasoning</h4>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl text-sm text-zinc-600 dark:text-zinc-400 italic">
                      "{selectedRec.reason}"
                    </div>
                  </section>
                  {selectedRec.details.tags && (
                    <section>
                      <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedRec.details.tags.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {selectedRec.details.address && (
                  <section>
                    <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Location</h4>
                    <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                      <MapPin size={18} className="text-rose-500" />
                      {selectedRec.details.address}
                    </div>
                  </section>
                )}
              </div>

              <div className="flex items-center gap-4 mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-700">
                <button className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-200 dark:shadow-white/10">
                  Explore Now <ExternalLink size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Profile Modal */}
      <Modal isOpen={isProfileOpen} onClose={() => { setIsProfileOpen(false); setIsEditingProfile(false); }}>
        {user && (
          <div className="flex flex-col bg-white dark:bg-zinc-900 min-h-full">
            <div className="h-32 bg-zinc-900 dark:bg-zinc-800 flex-shrink-0" />
            <div className="px-8 pb-8 -mt-12">
              <div className="flex items-end justify-between mb-8">
                <div className="w-24 h-24 bg-white dark:bg-zinc-900 rounded-3xl border-4 border-white dark:border-zinc-900 shadow-xl flex items-center justify-center text-3xl font-bold text-zinc-900 dark:text-white">
                  {user.name[0]}
                </div>
                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="px-6 py-2 border border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all dark:text-white"
                >
                  {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {isEditingProfile ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 block">Bio</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all text-sm dark:text-white"
                      rows={3}
                    />
                  </div>
                  <button
                    onClick={() => {
                      handleUpdateProfile(editForm.bio, editForm.preferences);
                      setIsEditingProfile(false);
                    }}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{user.name}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">{user.email}</p>
                    <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{user.bio}</p>
                  </div>

                  <div className="space-y-8">
                    <section>
                      <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Heart size={14} /> My Preferences
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-2">Genres</p>
                          <div className="flex flex-wrap gap-2">
                            {user.preferences.genres.map(g => (
                              <span key={g} className="px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium border border-rose-100 dark:border-rose-900/30">
                                {g}
                              </span>
                            ))}
                            <button className="px-3 py-1 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-400 dark:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">+ Add</button>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-2">Dietary</p>
                          <div className="flex flex-wrap gap-2">
                            {user.preferences.dietary.map(d => (
                              <span key={d} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium border border-emerald-100 dark:border-emerald-900/30">
                                {d}
                              </span>
                            ))}
                            <button className="px-3 py-1 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-400 dark:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">+ Add</button>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Bookmark size={14} /> Saved History
                      </h4>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 text-center">
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">You have {history.length} items in your recent history.</p>
                      </div>
                    </section>
                  </div>
                </>
              )}

              <div className="mt-12 pt-8 border-t border-zinc-100">
                <button
                  onClick={() => setUser(null)}
                  className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Location Modal */}
      <Modal isOpen={showManualLocation} onClose={() => setShowManualLocation(false)}>
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">Set Location Manually</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
            If automatic location detection isn't working, you can enter your city and state manually to get relevant recommendations.
          </p>
          <div className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
              <input
                type="text"
                placeholder="e.g., New York, NY"
                value={manualLocationInput}
                onChange={(e) => setManualLocationInput(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all text-zinc-900 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualLocationInput) {
                    setLocation(manualLocationInput);
                    setShowManualLocation(false);
                  }
                }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (manualLocationInput) {
                    setLocation(manualLocationInput);
                    setShowManualLocation(false);
                  }
                }}
                className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-lg shadow-zinc-200 dark:shadow-white/10"
              >
                Save Location
              </button>
              <button
                onClick={requestLocation}
                className="px-6 py-4 border border-zinc-100 dark:border-zinc-700 rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 text-zinc-900 dark:text-white"
              >
                <Zap size={18} className="text-amber-500" /> Auto-Detect
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-8 text-zinc-400 text-xs font-medium uppercase tracking-widest">
        <div className="flex items-center gap-6">
          <span>© 2026 Electa</span>
          <span className="w-1 h-1 rounded-full bg-zinc-200" />
          <span>Powered by Gemini 3.0</span>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} /> Privacy First
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} /> Real-time Inference
          </div>
        </div>
      </footer>

      <style>{`
        body {
          background-color: #F8F9FA;
        }
      `}</style>
    </div>
  );
}

