CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_socio INTEGER NOT NULL UNIQUE CHECK (numero_socio > 0),
  numero_legajo TEXT,
  numero_acta TEXT,
  apellido TEXT,
  nombre TEXT,
  dni TEXT NOT NULL UNIQUE,
  sexo TEXT,
  fecha_nacimiento DATE,
  tipo_socio TEXT,
  domicilio TEXT,
  localidad TEXT,
  telefono TEXT,
  fecha_alta DATE,
  fecha_baja DATE,
  motivo_baja TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_baja IS NULL OR fecha_alta IS NULL OR fecha_baja >= fecha_alta)
);

CREATE INDEX IF NOT EXISTS socios_apellido_nombre_idx ON socios (apellido, nombre);