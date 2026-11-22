import type { NextConfig } from "next";

// Fotos de comercios y productos en Supabase Storage (ver src/lib/storage.ts).
const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  // Para la imagen de Docker: `.next/standalone` trae solo lo necesario para `node server.js`.
  output: "standalone",
  experimental: {
    serverActions: {
      // Fotos de hasta 4 MB (src/lib/storage.ts) más el margen del multipart.
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // Se lee al compilar. Sin SUPABASE_URL en ese momento (la imagen de Docker recibe las variables al
    // arrancar), se autoriza cualquier proyecto de Supabase, solo en su ruta de archivos públicos.
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost ?? "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
