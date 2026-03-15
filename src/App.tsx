import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  Upload,
  Hourglass,
  RotateCcw,
  MessageSquare,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { getRecommendations, Recommendation, askFollowUp } from './services/gemini';
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

const SAMPLE_QUESTIONS: Record<string, string[]> = {
  movies: [
    "Is this a good family movie?",
    "Tell me about the director",
    "Where can I watch this?",
    "Is it too scary for kids?"
  ],
  movie: [
    "Is this a good family movie?",
    "Tell me about the director",
    "Where can I watch this?",
    "Is it too scary for kids?"
  ],
  music: [
    "What genre is this?",
    "Recommend similar artists",
    "Tell me about this album",
    "Is this good for a party?"
  ],
  books: [
    "Is this part of a series?",
    "How long is this book?",
    "What's the writing style like?",
    "Who is the target audience?"
  ],
  book: [
    "Is this part of a series?",
    "How long is this book?",
    "What's the writing style like?",
    "Who is the target audience?"
  ],
  restaurants: [
    "What's the best dish here?",
    "Is it good for a date?",
    "Do I need a reservation?",
    "Is it vegetarian-friendly?"
  ],
  food: [
    "What's the best dish here?",
    "Is it good for a date?",
    "Do I need a reservation?",
    "Is it vegetarian-friendly?"
  ],
  restaurant: [
    "What's the best dish here?",
    "Is it good for a date?",
    "Do I need a reservation?",
    "Is it vegetarian-friendly?"
  ],
  games: [
    "What's the difficulty level?",
    "How long to beat?",
    "Is it multiplayer?",
    "What platforms is it on?"
  ],
  game: [
    "What's the difficulty level?",
    "How long to beat?",
    "Is it multiplayer?",
    "What platforms is it on?"
  ],
  default: [
    "Tell me more about this",
    "Why do you recommend this?",
    "Is this popular right now?",
    "Give me similar suggestions"
  ]
};

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

