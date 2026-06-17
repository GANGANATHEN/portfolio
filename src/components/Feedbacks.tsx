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
    <section className="py-12 px-6 md:px-20 bg-[#0a0a0c] rounded-[2rem] border border-white/5 mx-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-white text-3xl font-black tracking-tight">
          Community <span className="text-accent">Feedback</span>
        </h2>
        <span className="text-gray-500 font-mono text-sm">
          {feedbacks.length} ENTRIES
        </span>
      </div>

      {/* Input Box - Modern Style */}
      <form
        onSubmit={handleSubmit}
        className="bg-white/[0.03] p-6 rounded-3xl border border-white/5 mb-12"
      >
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
            G
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <input
              placeholder="Your handle..."
              className="bg-transparent border-b border-white/10 focus:border-accent outline-none text-white pb-2 transition-all placeholder:text-gray-600"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <textarea
              placeholder="Share your thoughts on the project..."
              rows={2}
              className="bg-transparent border-b border-white/10 focus:border-accent outline-none text-white pb-2 transition-all placeholder:text-gray-600 resize-none"
              value={form.testimonial}
              onChange={(e) =>
                setForm({ ...form, testimonial: e.target.value })
              }
            />
            <button
              disabled={loading}
              type="submit"
              className="self-end bg-accent hover:bg-white text-black px-8 py-2.5 rounded-full text-sm font-black transition-all hover:scale-105 active:scale-95"
            >
              {loading ? "POSTING..." : "POST COMMENT"}
            </button>
          </div>
        </div>
      </form>

      {/* Feedbacks List */}
      <div className="grid gap-6">
        {feedbacks.map((f) => (
          <div
            key={f.id}
            className="feedback-card p-6 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-accent/30 transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                {f.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">@{f.name}</h4>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">
                  Verified Contributor
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed pl-14">
              {f.testimonial}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Feedbacks;
