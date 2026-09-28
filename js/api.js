import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

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
  documents: ["nombre", "casoId", "tipo", "fecha", "tamano", "descripcion", "mime", "texto", "data"],
  tasks: ["nombre", "casoId", "prioridad", "fecha", "done"],
  events: ["titulo", "detalle", "casoId", "fecha", "tipo"],
  library: ["titulo", "tipo", "materia", "fuente", "estado", "nota"]
};

function clean(value, max = 2000) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function valueOf(field, raw) {
  if (field === "done") return Boolean(raw);
  if (field === "color") return /^#[0-9a-fA-F]{6}$/.test(raw || "") ? raw : "#1a4fa0";
  if (field === "data") return String(raw ?? "").slice(0, 8_000_000);
  if (field === "texto") return clean(raw, 12000);
  if (field === "mime") return clean(raw, 120);
  const max = field === "notas" || field === "resumen" ? 8000 : 500;
  return clean(raw, max);
}

function unpackDoc(raw) {
  const text = raw || "";
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && "data" in parsed) {
        return {
          descripcion: parsed.nota || "",
          mime: parsed.mime || "",
          texto: parsed.texto || "",
          data: parsed.data || ""
        };
      }
    } catch {
      /* una nota antigua, sin archivo */
    }
  }
  return { descripcion: text, mime: "", texto: "", data: "" };
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

async function sb(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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

const fromClient = (row) => ({ id: row.id, nombre: row.nombre, email: row.email || "", telefono: row.telefono || "", rut: row.rut || "", notas: row.notas || "", color: row.color || "#1a4fa0", updatedAt: row.updated_at });
const fromCase = (row) => ({ id: row.id, nombre: row.nombre, materia: row.materia || "", detalle: row.detalle || "", clienteId: row.cliente_id || "", contraparte: row.contraparte || "", tribunal: row.tribunal || "", rol: row.rol || "", estado: row.estado || "prep", fecha: row.fecha || "", resumen: row.resumen || "", notas: row.notas || "", updatedAt: row.updated_at });
const fromDoc = (row) => {
  const file = unpackDoc(row.descripcion);
  return { id: row.id, nombre: row.nombre, casoId: row.caso_id || "", tipo: row.tipo || "", fecha: row.fecha || "", tamano: row.tamano || "", descripcion: file.descripcion, mime: file.mime, texto: file.texto, data: file.data, updatedAt: row.updated_at };
};
const fromTask = (row) => ({ id: row.id, nombre: row.nombre, casoId: row.caso_id || "", prioridad: row.prioridad || "media", fecha: row.fecha || "", done: Boolean(row.done), updatedAt: row.updated_at });
const fromEvent = (row) => ({ id: row.id, titulo: row.titulo, detalle: row.detalle || "", casoId: row.caso_id || "", fecha: row.fecha || "", tipo: row.tipo || "", updatedAt: row.updated_at });
const fromLibrary = (row) => ({ id: row.id, titulo: row.titulo, tipo: row.tipo || "", materia: row.materia || "", fuente: row.fuente || "", estado: row.estado || "", nota: row.nota || "", updatedAt: row.updated_at });

const toClient = (item) => ({ id: item.id, nombre: item.nombre, email: item.email, telefono: item.telefono, rut: item.rut, notas: item.notas, color: item.color, updated_at: item.updatedAt });
const toCase = (item) => ({ id: item.id, nombre: item.nombre, materia: item.materia, detalle: item.detalle, cliente_id: item.clienteId || null, contraparte: item.contraparte, tribunal: item.tribunal, rol: item.rol, estado: item.estado, fecha: item.fecha || null, resumen: item.resumen, notas: item.notas, updated_at: item.updatedAt });
const toDoc = (item) => ({
  id: item.id,
  nombre: item.nombre,
  caso_id: item.casoId || null,
  tipo: item.tipo,
  fecha: item.fecha || null,
  tamano: item.tamano,
  descripcion: item.data
    ? JSON.stringify({ nota: item.descripcion || "", mime: item.mime || "", texto: item.texto || "", data: item.data })
    : (item.descripcion || ""),
  updated_at: item.updatedAt
});
const toTask = (item) => ({ id: item.id, nombre: item.nombre, caso_id: item.casoId || null, prioridad: item.prioridad, fecha: item.fecha || null, done: Boolean(item.done), updated_at: item.updatedAt });
const toEvent = (item) => ({ id: item.id, titulo: item.titulo, detalle: item.detalle, caso_id: item.casoId || null, fecha: item.fecha || null, tipo: item.tipo, updated_at: item.updatedAt });
const toLibrary = (item) => ({ id: item.id, titulo: item.titulo, tipo: item.tipo, materia: item.materia, fuente: item.fuente, estado: item.estado, nota: item.nota, updated_at: item.updatedAt });

const toRow = { clients: toClient, cases: toCase, documents: toDoc, tasks: toTask, events: toEvent, library: toLibrary };

async function sbList(table, order) {
  return (await sb(`${table}?select=*&order=${order}`)) || [];
}

async function getState() {
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
  return {
    storage: "supabase",
    office: officeRow ? {
      studio: officeRow.studio || "",
      lawyer: officeRow.lawyer || "",
      role: officeRow.role || "",
      email: officeRow.email || "",
      colegiado: officeRow.colegiado || "",
      accent: officeRow.accent || "#1a4fa0"
    } : { studio: "", lawyer: "", role: "", email: "", colegiado: "", accent: "#1a4fa0" },
    clients: clients.map(fromClient),
    cases: cases.map(fromCase),
    documents: documents.map(fromDoc),
    tasks: tasks.map(fromTask),
    events: events.map(fromEvent),
    library: library.map(fromLibrary),
    activity: activity.slice(0, 12).map((row) => ({ id: row.id, text: row.mensaje || "", at: row.at }))
  };
}

async function addActivity(text) {
  await sb(TABLES.activity, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ id: crypto.randomUUID(), mensaje: clean(text, 240), at: new Date().toISOString() })
  });
  const rows = await sbList(TABLES.activity, "at.desc");
  const extra = rows.slice(12).map((row) => row.id);
  if (extra.length) await sb(`${TABLES.activity}?id=in.(${extra.join(",")})`, { method: "DELETE" });
}

