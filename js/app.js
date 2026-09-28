import { api } from "./api.js";
import {
  AI_TOOLS, CHAT_SUGGESTIONS, CLIENT_COLORS, DOC_TIPOS, ESTADOS, EVENT_TIPOS, LIB_TIPOS, MATERIAS, PRIORIDADES
} from "./config.js";
import {
  dentroDeDias, draft, empty, esc, estadoDe, fecha, hace, hoyTexto, iniciales, prioridadDe, saludo
} from "./format.js";
import { buscarLeyes, leyId, leySearchPage } from "./leychile.js";

let state = blank();
let online = true;
let caseId = null;
let tabName = "resumen";
let clientColor = CLIENT_COLORS[0];
let chatReady = false;
const filters = { casos: "todos", docs: "Todos", lib: "Todo" };
let leyHits = [];
const savingLey = new Set();

function blank() {
  return {
    office: { studio: "", lawyer: "", role: "", email: "", colegiado: "", accent: "#1a4fa0" },
    clients: [], cases: [], documents: [], tasks: [], events: [], library: [], activity: []
  };
}

const $ = (id) => document.getElementById(id);
const clientById = (id) => state.clients.find((item) => item.id === id);
const caseById = (id) => state.cases.find((item) => item.id === id);

export async function init() {
  try {
    state = await api.getState();
  } catch {
    online = false;
    state = blank();
  }
  fillFixedSelects();
  paintSwatches();
  bind();
  render();
  startChat();
}

function fillFixedSelects() {
  setOptions($("caso-materia"), MATERIAS);
  setOptions($("caso-estado"), ESTADOS.map((item) => item.label), ESTADOS.map((item) => item.id));
  setOptions($("doc-tipo"), DOC_TIPOS);
  setOptions($("evento-tipo"), EVENT_TIPOS.map((item) => item.label), EVENT_TIPOS.map((item) => item.id));
  setOptions($("tarea-prioridad"), PRIORIDADES.map((item) => item.label), PRIORIDADES.map((item) => item.id));
  setOptions($("fuente-tipo"), LIB_TIPOS);
  setOptions($("fuente-materia"), MATERIAS);
}

function setOptions(select, labels, values = labels) {
  if (!select) return;
  select.innerHTML = labels.map((label, i) => `<option value="${esc(values[i])}">${esc(label)}</option>`).join("");
}

function paintSwatches() {
  const box = $("color-pick");
  box.innerHTML = CLIENT_COLORS.map((color) =>
    `<button type="button" class="color-swatch${color === clientColor ? " active" : ""}" data-color="${color}" style="background:${color}" aria-label="Color"></button>`
  ).join("");
}

function bind() {
  document.body.addEventListener("click", onClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelectorAll(".modal-overlay.open").forEach((modal) => closeModal(modal.id));
  });
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });
  document.querySelectorAll("[data-search-for]").forEach((input) => {
    input.addEventListener("input", () => {
      const target = input.dataset.searchFor;
      if (target === "dashboard") renderDashboard();
      if (target === "casos") renderCases();
      if (target === "clientes") renderClients();
      if (target === "docs") renderDocs();
      if (target === "global") renderSearch(input.value);
    });
  });
  $("chat-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat();
    }
  });
  $("chat-send").addEventListener("click", () => sendChat());
  $("setup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveOffice({
      studio: $("setup-studio").value,
      lawyer: $("setup-lawyer").value,
      role: $("setup-role").value
    }, "Escritorio personalizado");
  });
  $("btn-save-office").addEventListener("click", () => saveOffice(readOffice(), "Cambios guardados"));
  $("form-caso").addEventListener("submit", onSaveCase);
  $("form-cliente").addEventListener("submit", onSaveClient);
  $("form-doc").addEventListener("submit", onSaveDoc);
  $("form-evento").addEventListener("submit", onSaveEvent);
  $("form-tarea").addEventListener("submit", onSaveTask);
  $("form-fuente").addEventListener("submit", onSaveFuente);
  $("form-ley").addEventListener("submit", onSearchLey);
  $("btn-edit-case").addEventListener("click", () => openCaseForm(caseById(caseId)));
  $("btn-close-case").addEventListener("click", () => closeCase(caseId));
  for (const zone of ["dropzone-caso", "dropzone-docs"]) bindDrop($(zone));
  $("doc-file").addEventListener("change", () => {
    const file = $("doc-file").files?.[0];
    if (!file) return;
    if (!$("modal-subir-doc").classList.contains("open")) openDocModal(file);
    else {
      $("doc-nombre").value = file.name;
      $("doc-tamano").value = file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "";
    }
  });
  document.body.addEventListener("change", (event) => {
    const box = event.target.closest(".source-check");
    if (box && event.target.matches("input[type=checkbox]")) box.classList.toggle("selected", event.target.checked);
  });
}

function bindDrop(zone) {
  if (!zone) return;
  zone.addEventListener("click", () => $("doc-file").click());
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    openDocModal(file);
  });
}

