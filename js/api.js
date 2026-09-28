async function request(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo guardar");
  }
  return response.json();
}

export const api = {
  getState: () => request("/api/state"),
  saveOffice: (office) => request("/api/office", { method: "PUT", body: JSON.stringify(office) }),
  create: (list, body) => request(`/api/${list}`, { method: "POST", body: JSON.stringify(body) }),
  update: (list, id, body) => request(`/api/${list}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (list, id) => request(`/api/${list}/${id}`, { method: "DELETE" })
};
