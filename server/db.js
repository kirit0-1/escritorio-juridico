import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUPABASE_ANON_KEY, SUPABASE_URL as PUBLIC_URL } from "./supabase-public.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "data", "db.json");

const TABLES = {
  clients: "juridico_clients",
  cases: "juridico_cases",
  documents: "juridico_documents",
  tasks: "juridico_tasks",
  events: "juridico_events",
  library: "juridico_library",
  activity: "juridico_activity"
};

const LISTS = {
  clients: ["nombre", "email", "telefono", "rut", "notas", "color"],
  cases: ["nombre", "materia", "detalle", "clienteId", "contraparte", "tribunal", "rol", "estado", "fecha", "resumen", "notas"],
  documents: ["nombre", "casoId", "tipo", "fecha", "tamano", "descripcion"],
  tasks: ["nombre", "casoId", "prioridad", "fecha", "done"],
  events: ["titulo", "detalle", "casoId", "fecha", "tipo"],
  library: ["titulo", "tipo", "materia", "fuente", "estado", "nota"]
};

function loadEnv() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (!process.env[key]) process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const SUPABASE_URL = (process.env.SUPABASE_URL || PUBLIC_URL || "").replace(/\/$/, "").replace(/\/rest\/v1$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || "";
export const usingSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY.length > 20);

function clean(value, max = 2000) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function longText(field) {
  return field === "notas" || field === "resumen";
}

function valueOf(field, raw) {
  if (field === "done") return Boolean(raw);
  if (field === "color") return /^#[0-9a-fA-F]{6}$/.test(raw || "") ? raw : "#1a4fa0";
  return clean(raw, longText(field) ? 8000 : 500);
}

function emptyDb() {
  return {
    office: { studio: "", lawyer: "", role: "", email: "", colegiado: "", accent: "#1a4fa0" },
    clients: [], cases: [], documents: [], tasks: [], events: [], library: [], activity: []
  };
}

function present(data) {
  return { ...data, storage: usingSupabase ? "supabase" : "local" };
}

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    const data = emptyDb();
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
}

function writeFile(data) {
  const copy = { ...data };
  delete copy.storage;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(copy, null, 2));
}