function onClick(event) {
  const swatch = event.target.closest("[data-color]");
  if (swatch) {
    clientColor = swatch.dataset.color;
    paintSwatches();
    return;
  }
  const screen = event.target.closest("[data-screen]");
  if (screen && !event.target.closest("form")) {
    showScreen(screen.dataset.screen);
    return;
  }
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    switchTab(tab.dataset.tab);
    return;
  }
  const opener = event.target.closest("[data-open]");
  if (opener) {
    openNamed(opener.dataset.open);
    return;
  }
  const closer = event.target.closest("[data-close]");
  if (closer) {
    closeModal(closer.dataset.close);
    return;
  }
  const chip = event.target.closest("[data-filter-casos],[data-filter-docs],[data-filter-lib]");
  if (chip) {
    setFilter(chip);
    return;
  }
  const task = event.target.closest("[data-task]");
  if (task) {
    toggleTask(task.dataset.task);
    return;
  }
  const openCase = event.target.closest("[data-open-case]");
  if (openCase && !event.target.closest("[data-delete]")) {
    openCaseView(openCase.dataset.openCase);
    return;
  }
  const saveLey = event.target.closest("[data-save-ley]");
  if (saveLey) {
    saveLeyHit(saveLey.dataset.saveLey);
    return;
  }
  const del = event.target.closest("[data-delete]");
  if (del) {
    removeItem(del.dataset.delete, del.dataset.id);
    return;
  }
  const editClient = event.target.closest("[data-edit-client]");
  if (editClient) {
    openClientForm(clientById(editClient.dataset.editClient));
    return;
  }
  const tool = event.target.closest("[data-ai-tool]");
  if (tool) {
    showCaseDraft(tool.dataset.aiTool);
    return;
  }
  const suggestion = event.target.closest("[data-suggest]");
  if (suggestion) sendChat(suggestion.dataset.suggest);
  if (event.target.closest("[data-copy-draft]")) copyDraft();
  if (event.target.closest("[data-save-draft]")) saveDraftToNotes();
  if (event.target.closest("#btn-save-note")) saveNote();
  if (event.target.closest("#btn-add-task")) {
    $("tarea-caso").value = caseId || "";
    openModal("modal-tarea");
  }
  if (event.target.closest("#btn-add-event")) {
    $("evento-caso").value = caseId || "";
    openModal("modal-agenda");
  }
}

function setFilter(chip) {
  if (chip.dataset.filterCasos) {
    filters.casos = chip.dataset.filterCasos;
    markChips(chip, "[data-filter-casos]");
    renderCases();
  }
  if (chip.dataset.filterDocs) {
    filters.docs = chip.dataset.filterDocs;
    markChips(chip, "[data-filter-docs]");
    renderDocs();
  }
  if (chip.dataset.filterLib) {
    filters.lib = chip.dataset.filterLib;
    markChips(chip, "[data-filter-lib]");
    renderLibrary();
  }
}

function markChips(chip, selector) {
  chip.parentElement.querySelectorAll(selector).forEach((item) => item.classList.toggle("active", item === chip));
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  $("screen-" + name)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  const nav = name === "caso" ? "casos" : name;
  $("nav-" + nav)?.classList.add("active");
  window.scrollTo(0, 0);
  if (name === "buscar") $("global-search").focus();
}