async function purgeCase(id, name) {
  await sb(`${TABLES.documents}?caso_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await sb(`${TABLES.tasks}?caso_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await sb(`${TABLES.events}?caso_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await sb(`${TABLES.cases}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await addActivity(`Caso cerrado y datos eliminados: ${name || "caso"}`);
}

export const api = {
  getState,
  async saveOffice(body) {
    const office = {
      studio: clean(body.studio, 120),
      lawyer: clean(body.lawyer, 120),
      role: clean(body.role, 80),
      email: clean(body.email, 120),
      colegiado: clean(body.colegiado, 40),
      accent: /^#[0-9a-fA-F]{6}$/.test(body.accent || "") ? body.accent : "#1a4fa0"
    };
    await sb("juridico_office?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: "estudio", ...office })
    });
    await addActivity("Se actualizó la personalización del estudio");
    return getState();
  },
  async create(list, body) {
    const fields = LISTS[list];
    if (!fields) throw new Error("Ruta no encontrada");
    const needs = list === "events" || list === "library" ? body.titulo : body.nombre;
    if (!String(needs || "").trim()) throw new Error("Falta el nombre");
    if (list === "cases" && body.estado === "cerrado") throw new Error("Un caso nuevo no se guarda como cerrado");
    const item = pick(body, fields);
    const labels = { clients: "clientes", cases: "casos", documents: "documentos", tasks: "tareas", events: "agenda", library: "biblioteca" };
    await sb(TABLES[list], {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(toRow[list](item))
    });
    await addActivity(`Se agregó en ${labels[list]}: ${item.nombre || item.titulo}`);
    return getState();
  },
  async update(list, id, body) {
    if (list === "cases" && body.estado === "cerrado") return api.remove("cases", id);
    const fields = LISTS[list];
    const state = await getState();
    const current = state[list].find((item) => item.id === id);
    if (!current) throw new Error("No encontrado");
    apply(current, body, fields);
    await sb(`${TABLES[list]}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(toRow[list](current))
    });
    return getState();
  },
  async remove(list, id) {
    const state = await getState();
    const current = state[list].find((item) => item.id === id);
    if (!current) throw new Error("No encontrado");
    if (list === "cases") {
      await purgeCase(id, current.nombre);
      return getState();
    }
    await sb(`${TABLES[list]}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return getState();
  }
};
