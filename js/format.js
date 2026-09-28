import { ESTADOS, PRIORIDADES } from "./config.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export function estadoDe(id) {
  return ESTADOS.find((item) => item.id === id) || ESTADOS[0];
}

export function prioridadDe(id) {
  return PRIORIDADES.find((item) => item.id === id) || PRIORIDADES[1];
}

const fechaLarga = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fechaCorta = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });

export function hoyTexto() {
  const texto = fechaLarga.format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function fecha(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : fechaCorta.format(date);
}

export function hace(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

export function saludo(lawyer) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const name = String(lawyer || "").trim().split(/\s+/)[0];
  return name ? `${hello}, ${name}` : hello;
}

export function iniciales(lawyer, studio) {
  const source = (lawyer || studio || "Escritorio Jurídico").trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "EJ";
}

export function dentroDeDias(value, days) {
  if (!value) return false;
  const date = new Date(`${value}T12:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return date >= start && date <= end;
}

export function empty(title, sub) {
  return `<div class="empty-state"><p class="empty-title">${esc(title)}</p><p class="empty-sub">${esc(sub)}</p></div>`;
}

export function draft({ kicker, tool, title, points, sources }) {
  const lista = points.map((point) => `<li>${esc(point)}</li>`).join("");
  const fuentes = sources?.length ? sources.map(esc).join(" · ") : "Ninguna fuente marcada";
  return `<article class="ai-draft">
    <div class="ai-draft-kicker"><span>${esc(kicker)}</span><span>${esc(tool)}</span></div>
    <div class="ai-draft-body"><h4>${esc(title)}</h4><ol>${lista}</ol></div>
    <div class="ai-draft-foot">Fuentes: ${fuentes}. Borrador de trabajo: contrasta cada punto en la fuente oficial antes de usarlo.</div>
  </article>`;
}