function switchTab(name) {
  tabName = name;
  document.querySelectorAll("#screen-caso .tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll("#screen-caso .tab-pane").forEach((pane) => pane.classList.remove("active"));
  $("tab-" + name)?.classList.add("active");
}

function openModal(id) {
  $(id)?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  $(id)?.classList.remove("open");
  if (!document.querySelector(".modal-overlay.open")) document.body.style.overflow = "";
}

function openNamed(id) {
  if (id === "modal-nuevo-caso") openCaseForm(null);
  else if (id === "modal-nuevo-cliente") openClientForm(null);
  else if (id === "modal-subir-doc") openDocModal(null);
  else openModal(id);
}

function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast${type ? " " + type : ""}`;
  el.textContent = message;
  $("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

async function commit(work, message) {
  if (!online) {
    toast("Sin servidor. Ejecuta npm start para guardar.", "warning");
    return;
  }
  try {
    state = await work();
    render();
    if (message) toast(message, "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

function readOffice() {
  return {
    studio: $("cfg-studio").value,
    lawyer: $("cfg-lawyer").value,
    role: $("cfg-role").value,
    email: $("cfg-email").value,
    colegiado: $("cfg-colegiado").value,
    accent: $("cfg-accent").value
  };
}

function saveOffice(partial, message) {
  const office = { ...state.office, ...partial };
  commit(() => api.saveOffice(office), message);
}

function openCaseForm(caso) {
  $("form-caso").reset();
  $("caso-id").value = caso?.id || "";
  $("modal-caso-title").textContent = caso ? "Editar caso" : "Nuevo caso";
  fillRelations();
  if (caso) {
    $("caso-nombre").value = caso.nombre || "";
    $("caso-materia").value = caso.materia || MATERIAS[0];
    $("caso-cliente").value = caso.clienteId || "";
    $("caso-contraparte").value = caso.contraparte || "";
    $("caso-tribunal").value = caso.tribunal || "";
    $("caso-rol").value = caso.rol || "";
    $("caso-estado").value = caso.estado || "prep";
    $("caso-fecha").value = caso.fecha || "";
    $("caso-resumen").value = caso.resumen || "";
  }
  openModal("modal-nuevo-caso");
}

function openClientForm(cliente) {
  $("form-cliente").reset();
  $("cliente-id").value = cliente?.id || "";
  $("modal-cliente-title").textContent = cliente ? "Editar cliente" : "Agregar cliente";
  clientColor = cliente?.color || CLIENT_COLORS[0];
  if (cliente) {
    $("cli-nombre").value = cliente.nombre || "";
    $("cli-rut").value = cliente.rut || "";
    $("cli-telefono").value = cliente.telefono || "";
    $("cli-email").value = cliente.email || "";
    $("cli-notas").value = cliente.notas || "";
  }
  paintSwatches();
  openModal("modal-nuevo-cliente");
}

function openDocModal(file) {
  $("form-doc").reset();
  fillRelations();
  if (caseId) $("doc-caso").value = caseId;
  if (file) {
    $("doc-nombre").value = file.name;
    $("doc-tamano").value = file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "";
  }
  openModal("modal-subir-doc");
}

function askClose() {
  return confirm("Al cerrar el caso se borran sus documentos, tareas, notas y fechas.\nEl cliente no se borra.\n\n¿Cerrar y borrar esos datos?");
}

function closeCase(id) {
  if (!id || !askClose()) return;
  commit(async () => {
    const next = await api.remove("cases", id);
    if (caseId === id) {
      caseId = null;
      showScreen("casos");
    }
    closeModal("modal-nuevo-caso");
    return next;
  }, "Caso cerrado. Sus datos se eliminaron.");
}

function onSaveCase(event) {
  event.preventDefault();
  const id = $("caso-id").value;
  const data = {
    nombre: $("caso-nombre").value,
    materia: $("caso-materia").value,
    clienteId: $("caso-cliente").value,
    contraparte: $("caso-contraparte").value,
    tribunal: $("caso-tribunal").value,
    rol: $("caso-rol").value,
    estado: $("caso-estado").value,
    fecha: $("caso-fecha").value,
    resumen: $("caso-resumen").value
  };
  if (data.estado === "cerrado") {
    if (!id) {
      toast("Para un caso nuevo elige En preparación o En curso.", "warning");
      return;
    }
    closeCase(id);
    return;
  }
  commit(async () => {
    const next = id ? await api.update("cases", id, data) : await api.create("cases", data);
    closeModal("modal-nuevo-caso");
    return next;
  }, id ? "Caso actualizado" : "Caso creado");
}

function onSaveClient(event) {
  event.preventDefault();
  const id = $("cliente-id").value;
  const data = {
    nombre: $("cli-nombre").value,
    rut: $("cli-rut").value,
    telefono: $("cli-telefono").value,
    email: $("cli-email").value,
    notas: $("cli-notas").value,
    color: clientColor
  };
  commit(async () => {
    const next = id ? await api.update("clients", id, data) : await api.create("clients", data);
    closeModal("modal-nuevo-cliente");
    return next;
  }, id ? "Cliente actualizado" : "Cliente agregado");
}

function onSaveDoc(event) {
  event.preventDefault();
  const data = {
    nombre: $("doc-nombre").value,
    casoId: $("doc-caso").value,
    tipo: $("doc-tipo").value,
    fecha: $("doc-fecha").value,
    tamano: $("doc-tamano").value,
    descripcion: $("doc-desc").value
  };
  commit(async () => {
    const next = await api.create("documents", data);
    closeModal("modal-subir-doc");
    return next;
  }, "Documento anotado");
}

function onSaveEvent(event) {
  event.preventDefault();
  const data = {
    titulo: $("evento-titulo").value,
    fecha: $("evento-fecha").value,
    tipo: $("evento-tipo").value,
    casoId: $("evento-caso").value,
    detalle: $("evento-detalle").value
  };
  commit(async () => {
    const next = await api.create("events", data);
    closeModal("modal-agenda");
    $("form-evento").reset();
    return next;
  }, "Evento agendado");
}

function onSaveTask(event) {
  event.preventDefault();
  const data = {
    nombre: $("tarea-nombre").value,
    prioridad: $("tarea-prioridad").value,
    fecha: $("tarea-fecha").value,
    casoId: $("tarea-caso").value || caseId || "",
    done: false
  };
  commit(async () => {
    const next = await api.create("tasks", data);
    closeModal("modal-tarea");
    $("form-tarea").reset();
    return next;
  }, "Tarea agregada");
}

function onSaveFuente(event) {
  event.preventDefault();
  const data = {
    titulo: $("fuente-titulo").value,
    tipo: $("fuente-tipo").value,
    materia: $("fuente-materia").value,
    fuente: $("fuente-origen").value,
    nota: $("fuente-nota").value,
    estado: "Por verificar"
  };
  commit(async () => {
    const next = await api.create("library", data);
    closeModal("modal-fuente");
    $("form-fuente").reset();
    return next;
  }, "Fuente agregada");
}

async function removeItem(list, id) {
  if (!confirm("¿Eliminar este registro?")) return;
  if (list === "cases" && id === caseId) {
    caseId = null;
    showScreen("casos");
  }
  await commit(() => api.remove(list, id), "Eliminado");
}

async function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const done = !task.done;
  await commit(() => api.update("tasks", id, { done }), done ? "Tarea completada" : "Tarea reabierta");
}

function saveNote() {
  if (!caseId) return;
  commit(() => api.update("cases", caseId, { notas: $("nota-area")?.value || "" }), "Nota guardada");
}

function render() {
  const noteDraft = document.activeElement?.id === "nota-area" ? document.activeElement.value : null;
  renderOffice();
  renderDashboard();
  renderCases();
  renderClients();
  renderAgenda();
  renderDocs();
  renderLibrary();
  renderSearch($("global-search").value);
  fillRelations();
  if (caseId) renderCase(noteDraft);
  $("offline-banner").hidden = online;
}

function renderOffice() {
  const office = state.office || blank().office;
  $("studio-name").textContent = office.studio || "Escritorio Jurídico";
  $("studio-tag").textContent = office.studio ? "Estudio personalizado" : "Sin personalizar";
  $("user-name").textContent = office.lawyer || "Sin nombre";
  $("user-role").textContent = office.role || "Completa tu perfil";
  $("user-avatar").textContent = iniciales(office.lawyer, office.studio);
  $("greeting-text").textContent = saludo(office.lawyer);
  $("fecha-actual").textContent = hoyTexto();
  $("setup-card").hidden = Boolean((office.studio || office.lawyer || "").trim());
  $("sync-label").textContent = !online ? "Sin servidor" : state.storage === "supabase" ? "Guardado en Supabase" : "Guardado en este equipo";
  if (/^#[0-9a-fA-F]{6}$/.test(office.accent || "")) {
    document.documentElement.style.setProperty("--accent", office.accent);
  }
  const fields = {
    "cfg-studio": office.studio,
    "cfg-lawyer": office.lawyer,
    "cfg-role": office.role,
    "cfg-email": office.email,
    "cfg-colegiado": office.colegiado
  };
  for (const [id, value] of Object.entries(fields)) {
    if (document.activeElement !== $(id)) $(id).value = value || "";
  }
  if (document.activeElement !== $("cfg-accent")) $("cfg-accent").value = office.accent || "#1a4fa0";
}

function renderDashboard() {
  const activos = state.cases.filter((item) => item.estado === "activo" || item.estado === "urgente");
  const pending = state.tasks.filter((item) => !item.done);
  const plazos = state.events.filter((item) => dentroDeDias(item.fecha, 7));
  const recientes = state.documents.filter((item) => item.updatedAt && Date.now() - new Date(item.updatedAt).getTime() < 7 * 86400000);
  $("stat-activos").textContent = String(activos.length);
  $("stat-activos-sub").textContent = activos.length ? `${activos.filter((item) => item.estado === "urgente").length} urgentes` : "Sin casos";
  $("stat-tareas").textContent = String(pending.length);
  $("stat-tareas-sub").textContent = pending.length ? "Sin tachar" : "Nada pendiente";
  $("stat-plazos").textContent = String(plazos.length);
  $("stat-docs").textContent = String(recientes.length);
  const badge = $("nav-badge-casos");
  badge.hidden = state.cases.length === 0;
  badge.textContent = String(state.cases.length);

  const query = ($("topbar-search").value || "").trim().toLowerCase();
  const rows = state.cases.filter((item) => {
    const client = clientById(item.clienteId);
    return !query || `${item.nombre} ${item.materia} ${client?.nombre || ""}`.toLowerCase().includes(query);
  }).slice(0, 6);
  $("dashboard-cases").innerHTML = rows.length ? rows.map(caseRow).join("") : empty("Sin casos", "Crea el primero con Nuevo caso.");
  $("dashboard-tasks").innerHTML = pending.length ? `<div class="task-list">${pending.slice(0, 6).map(taskRow).join("")}</div>` : empty("Sin tareas", "Las tareas de cada caso aparecen aquí.");
  $("dashboard-activity").innerHTML = state.activity.length
    ? state.activity.map((item) => `<div class="activity-item"><div class="activity-dot" style="background:var(--accent);"></div><div><div class="activity-text">${esc(item.text)}</div><div class="activity-time">${esc(hace(item.at))}</div></div></div>`).join("")
    : empty("Sin actividad", "Lo que crees quedará registrado aquí.");
}

function caseRow(item) {
  const client = clientById(item.clienteId);
  const estado = estadoDe(item.estado);
  return `<div class="case-row" data-open-case="${esc(item.id)}">
    <div><div class="case-name">${esc(item.nombre)}</div><div class="case-meta">${clientDot(client)} ${esc(client?.nombre || "Sin cliente")} · ${esc(item.materia || "Sin materia")}</div></div>
    <div class="case-court">${esc(item.tribunal || "Sin tribunal")}</div>
    <div><span class="badge ${estado.badge}">${esc(estado.label)}</span></div>
    <div class="case-date">${esc(hace(item.updatedAt))}</div>
  </div>`;
}

function taskRow(task) {
  const pr = prioridadDe(task.prioridad);
  const mark = task.done ? `<svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : "";
  return `<div class="task-item${task.done ? " is-done" : ""}">
    <div class="task-check${task.done ? " done" : ""}" data-task="${esc(task.id)}">${mark}</div>
    <div class="task-name${task.done ? " done" : ""}">${esc(task.nombre)}</div>
    <span class="${pr.cls}">${esc(task.done ? "LISTA" : pr.label)}</span>
    <div class="task-date">${esc(fecha(task.fecha))}</div>
  </div>`;
}

