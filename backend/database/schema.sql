-- Create database
CREATE DATABASE IF NOT EXISTS muralla;
USE muralla;

-- Create images table
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
