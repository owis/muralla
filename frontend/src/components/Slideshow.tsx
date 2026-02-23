"use client";

import { useState, useEffect, useRef } from "react";
import ToastNotification from "./ToastNotification";

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
    [],
  );
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [isTextVisible, setIsTextVisible] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageCacheRef = useRef<Map<string, string>>(new Map());
  const cycleCountRef = useRef<number>(0);

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

  // Preload image into cache
  const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCacheRef.current.set(url, url);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // Fetch initial images with LocalStorage Cache
  useEffect(() => {
    async function fetchImages() {
      // 1. Try to load from LocalStorage first for instant render
      const cachedData = localStorage.getItem("slideshow_images");
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          if (Array.isArray(parsedData)) {
            const processedImages = parsedData.map(
              (img: ImageData, i: number) => processImage(img, i),
            );
            setAllImages(processedImages);
            if (processedImages.length > 0) {
              setDisplayedImages([processedImages[0]]);
            }
          }
        } catch (e) {
          console.error("Error loading cached images:", e);
        }
      }

      // 2. Fetch fresh data from API
      try {
        const response = await fetch(`${apiUrl}/api/images`);
        const data = await response.json();
        if (data.success && data.data) {
          // Update LocalStorage
          localStorage.setItem("slideshow_images", JSON.stringify(data.data));

          // Process all existing images
          const processedImages = data.data.map((img: ImageData, i: number) =>
            processImage(img, i),
          );
          setAllImages(processedImages);

          // Reset cycle counter when loading images
          cycleCountRef.current = 0;

          // Preload all images into cache
          processedImages.forEach((img: ImageWithVisuals) => {
            preloadImage(`${apiUrl}${img.url}`);
          });

          // Only update displayed if it was empty (to avoid flicker if cache loaded)
          if (processedImages.length > 0 && displayedImages.length === 0) {
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

    const interval = setInterval(() => {
      const totalImages = allImages.length;

      // Usar el contador de ciclos para determinar qué imagen mostrar
      const nextIndex = cycleCountRef.current % totalImages;
      const baseImage = allImages[nextIndex];

      // Crear nueva imagen visual con zIndex más alto
      const visual = processImage(baseImage, cycleCountRef.current);

      setDisplayedImages((prev) => {
        // Agregar la nueva imagen siempre con zIndex más alto
        const newPile = [...prev, { ...visual, zIndex: prev.length }];

        // Mantener solo las últimas 5 imágenes, con zIndex de 0 a 4
        if (newPile.length > 5) {
          return newPile.slice(-5).map((img, idx) => ({ ...img, zIndex: idx }));
        }
        // Recalcular zIndex para que el más nuevo tenga el mayor
        return newPile.map((img, idx) => ({ ...img, zIndex: idx }));
      });

      // Incrementar el contador para la siguiente imagen
      cycleCountRef.current = (cycleCountRef.current + 1) % totalImages;
    }, DROP_INTERVAL);

    return () => clearInterval(interval);
  }, [allImages.length]); // Dependencia clave: si cambia allImages (nueva foto), el efecto se reinicia si fuera necesario, pero aquí solo necesitamos el length actualizado dentro del intervalo? No, el closure captura allImages.
  // Pero como allImages cambia con setAllImages, el efecto se re-ejecuta, reiniciando el intervalo.
  // Esto está bien, pero cycleCountRef persiste.

  // Control del texto grande y timing de visibilidad
  useEffect(() => {
    if (displayedImages.length === 0) return;

    // Usar la última imagen visual como referencia
    const latestVisual = displayedImages[displayedImages.length - 1];
    const index = displayedImages.length - 1;
    setActiveImageIndex(index);
    setIsTextVisible(true);

    const hideTimeout = setTimeout(
      () => {
        setIsTextVisible(false);
      },
      Math.max(0, DROP_INTERVAL - TEXT_HIDE_OFFSET),
    );

    return () => {
      clearTimeout(hideTimeout);
    };
  }, [displayedImages, cycleCountRef.current]);

  // WebSocket connection
  useEffect(() => {
    let isConnected = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    function connectWebSocket() {
      // Prevent multiple simultaneous connections
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        isConnected = true;
        reconnectAttempts = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "NEW_IMAGE" && message.data) {
            const imageUrl = `${apiUrl}${message.data.url}`;

            // Preload new image into cache
            preloadImage(imageUrl);

            // Update state: Add to END of array
            setAllImages((prev) => {
              const newImg = processImage(message.data, prev.length);
              const updated = [...prev, newImg];
              // Update LocalStorage
              const rawData = updated.map((u) => ({
                uid: u.uid,
                nombre: u.nombre,
                url: u.url,
                texto: u.texto,
                timestamp: u.timestamp,
              }));
              localStorage.setItem("slideshow_images", JSON.stringify(rawData));
              return updated;
            });

            // Don't reset cycle counter - let it continue normally
            // The new image will be shown when the cycle reaches the end

            // Mostrar notificación
            const senderName = message.data.nombre || "Alguien";
            setNotification(`${senderName} se ha unido a la fiesta!`);
          } else if (
            message.type === "UPDATE_IMAGES" &&
            Array.isArray(message.data)
          ) {
            // Update LocalStorage
            localStorage.setItem(
              "slideshow_images",
              JSON.stringify(message.data),
            );

            const newImages = message.data.map((img: ImageData, i: number) =>
              processImage(img, i),
            );
            setAllImages(newImages);

            // Preload all updated images
            newImages.forEach((img: ImageWithVisuals) => {
              preloadImage(`${apiUrl}${img.url}`);
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        isConnected = false;

        // Clean up current connection
        if (wsRef.current) {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current = null;
        }

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket();
          }, delay);
        } else {
          console.error("Max reconnection attempts reached");
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Let onclose handle reconnection
      };
    }

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [wsUrl, apiUrl]);

  // Actualizar contador (current / total) en el DOM
  useEffect(() => {
    const updateCounter = () => {
      const currentEl = document.getElementById("current-count");
      const totalEl = document.getElementById("total-count");

      const total = allImages.length;
      // Current is (index % total) + 1.
      // If cycleCountRef is 0 (new image), current is 1. Correct.
      const current = total > 0 ? (cycleCountRef.current % total) + 1 : 0;

      if (currentEl) currentEl.textContent = String(current);
      if (totalEl) totalEl.textContent = String(total);
    };

    // Actualizar inmediatamente
    updateCounter();

    // Actualizar cada vez que cambia displayedImages
    const interval = setInterval(updateCounter, 500);
    return () => clearInterval(interval);
  }, [displayedImages, allImages.length]);

  const renderConfetti = () => {
    // Show confetti only if there is a notification
    if (!notification) return null;

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
        key={`confetti-${notification}`} // Re-render confetti on new notification
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 110 }} // Higher zIndex to cover everything
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

  if (allImages.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <ToastNotification
          message={notification}
          onClose={() => setNotification(null)}
        />
        {/* Render confetti if notification is present (even in loading state) */}
        {notification && renderConfetti()}

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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-transparent"
    >
      <ToastNotification
        message={notification}
        onClose={() => setNotification(null)}
      />

      {displayedImages.map((img, idx) => {
        // Las imágenes más antiguas (índice bajo) tienen menos opacity
        const opacity = idx === 0 ? 0 : idx / displayedImages.length;

        return (
          <div
            key={img.instanceId}
            className="absolute transition-opacity duration-700"
            style={{
              zIndex: img.zIndex,
              transform: `translate(${img.offsetX}px, ${img.offsetY}px)`,
              opacity: idx === 0 ? 0.3 : 1,
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
                        {img.texto ? `"${img.texto}"` : ""}
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
        );
      })}

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

      {/* Confetti ahora condicionado a la notificación (dentro de la función renderConfetti) */}
      {renderConfetti()}

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
