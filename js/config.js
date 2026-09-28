export const MATERIAS = ["Laboral", "Civil", "Familia", "Contractual", "Administrativo", "Penal", "Otra"];

export const ESTADOS = [
  { id: "prep", label: "En preparación", badge: "badge-prep" },
  { id: "activo", label: "En curso", badge: "badge-active" },
  { id: "urgente", label: "Urgente", badge: "badge-urgent" },
  { id: "cerrado", label: "Cerrado", badge: "badge-closed" }
];

export const DOC_TIPOS = ["Demanda", "Contrato", "Carta", "Liquidación", "Certificado", "Resolución", "Otro"];
export const LIB_TIPOS = ["Ley", "Jurisprudencia", "Modelo", "Doctrina"];
export const CLIENT_COLORS = ["#1a4fa0", "#1a7a52", "#C4922A", "#9d174d", "#6d28d9", "#0f766e"];

export const PRIORIDADES = [
  { id: "alta", label: "URGENTE", cls: "priority-high" },
  { id: "media", label: "MEDIA", cls: "priority-med" },
  { id: "baja", label: "BAJA", cls: "priority-low" }
];

export const EVENT_TIPOS = [
  { id: "audiencia", label: "Audiencia" },
  { id: "plazo", label: "Plazo" },
  { id: "reunion", label: "Reunión" },
  { id: "hito", label: "Hito" }
];

export const AI_TOOLS = [
  { id: "resumir", label: "Resumir" },
  { id: "comparar", label: "Comparar" },
  { id: "fechas", label: "Extraer fechas" },
  { id: "borrador", label: "Crear borrador" },
  { id: "contradicciones", label: "Detectar vacíos" }
];

export const CHAT_SUGGESTIONS = [
  "Arma un esquema de borrador con lo que ya tengo cargado",
  "Qué me falta revisar antes de una audiencia",
  "Qué fechas debería anotar en la agenda"
];
