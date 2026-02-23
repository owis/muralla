import React, { useEffect } from "react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export default function ToastNotification({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.5)] flex items-center gap-4 border border-white/20 backdrop-blur-sm max-w-sm">
        <div className="bg-white/20 p-2 rounded-full flex-shrink-0">
          <span className="text-xl">📸</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg truncate">{message}</p>
          <p className="text-xs text-white/80">¡Nueva foto recibida!</p>
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          0% { transform: translateX(120%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
}