function logLocal(db, text) {
  db.activity.unshift({ id: crypto.randomUUID(), text: clean(text, 240), at: new Date().toISOString() });
  db.activity = db.activity.slice(0, 12);
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

function purgeLocal(db, id) {
  db.documents = db.documents.filter((item) => item.casoId !== id);
  db.tasks = db.tasks.filter((item) => item.casoId !== id);
  db.events = db.events.filter((item) => item.casoId !== id);
  db.cases = db.cases.filter((item) => item.id !== id);
}

async function sb(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no respondió (${response.status}). ${detail.slice(0, 160)}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function fromClient(row) {
  return { id: row.id, nombre: row.nombre, email: row.email || "", telefono: row.telefono || "", rut: row.rut || "", notas: row.notas || "", color: row.color || "#1a4fa0", updatedAt: row.updated_at };
}
function fromCase(row) {
  return { id: row.id, nombre: row.nombre, materia: row.materia || "", detalle: row.detalle || "", clienteId: row.cliente_id || "", contraparte: row.contraparte || "", tribunal: row.tribunal || "", rol: row.rol || "", estado: row.estado || "prep", fecha: row.fecha || "", resumen: row.resumen || "", notas: row.notas || "", updatedAt: row.updated_at };
}
function fromDoc(row) {
  return { id: row.id, nombre: row.nombre, casoId: row.caso_id || "", tipo: row.tipo || "", fecha: row.fecha || "", tamano: row.tamano || "", descripcion: row.descripcion || "", updatedAt: row.updated_at };
}
function fromTask(row) {
  return { id: row.id, nombre: row.nombre, casoId: row.caso_id || "", prioridad: row.prioridad || "media", fecha: row.fecha || "", done: Boolean(row.done), updatedAt: row.updated_at };
}
function fromEvent(row) {
  return { id: row.id, titulo: row.titulo, detalle: row.detalle || "", casoId: row.caso_id || "", fecha: row.fecha || "", tipo: row.tipo || "", updatedAt: row.updated_at };
}
function fromLibrary(row) {
  return { id: row.id, titulo: row.titulo, tipo: row.tipo || "", materia: row.materia || "", fuente: row.fuente || "", estado: row.estado || "", nota: row.nota || "", updatedAt: row.updated_at };
}

function toClient(item) {
  return { id: item.id, nombre: item.nombre, email: item.email, telefono: item.telefono, rut: item.rut, notas: item.notas, color: item.color, updated_at: item.updatedAt };
}
function toCase(item) {
  return { id: item.id, nombre: item.nombre, materia: item.materia, detalle: item.detalle, cliente_id: item.clienteId || null, contraparte: item.contraparte, tribunal: item.tribunal, rol: item.rol, estado: item.estado, fecha: item.fecha || null, resumen: item.resumen, notas: item.notas, updated_at: item.updatedAt };
}
function toDoc(item) {
  return { id: item.id, nombre: item.nombre, caso_id: item.casoId || null, tipo: item.tipo, fecha: item.fecha || null, tamano: item.tamano, descripcion: item.descripcion, updated_at: item.updatedAt };
}
function toTask(item) {
  return { id: item.id, nombre: item.nombre, caso_id: item.casoId || null, prioridad: item.prioridad, fecha: item.fecha || null, done: Boolean(item.done), updated_at: item.updatedAt };
}
function toEvent(item) {
  return { id: item.id, titulo: item.titulo, detalle: item.detalle, caso_id: item.casoId || null, fecha: item.fecha || null, tipo: item.tipo, updated_at: item.updatedAt };
}
function toLibrary(item) {
  return { id: item.id, titulo: item.titulo, tipo: item.tipo, materia: item.materia, fuente: item.fuente, estado: item.estado, nota: item.nota, updated_at: item.updatedAt };
}

const toRow = { clients: toClient, cases: toCase, documents: toDoc, tasks: toTask, events: toEvent, library: toLibrary };
const fromRow = { clients: fromClient, cases: fromCase, documents: fromDoc, tasks: fromTask, events: fromEvent, library: fromLibrary };

async function sbList(table, order) {
  const rows = await sb(`${table}?select=*&order=${order}`);
  return rows || [];
}

async function trimActivity() {
  const rows = await sbList(TABLES.activity, "at.desc");
  const extra = rows.slice(12).map((row) => row.id);
  if (!extra.length) return;
  await sb(`${TABLES.activity}?id=in.(${extra.join(",")})`, { method: "DELETE" });
}

async function addActivity(text) {
  await sb(TABLES.activity, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ id: crypto.randomUUID(), mensaje: clean(text, 240), at: new Date().toISOString() })
  });
  await trimActivity();
}

async function getRemote() {
  const [officeRows, clients, cases, documents, tasks, events, library, activity] = await Promise.all([
    sb("juridico_office?select=*"),
    sbList(TABLES.clients, "updated_at.desc"),
    sbList(TABLES.cases, "updated_at.desc"),
    sbList(TABLES.documents, "updated_at.desc"),
    sbList(TABLES.tasks, "updated_at.desc"),
    sbList(TABLES.events, "updated_at.desc"),
    sbList(TABLES.library, "updated_at.desc"),
    sbList(TABLES.activity, "at.desc")
  ]);
  const officeRow = (officeRows || [])[0];
  return present({
    office: officeRow ? {
      studio: officeRow.studio || "",
      lawyer: officeRow.lawyer || "",
      role: officeRow.role || "",
      email: officeRow.email || "",
      colegiado: officeRow.colegiado || "",
      accent: officeRow.accent || "#1a4fa0"
    } : emptyDb().office,
    clients: clients.map(fromClient),
    cases: cases.map(fromCase),
    documents: documents.map(fromDoc),
    tasks: tasks.map(fromTask),
    events: events.map(fromEvent),
    library: library.map(fromLibrary),
    activity: activity.slice(0, 12).map((row) => ({ id: row.id, text: row.mensaje || "", at: row.at }))
  });
}

