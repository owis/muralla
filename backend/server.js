import express from "express";
import cors from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

import { testConnection } from "./config/database.js";
import pool from "./config/database.js";
import { initWebSocket } from "./config/websocket.js";
import imageRoutes from "./routes/imageRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Database Initialization
async function initDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        nombre VARCHAR(255) NOT NULL,
        telefono VARCHAR(20),
        url VARCHAR(500) NOT NULL,
        texto TEXT,
        estado TINYINT DEFAULT 1,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_uid (uid),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.execute(createTableQuery);
    console.log("Database initialized: 'images' table verified.");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "https://muralla.creceideas.cl",
        "http://muralla.creceideas.cl",
        "http://localhost:4321",
        "http://localhost:3000",
      ];
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.FRONTEND_URL === origin) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        // For development, you might want to temporarily allow all:
        // callback(null, true); 
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/uploads", express.static(join(__dirname, "public/uploads")));

// Routes
app.use("/api", imageRoutes);

// Debug DB Route (Temporary)
app.get("/api/debug-db", async (req, res) => {
  try {
    const [rows] = await import("./config/database.js").then((m) =>
      m.default.execute("SHOW TABLES"),
    );
    const [columns] = await import("./config/database.js").then((m) =>
      m.default.execute("SHOW COLUMNS FROM images"),
    );
    res.json({ success: true, tables: rows, columns: columns });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Initialize WebSocket
initWebSocket(server);

// Start server
async function startServer() {
  await testConnection();
  await initDatabase();

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server ready`);
  });
}

startServer();
