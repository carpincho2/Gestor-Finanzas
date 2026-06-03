-- ============================================================
--  Flujo Finance Manager — Base de datos MySQL
--  Ejecutar en phpMyAdmin o con: mysql -u root < setup.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS flujo_finanzas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE flujo_finanzas;

-- ---- Usuarios ----
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  DEFAULT NULL,
  google_id     VARCHAR(255)  DEFAULT NULL,
  avatar        VARCHAR(10)   DEFAULT 'JP',
  picture       VARCHAR(500)  DEFAULT NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_google (google_id)
) ENGINE=InnoDB;

-- ---- Sesiones PHP (gestionadas por session_start, tabla opcional) ----
-- PHP maneja las sesiones automáticamente, no se necesita tabla extra.

SELECT 'Base de datos flujo_finanzas creada correctamente.' AS resultado;
