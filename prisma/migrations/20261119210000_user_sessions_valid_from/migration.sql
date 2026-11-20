-- Anular las sesiones de una cuenta (p. ej. al reclamarla con Google).
ALTER TABLE "users" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
