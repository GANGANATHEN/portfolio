"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const Feedbacks = () => {
  type Feedback = {
    id: string | number;
    name: string;
    testimonial: string;
    created_at?: string | null;
  };

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [form, setForm] = useState({ name: "", testimonial: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      const { data } = await supabase
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setFeedbacks(data);
    };
    fetchFeedbacks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.testimonial) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("feedbacks")
      .insert([
        {
          name: form.name,
          testimonial: form.testimonial,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Supabase Error:", error.message);
    } else {
      setFeedbacks([data[0], ...feedbacks]);
      setForm({ name: "", testimonial: "" });
    }
    setLoading(false);
  };

  return (
    <section className="py-8 md:py-12 px-4 md:px-10 lg:px-20 bg-[#0a0a0c] rounded-3xl md:rounded-4xl border border-white/5 mx-2 md:mx-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-10 gap-4">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
          Community <span className="text-accent">Feedback</span>
        </h2>
        <span className="text-gray-500 font-mono text-xs md:text-sm">
          {feedbacks.length} ENTRIES
        </span>
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSubmit}
        className="bg-white/3 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 mb-8 md:mb-12"
      >
        <div className="flex gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">
            G
          </div>
          <div className="flex-1 flex flex-col gap-3 md:gap-4">
            <input
              placeholder="Your handle..."
              className="bg-transparent border-b border-white/10 focus:border-cyan-400 outline-none text-white pb-2 transition-all placeholder:text-gray-600 w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <textarea
              placeholder="Share your thoughts..."
              rows={2}
              className="bg-transparent border-b border-white/10 focus:border-cyan-400 outline-none text-white pb-2 transition-all placeholder:text-gray-600 resize-none w-full"
              value={form.testimonial}
              onChange={(e) =>
                setForm({ ...form, testimonial: e.target.value })
              }
            />
            <button
              disabled={loading}
              type="submit"
              className="self-end bg-accent hover:bg-cyan-500 text-black px-6 md:px-8 py-2 rounded-full text-xs md:text-sm font-black transition-all hover:scale-105 active:scale-95"
            >
              {loading ? "POSTING..." : "POST COMMENT"}
            </button>
          </div>
        </div>
      </form>

      {/* Feedbacks List */}
      <div className="grid gap-4 md:gap-6">
        {feedbacks.map((f) => (
          <div
            key={f.id}
            className="p-4 md:p-6 bg-white/2 rounded-xl md:rounded-2xl border border-white/5 hover:border-cyan-400/30 transition-all"
          >
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-linear-to-tr from-accent to-cyan-500 flex items-center justify-center text-white font-bold text-[10px]">
                {f.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-white font-bold text-xs md:text-sm">
                  @{f.name}
                </h4>
                <p className="text-gray-500 text-[9px] md:text-[10px] uppercase tracking-wider">
                  Verified Contributor
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-xs md:text-sm leading-relaxed pl-11 md:pl-14">
              {f.testimonial}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Feedbacks;
