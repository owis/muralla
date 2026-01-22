import React, { useEffect, useState, useRef } from "react";
import ToastNotification from "./ToastNotification";

interface Image {
  uid: string;
  nombre: string;
  url: string;
  texto: string;
  timestamp: string;
  estado?: number;
}

interface Marquee3DProps {
  apiUrl: string;
  wsUrl: string;
  rowHeight?: string; // e.g., "30vh"
}

export default function Marquee3D({
  apiUrl,
  wsUrl,
  rowHeight = "30vh",
}: Marquee3DProps) {
  const [images, setImages] = useState<Image[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    async function fetchImages() {
      try {
        const response = await fetch(`${apiUrl}/api/images?all=true`);
        const data = await response.json();
        if (data.success) {
          // Filtrar solo imágenes visibles (estado 1)
          const visibleImages = data.data.filter(
            (img: any) => img.estado === 1,
          );
          setImages(visibleImages);
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    }
    fetchImages();
  }, [apiUrl]);

  // WebSocket Connection
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
            // Agregar nueva imagen a la lista
            setImages((prev) => [...prev, message.data]);

            // Mostrar notificación
            const senderName = message.data.nombre || "Alguien";
            setNotification(`${senderName} se ha unido a la fiesta!`);
          } else if (
            message.type === "UPDATE_IMAGES" &&
            Array.isArray(message.data)
          ) {
            const visibleImages = message.data.filter(
              (img: any) => img.estado === 1,
            );
            setImages(visibleImages);
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

  if (images.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-pulse">Cargando imágenes...</div>
      </div>
    );
  }

  // Duplicamos las imágenes para asegurar suficiente contenido
  // Si hay pocas imágenes, las repetimos varias veces
  let displayImages = [...images];
  while (displayImages.length < 10) {
    displayImages = [...displayImages, ...images];
  }

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-950">
      <ToastNotification
        message={notification}
        onClose={() => setNotification(null)}
      />

      <div className="flex h-full w-full flex-col justify-center gap-12 [perspective:1000px] py-10">
        {/* Fila 1 */}
        <MarqueeRow
          images={displayImages}
          duration="60s"
          apiUrl={apiUrl}
          rotateX={5}
          height={rowHeight}
        />

        {/* Fila 2 - Dirección opuesta */}
        <MarqueeRow
          images={displayImages}
          duration="50s"
          reverse
          apiUrl={apiUrl}
          rotateX={0}
          height={rowHeight}
        />

        {/* Fila 3 */}
        <MarqueeRow
          images={displayImages}
          duration="55s"
          apiUrl={apiUrl}
          rotateX={-5}
          height={rowHeight}
        />
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-950 to-transparent z-10"></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-950 to-transparent z-10"></div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-custom {
           display: flex;
           width: max-content;
        }
      `}</style>
    </div>
  );
}

function MarqueeRow({
  images,
  duration,
  reverse = false,
  apiUrl,
  rotateX = 0,
  height,
}: {
  images: Image[];
  duration: string;
  reverse?: boolean;
  apiUrl: string;
  rotateX?: number;
  height?: string;
}) {
  return (
    <div
      className="flex w-full [transform-style:preserve-3d]"
      style={{
        transform: `rotateY(-15deg) rotateX(${rotateX}deg) scale(1.1)`,
        opacity: 0.9,
        height: height,
      }}
    >
      <div
        className="animate-marquee-custom flex gap-4 pl-4 h-full items-center"
        style={{
          animation: `marquee ${duration} linear infinite ${
            reverse ? "reverse" : "normal"
          }`,
        }}
      >
        {/* Renderizamos la lista dos veces para el loop infinito perfecto */}
        {[...images, ...images, ...images].map((img, idx) => (
          <div
            key={`${img.uid}-${idx}`}
            className="group relative shrink-0 overflow-hidden rounded-lg bg-slate-800 shadow-xl border border-slate-700/50 transition-all hover:scale-105 hover:z-50 hover:border-white/50"
            style={{
              height: "100%",
              aspectRatio: "4/3", // Landscape aspect ratio
            }}
          >
            <img
              src={img.url.startsWith("http") ? img.url : `${apiUrl}${img.url}`}
              alt={img.nombre}
              className="h-full w-full object-cover opacity-70 transition-opacity duration-300 group-hover:opacity-100"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end p-3">
              <p className="text-white font-bold text-sm truncate">
                {img.nombre}
              </p>
              {img.texto && (
                <p className="text-gray-300 text-xs line-clamp-2 italic">
                  "{img.texto}"
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
