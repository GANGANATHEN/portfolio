"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, Smile, ThumbsUp, Heart, Sparkles, type LucideIcon } from "lucide-react";

interface TelegramEmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  mode?: "reaction" | "composer";
  currentReactions?: string[];
}

interface EmojiCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  emojis: { char: string; name: string }[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "popular",
    label: "Popular",
    icon: Sparkles,
    emojis: [
      { char: "👍", name: "thumbs up approve like" },
      { char: "❤️", name: "heart love" },
      { char: "🔥", name: "fire lit hot" },
      { char: "🎉", name: "party celebration congrats" },
      { char: "😂", name: "laugh lol tears joy" },
      { char: "😮", name: "wow surprise shock" },
      { char: "😢", name: "sad cry tears" },
      { char: "🙏", name: "pray please thanks pray" },
      { char: "🚀", name: "rocket launch speed fast" },
      { char: "👀", name: "eyes look seeing" },
      { char: "👏", name: "applause clap bravo" },
      { char: "💯", name: "hundred 100 percent perfect" },
      { char: "✨", name: "sparkles magic shiny" },
      { char: "💡", name: "idea lightbulb smart" },
      { char: "🎯", name: "target bullseye goal" },
      { char: "🤝", name: "handshake agree deal" },
    ],
  },
  {
    id: "smileys",
    label: "Smileys",
    icon: Smile,
    emojis: [
      { char: "😀", name: "grinning happy" },
      { char: "😃", name: "smile happy" },
      { char: "😄", name: "laugh smile" },
      { char: "😁", name: "grin proud" },
      { char: "😆", name: "squint smile laugh" },
      { char: "😅", name: "sweat smile relief" },
      { char: "🤣", name: "rofl laughing floor" },
      { char: "🥲", name: "smiling tear touched" },
      { char: "🥹", name: "holding tears moved" },
      { char: "😊", name: "blush warm" },
      { char: "😇", name: "angel halo innocent" },
      { char: "🙂", name: "slight smile" },
      { char: "🙃", name: "upside down sarcastic" },
      { char: "😉", name: "wink flirt playful" },
      { char: "😌", name: "relieved peace calm" },
      { char: "😍", name: "heart eyes love" },
      { char: "🥰", name: "adoring love hearts" },
      { char: "😘", name: "kiss love" },
      { char: "😋", name: "yummy delicious food" },
      { char: "😛", name: "tongue silly playful" },
      { char: "😜", name: "wink tongue crazy" },
      { char: "🤪", name: "zany wild goofy" },
      { char: "🤨", name: "raised eyebrow skeptic" },
      { char: "🧐", name: "monocle inspecting curious" },
      { char: "🤓", name: "nerd geek glasses" },
      { char: "😎", name: "cool sunglasses shades" },
      { char: "🤩", name: "star struck excited" },
      { char: "🥳", name: "party celebration hat" },
      { char: "😏", name: "smirk sly" },
      { char: "😒", name: "unamused bored" },
      { char: "😞", name: "disappointed sad" },
      { char: "😔", name: "pensive regret" },
      { char: "😟", name: "worried anxious" },
      { char: "😕", name: "confused puzzled" },
      { char: "🙁", name: "slight frown sad" },
      { char: "☹️", name: "frown unhappy" },
      { char: "😣", name: "persevering struggle" },
      { char: "😖", name: "confounded distressed" },
      { char: "😫", name: "tired exhausted" },
      { char: "😩", name: "weary groan" },
      { char: "🥺", name: "pleading puppy eyes" },
      { char: "😭", name: "loudly crying bawling" },
      { char: "😤", name: "triumph steam haughty" },
      { char: "😠", name: "angry mad" },
      { char: "😡", name: "enraged red angry" },
      { char: "🤬", name: "cursing swearing mad" },
      { char: "🤯", name: "mind blown exploding head" },
      { char: "😳", name: "flushed embarrassed" },
      { char: "🥵", name: "hot heat sweating" },
      { char: "🥶", name: "cold freezing ice" },
      { char: "😱", name: "screaming fearful fear" },
      { char: "😨", name: "fear scared" },
      { char: "😰", name: "anxious sweat nervous" },
      { char: "😥", name: "relieved tear sweat" },
      { char: "😓", name: "hard work sweat" },
      { char: "🤗", name: "hugs warmth embrace" },
      { char: "🫡", name: "salute respect soldier" },
      { char: "🤔", name: "thinking pondering consider" },
      { char: "🫢", name: "open eyes hand over mouth gasp" },
      { char: "🤫", name: "shh quiet secret" },
      { char: "🤥", name: "lying pinocchio long nose" },
      { char: "😶", name: "silent mouthless" },
      { char: "😐", name: "neutral poker face" },
      { char: "😑", name: "expressionless deadpan" },
      { char: "😬", name: "grimace awkward" },
      { char: "🫠", name: "melting dissolving" },
      { char: "🙄", name: "eye roll whatever" },
      { char: "🥱", name: "yawn sleepy bored" },
      { char: "😴", name: "sleeping zzz tired" },
      { char: "🤤", name: "drooling craving" },
      { char: "😵‍💫", name: "dizzy spiral eyes" },
      { char: "🤐", name: "zipper mouth sealed" },
    ],
  },
  {
    id: "gestures",
    label: "Hands",
    icon: ThumbsUp,
    emojis: [
      { char: "👍", name: "thumbs up approve good" },
      { char: "👎", name: "thumbs down dislike bad" },
      { char: "👊", name: "fist punch bro" },
      { char: "✊", name: "raised fist power" },
      { char: "🤛", name: "left fist bump" },
      { char: "🤜", name: "right fist bump" },
      { char: "👏", name: "clapping hands bravo" },
      { char: "🙌", name: "raising hands praise hooray" },
      { char: "👐", name: "open hands welcoming" },
      { char: "🤲", name: "palms up together" },
      { char: "🤝", name: "handshake deal agreement" },
      { char: "🙏", name: "folded hands pray thank you" },
      { char: "✍️", name: "writing hand note" },
      { char: "💪", name: "flexed biceps strong muscle" },
      { char: "✌️", name: "peace sign victory" },
      { char: "🤞", name: "crossed fingers lucky wish" },
      { char: "🫰", name: "hand with index finger heart kpop" },
      { char: "🤟", name: "love you gesture ily" },
      { char: "🤘", name: "sign of horns rock metal" },
      { char: "🤙", name: "call me hand shaka" },
      { char: "👈", name: "pointing left" },
      { char: "👉", name: "pointing right" },
      { char: "👆", name: "pointing up" },
      { char: "👇", name: "pointing down" },
      { char: "☝️", name: "index pointing up one" },
      { char: "👋", name: "waving hand hello bye" },
      { char: "🤚", name: "raised back of hand" },
      { char: "🖐️", name: "hand splayed five" },
      { char: "✋", name: "raised hand stop high five" },
      { char: "🖖", name: "vulcan salute spock" },
    ],
  },
  {
    id: "symbols",
    label: "Hearts & Signs",
    icon: Heart,
    emojis: [
      { char: "❤️", name: "red heart love" },
      { char: "🧡", name: "orange heart" },
      { char: "💛", name: "yellow heart" },
      { char: "💚", name: "green heart" },
      { char: "💙", name: "blue heart" },
      { char: "💜", name: "purple heart" },
      { char: "🖤", name: "black heart" },
      { char: "🤍", name: "white heart" },
      { char: "🤎", name: "brown heart" },
      { char: "💔", name: "broken heart heartbreak" },
      { char: "❤️‍🔥", name: "heart on fire passion" },
      { char: "❤️‍🩹", name: "mending heart healing" },
      { char: "❣️", name: "heart exclamation" },
      { char: "💕", name: "two hearts love" },
      { char: "💞", name: "revolving hearts" },
      { char: "💓", name: "beating heart" },
      { char: "💗", name: "growing heart" },
      { char: "💖", name: "sparkling heart" },
      { char: "💘", name: "cupid arrow heart" },
      { char: "💝", name: "ribbon gift heart" },
      { char: "💯", name: "hundred points 100" },
      { char: "🔥", name: "fire hot flame" },
      { char: "💥", name: "collision boom bang" },
      { char: "✨", name: "sparkles shiny clean" },
      { char: "⭐", name: "star favorite" },
      { char: "⚡", name: "high voltage lightning electricity" },
      { char: "🎉", name: "party popper tada" },
      { char: "🎊", name: "confetti ball" },
      { char: "🏆", name: "trophy winner award" },
      { char: "🥇", name: "1st place medal gold" },
      { char: "🎯", name: "direct hit target bullseye" },
      { char: "🚀", name: "rocket spaceship fast" },
      { char: "💡", name: "light bulb idea smart" },
      { char: "✅", name: "check mark green tick" },
      { char: "❌", name: "cross mark red x" },
      { char: "❓", name: "question mark question" },
      { char: "❗", name: "exclamation mark warning" },
    ],
  },
];

