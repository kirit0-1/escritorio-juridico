const MAX_BYTES = 2 * 1024 * 1024;

export function fileTooBig(file) {
  return Boolean(file && file.size > MAX_BYTES);
}

export function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("No pude leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export async function textFromFile(file) {
  const name = file.name.toLowerCase();
  try {
    if (file.type.startsWith("text/") || /\.(txt|md|csv|json|log)$/.test(name)) {
      return (await file.text()).replace(/\s+/g, " ").trim().slice(0, 12000);
    }
    if (file.type === "application/pdf" || name.endsWith(".pdf")) return await textFromPdf(file);
  } catch {
    return "";
  }
  return "";
}

async function textFromPdf(file) {
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const parts = [];
  const pages = Math.min(pdf.numPages, 8);
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => item.str).join(" "));
  }
  return parts.join("\n").replace(/\s+/g, " ").trim().slice(0, 12000);
}

export function blobFromDoc(item) {
  const binary = atob(item.data || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: item.mime || "application/octet-stream" });
}
