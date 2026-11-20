-- Progreso de los envíos en varios mensajes (pedidos largos).
ALTER TABLE "outbox_messages" ADD COLUMN "partsSent" INTEGER NOT NULL DEFAULT 0;
