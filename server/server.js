import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createItem, getState, removeItem, saveOffice, updateItem, usingSupabase } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) reject(new Error("payload"));
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("json")); }
    });
    req.on("error", reject);
  });
}

function statusFor(error) {
  const message = error.message || "No se pudo guardar";
  if (message === "No encontrado") return 404;
  if (message === "Ruta no encontrada") return 404;
  return 400;
}

async function handleApi(req, res, parts) {
  const [, list, id] = parts;
  const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
  try {
    if (req.method === "GET" && list === "state") return json(res, 200, await getState());
    if (req.method === "PUT" && list === "office") return json(res, 200, await saveOffice(body));
    if (req.method === "POST" && list && !id) return json(res, 201, await createItem(list, body));
    if (req.method === "PUT" && list && id) return json(res, 200, await updateItem(list, id, body));
    if (req.method === "DELETE" && list && id) return json(res, 200, await removeItem(list, id));
    return json(res, 404, { error: "Ruta no encontrada" });
  } catch (error) {
    return json(res, statusFor(error), { error: error.message || "No se pudo guardar" });
  }
}

function serveStatic(res, urlPath) {
  if (urlPath.includes("..") || urlPath.startsWith("/server")) return json(res, 404, { error: "No encontrado" });
  const rel = (urlPath === "/" ? "index.html" : urlPath).replace(/^[/\\]+/, "");
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return json(res, 404, { error: "No encontrado" });
  fs.readFile(file, (err, buf) => {
    if (err) return json(res, 404, { error: "No encontrado" });
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parts = decodeURIComponent(req.url.split("?")[0]).split("/").filter(Boolean);
    if (parts[0] === "api") await handleApi(req, res, parts);
    else serveStatic(res, `/${parts.join("/")}`);
  } catch {
    json(res, 400, { error: "Solicitud inválida" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const donde = usingSupabase ? "Supabase" : "este equipo";
  console.log(`Escritorio jurídico en http://127.0.0.1:${PORT} (datos en ${donde})`);
});