function clientDot(client) {
  if (!client?.color) return "";
  return `<span class="client-dot" style="background:${esc(client.color)}"></span>`;
}

function renderCases() {
  const activos = state.cases.filter((item) => item.estado === "activo" || item.estado === "urgente").length;
  $("casos-sub").textContent = state.cases.length ? `${state.cases.length} casos · ${activos} activos` : "Todavía no hay casos";
  const query = ($("casos-search").value || "").trim().toLowerCase();
  const rows = state.cases.filter((item) => {
    const client = clientById(item.clienteId);
    const blob = `${item.nombre} ${item.materia} ${item.tribunal} ${client?.nombre || ""}`.toLowerCase();
    if (query && !blob.includes(query)) return false;
    if (filters.casos === "activos") return item.estado === "activo" || item.estado === "urgente";
    if (filters.casos === "prep") return item.estado === "prep";
    if (filters.casos === "cerrados") return item.estado === "cerrado";
    return true;
  });
  if (!rows.length) {
    $("casos-list").innerHTML = filters.casos === "cerrados"
      ? empty("No quedan casos cerrados", "Al cerrar un caso se borran sus datos para no ocupar espacio.")
      : empty("Ningún caso con este filtro", "Prueba otra búsqueda o crea un caso.");
    return;
  }
  const head = `<div class="list-head cols-cases"><span>Caso / cliente</span><span>Tribunal</span><span>Materia</span><span>Estado</span><span></span></div>`;
  $("casos-list").innerHTML = head + rows.map((item) => {
    const client = clientById(item.clienteId);
    const estado = estadoDe(item.estado);
    return `<div class="table-row cols-cases" data-open-case="${esc(item.id)}">
      <div><div class="case-name">${esc(item.nombre)}</div><div class="case-meta">${clientDot(client)} ${esc(client?.nombre || "Sin cliente")}</div></div>
      <div class="case-court">${esc(item.tribunal || "—")}</div>
      <div>${esc(item.materia || "—")}</div>
      <div><span class="badge ${estado.badge}">${esc(estado.label)}</span></div>
      <div class="row-actions"><button class="btn-ghost" type="button" data-delete="cases" data-id="${esc(item.id)}">Eliminar</button></div>
    </div>`;
  }).join("");
}

