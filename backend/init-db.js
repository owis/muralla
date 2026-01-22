import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  let connection;
  try {
    // 1. Conectar sin seleccionar DB para poder crearla si no existe
    console.log("Conectando a MySQL...");
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      multipleStatements: true, // Importante para ejecutar el schema completo
    });

    console.log("Conexión exitosa.");

    // 2. Leer el archivo schema.sql
    const schemaPath = path.join(__dirname, "database", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    console.log("Ejecutando schema.sql...");
    
    // 3. Ejecutar las consultas
    await connection.query(schemaSql);

    console.log("¡Base de datos inicializada correctamente!");
    console.log(`Base de datos '${process.env.DB_NAME || "muralla"}' lista para usar.`);

  } catch (error) {
    console.error("Error al inicializar la base de datos:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDb();