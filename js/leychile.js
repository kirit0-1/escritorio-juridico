const SEARCH = "https://servicios-leychile.bcn.cl/Consulta/obtxml";

function text(node, tag) {
  return node.querySelector(tag)?.textContent?.trim() || "";
}

function officialUrl(idNorma, raw) {
  const url = String(raw || "").trim();
  if (/^https:\/\/(www\.)?(leychile\.cl|bcn\.cl)\//i.test(url)) return url;
  if (/^\d+$/.test(idNorma)) return `https://www.bcn.cl/leychile/navegar?idNorma=${idNorma}`;
  return "";
}

export function leySearchPage(query) {
  const q = encodeURIComponent(String(query || "").trim());
  return q
    ? `https://www.bcn.cl/leychile/consulta/listaresultadosimple?cadena=${q}`
    : "https://www.bcn.cl/leychile/";
}

export function leyId(url) {
  return String(url || "").match(/idNorma=(\d+)/i)?.[1] || "";
}

export async function buscarLeyes(query) {
  const q = String(query || "").trim();
  if (q.length < 2) throw new Error("Escribe al menos dos letras");
  const response = await fetch(`${SEARCH}?opt=61&cadena=${encodeURIComponent(q)}`);
  if (!response.ok) throw new Error("Ley Chile no respondió");
  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Ley Chile envió una respuesta ilegible");
  const items = [...doc.querySelectorAll("Norma")].map((node) => {
    const idNorma = text(node, "IdNorma");
    return {
      idNorma,
      titulo: text(node, "TituloNorma"),
      numero: text(node, "Compuesto"),
      tipo: text(node, "Descripcion"),
      fecha: text(node, "FechaPublicacion"),
      url: officialUrl(idNorma, text(node, "Url"))
    };
  }).filter((item) => item.titulo && item.url);
  const total = Number(doc.querySelector("Normas")?.getAttribute("total") || items.length);
  return { total, items };
}
