import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import { broadcastNewImage, broadcastMessage } from "../config/websocket.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function uploadImage(req, res) {
  try {
    const { nombre, telefono, texto, foto } = req.body;
    let file = req.file;
    let filename;

    // Caso 1: Subida vía Bot (JSON con URL de foto o Base64)
    if (!file && foto) {
      console.log("Procesando imagen desde bot..."); // Log de confirmación
      try {
        let buffer;
        let ext = ".jpg";

        // Si es URL (http/https)
        if (foto.startsWith("http")) {
          const response = await fetch(foto);
          if (!response.ok) throw new Error("No se pudo descargar la imagen");
          buffer = await response.arrayBuffer();
          ext = path.extname(foto).split("?")[0] || ".jpg";
        }
        // Asumimos que es Base64
        else {
          // Si viene con prefijo data URI, lo quitamos
          const base64Data = foto.replace(/^data:image\/\w+;base64,/, "");
          buffer = Buffer.from(base64Data, "base64");
        }

        filename = `${uuidv4()}${ext}`;
        const savePath = path.join(__dirname, "../public/uploads/", filename);

        fs.writeFileSync(
          savePath,
          Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
        );

        // Simulamos el objeto file para mantener consistencia
        file = { filename };
      } catch (err) {
        console.error("Error procesando imagen del bot:", err);
        return res.status(400).json({
          error: "Error al procesar la imagen (URL o Base64 inválido)",
        });
      }
    }

    if (!file) {
      return res
        .status(400)
        .json({ error: "No se ha proporcionado ninguna imagen" });
    }

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }

    const uid = uuidv4();
    const url = `/uploads/${file.filename || filename}`;
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

    const [result] = await pool.execute(
      "INSERT INTO images (uid, nombre, telefono, url, texto, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [uid, nombre, telefono || "", url, texto || "", timestamp],
    );

    const imageData = {
      uid,
      nombre,
      url,
      texto: texto || "",
      timestamp,
    };

    // Broadcast to all connected WebSocket clients
    broadcastNewImage(imageData);

    res.status(201).json({
      success: true,
      message: "Imagen subida correctamente",
      data: imageData,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Error al subir la imagen" });
  }
}

export async function getAllImages(req, res) {
  try {
    const showAll = req.query.all === "true";
    const query = showAll
      ? "SELECT uid, nombre, url, texto, timestamp, estado FROM images ORDER BY timestamp ASC"
      : "SELECT uid, nombre, url, texto, timestamp FROM images WHERE estado = 1 ORDER BY timestamp ASC";

    const [rows] = await pool.execute(query);

    res.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ error: "Error al obtener las imágenes" });
  }
}

export async function getImageCount(req, res) {
  try {
    const [rows] = await pool.execute(
      "SELECT COUNT(*) as count FROM images WHERE estado = 1",
    );

    res.json({
      success: true,
      count: rows[0].count,
    });
  } catch (error) {
    console.error("Error counting images:", error);
    res.status(500).json({ error: "Error al contar las imágenes" });
  }
}

export async function updateImageStatus(req, res) {
  try {
    const { uid } = req.params;
    const { estado } = req.body; // 0 or 1

    if (estado === undefined) {
      return res.status(400).json({ error: "Estado es requerido" });
    }

    const [result] = await pool.execute(
      "UPDATE images SET estado = ? WHERE uid = ?",
      [estado, uid],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    // Get updated list of active images to broadcast
    const [activeImages] = await pool.execute(
      "SELECT uid, nombre, url, texto, timestamp FROM images WHERE estado = 1 ORDER BY timestamp ASC",
    );

    broadcastMessage("UPDATE_IMAGES", activeImages);

    res.json({
      success: true,
      message: "Estado actualizado correctamente",
    });
  } catch (error) {
    console.error("Error updating image status:", error);
    res.status(500).json({ error: "Error al actualizar el estado" });
  }
}
