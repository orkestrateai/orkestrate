"use client";

import React, { useState, useRef } from "react";
import { X, Send, Paperclip, Loader2, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const ReportIssueModal = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const formData = new FormData();
      formData.append("message", message);
      images.forEach((img) => formData.append("images", img));

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to send message.");

      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setTimeout(() => {
          setSubmitted(false);
          setMessage("");
          setImages([]);
        }, 300);
      }, 2000);

    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[101] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                  <MessageSquareWarning className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Report an Issue</h3>
                  <p className="text-[11px] text-zinc-500">Send direct feedback to the engineering team.</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            {submitted ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-[300px]">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <h4 className="text-lg font-semibold text-zinc-200 mb-2">Report Sent</h4>
                <p className="text-sm text-zinc-500 max-w-[250px]">
                  Thank you for helping us improve Orkestrate. Our team will look into this immediately.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col p-4 bg-[#0A0A0A]">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe the issue in detail..."
                  className="w-full h-32 bg-transparent border border-white/10 rounded-xl p-4 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-white/20 transition-colors resize-none mb-4"
                  required
                  autoFocus
                />

                {/* Attached Images */}
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {images.map((img, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-white/10">
                        <img
                          src={URL.createObjectURL(img)}
                          alt="attachment"
                          className="w-16 h-16 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-auto">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    disabled={images.length >= 3}
                  />
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= 3}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Paperclip className="w-4 h-4" />
                    {images.length >= 3 ? "Max 3 images" : "Attach Images"}
                  </button>

                  <button
                    type="submit"
                    disabled={(!message.trim() && images.length === 0) || isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 focus:ring-2 focus:ring-red-500/50 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Report
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
