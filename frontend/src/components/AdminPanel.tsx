import React, { useEffect, useState } from "react";

interface Image {
  uid: string;
  nombre: string;
  url: string;
  texto: string;
  timestamp: string;
  estado?: number;
}

interface AdminPanelProps {
  apiUrl: string;
}

export default function AdminPanel({ apiUrl }: AdminPanelProps) {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "sender_asc" | "sender_desc"
  >("date_desc");
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchImages = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/images?all=true`);
      const data = await response.json();
      if (data.success) {
        setImages(data.data);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [apiUrl]);

  const toggleStatus = async (uid: string, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? 0 : 1;
      const response = await fetch(`${apiUrl}/api/images/${uid}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estado: newStatus }),
      });

      if (response.ok) {
        setImages((prev) =>
          prev.map((img) =>
            img.uid === uid ? { ...img, estado: newStatus } : img,
          ),
        );
      } else {
        console.error("Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const deleteImage = async (uid: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta imagen?")) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/images/${uid}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setImages((prev) => prev.filter((img) => img.uid !== uid));
      } else {
        console.error("Failed to delete image");
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  if (loading)
    return <div className="text-white text-center p-10">Cargando...</div>;

  const filteredImages = images
    .filter((img) => {
      // Filtro por visibilidad
      if (showOnlyVisible && img.estado !== 1) return false;

      // Filtro por buscador
      const searchLower = searchTerm.toLowerCase();
      return (
        img.nombre.toLowerCase().includes(searchLower) ||
        (img.texto && img.texto.toLowerCase().includes(searchLower)) ||
        img.uid.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Ordenamiento
      switch (sortBy) {
        case "date_asc":
          return (
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        case "date_desc":
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        case "sender_asc":
          return a.nombre.localeCompare(b.nombre);
        case "sender_desc":
          return b.nombre.localeCompare(a.nombre);
        default:
          return 0;
      }
    });

  return (
    <div className="container mx-auto p-4 overflow-y-auto h-screen">
      <h1 className="text-3xl font-bold text-white mb-6">
        Administración de Imágenes
      </h1>

      {/* Filtros y Controles */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6 text-white space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        {/* Buscador */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre, texto o ID..."
            className="w-full px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Ordenar por */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-300 whitespace-nowrap">
            Ordenar por:
          </label>
          <select
            className="px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "date_desc"
                  | "date_asc"
                  | "sender_asc"
                  | "sender_desc",
              )
            }
          >
            <option value="date_desc">Fecha (Más reciente)</option>
            <option value="date_asc">Fecha (Más antigua)</option>
            <option value="sender_asc">Remitente (A-Z)</option>
            <option value="sender_desc">Remitente (Z-A)</option>
          </select>
        </div>

        {/* Checkbox Solo Visibles */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showVisible"
            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
            checked={showOnlyVisible}
            onChange={(e) => setShowOnlyVisible(e.target.checked)}
          />
          <label htmlFor="showVisible" className="cursor-pointer select-none">
            Ver solo visibles
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
        {filteredImages.map((image) => (
          <div
            key={image.uid}
            className={`bg-white rounded-lg overflow-hidden shadow-lg transition-opacity ${
              image.estado === 0 ? "opacity-50" : "opacity-100"
            }`}
          >
            <div className="relative h-48">
              <img
                src={`${apiUrl}${image.url}`}
                alt={image.nombre}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                {image.estado === 1 ? "Visible" : "Oculto"}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-lg truncate">{image.nombre}</h3>
              <p className="text-gray-600 text-sm truncate">{image.texto}</p>
              <p className="text-gray-400 text-xs mt-2">
                {new Date(image.timestamp).toLocaleString()}
              </p>
              <button
                onClick={() => toggleStatus(image.uid, image.estado ?? 1)}
                className={`mt-4 w-full py-2 px-4 rounded font-bold text-white transition-colors ${
                  image.estado === 1
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-500 hover:bg-green-600"
                }`}
              >
                {image.estado === 1 ? "Ocultar" : "Mostrar"}
              </button>

              {image.estado === 0 && (
                <button
                  onClick={() => deleteImage(image.uid)}
                  className="mt-2 w-full py-2 px-4 rounded font-bold text-white transition-colors bg-gray-700 hover:bg-gray-800"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}