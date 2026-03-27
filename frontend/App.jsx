import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { jsPDF } from "jspdf";
import Logo from "./assets/trackseamlogo.jpeg"

// CONFIG 
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";

// AUTH CONTEXT
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

// HELPERS
const generateId = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// OUTFIT FIELDS
const OUTFIT_FIELDS = {
  Shirt:   ["Chest", "Waist", "Shoulder", "Sleeve Length", "Back Length", "Neck"],
  Trouser: ["Waist", "Hip", "Thigh", "Inseam", "Outseam", "Knee", "Bottom"],
  Dress:   ["Bust", "Waist", "Hip", "Shoulder", "Sleeve Length", "Dress Length", "Back"],
  Suit:    ["Chest", "Waist", "Hip", "Shoulder", "Sleeve Length", "Jacket Length", "Trouser Waist", "Inseam"],
  Skirt:   ["Waist", "Hip", "Skirt Length", "Hem"],
  Agbada:  ["Chest", "Waist", "Shoulder", "Sleeve Length", "Gown Length", "Trouser Waist", "Inseam"],
  Kaftan:  ["Chest", "Waist", "Shoulder", "Sleeve Length", "Kaftan Length"],
  Custom:  [],
};

// API
const getToken = () => localStorage.getItem("tb_token");

const apiFetch = (path, options = {}) => {
  const token = getToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  });
};

const api = {
  // AUTH
  register:   (body) => apiFetch("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login:      (body) => apiFetch("/auth/login",    { method: "POST", body: JSON.stringify(body) }),
  me:         ()     => apiFetch("/auth/me"),

  // CLIENTS
  getClients:    ()  => apiFetch("/clients"),
  searchClients: (q) => apiFetch(`/clients/search?q=${encodeURIComponent(q)}`),
  createClient:  (d) => apiFetch("/clients", { method: "POST", body: JSON.stringify(d) }),
  deleteClient:  (id)=> apiFetch(`/clients/${id}`, { method: "DELETE" }),

  // MEASUREMENTS
  getMeasurements:    (cid)        => apiFetch(`/clients/${cid}/measurements`),
  addMeasurement:     (cid, d)     => apiFetch(`/clients/${cid}/measurements`, { method: "POST", body: JSON.stringify(d) }),
  deleteMeasurement:  (cid, mid)   => apiFetch(`/clients/${cid}/measurements/${mid}`, { method: "DELETE" }),
};

// PDF EXPORT
const exportMeasurement = (client, measurement, shopName) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const ML = 20, MR = 20, MT = 20;
  const CW = W - ML - MR;

  const INK       = [26,  25,  22];
  const MUTED     = [112, 108, 100];
  const FAINT     = [160, 156, 148];
  const RULE      = [226, 224, 220];
  const ACCENT_BG = [245, 244, 242];

  const setInk   = () => doc.setTextColor(...INK);
  const setMuted = () => doc.setTextColor(...MUTED);
  const setFaint = () => doc.setTextColor(...FAINT);

  // TRACKSEAM (app branding)
  const drawWatermark = () => {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.07 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(52);
    doc.setTextColor(...INK);
    doc.text("Trackseam", W / 2, H / 2 + 10, { align: "center", angle: 38 });
    doc.text("Trackseam", W / 2, H / 2 - 42, { align: "center", angle: 38 });
    doc.restoreGraphicsState();
  };

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setInk();
    doc.text(shopName || "Trackseam", ML, 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setMuted();
    doc.text("Client Measurement Record · Trackseam", W - MR, 13, { align: "right" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(ML, 16, W - MR, 16);
  };

  const drawFooter = () => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(ML, H - 12, W - MR, H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setFaint();
    doc.text("All measurements in centimetres (cm)", ML, H - 8);
    doc.text(`Exported: ${new Date().toLocaleString()}`, W - MR, H - 8, { align: "right" });
  };

  drawWatermark();
  drawHeader();
  drawFooter();

  let y = MT + 8;

  // TITLE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setInk();
  doc.text("Measurement Record", ML, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setMuted();
  doc.text(`Prepared by ${shopName || "Trackseam"}`, ML, y);
  y += 5;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.line(ML, y, W - MR, y);
  y += 8;

  // CLIENT INFO BLOCK
  const infoRows = [
    ["Client Name", client.name],
    ["Client ID",   client.clientId],
    ["Phone",       client.phone  || "N/A"],
    ["Email",       client.email  || "N/A"],
    ["Tailor Shop", shopName      || "N/A"],
  ];
  const blockH = infoRows.length * 8 + 6;
  doc.setFillColor(...ACCENT_BG);
  doc.rect(ML, y, CW, blockH, "F");

  let iy = y + 7;
  infoRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setMuted();
    doc.text(label, ML + 5, iy);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setInk();
    doc.text(String(value), ML + 46, iy);
    iy += 8;
  });
  y += blockH + 8;

  // OUTFIT & DESCRIPTION
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setInk();
  doc.text(measurement.outfitType, ML, y);
  y += 5;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
  y += 6;

  const metaRows = [
    ["Description", measurement.description || "N/A"],
    ["Date Taken",  formatDate(measurement.createdAt)],
    ["Notes",       measurement.notes || "None"],
  ];
  metaRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setMuted();
    doc.text(label, ML, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setInk();
    const lines = doc.splitTextToSize(String(value), CW - 40);
    doc.text(lines, ML + 38, y);
    y += lines.length > 1 ? lines.length * 5 + 2 : 7;
  });
  y += 4;

  // MEASUREMENT TABLE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setInk();
  doc.text("Measurements", ML, y);
  y += 5;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
  y += 2;

  // Table header row
  doc.setFillColor(...ACCENT_BG);
  doc.rect(ML, y, CW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setMuted();
  doc.text("Measurement",  ML + 5,     y + 5.5);
  doc.text("Value (cm)",   W - MR - 5, y + 5.5, { align: "right" });
  y += 8;

  const fields = Object.entries(measurement.fields || {});
  fields.forEach(([key, val], i) => {
    const rowBg = i % 2 === 0 ? [255, 255, 255] : [...ACCENT_BG];
    doc.setFillColor(...rowBg);
    doc.rect(ML, y, CW, 9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setInk();
    doc.text(key, ML + 5, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`${val} cm`, W - MR - 5, y + 6, { align: "right" });

    if (i < fields.length - 1) {
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.2);
      doc.line(ML, y + 9, W - MR, y + 9);
    }
    y += 9;
  });

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);

  const safeName = `${client.name.replace(/\s+/g, "_")}_${measurement.outfitType}_${measurement._id || generateId()}.pdf`;
  doc.save(safeName);
};