function renderClients() {
  $("clientes-sub").textContent = state.clients.length ? `${state.clients.length} fichas` : "Cada cliente tiene su ficha";
  const query = ($("clientes-search").value || "").trim().toLowerCase();
  const rows = state.clients.filter((item) => `${item.nombre} ${item.email} ${item.rut} ${item.telefono}`.toLowerCase().includes(query));
  if (!rows.length) {
    $("clientes-list").innerHTML = empty("Sin clientes", "Agrega la ficha de cada persona o empresa.");
    return;
  }
  const head = `<div class="list-head cols-clients"><span>Cliente</span><span>Contacto</span><span>RUT</span><span>Notas</span><span></span></div>`;
  $("clientes-list").innerHTML = head + rows.map((item) => {
    const count = state.cases.filter((caso) => caso.clienteId === item.id).length;
    return `<div class="table-row cols-clients" data-edit-client="${esc(item.id)}">
      <div class="client-name"><span class="client-dot" style="background:${esc(item.color || "#1a4fa0")}"></span>${esc(item.nombre)} <span class="case-meta">${count} casos</span></div>
      <div>${esc(item.email || item.telefono || "Sin contacto")}</div>
      <div>${esc(item.rut || "—")}</div>
      <div class="case-meta">${esc(item.notas || "Sin notas")}</div>
      <div class="row-actions"><button class="btn-ghost" type="button" data-delete="clients" data-id="${esc(item.id)}">Eliminar</button></div>
    </div>`;
  }).join("");
}

function renderAgenda() {
  const rows = [...state.events].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  if (!rows.length) {
    $("agenda-list").innerHTML = empty("Agenda vacía", "Anota audiencias y plazos con fecha.");
    return;
  }
  const head = `<div class="list-head cols-agenda"><span>Fecha</span><span>Evento</span><span>Tipo</span><span>Caso</span><span></span></div>`;
  const today = new Date().toISOString().slice(0, 10);
  $("agenda-list").innerHTML = head + rows.map((item) => {
    const caso = caseById(item.casoId);
    const tipo = EVENT_TIPOS.find((entry) => entry.id === item.tipo)?.label || item.tipo;
    return `<div class="table-row cols-agenda${item.fecha < today ? " agenda-past" : ""}">
      <div class="agenda-day">${esc(fecha(item.fecha))}</div>
      <div><div class="case-name">${esc(item.titulo)}</div><div class="case-meta">${esc(item.detalle || "")}</div></div>
      <div>${esc(tipo || "—")}</div>
      <div>${esc(caso?.nombre || "Sin caso")}</div>
      <div class="row-actions"><button class="btn-ghost" type="button" data-delete="events" data-id="${esc(item.id)}">Eliminar</button></div>
    </div>`;
  }).join("");
}

function badgeDoc(tipo) {
  if (tipo === "Demanda") return "badge-demand";
  if (tipo === "Contrato") return "badge-contract";
  return "badge-doc";
}

