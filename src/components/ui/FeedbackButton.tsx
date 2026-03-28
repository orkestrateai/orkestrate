"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Paperclip, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export const FeedbackButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      setIsAuthenticated(!!res.data?.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setIsAuthenticated(!!session?.user);
    });

    const handleOpenModal = () => setIsOpen(true);
    window.addEventListener("open-feedback-modal", handleOpenModal);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("open-feedback-modal", handleOpenModal);
    };
  }, [supabase.auth]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages((prev) => [...prev, ...newFiles].slice(0, 3)); // Max 3 images
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && images.length === 0) return;

    setIsSubmitting(true);

    try {
      // Package images and text into FormData to support multipart file upload natively
      const formData = new FormData();
      formData.append("message", message);
      images.forEach((img) => formData.append("images", img));

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to send message via Server Endpoint.");
      }

      setSubmitted(true);
      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        // Reset state after closing animation
        setTimeout(() => {
          setSubmitted(false);
          setMessage("");
          setImages([]);
        }, 300);
      }, 2000);

    } catch (error) {
      console.error(error);
      alert("Failed to send feedback right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated === null || !isAuthenticated) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-[60] w-[340px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111]">
              <span className="text-zinc-200 text-sm font-medium tracking-wide">Contact Support</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-3 h-[200px]">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-[#4ADE80]" />
                </motion.div>
                <p className="text-zinc-300 text-[13px] text-center">
                  Message sent to support!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col p-4 bg-[#0A0A0A]">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  className="w-full h-24 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-white/20 transition-colors resize-none mb-4"
                  required
                  autoFocus
                />

                {/* Attached Images */}
                {images.length > 0 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {images.map((file, i) => (
                      <div key={i} className="relative group w-12 h-12 rounded-md overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Attachment" 
                          className="w-full h-full object-cover opacity-80"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between mt-auto">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-md transition-all flex items-center gap-2"
                    title="Attach internal log or image"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="text-[11px]">Attach</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || (!message.trim() && images.length === 0)}
                    className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-lg text-[13px] font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center gap-2 h-10 px-4 bg-white hover:bg-zinc-200 border border-transparent rounded-full shadow-[0_4px_14px_rgba(255,255,255,0.1)] transition-all group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        aria-label="Report issue or send feedback"
      >
        {isOpen ? (
          <X className="w-4 h-4 text-black" />
        ) : (
          <>
            <MessageSquare className="w-4 h-4 text-black" />
            <span className="text-black text-[13px] font-semibold tracking-tight">Feedback</span>
          </>
        )}
      </motion.button>
    </>
  );
};