// SHARED UI COMPONENTS

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
      <div className="spinner" />
    </div>
  );
}

function Toast({ msg, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className="toast">{msg}</div>;
}

function Modal({ title, onClose, children }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// AUTH SCREENS

function AuthPage({ onAuth }) {
  const [mode, setMode]       = useState("login");
  const [form, setForm]       = useState({ shopName: "", email: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!form.email || !form.password) return setError("Email and password are required.");
    if (mode === "register" && !form.shopName.trim()) return setError("Shop / brand name is required.");

    setLoading(true);
    try {
      const data = mode === "register"
        ? await api.register({ shopName: form.shopName, email: form.email, password: form.password })
        : await api.login({ email: form.email, password: form.password });

      localStorage.setItem("tb_token", data.token);
      onAuth(data.tailor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => e.key === "Enter" && handleSubmit();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="auth-logo" src={Logo} alt="Trackseam Logo" />
          <span className="brand-name">Trackseam</span>
          <p className="auth-tagline">
                  {mode === "login" ? "Sign in to your shop account" : "Create your tailor shop account"}
          </p>
</div>

        <div className="form-grid">
          {mode === "register" && (
            <>
              <label>Shop / Brand Name *</label>
              <input
                className="input"
                placeholder="e.g. Ade's Bespoke Studio"
                value={form.shopName}
                onChange={set("shopName")}
                onKeyDown={handleKeyDown}
              />
            </>
          )}
          <label>Email Address *</label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            onKeyDown={handleKeyDown}
          />
          <label>Password *</label>
          <input
            className="input"
            type="password"
            placeholder={mode === "register" ? "Min. 6 characters" : "Your password"}
            value={form.password}
            onChange={set("password")}
            onKeyDown={handleKeyDown}
          />

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>

        <p className="auth-switch">
          {mode === "login" ? (
            <>No account? <button className="link-btn" onClick={() => { setMode("register"); setError(""); }}>Register your shop</button></>
          ) : (
            <>Already registered? <button className="link-btn" onClick={() => { setMode("login"); setError(""); }}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── ADD CLIENT FORM ─────────────────────────────────────────────────────────

function AddClientForm({ onSave, onClose }) {
  const [form, setForm]       = useState({ name: "", phone: "", email: "", notes: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError("Client name is required.");
    setError("");
    setLoading(true);
    try {
      const clientId = generateId();
      const res = await api.createClient({ ...form, clientId });
      onSave(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-grid">
      <label>Full Name *</label>
      <input className="input" placeholder="e.g. Amara Okonkwo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label>Phone Number</label>
      <input className="input" placeholder="e.g. +234 801 234 5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <label>Email</label>
      <input className="input" placeholder="e.g. amara@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <label>Notes</label>
      <textarea className="input textarea" placeholder="Fitting notes, preferences..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      {error && <p className="auth-error">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : "Save Client"}
        </button>
      </div>
    </div>
  );
}

// ADD MEASUREMENT FORM

function AddMeasurementForm({ client, onSave, onClose }) {
  const [outfitType,   setOutfitType]   = useState("Shirt");
  const [description,  setDescription]  = useState("");
  const [notes,        setNotes]        = useState("");
  const [fields,       setFields]       = useState({});
  const [customField,  setCustomField]  = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);

  const currentFields = outfitType === "Custom"
    ? Object.keys(fields)
    : OUTFIT_FIELDS[outfitType] || [];

  const handleOutfitChange = (type) => { setOutfitType(type); setFields({}); };

  const addCustomField = () => {
    if (!customField.trim()) return;
    setFields({ ...fields, [customField.trim()]: "" });
    setCustomField("");
  };

  const handleSubmit = async () => {
    if (!description.trim()) return setError("Description is required.");
    const missing = currentFields.filter((f) => !fields[f]);
    if (missing.length && !window.confirm(`Some fields are empty (${missing.join(", ")}). Continue?`)) return;

    setError("");
    setLoading(true);
    try {
      const res = await api.addMeasurement(client._id, { outfitType, description, notes, fields });
      onSave(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-grid">
      <label>Outfit Type</label>
      <div className="tag-grid">
        {Object.keys(OUTFIT_FIELDS).map((t) => (
          <button key={t} className={`tag ${outfitType === t ? "tag-active" : ""}`} onClick={() => handleOutfitChange(t)}>{t}</button>
        ))}
      </div>

      <label>Description *</label>
      <input className="input" placeholder="e.g. Wedding suit for December" value={description} onChange={(e) => setDescription(e.target.value)} />

      <label>Measurements (cm)</label>
      <div className="meas-grid">
        {currentFields.map((f) => (
          <div key={f} className="meas-item">
            <span className="meas-label">{f}</span>
            <input
              className="input meas-input"
              type="number"
              min="0"
              placeholder="0"
              value={fields[f] || ""}
              onChange={(e) => setFields({ ...fields, [f]: e.target.value })}
            />
            <span className="meas-unit">cm</span>
          </div>
        ))}
        {outfitType === "Custom" && (
          <div className="meas-item custom-add">
            <input className="input" placeholder="Field name" value={customField} onChange={(e) => setCustomField(e.target.value)} />
            <button className="btn btn-ghost btn-sm" onClick={addCustomField}>+ Add</button>
          </div>
        )}
      </div>

      <label>Additional Notes</label>
      <textarea className="input textarea" placeholder="Fabric type, special requests..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 56 }} />

      {error && <p className="auth-error">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : "Save Measurement"}
        </button>
      </div>
    </div>
  );
}

// CLIENT DETAIL

function ClientDetail({ client, onBack, onToast }) {
  const { tailor }                      = useAuth();
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showAdd, setShowAdd]           = useState(false);
  const [expanded, setExpanded]         = useState(null);

  useEffect(() => {
    api.getMeasurements(client._id).then((data) => {
      setMeasurements(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [client._id]);

  const handleAdd = (m) => {
    setMeasurements((prev) => [m, ...prev]);
    setShowAdd(false);
    onToast("Measurement saved.");
  };

  const handleDelete = async (measId) => {
    if (!window.confirm("Delete this measurement?")) return;
    await api.deleteMeasurement(client._id, measId);
    setMeasurements((prev) => prev.filter((m) => m._id !== measId));
    onToast("Measurement deleted.");
  };

  return (
    <>
      {showAdd && (
        <Modal title="New Measurement" onClose={() => setShowAdd(false)}>
          <AddMeasurementForm client={client} onSave={handleAdd} onClose={() => setShowAdd(false)} />
        </Modal>
      )}

      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>← Clients</button>
        <div>
          <h2 className="client-name-heading">{client.name}</h2>
          <div className="client-meta-row">
            <span className="badge">ID: {client.clientId}</span>
            {client.phone && <span className="client-meta">{client.phone}</span>}
            {client.email && <span className="client-meta">{client.email}</span>}
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setShowAdd(true)}>
          + Measurement
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : measurements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📐</div>
          <p>No measurements recorded yet.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add First Measurement</button>
        </div>
      ) : (
        <div className="meas-list">
          {measurements.map((m) => (
            <div key={m._id} className="meas-card">
              <div className="meas-card-header" onClick={() => setExpanded(expanded === m._id ? null : m._id)}>
                <div>
                  <span className="outfit-badge">{m.outfitType}</span>
                  <span className="meas-desc">{m.description}</span>
                </div>
                <div className="meas-card-actions">
                  <span className="meas-date">{formatDate(m.createdAt)}</span>
                  <button
                    className="icon-btn action-btn"
                    title="Export PDF"
                    onClick={(e) => { e.stopPropagation(); exportMeasurement(client, m, tailor?.shopName); }}
                  >↓ PDF</button>
                  <button
                    className="icon-btn action-btn danger"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(m._id); }}
                  >✕</button>
                  <span className="chevron">{expanded === m._id ? "▲" : "▼"}</span>
                </div>
              </div>
              {expanded === m._id && (
                <div className="meas-card-body">
                  <div className="meas-fields-grid">
                    {Object.entries(m.fields || {}).map(([k, v]) => (
                      <div key={k} className="meas-field-row">
                        <span className="field-key">{k}</span>
                        <span className="field-val">{v} cm</span>
                      </div>
                    ))}
                  </div>
                  {m.notes && <p className="meas-notes">Notes: {m.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// CLIENT LIST

function ClientList({ onSelect, onToast }) {
  const [clients, setClients] = useState([]);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = search.trim() ? await api.searchClients(search) : await api.getClients();
      setClients(Array.isArray(data) ? data : []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchClients, 300);
    return () => clearTimeout(t);
  }, [fetchClients]);

  const handleAdd = (c) => {
    setClients((prev) => [c, ...prev]);
    setShowAdd(false);
    onToast(`Client "${c.name}" added — ID: ${c.clientId}`);
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${name} and all their measurements?`)) return;
    await api.deleteClient(id);
    setClients((prev) => prev.filter((c) => c._id !== id));
    onToast("Client deleted.");
  };

  return (
    <>
      {showAdd && (
        <Modal title="Register New Client" onClose={() => setShowAdd(false)}>
          <AddClientForm onSave={handleAdd} onClose={() => setShowAdd(false)} />
        </Modal>
      )}

      <div className="list-toolbar">
        <input
          className="input search-input"
          placeholder="Search client by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Client</button>
      </div>

      {loading ? (
        <Spinner />
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧵</div>
          <p>{search ? "No clients found." : "No clients yet. Add your first client."}</p>
        </div>
      ) : (
        <div className="client-table">
          <div className="table-header">
            <span>Client</span>
            <span>ID</span>
            <span>Phone</span>
            <span>Registered</span>
            <span></span>
          </div>
          {clients.map((c) => (
            <div key={c._id} className="table-row" onClick={() => onSelect(c)}>
              <span className="client-name-cell">{c.name}</span>
              <span className="mono">{c.clientId}</span>
              <span>{c.phone || "—"}</span>
              <span>{formatDate(c.createdAt)}</span>
              <span>
                <button className="icon-btn danger" title="Delete client" onClick={(e) => handleDelete(e, c._id, c.name)}>✕</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// APP ROOT

export default function App() {
  const [tailor,         setTailor]         = useState(null);
  const [authChecked,    setAuthChecked]     = useState(false);
  const [view,           setView]           = useState("clients");
  const [selectedClient, setSelectedClient] = useState(null);
  const [toast,          setToast]          = useState(null);

  // ON MOUNT: CHECK AUTH
  useEffect(() => {
    const token = localStorage.getItem("tb_token");
    if (!token) { setAuthChecked(true); return; }

    api.me()
      .then((data) => setTailor(data.tailor))
      .catch(() => localStorage.removeItem("tb_token"))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleAuth  = (t)  => setTailor(t);
  const handleLogout = ()  => {
    localStorage.removeItem("tb_token");
    setTailor(null);
    setView("clients");
    setSelectedClient(null);
  };

  const showToast   = useCallback((msg) => setToast(msg), []);
  const selectClient = (c) => { setSelectedClient(c); setView("detail"); };

  if (!authChecked) return (
    <>
      <style>{CSS}</style>
      <div className="app"><Spinner /></div>
    </>
  );

  if (!tailor) return (
    <>
      <style>{CSS}</style>
      <AuthPage onAuth={handleAuth} />
    </>
  );

  return (
    <AuthContext.Provider value={{ tailor }}>
      <style>{CSS}</style>
      <div className="app">
        <header className="header">
          <div className="header-inner">
            <div className="brand">
              <span className="brand-mark">✦</span>
              <span className="brand-name">Trackseam</span>
            </div>
            <div className="header-shop">
              <span className="header-shop-name">{tailor.shopName}</span>
              <span className="header-tagline">Client Measurement Records</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Sign out">Sign out</button>
          </div>
        </header>

        <main className="main">
          <div className="container">
            {view === "clients" ? (
              <>
                <div className="page-title-row">
                  <h1 className="page-title">Clients</h1>
                </div>
                <ClientList onSelect={selectClient} onToast={showToast} />
              </>
            ) : (
              <ClientDetail
                client={selectedClient}
                onBack={() => setView("clients")}
                onToast={showToast}
              />
            )}
          </div>
        </main>

        {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      </div>
    </AuthContext.Provider>
  );
}

// STYLES
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           #FAFAF8;
    --surface:      #FFFFFF;
    --border:       #E2E0DC;
    --border-strong:#C8C4BC;
    --text:         #1A1916;
    --text-muted:   #706C64;
    --text-faint:   #A09C94;
    --accent:       #1A1916;
    --accent-fg:    #FAFAF8;
    --danger:       #8B1A1A;
    --danger-light: #FDF0F0;
    --mono:         'DM Mono', monospace;
    --serif:        'EB Garamond', Georgia, serif;
    --radius:       2px;
    --shadow:       0 1px 3px rgba(0,0,0,0.08);
    --shadow-lg:    0 4px 16px rgba(0,0,0,0.10);
  }

  body { background: var(--bg); color: var(--text); font-family: var(--serif); font-size: 16px; line-height: 1.6; }
  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── AUTH ── */
  .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--bg); }
  .auth-card { width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 36px 32px; box-shadow: var(--shadow-lg); }
    .auth-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }
  .auth-logo {
    width: 100px;
    height: 60px;
    // margin-bottom: -145px;
    // margin-top: -80px;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
  .auth-logo:hover {
    transform: scale(1.05);
    opacity: 0.85;
  }
    .auth-brand .brand-name {
    font-family: var(--serif);
    font-size: 26px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text);
    line-height: 1;
  }

  .auth-tagline { font-family: var(--mono); font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 28px; margin: auto;}
  .auth-error { font-family: var(--mono); font-size: 12px; color: var(--danger); background: var(--danger-light); padding: 8px 12px; border-radius: var(--radius); }
  .auth-switch { margin-top: 20px; font-size: 14px; color: var(--text-muted); text-align: center; }
  .link-btn { background: none; border: none; cursor: pointer; font-family: var(--serif); font-size: 14px; color: var(--text); text-decoration: underline; padding: 0; }


  /* ── HEADER ── */
  .header { background: var(--text); color: var(--accent-fg); border-bottom: 2px solid var(--text); }
.header-inner { 
  max-width: 960px; 
  margin: 0 auto; 
  padding: 12px 24px; 
  display: grid; 
  grid-template-columns: 1fr auto; 
  grid-template-rows: auto auto; 
  align-items: center; 
  gap: 0 16px; 
}
.brand { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  grid-column: 1; 
  grid-row: 1; 
}
  .brand-mark { font-size: 18px; opacity: 0.7; }
  .brand-name { font-family: var(--serif); font-size: 22px; font-weight: 600; letter-spacing: 0.02em; }
  .header-shop { 
  display: flex; 
  flex-direction: row; 
  align-items: center; 
  gap: 8px; 
  grid-column: 1; 
  grid-row: 2; 
  padding-left: 28px; 
}
.header-shop-name { 
  font-family: var(--serif); 
  font-size: 13px; 
  font-weight: 500; 
  opacity: 0.75; 
}
.header-tagline { 
  font-family: var(--mono); 
  font-size: 10px; 
  letter-spacing: 0.08em; 
  text-transform: uppercase; 
  opacity: 0.4; 
}
  .header-shop-name { font-family: var(--serif); font-size: 15px; font-weight: 500; opacity: 0.9; }
  .header-tagline { font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.4; }
  .logout-btn { 
  grid-column: 2; 
  grid-row: 1; 
  background: none; 
  border: 1px solid rgba(250,250,248,0.25); 
  color: var(--accent-fg); 
  padding: 6px 14px; 
  border-radius: var(--radius); 
  font-family: var(--mono); 
  font-size: 11px; 
  letter-spacing: 0.06em; 
  text-transform: uppercase; 
  cursor: pointer; 
  opacity: 0.7; 
  transition: opacity 0.15s; 
  align-self: center;
}
  .logout-btn:hover { opacity: 1; }

  /* ── MAIN ── */
  .main { flex: 1; padding: 36px 24px; }
  .container { max-width: 960px; margin: 0 auto; }
  .page-title-row { margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
  .page-title { font-family: var(--serif); font-size: 28px; font-weight: 500; }

  /* ── TOOLBAR ── */
  .list-toolbar { display: flex; gap: 12px; margin-bottom: 20px; }
  .search-input { flex: 1; }

  /* ── INPUTS ── */
  .input { width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--serif); font-size: 15px; background: var(--surface); color: var(--text); outline: none; transition: border 0.15s; }
  .input:focus { border-color: var(--text); }
  .textarea { resize: vertical; min-height: 72px; }
  .meas-input { width: 80px; text-align: center; }

  /* ── BUTTONS ── */
  .btn { padding: 9px 18px; border-radius: var(--radius); font-family: var(--serif); font-size: 15px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
  .btn-primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
  .btn-primary:hover { opacity: 0.85; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: var(--text); border-color: var(--border); }
  .btn-ghost:hover { border-color: var(--border-strong); background: var(--bg); }
  .btn-sm { padding: 5px 10px; font-size: 13px; }
  .icon-btn { background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-muted); padding: 4px 6px; border-radius: var(--radius); transition: all 0.1s; }
  .icon-btn:hover { background: var(--bg); color: var(--text); }
  .icon-btn.danger:hover { color: var(--danger); background: var(--danger-light); }
  .action-btn { font-size: 12px; font-family: var(--mono); }
  .back-btn { background: none; border: none; cursor: pointer; font-family: var(--serif); font-size: 14px; color: var(--text-muted); padding: 0; transition: color 0.15s; }
  .back-btn:hover { color: var(--text); }

  /* ── TABLE ── */
  .client-table { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .table-header { display: grid; grid-template-columns: 2fr 1fr 1.2fr 1fr 40px; gap: 12px; padding: 10px 16px; background: var(--bg); border-bottom: 1px solid var(--border); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
  .table-row { display: grid; grid-template-columns: 2fr 1fr 1.2fr 1fr 40px; gap: 12px; padding: 13px 16px; border-bottom: 1px solid var(--border); align-items: center; cursor: pointer; transition: background 0.1s; font-size: 15px; }
  .table-row:last-child { border-bottom: none; }
  .table-row:hover { background: var(--bg); }
  .client-name-cell { font-weight: 500; }
  .mono { font-family: var(--mono); font-size: 13px; color: var(--text-muted); }

  /* ── DETAIL ── */
  .detail-header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .client-name-heading { font-family: var(--serif); font-size: 26px; font-weight: 500; }
  .client-meta-row { display: flex; align-items: center; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
  .badge { font-family: var(--mono); font-size: 11px; padding: 2px 8px; border: 1px solid var(--border-strong); border-radius: var(--radius); color: var(--text-muted); }
  .client-meta { font-size: 14px; color: var(--text-muted); }

  /* ── MEASUREMENTS ── */
  .meas-list { display: flex; flex-direction: column; gap: 8px; }
  .meas-card { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
  .meas-card-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; gap: 12px; transition: background 0.1s; flex-wrap: wrap; }
  .meas-card-header:hover { background: var(--bg); }
  .outfit-badge { font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--text); color: var(--accent-fg); padding: 2px 7px; border-radius: var(--radius); margin-right: 10px; }
  .meas-desc { font-size: 15px; font-weight: 500; }
  .meas-date { font-family: var(--mono); font-size: 12px; color: var(--text-faint); }
  .meas-card-actions { display: flex; align-items: center; gap: 8px; }
  .chevron { font-size: 10px; color: var(--text-faint); }
  .meas-card-body { padding: 16px; border-top: 1px solid var(--border); background: var(--bg); }
  .meas-fields-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
  .meas-field-row { display: flex; justify-content: space-between; padding: 6px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px; }
  .field-key { color: var(--text-muted); }
  .field-val { font-family: var(--mono); font-weight: 500; }
  .meas-notes { margin-top: 12px; font-size: 14px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px; }

  /* ── FORM ── */
  .form-grid { display: flex; flex-direction: column; gap: 10px; }
  .form-grid label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); margin-top: 4px; }
  .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
  .tag-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { padding: 5px 12px; border: 1px solid var(--border); border-radius: 20px; background: none; cursor: pointer; font-family: var(--serif); font-size: 14px; color: var(--text-muted); transition: all 0.1s; }
  .tag:hover { border-color: var(--text); color: var(--text); }
  .tag-active { background: var(--text); color: var(--accent-fg); border-color: var(--text); }
  .meas-grid { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; background: var(--bg); max-height: 260px; overflow-y: auto; }
  .meas-item { display: flex; align-items: center; gap: 8px; }
  .meas-label { flex: 1; font-size: 14px; color: var(--text-muted); }
  .meas-unit { font-family: var(--mono); font-size: 12px; color: var(--text-faint); }
  .custom-add { border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px; }

  /* ── MODAL ── */
  .overlay { position: fixed; inset: 0; background: rgba(26,25,22,0.55); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
  .modal { background: var(--surface); border-radius: var(--radius); width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--border); }
  .modal-title { font-family: var(--serif); font-size: 18px; font-weight: 500; }
  .modal-body { padding: 20px; }

  /* ── SPINNER ── */
  .spinner { width: 28px; height: 28px; border: 2px solid var(--border); border-top-color: var(--text); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── TOAST ── */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--accent-fg); padding: 10px 20px; border-radius: var(--radius); font-family: var(--mono); font-size: 13px; z-index: 200; box-shadow: var(--shadow-lg); animation: fadeUp 0.2s ease; }
  @keyframes fadeUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* ── EMPTY ── */
  .empty-state { text-align: center; padding: 64px 24px; color: var(--text-muted); }
  .empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
  .empty-state p { margin-bottom: 20px; font-size: 16px; }

  /* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .table-header, .table-row { grid-template-columns: 1.5fr 1fr 40px; }
  .table-header span:nth-child(3), .table-row span:nth-child(3),
  .table-header span:nth-child(4), .table-row span:nth-child(4) { display: none; }
  .detail-header { flex-direction: column; gap: 12px; }
  .btn-primary { margin-left: 0 !important; }
  .auth-card { padding: 28px 20px; }
  .auth-logo { width: 56px; height: 40px; }
  .header-inner { padding: 10px 16px; }
  .header-shop { padding-left: 22px; }
  .header-tagline { font-size: 8px }
}
`;