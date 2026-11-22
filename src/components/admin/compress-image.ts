/** Lado más largo de la foto que se sube; de sobra para tarjetas y fichas de producto. */
const MAX_SIDE = 1600;
/** Por debajo de este peso, una foto JPG/PNG/WebP se sube tal cual. */
const KEEP_ORIGINAL_BYTES = 1.5 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la foto"));
    };
    img.src = url;
  });
}

/**
 * Las fotos del celular suelen pesar 3–8 MB: se reducen a 1600 px y se pasan a JPG antes de subirlas.
 * El `<img>` respeta la orientación EXIF, así que la foto no sale girada. Devuelve `null` si el
 * navegador no puede leerla (por ejemplo, un HEIC en un navegador que no lo soporta).
 */
export async function prepareImage(file: File): Promise<File | null> {
  if (ACCEPTED.has(file.type) && file.size <= KEEP_ORIGINAL_BYTES) return file;
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return null;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // JPG no tiene transparencia: el fondo de un PNG queda blanco en vez de negro.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return null;
  const name = file.name.replace(/\.[^.]*$/, "") || "foto";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}