export default function TelegramEmojiPicker({
  onSelect,
  onClose,
  mode = "reaction",
  currentReactions = [],
}: TelegramEmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("popular");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      const category = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
      return category ? category.emojis : EMOJI_CATEGORIES[0].emojis;
    }

    const matched: { char: string; name: string }[] = [];
    const seen = new Set<string>();

    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (!seen.has(item.char) && (item.name.includes(q) || item.char === q)) {
          seen.add(item.char);
          matched.push(item);
        }
      }
    }
    return matched;
  }, [activeCategory, searchQuery]);

  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Emoji picker"
      className="w-72 sm:w-80 bg-[#17212b]/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col z-50 text-white animate-in fade-in zoom-in-95 duration-150 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Bar */}
      <div className="relative mb-2 flex items-center">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis..."
          className="w-full bg-[#0e1621] border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-400 transition-colors"
          autoFocus
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 text-gray-400 hover:text-white p-0.5 cursor-pointer"
            title="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Category Tabs (shown when not searching) */}
      {!searchQuery && (
        <div className="flex items-center justify-around border-b border-white/10 pb-1.5 mb-1.5">
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
                title={cat.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="max-h-52 overflow-y-auto custom-scrollbar grid grid-cols-7 sm:grid-cols-8 gap-1 p-1">
        {filteredEmojis.length === 0 ? (
          <div className="col-span-full py-6 text-center text-gray-400 text-xs">
            No emojis found for &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredEmojis.map(({ char, name }) => {
            const isAlreadyReacted = currentReactions.includes(char);
            return (
              <button
                key={`${char}-${name}`}
                type="button"
                onClick={() => {
                  onSelect(char);
                  if (mode === "reaction") {
                    onClose();
                  }
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:scale-125 transition-all cursor-pointer ${
                  isAlreadyReacted
                    ? "bg-cyan-500/30 border border-cyan-400 scale-105"
                    : "hover:bg-white/10"
                }`}
                title={name}
              >
                <span>{char}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Close */}
      <div className="mt-1 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-400 px-1">
        <span>{mode === "reaction" ? "Click to react" : "Click to insert"}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white cursor-pointer px-1 py-0.5 rounded hover:bg-white/10"
        >
          Close
        </button>
      </div>
    </div>
  );
}
