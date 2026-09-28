import { draft, fecha } from "./format.js";

const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";
const FECHA = new RegExp(String.raw`\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{1,2}\s+de\s+(?:${MESES})\s+de\s+\d{4}\b`, "gi");

function norm(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sentences(text) {
  return String(text || "").split(/(?<=[.!?;])\s+|\n+/).map((item) => item.trim()).filter((item) => item.length > 30);
}

function datesIn(text) {
  return [...new Set(String(text || "").match(FECHA) || [])].slice(0, 8);
}

function material(docs) {
  return docs.map((item) => item.texto).filter(Boolean).join("\n");
}

function clip(text, max = 280) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function caseAnswer({ tool, caso, client, docs, events, selected }) {
  const chosen = docs.filter((item) => selected.includes(item.nombre));
  if (!chosen.length) {
    return draft({
      kicker: "Borrador · requiere tu revisión",
      tool: tool.label,
      title: caso.nombre,
      points: [
        "Marca al menos un documento.",
        "Si el archivo no está, súbelo en la pestaña Documentos y pulsa Ver para comprobarlo.",
        "Luego vuelve a usar esta herramienta."
      ],
      sources: []
    });
  }
  const readable = chosen.filter((item) => item.texto);
  const unread = chosen.filter((item) => item.data && !item.texto).map((item) => item.nombre);
  const text = material(readable);
  const clientLine = client ? `Cliente: ${client.nombre}.` : "Este caso no tiene cliente en la ficha.";
  let points = [];

  if (tool.id === "comparar") {
    points = comparePoints(readable, unread);
  } else if (tool.id === "fechas") {
    points = datePoints(text || `${caso.resumen || ""} ${caso.notas || ""}`, events, unread);
  } else if (tool.id === "borrador") {
    const hechos = readable.length ? sentences(text).slice(0, 2).map((line) => clip(line)) : [clip(caso.resumen) || "Falta el resumen del caso o un PDF con texto."];
    points = [
      `Hechos: ${hechos.join(" ")}`,
      caso.detalle ? `Pedido anotado: ${clip(caso.detalle)}` : "Falta anotar qué se pide. Escríbelo al editar el caso.",
      chosen.length ? `Documentos: ${chosen.map((item) => item.nombre).join(", ")}.` : "No hay documentos marcados.",
      "Revisa el texto antes de usarlo. No agregué normas ni plazos."
    ];
  } else if (tool.id === "contradicciones") {
    points = tensionPoints(readable, caso, unread);
  } else {
    const bits = readable.length ? sentences(text).slice(0, 3).map((line) => clip(line)) : [];
    points = [
      bits.length ? `En el documento: ${bits.join(" ")}` : (clip(caso.resumen) || "No hay texto leíble en los documentos marcados."),
      clientLine,
      unread.length ? `Puedes abrirlos, pero no tienen texto para citar: ${unread.join(", ")}.` : "Cita solo lo que acabas de leer arriba."
    ];
  }

  return draft({
    kicker: "Borrador · requiere tu revisión",
    tool: tool.label,
    title: caso.nombre,
    points,
    sources: chosen.map((item) => item.nombre)
  });
}

function comparePoints(readable, unread) {
  if (readable.length < 2) {
    return [
      "Marca dos documentos que tengan texto, por ejemplo dos PDF.",
      unread.length ? `Estos se abren con Ver, pero no pude leer su texto: ${unread.join(", ")}.` : "Si el PDF es un escaneo, el asistente no puede leerlo.",
      "La comparación sale de las frases, no de una norma."
    ];
  }
  const [first, second] = readable;
  const only = (from, against) => sentences(from.texto).filter((line) => !norm(against.texto).includes(norm(line).slice(0, 80))).slice(0, 2);
  const left = only(first, second).map((line) => clip(line));
  const right = only(second, first).map((line) => clip(line));
  return [
    left.length ? `Solo en ${first.nombre}: ${left.join(" ")}` : `${first.nombre} no tiene frases distintas a las del otro.`,
    right.length ? `Solo en ${second.nombre}: ${right.join(" ")}` : `${second.nombre} no tiene frases distintas a las del otro.`,
    "Confirma la diferencia abriendo los dos archivos."
  ];
}

function datePoints(text, events, unread) {
  const found = datesIn(text);
  const agenda = events.map((item) => `${fecha(item.fecha)} · ${item.titulo}`);
  return [
    found.length ? `Fechas escritas en el material: ${found.join(", ")}.` : "No encontré fechas escritas en el texto.",
    agenda.length ? `Ya está en la agenda: ${agenda.join("; ")}.` : "Este caso todavía no tiene fechas en la agenda.",
    unread.length ? `No leí texto en: ${unread.join(", ")}.` : "No calculo días hábiles ni vencimientos. Si falta una fecha, anótala en Agenda."
  ];
}

function tensionPoints(readable, caso, unread) {
  if (readable.length < 2) {
    return [
      caso.resumen ? `Resumen del caso: ${clip(caso.resumen)}` : "Escribe el resumen para tener un hecho contra el cual contrastar.",
      readable.length ? `Texto disponible: ${clip(sentences(readable[0].texto)[0] || readable[0].texto)}` : "Sube al menos dos archivos con texto para buscar diferencias.",
      unread.length ? `Sin texto leíble: ${unread.join(", ")}.` : "Una diferencia solo cuenta si la ves en los dos archivos."
    ];
  }
  const lists = readable.map((item) => ({ name: item.nombre, dates: datesIn(item.texto) }));
  const notes = lists.filter((item) => item.dates.length).map((item) => `${item.name}: ${item.dates.join(", ")}`);
  return [
    notes.length ? `Fechas por archivo: ${notes.join(" · ")}.` : "Los archivos no traen fechas distintas que pueda señalar.",
    `Frase de ${readable[0].nombre}: ${clip(sentences(readable[0].texto)[0] || readable[0].texto)}`,
    `Frase de ${readable[1].nombre}: ${clip(sentences(readable[1].texto)[0] || readable[1].texto)}`
  ];
}

export function chatAnswer(message, state) {
  const q = norm(message);
  if (q.includes("borrador")) return overview(state);
  if (q.includes("audiencia") || q.includes("revisar")) return pending(state);
  if (q.includes("fecha") || q.includes("agenda") || q.includes("plazo")) return upcoming(state);
  return ask(message, state);
}

function overview(state) {
  const cases = state.cases.slice(0, 4);
  if (!cases.length) {
    return draft({
      kicker: "Borrador · no es asesoría",
      tool: "Consulta",
      title: "Todavía no hay material",
      points: ["Crea un caso.", "Sube el PDF o el texto del escrito.", "Vuelve a pedir el borrador cuando el documento tenga el botón Ver."],
      sources: []
    });
  }
  return draft({
    kicker: "Borrador · no es asesoría",
    tool: "Esquema",
    title: "Con lo que ya está cargado",
    points: cases.map((caso) => {
      const docs = state.documents.filter((item) => item.casoId === caso.id);
      const bit = clip(caso.resumen) || clip(docs.find((item) => item.texto)?.texto) || "sin resumen todavía";
      const names = docs.map((item) => item.nombre).join(", ") || "sin documentos";
      return `${caso.nombre}: ${bit} Documentos: ${names}.`;
    }).concat("Arma el escrito con esos hechos. No completé normas ni plazos."),
    sources: state.documents.map((item) => item.nombre).slice(0, 6)
  });
}

function pending(state) {
  const tasks = state.tasks.filter((item) => !item.done);
  const events = [...state.events].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).slice(0, 4);
  const points = [];
  points.push(tasks.length ? `Tareas abiertas: ${tasks.map((item) => item.nombre).join(", ")}.` : "No hay tareas abiertas.");
  points.push(events.length ? `Fechas anotadas: ${events.map((item) => `${fecha(item.fecha)} · ${item.titulo}`).join("; ")}.` : "No hay fechas en la agenda.");
  points.push(state.documents.length ? "Abre cada documento con Ver y confirma que sea el escrito de la audiencia." : "Falta subir el escrito de la audiencia.");
  return draft({
    kicker: "Borrador · no es asesoría",
    tool: "Antes de la audiencia",
    title: "Lo que falta mirar",
    points,
    sources: state.documents.map((item) => item.nombre).slice(0, 6)
  });
}

