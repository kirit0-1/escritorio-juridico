import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB = path.join(__dirname, "data", "db.json");
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

const LISTS = {
  clients: ["nombre", "email", "telefono", "rut", "notas", "color"],
  cases: ["nombre", "materia", "detalle", "clienteId", "contraparte", "tribunal", "rol", "estado", "fecha", "resumen", "notas"],
  documents: ["nombre", "casoId", "tipo", "fecha", "tamano", "descripcion"],
  tasks: ["nombre", "casoId", "prioridad", "fecha", "done"],
  events: ["titulo", "detalle", "casoId", "fecha", "tipo"],
  library: ["titulo", "tipo", "materia", "fuente", "estado", "nota"]
};

function emptyDb() {
  return {
    office: { studio: "", lawyer: "", role: "", email: "", colegiado: "", accent: "#1a4fa0" },
    clients: [], cases: [], documents: [], tasks: [], events: [], library: [], activity: []
  };
}

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch {
    const data = emptyDb();
    fs.mkdirSync(path.dirname(DB), { recursive: true });
    fs.writeFileSync(DB, JSON.stringify(data, null, 2));
    return data;
  }
}

function writeDb(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

function clean(value, max = 2000) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function log(db, text) {
  db.activity.unshift({ id: crypto.randomUUID(), text: clean(text, 240), at: new Date().toISOString() });
  db.activity = db.activity.slice(0, 12);
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
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

function valueOf(field, raw) {
  if (field === "done") return Boolean(raw);
  if (field === "color") return /^#[0-9a-fA-F]{6}$/.test(raw || "") ? raw : "#1a4fa0";
  return clean(raw, field === "notas" || field === "resumen" ? 8000 : 500);
}

function pick(body, fields) {
  const item = { id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
  for (const field of fields) item[field] = valueOf(field, body[field]);
  return item;
}

function apply(item, body, fields) {
  for (const field of fields) {
    if (field in body) item[field] = valueOf(field, body[field]);
  }
  item.updatedAt = new Date().toISOString();
  return item;
}

async function handleApi(req, res, parts) {
  const db = readDb();
  const [, list, id] = parts;
  const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);

  if (req.method === "GET" && parts.length === 2 && list === "state") return json(res, 200, db);

  if (req.method === "PUT" && list === "office") {
    db.office = {
      studio: clean(body.studio, 120),
      lawyer: clean(body.lawyer, 120),
      role: clean(body.role, 80),
      email: clean(body.email, 120),
      colegiado: clean(body.colegiado, 40),
      accent: /^#[0-9a-fA-F]{6}$/.test(body.accent || "") ? body.accent : "#1a4fa0"
    };
    log(db, "Se actualizó la personalización del estudio");
    writeDb(db);
    return json(res, 200, db);
  }

  const fields = LISTS[list];
  if (!fields) return json(res, 404, { error: "Ruta no encontrada" });

  if (req.method === "POST" && !id) {
    const needs = list === "events" ? body.titulo : body.nombre || body.titulo;
    if (!String(needs || "").trim()) return json(res, 400, { error: "Falta el nombre" });
    const item = pick(body, fields);
    db[list].unshift(item);
    const labels = { clients: "clientes", cases: "casos", documents: "documentos", tasks: "tareas", events: "agenda", library: "biblioteca" };
    log(db, `Se agregó en ${labels[list] || list}: ${item.nombre || item.titulo}`);
    writeDb(db);
    return json(res, 201, db);
  }

  const current = db[list].find((item) => item.id === id);
  if (!current) return json(res, 404, { error: "No encontrado" });

  if (req.method === "PUT") {
    apply(current, body, fields);
    writeDb(db);
    return json(res, 200, db);
  }

  if (req.method === "DELETE") {
    db[list] = db[list].filter((item) => item.id !== id);
    if (list === "cases") {
      db.documents = db.documents.filter((item) => item.casoId !== id);
      db.tasks = db.tasks.filter((item) => item.casoId !== id);
      db.events = db.events.filter((item) => item.casoId !== id);
    }
    writeDb(db);
    return json(res, 200, db);
  }

  return json(res, 405, { error: "Método no permitido" });
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
  console.log(`Escritorio jurídico en http://127.0.0.1:${PORT}`);
});
