import pool from "../config/database.js";

async function addEstadoColumn() {
  try {
    console.log("Checking for 'estado' column in 'images' table...");
    
    // Check if column exists
    const [columns] = await pool.execute(
      "SHOW COLUMNS FROM images LIKE 'estado'"
    );

    if (columns.length === 0) {
      console.log("Column 'estado' does not exist. Adding it...");
      await pool.execute(
        "ALTER TABLE images ADD COLUMN estado TINYINT DEFAULT 1"
      );
      console.log("Column 'estado' added successfully.");
    } else {
      console.log("Column 'estado' already exists.");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error adding column:", error);
    process.exit(1);
  }
}

addEstadoColumn();