const MoodButton = ({ mood, isActive, onClick }: { mood: any, isActive: boolean, onClick: () => void, key?: any }) => (
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

const RecCard = ({ 
  rec, 
  onClick, 
  onFeedback, 
  onAsk,
  isLiked = false,
  isDisliked = false,
  isSaved = false
}: { 
  rec: Recommendation, 
  onClick: () => void, 
  onFeedback: (id: string, type: 'like' | 'dislike' | 'save') => void,
  onAsk: (rec: Recommendation) => void,
  isLiked?: boolean,
  isDisliked?: boolean,
  isSaved?: boolean,
  key?: any 
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-700 shadow-sm hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black/30 transition-all group cursor-pointer flex flex-col h-full relative"
      onClick={onClick}
    >
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700">
            {rec.category}
          </span>
          {rec.details.rating && (
            <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
              <Star size={14} fill="currentColor" /> {rec.details.rating}
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 line-clamp-1">{rec.title}</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm line-clamp-2 mb-4">{rec.description}</p>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-700 rounded-xl mb-6">
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-300 uppercase tracking-widest mb-1">
            <Sparkles size={12} className="text-amber-500" /> AI Reasoning
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 italic leading-relaxed">"{rec.reason}"</p>
        </div>

        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onFeedback(rec.id, 'like')}
              className={cn(
                "p-2 rounded-full transition-colors",
                isLiked 
                  ? "bg-rose-50 dark:bg-rose-900/30 text-rose-500" 
                  : "hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 text-zinc-400 dark:text-zinc-500"
              )}
            >
              <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onFeedback(rec.id, 'dislike')}
              className={cn(
                "p-2 rounded-full transition-colors",
                isDisliked
                  ? "bg-zinc-100 dark:bg-zinc-600 text-zinc-900 dark:text-white"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-white text-zinc-400 dark:text-zinc-500"
              )}
            >
              <ThumbsDown size={20} fill={isDisliked ? "currentColor" : "none"} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onAsk(rec)}
              className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all border border-rose-100/50 dark:border-rose-800/50 ml-2"
            >
              <MessageSquare size={14} /> Ask AI
            </motion.button>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onFeedback(rec.id, 'save')}
            className={cn(
              "p-2 rounded-full transition-colors",
              isSaved
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-500"
                : "hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-500 text-zinc-400 dark:text-zinc-500"
            )}
          >
            <Bookmark size={20} fill={isSaved ? "currentColor" : "none"} />
          </motion.button>
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
  profile_photo?: string;
  preferences: {
    genres: string[];
    dietary: string[];
    interests: string[];
  };
  bookmarks: Recommendation[];
  location?: string;
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
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<string[]>([]);
  const [location, setLocation] = useState<string | null>(() => {
    return user?.location || null;
  });
  const [isLocating, setIsLocating] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState("");
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<Recommendation | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [apiContext, setApiContext] = useState<{ weather: string, timeOfDay: string } | null>(null);

  const [editForm, setEditForm] = useState({
    bio: '',
    profile_photo: '',
    preferences: { genres: [] as string[], dietary: [] as string[], interests: [] as string[] }
  });

  // Caching layer for recommendations
  const [recCache, setRecCache] = useState<Record<string, Recommendation[]>>({});
  const [tagInputs, setTagInputs] = useState({ genres: '', dietary: '', interests: '' });

  // Theme hook - must be at top level before any conditional returns
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (user) {
      setEditForm({
        bio: user.bio || '',
        profile_photo: user.profile_photo || '',
        preferences: user.preferences
      });
    }
  }, [user]);

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, profile_photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSetLocation = (newLoc: string | null) => {
    setLocation(newLoc);
    if (user && newLoc) {
      setUser({ ...user, location: newLoc });
      // Sync to backend
      fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          bio: user.bio,
          profile_photo: user.profile_photo,
          preferences: user.preferences,
          bookmarks: user.bookmarks,
          location: newLoc
        }),
      }).catch(err => console.error("Failed to sync location to server", err));
    }
  };

  const fetchIPLocation = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error("IP location failed");
      const data = await response.json();
      if (data.city) {
        const loc = data.region ? `${data.city}, ${data.region}` : data.city;
        console.log("IP Location found:", loc);
        handleSetLocation(loc);
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
        if (!success) handleSetLocation("Location not supported");
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

          handleSetLocation(locString);
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
            handleSetLocation("San Francisco, CA");
          } else {
            handleSetLocation("Location unavailable");
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


  const handleFetchRecommendations = React.useCallback(async (forceRefresh = false) => {
    if (!mood) return;

    const cacheKey = `${mood}-${category}`;
    if (!forceRefresh && recCache[cacheKey]) {
      setRecommendations(recCache[cacheKey]);
      setApiError(null);
      return;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const prefs = user ? [...user.preferences.genres, ...user.preferences.dietary, ...user.preferences.interests] : [];
      // Use the raw response to get the context
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood,
          category,
          preferences: prefs,
          history,
          location: location || undefined,
          userHour: new Date().getHours()
        })
      });
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);
      
      const recs = data.recommendations;
      setRecommendations(recs);
      setRecCache(prev => ({ ...prev, [cacheKey]: recs }));
      if (data.context) {
        setApiContext(data.context);
      }
    } catch (error: any) {
      console.error("Failed to fetch recommendations", error);
      if (error.message === "RATE_LIMIT") {
        setApiError("Limit reached.");
      } else {
        setApiError("Try after few hours");
      }
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [mood, category, history, location, user, recCache]);

  useEffect(() => {
    if (mood) {
      const timer = setTimeout(() => {
        handleFetchRecommendations();
      }, 400); // 400ms debounce
      return () => clearTimeout(timer);
    }
  }, [mood, category, location, user, history, handleFetchRecommendations]);

  const handleAsk = (rec: Recommendation) => {
    setChatTarget(rec);
    setChatMessages([]);
    setChatInput("");
    setIsChatOpen(true);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !chatTarget) return;

    const userMsg = { role: 'user' as const, content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const answer = await askFollowUp(chatTarget, chatInput, chatMessages);
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: answer }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: "Sorry, Electa encountered an issue answering that. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleFeedback = async (id: string, type: 'like' | 'dislike' | 'save') => {
    const item = recommendations.find(r => r.id === id);
    if (!item) return;

    if (type === 'like') {
      setLikedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else {
          next.add(id);
          setDislikedIds(d => {
            const dn = new Set(d);
            dn.delete(id);
            return dn;
          });
          setHistory(h => [...h, item.title].slice(-5));
        }
        return next;
      });
    }

    if (type === 'dislike') {
      setDislikedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else {
          next.add(id);
          setLikedIds(l => {
            const ln = new Set(l);
            ln.delete(id);
            return ln;
          });
        }
        return next;
      });
    }

    if (type === 'save' && user) {
      const isBookmarked = user.bookmarks.some((b: any) => b.id === id);
      const newBookmarks = isBookmarked 
        ? user.bookmarks.filter((b: any) => b.id !== id)
        : [item, ...user.bookmarks];
      
      const updatedUser = { ...user, bookmarks: newBookmarks };
      setUser(updatedUser);

      // Sync to backend asynchronously
      fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          bio: user.bio,
          profile_photo: user.profile_photo,
          preferences: user.preferences,
          bookmarks: newBookmarks
        }),
      }).catch(err => console.error("Failed to sync bookmark to server", err));
    }

    console.log(`Feedback for ${id}: ${type}`);
  };

  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailFormError, setEmailFormError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailFormError(null);
    setAuthError(null);

    if (!authForm.email.includes('@')) {
      setEmailFormError('Invalid Email');
      return;
    }

    setIsLoading(true);
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
        // After login, try auto-location, if it fails or completes, check if we need manual
        requestLocation();
        if (!data.user.location) {
          setTimeout(() => setShowManualLocation(true), 1500);
        }
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (newBio: string, newPhoto: string, newPrefs: any) => {
    if (!user) return;
    try {
      const response = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          bio: newBio,
          profile_photo: newPhoto,
          preferences: newPrefs,
          bookmarks: user.bookmarks
        }),
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

      const popup = window.open(
        url,
        'google_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (popup) {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            setIsLoading(false);
          }
        }, 500);
      }
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

      const popup = window.open(
        url,
        'github_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (popup) {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            setIsLoading(false);
          }
        }, 500);
      }
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
        if (!event.data.user.location) {
          setTimeout(() => setShowManualLocation(true), 1500);
        }
        setIsLoading(false);
      } else if (event.data?.type === 'OAUTH_ERROR') {
        setAuthError(event.data.error);
        setIsLoading(false);
      } else if (event.data?.type === 'OAUTH_CANCELLED') {
        setAuthError(null);
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

            <form onSubmit={handleAuth} className="space-y-4" noValidate>
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
              <div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    value={authForm.email}
                    onChange={(e) => {
                      setAuthForm({ ...authForm, email: e.target.value });
                      if (emailFormError) setEmailFormError(null);
                    }}
                    className={cn(
                      "w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border rounded-2xl focus:outline-none transition-all dark:text-white",
                      emailFormError
                        ? "border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                        : "border-zinc-100 dark:border-zinc-700 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                    )}
                  />
                </div>
                {emailFormError && (
                  <p className="text-rose-500 text-xs mt-1 ml-2">{emailFormError}</p>
                )}
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
                profile_photo: '',
                preferences: { genres: [], dietary: [], interests: [] },
                bookmarks: []
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
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl">
              <Sparkles size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">Electa</span>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
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
                  <span className="inline truncate max-w-[100px] md:max-w-[150px]">{location || "Set Location"}</span>
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
            <div className="flex items-center gap-2 md:gap-3 pl-3 md:pl-6 border-l border-zinc-100 dark:border-zinc-800">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => {
                  requestLocation();
                  setIsProfileOpen(true);
                }}
                className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
              >
                {user.profile_photo ? (
                  <img src={user.profile_photo} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  user.name[0].toUpperCase()
                )}
              </button>
              <button onClick={() => setUser(null)} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Mood Section */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">How are you feeling?</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Our AI uses your mood and location to suggest recommendations.</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleFetchRecommendations(true)}
                disabled={isLoading || !mood}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all border border-zinc-100 dark:border-zinc-800"
                title="Get fresh recommendations"
              >
                <RotateCcw size={12} className={cn(isLoading && "animate-spin")} />
                Refresh
              </button>
              <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {apiContext ? (
                  <span className="flex items-center gap-2">
                    {apiContext.weather} • {apiContext.timeOfDay}
                  </span>
                ) : (
                  "Agentic Context Active"
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
            <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">Select a Category</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 rounded-2xl text-xs md:text-sm font-bold transition-all",
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
                <p className="font-mono text-xs uppercase tracking-widest">Curating tailored gems...</p>
              </motion.div>
            ) : mood ? (
              apiError ? (
                apiError === "Limit reached." ? (
                  <motion.div
                    key="error-limit"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-center"
                  >
                    <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 rounded-full flex items-center justify-center text-rose-500 mb-6 relative">
                      <Hourglass size={32} className="relative z-10 animate-[spin_3s_ease-in-out_infinite]" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Cool Down Active</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 font-mono text-xs mt-1">
                      Try after some hours
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="error-generic"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-center"
                  >
                    <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-500 mb-6 border border-amber-200 dark:border-amber-800">
                      <Hourglass size={32} className="animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Something went wrong</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 font-mono text-sm max-w-md mt-1 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      {apiError}
                    </p>
                  </motion.div>
                )
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
                      onAsk={handleAsk}
                      isLiked={likedIds.has(rec.id)}
                      isDisliked={dislikedIds.has(rec.id)}
                      isSaved={user?.bookmarks.some(b => b.id === rec.id)}
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
            <div className="h-32 flex-shrink-0 relative bg-zinc-900 dark:bg-zinc-800 flex items-center px-8">
              <div>
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-white border border-white/10 mb-3 inline-block">
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

                {selectedRec.category === 'Food' && selectedRec.details.address && (
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
                <button
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedRec.title)}`, '_blank')}
                  className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-200 dark:shadow-white/10"
                >
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
            <div className="h-32 bg-zinc-900 dark:bg-zinc-800 flex-shrink-0 relative overflow-hidden">
              {user.profile_photo && (
                <img src={user.profile_photo} alt="Cover" className="w-full h-full object-cover opacity-30 blur-sm" referrerPolicy="no-referrer" />
              )}
            </div>
            <div className="px-8 pb-8 -mt-12">
              <div className="flex items-end justify-between mb-8">
                <div
                  className={`w-24 h-24 bg-white dark:bg-zinc-900 rounded-3xl border-4 border-white dark:border-zinc-900 shadow-xl overflow-hidden flex items-center justify-center text-3xl font-bold text-zinc-900 dark:text-white relative bg-zinc-100 dark:bg-zinc-800 ${isEditingProfile ? 'cursor-pointer group' : ''}`}
                  onClick={() => isEditingProfile && fileInputRef.current?.click()}
                >
                  {isEditingProfile && (
                    <div className="absolute inset-0 bg-black/50 z-10 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload size={20} className="mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Upload</span>
                    </div>
                  )}
                  {editForm.profile_photo && isEditingProfile ? (
                    <img src={editForm.profile_photo} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : user.profile_photo && !isEditingProfile ? (
                    <img src={user.profile_photo} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    user.name[0].toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="px-6 py-2 border border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all dark:text-white shadow-sm"
                >
                  {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {isEditingProfile ? (
                <div className="space-y-6">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleProfilePhotoUpload}
                  />
                  <div>
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 block">Bio</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all text-sm dark:text-white"
                      rows={3}
                    />
                  </div>

                  {/* Preferences Editor */}
                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Edit Preferences</h4>

                    {(['genres', 'dietary', 'interests'] as const).map(prefType => (
                      <div key={prefType} className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 block">{prefType}</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {editForm.preferences[prefType].map(tag => (
                            <span key={tag} className="px-3 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium flex items-center gap-1 group">
                              {tag}
                              <button
                                onClick={() => setEditForm(prev => ({
                                  ...prev,
                                  preferences: { ...prev.preferences, [prefType]: prev.preferences[prefType].filter(t => t !== tag) }
                                }))}
                                className="opacity-50 hover:opacity-100 hover:text-rose-500 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tagInputs[prefType]}
                            onChange={e => setTagInputs(prev => ({ ...prev, [prefType]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && tagInputs[prefType].trim()) {
                                e.preventDefault();
                                const newTag = tagInputs[prefType].trim();
                                if (!editForm.preferences[prefType].includes(newTag)) {
                                  setEditForm(prev => ({
                                    ...prev,
                                    preferences: { ...prev.preferences, [prefType]: [...prev.preferences[prefType], newTag] }
                                  }));
                                }
                                setTagInputs(prev => ({ ...prev, [prefType]: '' }));
                              }
                            }}
                            placeholder={`Add ${prefType}... (Press Enter)`}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-400 dark:text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      handleUpdateProfile(editForm.bio, editForm.profile_photo, editForm.preferences);
                      setIsEditingProfile(false);
                    }}
                    className="w-full mt-6 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-lg"
                  >
                    Save Profile
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
                            {user.preferences.genres.length > 0 ? user.preferences.genres.map(g => (
                              <span key={g} className="px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium border border-rose-100 dark:border-rose-900/30">
                                {g}
                              </span>
                            )) : <span className="text-xs text-zinc-400 italic">No genres added.</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-2">Dietary</p>
                          <div className="flex flex-wrap gap-2">
                            {user.preferences.dietary.length > 0 ? user.preferences.dietary.map(d => (
                              <span key={d} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium border border-emerald-100 dark:border-emerald-900/30">
                                {d}
                              </span>
                            )) : <span className="text-xs text-zinc-400 italic">No dietary preferences added.</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-2">Interests</p>
                          <div className="flex flex-wrap gap-2">
                            {user.preferences.interests.length > 0 ? user.preferences.interests.map(i => (
                              <span key={i} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium border border-blue-100 dark:border-blue-900/30">
                                {i}
                              </span>
                            )) : <span className="text-xs text-zinc-400 italic">No interests added.</span>}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Bookmark size={14} /> Saved Bookmarks
                      </h4>
                      {user.bookmarks && user.bookmarks.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {user.bookmarks.map(rec => (
                            <div key={rec.id} className="group relative flex gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 transition-all cursor-pointer" onClick={() => setSelectedRec(rec)}>
                              <div className="w-10 h-10 rounded-xl flex-shrink-0 bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center">
                                <Sparkles size={16} className="text-zinc-400" />
                              </div>
                              <div className="flex flex-col justify-center overflow-hidden">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1">{rec.category}</span>
                                <h5 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{rec.title}</h5>
                              </div>
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAsk(rec);
                                  }}
                                  className="p-1.5 bg-white dark:bg-zinc-700 rounded-full text-zinc-400 hover:text-rose-500 shadow-sm"
                                  title="Ask AI"
                                >
                                  <MessageSquare size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newBookmarks = user.bookmarks.filter(b => b.id !== rec.id);
                                    setUser({ ...user, bookmarks: newBookmarks });

                                    fetch('/api/user/update', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        email: user.email,
                                        bio: user.bio,
                                        profile_photo: user.profile_photo,
                                        preferences: user.preferences,
                                        bookmarks: newBookmarks
                                      }),
                                    }).catch(err => console.error("Failed to sync bookmark deletion", err));
                                  }}
                                  className="p-1.5 bg-white dark:bg-zinc-700 rounded-full text-zinc-400 hover:text-rose-500 shadow-sm"
                                  title="Remove bookmark"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 text-center">
                          <Bookmark size={24} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                          <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">No saved bookmarks yet</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Click the bookmark icon on any recommendation to save it here.</p>
                        </div>
                      )}
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
                    handleSetLocation(manualLocationInput);
                    setShowManualLocation(false);
                  }
                }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (manualLocationInput) {
                    handleSetLocation(manualLocationInput);
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

      {/* Talk to the Card Chat Modal */}
      <Modal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)}>
        <div className="flex flex-col h-[600px] max-h-[80vh] bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Chat Header */}
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Ask Electa</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">About {chatTarget?.title}</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400">
              <X size={20} />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 && (
              <div className="py-4">
                <p className="text-sm font-bold text-zinc-900 dark:text-white mb-4 px-2">Suggested Questions</p>
                <div className="grid grid-cols-1 gap-2">
                  {(SAMPLE_QUESTIONS[chatTarget?.category.toLowerCase() || 'default'] || SAMPLE_QUESTIONS.default).map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => setChatInput(q)}
                      className="text-left px-4 py-3 text-xs bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50 rounded-xl hover:border-rose-300 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all text-zinc-600 dark:text-zinc-400 font-medium"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed shadow-sm",
                  msg.role === 'user' 
                    ? "bg-rose-500 text-white rounded-tr-none" 
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-zinc-200/50 dark:border-zinc-700/50"
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content.split(/(\[.*?\]\(.*?\))/g).map((part, index) => {
                        const match = part.match(/\[(.*?)\]\((.*?)\)/);
                        if (match) {
                          return (
                            <a 
                              key={index} 
                              href={match[2]} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-rose-600 dark:text-rose-400 font-bold underline hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                            >
                              {match[1]}
                            </a>
                          );
                        }
                        return part;
                      })}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-zinc-400" />
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isChatLoading}
                className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50 dark:text-white"
              />
              <button
                onClick={handleSendMessage}
                disabled={isChatLoading || !chatInput.trim()}
                className="p-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all shadow-lg shadow-rose-200 dark:shadow-rose-900/20 disabled:opacity-50 disabled:grayscale"
              >
                <Send size={18} />
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

