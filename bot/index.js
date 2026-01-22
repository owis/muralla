import dotenv from "dotenv";
dotenv.config();

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import fs from "fs";

// Configuración de rutas
const AUTH_FOLDER = join(process.cwd(), "auth_info");
const FILES_DIR = join(process.cwd(), "files");

// Asegurar que exista carpeta de archivos
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Estado en memoria para flujos simples (usuario -> estado)
// Estructura: { '56912345678@s.whatsapp.net': { step: 'waiting_title', data: { foto: 'base64...' } } }
const userStates = new Map();

// Función para enviar datos a la API
const postMensaje = async ({ nombre, telefono, texto, foto }) => {
  try {
    const resp = await fetch(`${process.env.API_URL}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // Add content-type header
      body: JSON.stringify({ nombre, telefono, texto, foto }),
    });

    if (!resp.ok) {
      const errorData = await resp.text();
      console.error(`Error API: ${resp.status} ${resp.statusText}`, errorData);
    }
    return resp.ok;
  } catch (e) {
    console.error("Error conexión API:", e);
    return false;
  }
};

const startBot = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(
    `🚀 Iniciando servicio v${version.join(".")} (Latest: ${isLatest})`,
  );

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }), // debug
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    browser: ["CtrlStock Bot", "Chrome", "1.0.0"],
    generateHighQualityLinkPreview: true,
    // Configuración de estabilidad de conexión
    connectTimeoutMs: 60000, // 60 segundos para conectar
    keepAliveIntervalMs: 10000, // Ping cada 10 segundos para evitar cierres
    retryRequestDelayMs: 5000,
    syncFullHistory: false, // No descargar historial antiguo (ahorra tiempo y evita timeouts)
  });

  // Manejo de eventos de conexión
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("⚡️ Escanea el QR:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log(
        "❌ Conexión cerrada debido a:",
        lastDisconnect?.error,
        ", reconectando:",
        shouldReconnect,
      );

      if (shouldReconnect) {
        startBot();
      } else {
        console.log(
          "⚠️ Desconectado permanentemente (logout). Borra 'auth_info' para reiniciar.",
        );
      }
    } else if (connection === "open") {
      console.log("✅ Conexión establecida exitosamente!");
    }
  });

  // Guardar credenciales cuando cambian
  sock.ev.on("creds.update", saveCreds);

  // Manejo de mensajes entrantes
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid;
      const pushName = msg.pushName || "Usuario";

      // Extraer texto del mensaje (puede venir en diferentes formatos)
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "";

      const isImage = !!msg.message.imageMessage;

      console.log(
        `📩 Mensaje de ${pushName} (${remoteJid}): ${text || "[Media]"}`,
      );

      // Lógica de Estado (Flujo de renombrar)
      const currentState = userStates.get(remoteJid);

      if (currentState?.step === "waiting_confirmation") {
        const response = text.trim().toLowerCase();
        if (["si", "sí", "yes", "y", "s", "ok"].includes(response)) {
          userStates.set(remoteJid, {
            step: "waiting_title",
            data: currentState.data,
          });
          await sock.sendMessage(remoteJid, {
            text: "Perfecto. ¿Qué texto quieres agregar?",
          });
        } else if (["no", "n", "nop"].includes(response)) {
          const titulo = "";
          const foto = currentState.data.foto;
          await sock.sendMessage(remoteJid, {
            text: "⏳ Guardando...",
          });

          const ok = await postMensaje({
            nombre: pushName,
            telefono: remoteJid.replace("@s.whatsapp.net", ""),
            texto: titulo,
            foto: foto,
          });

          if (ok) {
            await sock.sendMessage(remoteJid, {
              text: "✅ Mensaje enviado correctamente.",
            });
          } else {
            await sock.sendMessage(remoteJid, {
              text: "❌ Error al guardar en la base de datos.",
            });
          }
          userStates.delete(remoteJid);
        } else {
          await sock.sendMessage(remoteJid, {
            text: "Por favor, responde 'Si' para agregar un mensaje o 'No' para enviar solo la imagen.",
          });
        }
        return;
      }

      if (currentState?.step === "waiting_title") {
        const titulo = text.trim();
        if (!titulo) {
          await sock.sendMessage(remoteJid, {
            text: "Por favor, envía un corto mensaje para agregar.",
          });
          return;
        }

        const foto = currentState.data.foto;
        await sock.sendMessage(remoteJid, { text: "⏳ Guardando..." });

        const ok = await postMensaje({
          nombre: pushName,
          telefono: remoteJid.replace("@s.whatsapp.net", ""),
          texto: titulo,
          foto: foto,
        });

        if (ok) {
          await sock.sendMessage(remoteJid, {
            text: "✅ Imagen y mensaje guardados correctamente.",
          });
        } else {
          await sock.sendMessage(remoteJid, {
            text: "❌ Error al guardar en la base de datos.",
          });
        }

        // Limpiar estado
        userStates.delete(remoteJid);
        return;
      }

      // Comandos Básicos
      if (text.toLowerCase() === "ping") {
        await sock.sendMessage(remoteJid, { text: "🏓 pong!" });
        return;
      }

      if (text.toLowerCase() === "info") {
        await sock.sendMessage(remoteJid, {
          text: `Hola! ${pushName}, \n\ntu número\n>_${remoteJid.replace(
            "@s.whatsapp.net",
            "",
          )}_`,
        });
        return;
      }

      // Check if the text (not from image caption) contains the word "hola"
      if (text && text.toLowerCase().includes("hola")) {
        await sock.sendMessage(remoteJid, {
          text: `¡Hola ${pushName}! 👋\n\nSoy un *bot* que te ayudara a enviar imágenes con dedicatoria.\n\nPara comenzar:\n1. Envía una imagen 📸\n2. Responde si quieres agregar un mensaje\n3. ¡Listo! Tu imagen y mensaje se guardarán`,
        });
        return;
      }

      // Manejo de Imágenes
      if (isImage) {
        try {
          console.log("📷 Imagen recibida, descargando...");

          // Descargar imagen (usando la utilidad de baileys si estuviera disponible,
          // pero aquí usamos una implementación directa simplificada o buffer)
          // Nota: Baileys v6+ requiere 'downloadMediaMessage'.
          // Importamos dinámicamente o usamos la función auxiliar

          const { downloadMediaMessage } =
            await import("@whiskeysockets/baileys");
          const buffer = await downloadMediaMessage(
            msg,
            "buffer",
            {},
            {
              logger: pino({ level: "silent" }),
              reuploadRequest: sock.updateMediaMessage,
            },
          );

          const fotoBase64 = buffer.toString("base64");

          // Preguntar por confirmación (Flujo)
          userStates.set(remoteJid, {
            step: "waiting_confirmation",
            data: { foto: fotoBase64 },
          });

          await sock.sendMessage(remoteJid, {
            text: "📸 Imagen recibida!\n\n ¿Quieres agregarle una pequeña dedicatoria? \n(Responde '*Si*' o '*No*')",
          });
        } catch (err) {
          console.error("Error descargando imagen:", err);
          await sock.sendMessage(remoteJid, {
            text: "❌ Error al procesar la imagen.",
          });
        }
      }
    }
  });
};

startBot();