async function purgeRemote(id, name) {
  await sb(`${TABLES.documents}?caso_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await sb(`${TABLES.tasks}?caso_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await sb(`${TABLES.events}?caso_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await sb(`${TABLES.cases}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await addActivity(`Caso cerrado y datos eliminados: ${name || "caso"}`);
}

export async function getState() {
  if (!usingSupabase) return present(readFile());
  return getRemote();
}

export async function saveOffice(body) {
  const office = {
    studio: clean(body.studio, 120),
    lawyer: clean(body.lawyer, 120),
    role: clean(body.role, 80),
    email: clean(body.email, 120),
    colegiado: clean(body.colegiado, 40),
    accent: /^#[0-9a-fA-F]{6}$/.test(body.accent || "") ? body.accent : "#1a4fa0"
  };
  if (!usingSupabase) {
    const db = readFile();
    db.office = office;
    logLocal(db, "Se actualizó la personalización del estudio");
    writeFile(db);
    return present(db);
  }
  await sb("juridico_office?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: "estudio", ...office })
  });
  await addActivity("Se actualizó la personalización del estudio");
  return getRemote();
}

export async function createItem(list, body) {
  const fields = LISTS[list];
  if (!fields) throw new Error("Ruta no encontrada");
  const needs = list === "events" || list === "library" ? body.titulo : body.nombre;
  if (!String(needs || "").trim()) throw new Error("Falta el nombre");
  if (list === "cases" && body.estado === "cerrado") throw new Error("Un caso nuevo no se guarda como cerrado");
  const item = pick(body, fields);
  const labels = { clients: "clientes", cases: "casos", documents: "documentos", tasks: "tareas", events: "agenda", library: "biblioteca" };
  const text = `Se agregó en ${labels[list] || list}: ${item.nombre || item.titulo}`;
  if (!usingSupabase) {
    const db = readFile();
    db[list].unshift(item);
    logLocal(db, text);
    writeFile(db);
    return present(db);
  }
  await sb(TABLES[list], {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(toRow[list](item))
  });
  await addActivity(text);
  return getRemote();
}

export async function updateItem(list, id, body) {
  const fields = LISTS[list];
  if (!fields) throw new Error("Ruta no encontrada");
  if (list === "cases" && body.estado === "cerrado") return removeItem("cases", id);
  if (!usingSupabase) {
    const db = readFile();
    const current = db[list].find((item) => item.id === id);
    if (!current) throw new Error("No encontrado");
    apply(current, body, fields);
    writeFile(db);
    return present(db);
  }
  const remote = await getRemote();
  const current = remote[list].find((item) => item.id === id);
  if (!current) throw new Error("No encontrado");
  apply(current, body, fields);
  await sb(`${TABLES[list]}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(toRow[list](current))
  });
  return getRemote();
}

export async function removeItem(list, id) {
  if (!LISTS[list] && list !== "activity") throw new Error("Ruta no encontrada");
  if (!usingSupabase) {
    const db = readFile();
    const current = db[list].find((item) => item.id === id);
    if (!current) throw new Error("No encontrado");
    if (list === "cases") {
      purgeLocal(db, id);
      logLocal(db, `Caso cerrado y datos eliminados: ${current.nombre}`);
    } else {
      db[list] = db[list].filter((item) => item.id !== id);
    }
    writeFile(db);
    return present(db);
  }
  const remote = await getRemote();
  const current = remote[list].find((item) => item.id === id);
  if (!current) throw new Error("No encontrado");
  if (list === "cases") {
    await purgeRemote(id, current.nombre);
    return getRemote();
  }
  await sb(`${TABLES[list]}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return getRemote();
}
