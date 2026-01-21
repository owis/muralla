"use client";

import { useState, useEffect, useRef } from "react";

const ENABLE_CONFETTI = true;
const DROP_INTERVAL = 6000;
const TEXT_HIDE_OFFSET = 2000;

interface ImageData {
  uid: string;
  nombre: string;
  url: string;
  texto: string;
  timestamp: string;
}

interface ImageWithVisuals extends ImageData {
  instanceId: string;
  rotation: number;
  offsetX: number;
  offsetY: number;
  zIndex: number;
}

interface SlideshowProps {
  apiUrl: string;
  wsUrl: string;
}

export default function Slideshow({ apiUrl, wsUrl }: SlideshowProps) {
  const [allImages, setAllImages] = useState<ImageWithVisuals[]>([]);
  const [displayedImages, setDisplayedImages] = useState<ImageWithVisuals[]>(
    []
  );
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [isTextVisible, setIsTextVisible] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to add visual properties to an image
  const processImage = (img: ImageData, index: number): ImageWithVisuals => {
    // Random rotation between -10 and 10 degrees (less rotation for better readability)
    const rotation = Math.random() * 20 - 10;
    // Random offset from center (scatter effect)
    // Reduced limits to keep them more central: X +/- 50px, Y +/- 50px
    const offsetX = Math.random() * 100 - 50;
    const offsetY = Math.random() * 100 - 50;

    return {
      ...img,
      instanceId: crypto.randomUUID(),
      rotation,
      offsetX,
      offsetY,
      zIndex: index + 1,
    };
  };

  // Fetch initial images
  useEffect(() => {
    async function fetchImages() {
      try {
        const response = await fetch(`${apiUrl}/api/images`);
        const data = await response.json();
        if (data.success && data.data) {
          // Process all existing images
          const processedImages = data.data.map((img: ImageData, i: number) =>
            processImage(img, i)
          );
          setAllImages(processedImages);
          if (processedImages.length > 0) {
            setDisplayedImages([processedImages[0]]);
          }
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    }
    fetchImages();
  }, [apiUrl]);

  // Lógica de caída secuencial en bucle infinito
  useEffect(() => {
    if (allImages.length === 0) return;

    const timeout = setTimeout(() => {
      setDisplayedImages((prev) => {
        if (allImages.length === 0) return prev;
        // Avanzar circularmente por las imágenes disponibles
        const nextIndex = prev.length % allImages.length;
        const baseImage = allImages[nextIndex];
        const visual = processImage(baseImage, prev.length);
        
        const newPile = [...prev, visual];
        // Mantener solo las últimas 5 imágenes para evitar problemas de memoria y superposición excesiva
        if (newPile.length > 5) {
          return newPile.slice(newPile.length - 5);
        }
        return newPile;
      });
    }, DROP_INTERVAL);

    return () => clearTimeout(timeout);
  }, [displayedImages.length, allImages.length]);

  // Control del texto grande y timing de visibilidad
  useEffect(() => {
    if (displayedImages.length === 0) return;

    const index = displayedImages.length - 1;
    setActiveImageIndex(index);
    setIsTextVisible(true);

    const hideTimeout = setTimeout(() => {
      setIsTextVisible(false);
    }, Math.max(0, DROP_INTERVAL - TEXT_HIDE_OFFSET));

    return () => {
      clearTimeout(hideTimeout);
    };
  }, [displayedImages.length]);

  // WebSocket connection
  useEffect(() => {
    function connectWebSocket() {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "NEW_IMAGE" && message.data) {
            setAllImages((prev) => [
              ...prev,
              processImage(message.data, prev.length),
            ]);
            // For new real-time images, we might want to add them immediately to displayed?
            // The effect above will handle it naturally as allImages grows.
          } else if (
            message.type === "UPDATE_IMAGES" &&
            Array.isArray(message.data)
          ) {
            const newImages = message.data.map((img: ImageData, i: number) =>
              processImage(img, i)
            );
            setAllImages(newImages);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    }

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl]);

  // Actualizar contador (current / total) en el DOM, reiniciando al llegar al final
  useEffect(() => {
    const currentEl = document.getElementById("current-count");
    const totalEl = document.getElementById("total-count");

    const total = allImages.length;
    const current =
      activeImageIndex !== null && total > 0
        ? (activeImageIndex % total) + 1
        : 0;

    if (currentEl) currentEl.textContent = String(current);
    if (totalEl) totalEl.textContent = String(total);
  }, [activeImageIndex, allImages.length]);

  if (allImages.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="animate-pulse">
            <svg
              className="mx-auto h-16 w-16 text-primary mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-white text-xl font-semibold mb-2">
            Esperando imágenes...
          </p>
          <p className="text-white/60 text-sm">
            Escanea el código QR para subir la primera imagen
          </p>
        </div>
      </div>
    );
  }

  const activeImage =
    activeImageIndex !== null ? displayedImages[activeImageIndex] : null;

  const renderConfetti = () => {
    if (!ENABLE_CONFETTI) return null;

    const pieces = Array.from({ length: 200 });
    const colors = [
      "#f97316",
      "#facc15",
      "#22c55e",
      "#3b82f6",
      "#ec4899",
      "#a855f7",
    ];

    return (
      <div
        key={displayedImages.length}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 40 }}
      >
        {pieces.map((_, index) => {
          const left = Math.random() * 100;
          const delay = Math.random() * 0.5;
          const duration = 1.2 + Math.random() * 0.8;
          const size = 25 + Math.random() * 4;
          const color = colors[index % colors.length];

          return (
            <span
              key={index}
              className="confetti-piece"
              style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                width: `${size}px`,
                height: `${size * 0.4}px`,
                backgroundColor: color,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-transparent"
    >
      {displayedImages.map((img) => (
        <div
          key={img.instanceId}
          className="absolute"
          style={{
            zIndex: img.zIndex,
            transform: `translate(${img.offsetX}px, ${img.offsetY}px)`,
          }}
        >
          <div className="animate-drop-in flex justify-center items-center w-full h-full">
            <div
              className="relative bg-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] rounded-md transition-transform hover:scale-105 duration-300 flex flex-col"
              style={{
                transform: `rotate(${img.rotation}deg)`,
                width: "fit-content",
                maxWidth: "95vw",
                maxHeight: "95vh",
              }}
            >
              <div className="w-full mx-auto pt-4 px-4 pb-6 flex-1 flex flex-col justify-center">
                <div className="mx-auto overflow-hidden bg-gray-100 border border-gray-200 flex justify-center items-center">
                  <img
                    src={`${apiUrl}${img.url}`}
                    alt={img.nombre}
                    className="w-auto h-auto max-h-[70vh] object-contain"
                  />
                </div>

                {
                  <div className="mt-5 pt-3 border-t border-gray-100 text-center">
                    <p
                      className="text-gray-500 text-3xl font-medium"
                      style={{
                        fontFamily:
                          '"Bilbo", "Chalkboard SE", "Marker Felt", sans-serif',
                      }}
                    >
                      "{img.texto}"
                    </p>

                    <p className="text-md font-bold leading-tight text-gray-500">
                      {img.nombre}
                    </p>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      ))}

      {activeImage && (
        <div
          className={`pointer-events-none absolute left-12 bottom-12 max-w-7xl mx-auto transition-all duration-700 ${
            isTextVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
          style={{ zIndex: 9999 }}
        >
          <div className="text-left text-white drop-shadow-2xl">
            <p className="text-7xl font-bold p-10 bg-black/40 backdrop-blur-md leading-none font-mouse text-yellow-100">
              {activeImage.texto}
              <p className="text-3xl text-gray-300 font-bold mt-4">
                {activeImage.nombre}
              </p>
            </p>
          </div>
        </div>
      )}

      {ENABLE_CONFETTI && renderConfetti()}

      <style>{`
        .animate-drop-in {
          animation: dropIn 1.2s ease-out backwards;
        }

        @keyframes dropIn {
          0% {
            opacity: 0;
            transform: translateY(-120vh);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .confetti-piece {
          position: absolute;
          top: -10%;
          border-radius: 9999px;
          opacity: 0.9;
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }

        @keyframes confetti-fall {
          0% {
            transform: translate3d(0, 0, 0) rotateZ(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 120vh, 0) rotateZ(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