function upcoming(state) {
  const pool = [
    ...state.documents.map((item) => item.texto),
    ...state.cases.map((item) => `${item.resumen || ""} ${item.notas || ""}`)
  ].join("\n");
  const found = datesIn(pool);
  const agenda = state.events.map((item) => `${fecha(item.fecha)} · ${item.titulo}`);
  return draft({
    kicker: "Borrador · no es asesoría",
    tool: "Fechas",
    title: "Fechas que ya están escritas",
    points: [
      found.length ? `En los documentos y notas: ${found.join(", ")}.` : "No encontré fechas en los documentos ni en las notas.",
      agenda.length ? `En la agenda: ${agenda.join("; ")}.` : "La agenda está vacía. Copia ahí la fecha que viste en el documento.",
      "No calculo plazos ni días hábiles."
    ],
    sources: state.documents.filter((item) => item.texto).map((item) => item.nombre).slice(0, 6)
  });
}

function ask(message, state) {
  const words = norm(message).split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !["para", "como", "este", "esta", "cuando", "donde", "sobre", "desde", "hasta", "tiene", "tienen", "puede", "puedo"].includes(word));
  const ranked = state.cases.map((caso) => ({ caso, score: scoreOf(caso, words, state) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const best = ranked[0]?.caso;
  const docs = state.documents.filter((item) => !best || item.casoId === best.id);
  const quotes = docs.flatMap((item) => sentences(item.texto).filter((line) => words.some((word) => norm(line).includes(word))).slice(0, 2).map((line) => `${item.nombre}: ${clip(line)}`)).slice(0, 3);
  const points = [];
  points.push(best ? `Caso relacionado: ${best.nombre}.` : (state.cases.length ? `No enlacé la pregunta a un caso. Hay: ${state.cases.map((item) => item.nombre).join(", ")}.` : "Todavía no hay casos."));
  points.push(quotes.length ? quotes.join(" ") : "No encontré esas palabras en el texto de los documentos. Ábrelos con Ver si el PDF es un escaneo.");
  points.push("La respuesta sale de lo que ya subiste. No cita fallos ni calcula plazos.");
  return draft({
    kicker: "Borrador · no es asesoría",
    tool: "Consulta",
    title: message.slice(0, 110),
    points,
    sources: docs.map((item) => item.nombre).slice(0, 6)
  });
}

function scoreOf(caso, words, state) {
  if (!words.length) return 0;
  const client = state.clients.find((item) => item.id === caso.clienteId);
  const docs = state.documents.filter((item) => item.casoId === caso.id);
  const hay = norm([caso.nombre, caso.materia, caso.resumen, caso.notas, caso.detalle, client?.nombre, ...docs.map((item) => `${item.nombre} ${item.texto} ${item.descripcion}`)].join(" "));
  return words.filter((word) => hay.includes(word)).length;
}