function renderDocs() {
  $("docs-sub").textContent = state.documents.length ? `${state.documents.length} fichas de documento` : "Sin archivos";
  const query = ($("docs-search").value || "").trim().toLowerCase();
  const rows = state.documents.filter((item) => {
    const caso = caseById(item.casoId);
    const blob = `${item.nombre} ${item.tipo} ${caso?.nombre || ""}`.toLowerCase();
    if (query && !blob.includes(query)) return false;
    if (filters.docs !== "Todos" && item.tipo !== filters.docs) return false;
    return true;
  });
  $("docs-body").innerHTML = rows.length ? rows.map((item) => {
    const caso = caseById(item.casoId);
    return `<tr class="doc-row" ${caso ? `data-open-case="${esc(caso.id)}"` : ""}>
      <td><div class="doc-name">${esc(item.nombre)}</div></td>
      <td>${esc(caso?.nombre || "General")}</td>
      <td><span class="badge ${badgeDoc(item.tipo)}">${esc(item.tipo || "Otro")}</span></td>
      <td>${esc(fecha(item.fecha))}</td>
      <td><button class="doc-action-btn" type="button" data-delete="documents" data-id="${esc(item.id)}">Quitar</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="5">${empty("Sin documentos", "Anota el nombre del archivo y el caso al que pertenece.")}</td></tr>`;
}

function leySaved(url) {
  const id = leyId(url);
  return state.library.some((item) => item.fuente === url || (id && leyId(item.fuente) === id));
}

function fuenteLine(item) {
  const fuente = item.fuente || "";
  if (/^https:\/\/(www\.)?(leychile\.cl|bcn\.cl)\//i.test(fuente)) {
    const extra = item.nota ? `${esc(item.nota)} · ` : "";
    return `${extra}<a href="${esc(fuente)}" target="_blank" rel="noopener noreferrer">Abrir en Ley Chile</a>`;
  }
  return esc(fuente || "Sin referencia de verificación");
}

async function onSearchLey(event) {
  event.preventDefault();
  const query = $("ley-query").value.trim();
  const button = $("ley-submit");
  $("ley-open-all").href = leySearchPage(query);
  button.disabled = true;
  button.textContent = "Buscando…";
  $("ley-status").textContent = "Consultando Ley Chile…";
  leyHits = [];
  paintLeyHits();
  try {
    const found = await buscarLeyes(query);
    leyHits = found.items;
    const shown = leyHits.length;
    $("ley-status").textContent = shown
      ? `Ley Chile encontró ${found.total.toLocaleString("es-CL")} coincidencias. Aquí van las primeras ${shown}. El texto completo se abre en el sitio oficial.`
      : "Sin coincidencias. Prueba con el número de la ley o ábrela en Ley Chile.";
    paintLeyHits();
  } catch (error) {
    $("ley-status").textContent = `${error.message}. Puedes abrir la búsqueda en Ley Chile.`;
  } finally {
    button.disabled = false;
    button.textContent = "Buscar";
  }
}

function paintLeyHits() {
  const box = $("ley-results");
  if (!box) return;
  box.innerHTML = leyHits.map((item, index) => {
    const saved = leySaved(item.url);
    const saving = savingLey.has(item.url);
    const meta = [item.numero, item.tipo, item.fecha].filter(Boolean).join(" · ");
    return `<article class="ley-hit">
      <div>
        <div class="ley-hit-title">${esc(item.titulo)}</div>
        <div class="ley-hit-meta">${esc(meta)}</div>
      </div>
      <a class="btn-ghost" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Abrir</a>
      <button class="btn-primary" type="button" data-save-ley="${index}" ${saved || saving ? "disabled" : ""}>${saved ? "Guardada" : saving ? "Guardando…" : "Guardar"}</button>
    </article>`;
  }).join("");
}

async function saveLeyHit(index) {
  const item = leyHits[Number(index)];
  if (!item || savingLey.has(item.url)) return;
  if (leySaved(item.url)) {
    toast("Esa ley ya está en la biblioteca");
    paintLeyHits();
    return;
  }
  const nota = [item.numero, item.fecha].filter(Boolean).join(" · ");
  savingLey.add(item.url);
  paintLeyHits();
  try {
    await commit(async () => api.create("library", {
      titulo: item.titulo,
      tipo: "Ley",
      materia: item.numero || "Ley",
      fuente: item.url,
      nota,
      estado: "En Ley Chile"
    }), "Enlace guardado en la biblioteca");
  } finally {
    savingLey.delete(item.url);
    paintLeyHits();
  }
}

function renderLibrary() {
  const rows = state.library.filter((item) => filters.lib === "Todo" || item.tipo === filters.lib || item.materia === filters.lib);
  $("lib-grid").innerHTML = rows.length ? rows.map((item) => `<article class="lib-card">
    <div class="lib-card-type">${esc(item.tipo || "Fuente")} · ${esc(item.materia || "")}</div>
    <div class="lib-card-title">${esc(item.titulo)}</div>
    <div class="lib-card-sub">${fuenteLine(item)}</div>
    <div class="lib-card-footer"><span>${esc(item.estado || "Por verificar")}</span><button class="btn-ghost" type="button" data-delete="library" data-id="${esc(item.id)}">Quitar</button></div>
  </article>`).join("") : empty("Biblioteca vacía", "Busca una ley arriba o agrega una fuente que vayas a verificar.");
  paintLeyHits();
}

function renderSearch(query) {
  const q = String(query || "").trim().toLowerCase();
  const box = $("search-results");
  if (!q) {
    box.innerHTML = empty("Escribe para buscar", "Busca en casos, clientes, documentos y biblioteca.");
    return;
  }
  const groups = [
    ["Casos", state.cases.filter((item) => `${item.nombre} ${item.materia} ${item.resumen}`.toLowerCase().includes(q)).map((item) => ({ title: item.nombre, sub: item.materia, caseId: item.id }))],
    ["Clientes", state.clients.filter((item) => `${item.nombre} ${item.email} ${item.rut}`.toLowerCase().includes(q)).map((item) => ({ title: item.nombre, sub: item.email || item.notas || "Ficha", screen: "clientes" }))],
    ["Documentos", state.documents.filter((item) => item.nombre.toLowerCase().includes(q)).map((item) => ({ title: item.nombre, sub: item.tipo, caseId: item.casoId }))],
    ["Biblioteca", state.library.filter((item) => `${item.titulo} ${item.fuente}`.toLowerCase().includes(q)).map((item) => ({ title: item.titulo, sub: item.tipo, screen: "biblioteca" }))]
  ].filter(([, items]) => items.length);
  if (!groups.length) {
    box.innerHTML = empty("Sin resultados", "Prueba con otra palabra.");
    return;
  }
  box.innerHTML = `<div class="panel">${groups.map(([label, items]) => `<div class="search-cat-label">${esc(label)}</div>${items.map((item) => `<div class="search-result-row" ${item.caseId ? `data-open-case="${esc(item.caseId)}"` : `data-screen="${esc(item.screen)}"`}>
    <div><div class="search-result-title">${esc(item.title)}</div><div class="search-result-sub">${esc(item.sub || "")}</div></div>
  </div>`).join("")}`).join("")}</div>`;
}

function fillRelations() {
  fillSelect($("caso-cliente"), state.clients, "Sin cliente", (item) => item.nombre);
  fillSelect($("doc-caso"), state.cases, "Sin caso", (item) => item.nombre);
  fillSelect($("tarea-caso"), state.cases, "Caso actual o ninguno", (item) => item.nombre);
  fillSelect($("evento-caso"), state.cases, "Sin caso", (item) => item.nombre);
}

function fillSelect(select, items, placeholder, label) {
  if (!select || document.activeElement === select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${esc(placeholder)}</option>` + items.map((item) => `<option value="${esc(item.id)}">${esc(label(item))}</option>`).join("");
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function openCaseView(id) {
  caseId = id;
  tabName = "resumen";
  showScreen("caso");
  renderCase(null);
}

function renderCase(noteDraft) {
  const caso = caseById(caseId);
  if (!caso) return;
  const client = clientById(caso.clienteId);
  const estado = estadoDe(caso.estado);
  $("case-main-title").textContent = caso.nombre;
  $("case-state").textContent = estado.label;
  $("case-state").className = caso.estado === "prep" ? "state-pill-prep" : "state-pill-active";
  $("case-chips").innerHTML = [
    client?.nombre || "Sin cliente",
    caso.materia,
    caso.tribunal,
    caso.rol ? `Rol ${caso.rol}` : ""
  ].filter(Boolean).map((text) => `<span class="case-chip">${esc(text)}</span>`).join("");

  const docs = state.documents.filter((item) => item.casoId === caso.id);
  const tasks = state.tasks.filter((item) => item.casoId === caso.id);
  const events = state.events.filter((item) => item.casoId === caso.id).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  $("tab-count-docs").textContent = String(docs.length);
  $("tab-count-tareas").textContent = String(tasks.length);

  $("tab-resumen").innerHTML = `<div class="resumen-grid">
    <div class="info-block"><div class="info-block-header">Información del caso</div>
      ${info("Cliente", client?.nombre || "Sin cliente")}
      ${info("Contraparte", caso.contraparte || "—")}
      ${info("Materia", caso.materia || "—")}
      ${info("Inicio", fecha(caso.fecha))}
      ${info("Rol", caso.rol || "—")}
      ${info("Estado", estado.label)}
    </div>
    <div class="info-block"><div class="info-block-header">Ficha del cliente</div>
      ${info("Color", client ? "Asignado" : "Sin ficha")}
      ${info("Correo", client?.email || "—")}
      ${info("Teléfono", client?.telefono || "—")}
      ${info("RUT", client?.rut || "—")}
      <div class="info-row"><span class="info-key">Notas</span><span class="info-val">${esc(client?.notas || "Esta persona todavía no tiene notas.")}</span></div>
    </div>
    <div class="summary-text"><h3>Resumen</h3><p>${esc(caso.resumen || "Todavía no hay resumen. Edita el caso y escribe los hechos con tus palabras.")}</p></div>
  </div>`;

  $("tab-documentos").innerHTML = `<div class="dropzone" id="dropzone-case-inline">Arrastra un archivo de este caso</div>
    ${docs.length ? `<table class="doc-table"><thead><tr><th>Documento</th><th>Tipo</th><th>Fecha</th><th></th></tr></thead><tbody>${docs.map((item) => `<tr class="doc-row"><td><div class="doc-name">${esc(item.nombre)}</div></td><td><span class="badge ${badgeDoc(item.tipo)}">${esc(item.tipo)}</span></td><td>${esc(fecha(item.fecha))}</td><td><button class="doc-action-btn" type="button" data-delete="documents" data-id="${esc(item.id)}">Quitar</button></td></tr>`).join("")}</tbody></table>` : empty("Sin documentos en este caso", "Sube la ficha del archivo desde el botón del menú o arrastrándolo aquí.")}`;
  bindDrop($("dropzone-case-inline"));

  $("tab-cronologia").innerHTML = `<div class="section-header"><div class="section-title">Línea temporal</div><button class="btn-outline" type="button" id="btn-add-event">+ Agregar evento</button></div>
    ${events.length ? `<div class="timeline">${events.map((item) => `<div class="tl-item"><div class="tl-dot blue"></div><div class="tl-date">${esc(fecha(item.fecha))}</div><div class="tl-event">${esc(item.titulo)}</div><div class="tl-detail">${esc(item.detalle || "")}</div></div>`).join("")}</div>` : empty("Sin hitos", "Los eventos de la agenda que pertenezcan a este caso se listan aquí.")}`;

  $("tab-tareas").innerHTML = `<div class="section-header"><div class="section-title">Tareas del caso</div><button class="btn-primary" type="button" id="btn-add-task">+ Nueva tarea</button></div>
    ${tasks.length ? `<div class="task-list">${tasks.map(taskRow).join("")}</div>` : empty("Sin tareas", "Agrega lo que hay que hacer antes de la próxima fecha.")}`;

  const note = noteDraft !== null ? noteDraft : (caso.notas || "");
  $("tab-notas").innerHTML = `<div class="section-header"><div class="section-title">Notas del caso</div><button class="btn-primary" type="button" id="btn-save-note">Guardar</button></div><textarea class="nota-area" id="nota-area">${esc(note)}</textarea>`;
  if (noteDraft !== null) $("nota-area").focus();

  const fuentes = state.library.filter((item) => !caso.materia || item.materia === caso.materia || item.materia === "Otra");
  $("tab-fuentes").innerHTML = `<div class="section-header"><div class="section-title">Fuentes de esta materia</div><button class="btn-outline" type="button" data-open="modal-fuente">+ Agregar fuente</button></div>
    ${fuentes.length ? `<div class="panel">${fuentes.map((item) => `<div class="config-row"><div><div class="config-key">${esc(item.titulo)}</div><div class="config-sub">${esc(item.fuente || item.tipo)}</div></div><span>${esc(item.estado || "")}</span></div>`).join("")}</div>` : empty("Sin fuentes de esta materia", "Agrega en Biblioteca lo que uses y verifica la vigencia tú.")}`;

  $("tab-ia").innerHTML = `<div class="caso-two-col"><div>
      <div class="ai-panel"><div class="ai-panel-header"><div><h3>Asistente del caso</h3><p>${esc(caso.nombre)}</p></div></div>
        <div class="ai-sources"><div class="ai-sources-label">1 · Fuentes a considerar</div><div id="ai-sources">${docs.length ? docs.map((item) => `<label class="source-check"><input type="checkbox" data-name="${esc(item.nombre)}"> ${esc(item.nombre)}</label>`).join("") : "<p class=\"case-meta\">No hay documentos. El borrador saldrá como lista de verificación.</p>"}</div></div>
        <div class="ai-actions"><div class="ai-actions-label">2 · Formato de salida</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${AI_TOOLS.map((tool) => `<button class="ai-action-btn" type="button" data-ai-tool="${tool.id}">${esc(tool.label)}</button>`).join("")}</div></div>
      </div>
      <div id="ai-result-box" style="display:none;margin-top:16px;"></div>
    </div>
    <div class="panel"><div class="panel-header"><span class="panel-title">Cómo responde</span></div><div style="padding:14px 16px;font-size:13px;color:var(--text-mid);">Cada herramienta devuelve el mismo esquema: aviso de borrador, título, puntos numerados y fuentes marcadas. No inventa fallos ni plazos.</div></div>
  </div>`;
  switchTab(tabName);
}

function info(key, value) {
  return `<div class="info-row"><span class="info-key">${esc(key)}</span><span class="info-val">${esc(value)}</span></div>`;
}

function showCaseDraft(toolId) {
  const caso = caseById(caseId);
  if (!caso) return;
  const tool = AI_TOOLS.find((item) => item.id === toolId) || AI_TOOLS[0];
  const sources = [...document.querySelectorAll("#ai-sources input:checked")].map((input) => input.dataset.name);
  const client = clientById(caso.clienteId);
  const events = state.events.filter((item) => item.casoId === caso.id).map((item) => `${fecha(item.fecha)} · ${item.titulo}`);
  const points = {
    resumir: [
      caso.resumen || "Escribe el resumen del caso antes de pedirle forma a este borrador.",
      client ? `Cliente de la ficha: ${client.nombre}.` : "Asocia un cliente para personalizar el borrador.",
      sources.length ? "Limítate a las fuentes marcadas." : "No marcaste fuentes: no hay documento que resumir."
    ],
    comparar: sources.length < 2
      ? ["Marca al menos dos documentos para compararlos.", "Anota tú en qué coinciden y en qué no.", "Este asistente no abre los archivos."]
      : [`Compara: ${sources.join(" / ")}.`, "Anota coincidencias, diferencias y lo que no está en ambos.", "No des por cierta una diferencia que no hayas leído."],
    fechas: [
      events.length ? `Ya agendado: ${events.join("; ")}.` : "Este caso no tiene fechas en la agenda.",
      "Si el papel trae otra fecha, créala en Agenda.",
      "No calculo días hábiles ni vencimientos."
    ],
    borrador: [
      "I. Hechos que puedes probar.",
      "II. Lo que pides.",
      sources.length ? `III. Respaldo marcado: ${sources.join(", ")}.` : "III. Falta marcar documentos de respaldo.",
      "IV. Revisión tuya antes de firmar o presentar."
    ],
    contradicciones: [
      "Revisa si el resumen y los documentos marcados hablan del mismo hecho.",
      sources.length ? `Pendiente de lectura humana: ${sources.join(", ")}.` : "Sin documentos marcados no hay vacío detectable.",
      client?.notas ? `Contexto de la ficha: ${client.notas}` : "La ficha del cliente no tiene notas de contexto."
    ]
  }[tool.id];
  const box = $("ai-result-box");
  box.style.display = "block";
  box.innerHTML = `${draft({
    kicker: "Borrador · requiere tu revisión",
    tool: tool.label,
    title: caso.nombre,
    points,
    sources
  })}<div class="modal-footer"><button class="btn-primary" type="button" data-copy-draft>Copiar</button><button class="btn-outline" type="button" data-save-draft>Guardar en notas</button></div>`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function draftText() {
  return $("ai-result-box")?.innerText?.trim() || "";
}

async function copyDraft() {
  const text = draftText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast("Borrador copiado", "success");
  } catch {
    toast("No se pudo copiar", "error");
  }
}

function saveDraftToNotes() {
  const caso = caseById(caseId);
  const text = draftText();
  if (!caso || !text) return;
  const notas = `${caso.notas || ""}\n\n${text}`.trim();
  commit(() => api.update("cases", caseId, { notas }), "Borrador guardado en notas");
}

function startChat() {
  if (chatReady) return;
  chatReady = true;
  const box = $("chat-messages");
  box.innerHTML = `<div class="chat-bubble ai">${draft({
    kicker: "Asistente del estudio",
    tool: "Formato fijo",
    title: "Listo cuando cargues tu propio material",
    points: [
      "Respondo con aviso, título, puntos y fuentes.",
      "Uso los casos y documentos que ya guardaste.",
      "No cito jurisprudencia ni calculo plazos."
    ],
    sources: []
  })}</div><div class="chat-suggestions">${CHAT_SUGGESTIONS.map((text) => `<button class="btn-outline" type="button" data-suggest="${esc(text)}">${esc(text)}</button>`).join("")}</div>`;
}

function sendChat(preset) {
  const input = $("chat-input");
  const message = (preset ?? input.value).trim();
  if (!message) return;
  if (!preset) input.value = "";
  const messages = $("chat-messages");
  const user = document.createElement("div");
  user.className = "chat-bubble user";
  user.textContent = message;
  messages.appendChild(user);
  const thinking = document.createElement("div");
  thinking.className = "chat-bubble ai-thinking";
  thinking.textContent = "Preparando un borrador…";
  messages.appendChild(thinking);
  thinking.scrollIntoView({ block: "end" });
  setTimeout(() => {
    thinking.remove();
    const reply = document.createElement("div");
    reply.className = "chat-bubble ai";
    reply.innerHTML = chatDraft(message);
    messages.appendChild(reply);
    reply.scrollIntoView({ block: "end" });
  }, 1000);
}

function chatDraft(message) {
  const q = message.toLowerCase();
  const related = state.cases.filter((item) => q.includes(item.nombre.toLowerCase()) || item.nombre.toLowerCase().includes(q.slice(0, 24))).slice(0, 3);
  const docs = state.documents.filter((item) => related.some((caso) => caso.id === item.casoId)).map((item) => item.nombre);
  return draft({
    kicker: "Borrador · no es asesoría",
    tool: "Consulta",
    title: message.slice(0, 110),
    points: [
      related.length ? `Casos del estudio que coinciden: ${related.map((item) => item.nombre).join(", ")}.` : "No enlacé esta consulta a un caso guardado.",
      q.includes("audiencia") || q.includes("plazo") || q.includes("fecha")
        ? "Anota la fecha en Agenda. Aquí no se calculan plazos."
        : "Separa hechos, pedidos y documentos antes de redactar.",
      "Contrasta la norma en la fuente oficial. Este texto no la cita.",
      state.office.lawyer ? `Queda a revisión de ${state.office.lawyer}.` : "Pon tu nombre en Configuración para firmar la revisión."
    ],
    sources: docs
  });
}
