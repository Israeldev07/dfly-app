-- La verificación del email ahora solo se hace con Google: se quitan los códigos por correo.
ALTER TABLE "users" DROP COLUMN "emailCodeAttempts",
DROP COLUMN "emailCodeExpiresAt",
DROP COLUMN "emailCodeHash";
