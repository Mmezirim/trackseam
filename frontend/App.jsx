import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { jsPDF } from "jspdf";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import Logo from "./assets/trackseamlogo.jpeg"

// CONFIG
const API_BASE  = (import.meta.env.VITE_API_BASE || "https://trackseam.onrender.com/api").replace(/\/+$/, "");
// Privacy policy, terms, support and account deletion pages (website/ in this repo).
const SITE_BASE = (import.meta.env.VITE_SITE_BASE || "https://trackseam.com").replace(/\/+$/, "");
const IS_NATIVE = Capacitor.isNativePlatform();
const PASSWORD_MIN = 8;

const openLink = (path) => {
  const url = `${SITE_BASE}${path}`;
  if (IS_NATIVE) Browser.open({ url });
  else window.open(url, "_blank", "noopener");
};

// ANDROID BACK BUTTON — screens and modals register a handler while mounted;
// the hardware back button runs the most recent one, or leaves the app.
const backHandlers = [];

function useBackHandler(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const entry = () => ref.current();
    backHandlers.push(entry);
    return () => { backHandlers.splice(backHandlers.indexOf(entry), 1); };
  }, []);
}

if (IS_NATIVE) {
  NativeApp.addListener("backButton", () => {
    const top = backHandlers[backHandlers.length - 1];
    if (top) top();
    else NativeApp.exitApp();
  });
}

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

// Fired when a signed-in request comes back 401 (expired or revoked session).
const UNAUTHORIZED_EVENT = "trackseam:unauthorized";

const apiFetch = async (path, options = {}) => {
  const token = getToken();
  let r;
  try {
    r = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Can't reach Trackseam. Check your internet connection and try again.");
  }
  // Error pages from proxies or a sleeping host are HTML, not JSON.
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || (r.status >= 500 ? "Server error. Please try again shortly." : "Request failed"));
    err.status = r.status;
    if (r.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw err;
  }
  return data;
};

const api = {
  // AUTH
  register:      (body)  => apiFetch("/auth/register",   { method: "POST", body: JSON.stringify(body) }),
  login:         (body)  => apiFetch("/auth/login",      { method: "POST", body: JSON.stringify(body) }),
  me:            ()      => apiFetch("/auth/me"),
  updateMe:      (body)  => apiFetch("/auth/me",         { method: "PATCH",  body: JSON.stringify(body) }),
  deleteAccount: (body)  => apiFetch("/auth/me",         { method: "DELETE", body: JSON.stringify(body) }),
  forgotPassword:(body)  => apiFetch("/auth/forgot-password",       { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (token, body) => apiFetch(`/auth/reset-password/${token}`, { method: "POST", body: JSON.stringify(body) }),

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
// A WebView can't download blobs, so on Android/iOS the PDF is written to the
// cache directory and handed to the share sheet (save to Files, WhatsApp, print…).
const savePdf = async (doc, filename) => {
  if (!IS_NATIVE) return doc.save(filename);
  const data = doc.output("datauristring").split(",")[1];
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  try {
    await Share.share({ title: filename, files: [uri] });
  } catch (err) {
    if (!/cancel/i.test(err?.message || "")) throw err;
  }
};

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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setInk();
  doc.text("Measurements", ML, y);
  y += 5;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
  y += 2;

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

  const baseName = `${client.name}_${measurement.outfitType}_${measurement.id || generateId()}`;
  return savePdf(doc, `${baseName.replace(/[^\w.-]+/g, "_")}.pdf`);
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
  useBackHandler(onClose);
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

// ─── FORGOT PASSWORD SCREEN ───────────────────────────────────────────────────

function ForgotPasswordScreen({ onBack }) {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  useBackHandler(onBack);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()) return setError("Please enter your email address.");
    setLoading(true);
    try {
      await api.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="auth-logo" src={Logo} alt="Trackseam Logo" />
          <span className="brand-name">Trackseam</span>
          <p className="auth-tagline">Reset your password</p>
        </div>

        {sent ? (
          <div className="form-grid">
            <div className="reset-success-box">
              <span className="reset-success-icon">✉️</span>
              <p className="reset-success-text">
                If that email is registered, a reset link has been sent. Check your inbox and follow the link to set a new password.
              </p>
            </div>
            <button className="btn btn-primary" onClick={onBack}>Back to Sign In</button>
          </div>
        ) : (
          <div className="form-grid">
            <p className="reset-hint">
              Enter the email address you registered with and we'll send you a password reset link.
            </p>
            <label>Email Address *</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </div>
        )}

        <p className="auth-switch">
          <button className="link-btn" onClick={onBack}>← Back to Sign In</button>
        </p>
      </div>
    </div>
  );
}

// ─── RESET PASSWORD SCREEN ────────────────────────────────────────────────────
// Rendered when the URL contains ?resetToken=<token>
// e.g. https://yourdomain.com/?resetToken=abc123...

function ResetPasswordScreen({ resetToken, onAuth }) {
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [done,      setDone]      = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!password) return setError("Please enter a new password.");
    if (password.length < PASSWORD_MIN) return setError(`Password must be at least ${PASSWORD_MIN} characters.`);
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const data = await api.resetPassword(resetToken, { password });
      localStorage.setItem("tb_token", data.token);
      setDone(true);
      // Auto-login after a short pause so the user sees the success message
      setTimeout(() => onAuth(data.tailor), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="auth-logo" src={Logo} alt="Trackseam Logo" />
          <span className="brand-name">Trackseam</span>
          <p className="auth-tagline">Choose a new password</p>
        </div>

        {done ? (
          <div className="form-grid">
            <div className="reset-success-box">
              <span className="reset-success-icon">✅</span>
              <p className="reset-success-text">Password updated! Signing you in…</p>
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <label>New Password *</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder={`Min. ${PASSWORD_MIN} characters`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <label>Confirm Password *</label>
            <input
              className="input"
              type="password"
              placeholder="Re-enter your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Set New Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AUTH PAGE (login + register) ────────────────────────────────────────────

function AuthPage({ onAuth, onForgotPassword }) {
  const [mode, setMode]       = useState("login");
  const [form, setForm]       = useState({ shopName: "", email: "", password: "" });
  const [agreed, setAgreed]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!form.email || !form.password) return setError("Email and password are required.");
    if (mode === "register") {
      if (!form.shopName.trim()) return setError("Shop / brand name is required.");
      if (form.password.length < PASSWORD_MIN) return setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      if (!agreed) return setError("Please accept the Terms of Use and Privacy Policy.");
    }

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
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            onKeyDown={handleKeyDown}
          />
          <label>Password *</label>
          <input
            className="input"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder={mode === "register" ? `Min. ${PASSWORD_MIN} characters` : "Your password"}
            value={form.password}
            onChange={set("password")}
            onKeyDown={handleKeyDown}
          />

          {mode === "register" && (
            <div className="consent">
              <input id="consent" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                <span onClick={() => setAgreed(!agreed)}>I am 18 or older and agree to the </span>
                <button type="button" className="link-btn" onClick={() => openLink("/terms")}>Terms of Use</button>
                {" "}and{" "}
                <button type="button" className="link-btn" onClick={() => openLink("/privacy")}>Privacy Policy</button>.
              </span>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          {mode === "login" && (
            <p style={{ textAlign: "center", marginTop: "2px" }}>
              <button className="link-btn forgot-link" onClick={onForgotPassword}>
                Forgot your password?
              </button>
            </p>
          )}
        </div>

        <p className="auth-switch">
          {mode === "login" ? (
            <>No account? <button className="link-btn" onClick={() => { setMode("register"); setError(""); }}>Register your shop</button></>
          ) : (
            <>Already registered? <button className="link-btn" onClick={() => { setMode("login"); setError(""); }}>Sign in</button></>
          )}
        </p>
        <LegalLinks />
      </div>
    </div>
  );
}

function LegalLinks() {
  return (
    <p className="legal-links">
      <button className="link-btn" onClick={() => openLink("/privacy")}>Privacy</button>
      <span>·</span>
      <button className="link-btn" onClick={() => openLink("/terms")}>Terms</button>
      <span>·</span>
      <button className="link-btn" onClick={() => openLink("/support")}>Support</button>
    </p>
  );
}

// ─── ACCOUNT PANEL ────────────────────────────────────────────────────────────

function AccountPanel({ onUpdated, onLogout, onDeleted, onToast }) {
  const { tailor }                  = useAuth();
  const [shopName, setShopName]     = useState(tailor.shopName);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");

  const saveShopName = async () => {
    setError("");
    if (!shopName.trim()) return setError("Shop name is required.");
    setSaving(true);
    try {
      const data = await api.updateMe({ shopName: shopName.trim() });
      onUpdated(data.tailor);
      onToast("Shop name updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    setError("");
    if (!password) return setError("Enter your password to confirm.");
    setDeleting(true);
    try {
      await api.deleteAccount({ password });
      onDeleted();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="form-grid">
      <label>Signed in as</label>
      <p className="account-email">{tailor.email}</p>

      <label>Shop / Brand Name</label>
      <div className="inline-row">
        <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={120} />
        <button className="btn btn-ghost" onClick={saveShopName} disabled={saving || shopName.trim() === tailor.shopName}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <label>Legal & Help</label>
      <div className="account-links">
        <button className="link-btn" onClick={() => openLink("/privacy")}>Privacy Policy</button>
        <button className="link-btn" onClick={() => openLink("/terms")}>Terms of Use</button>
        <button className="link-btn" onClick={() => openLink("/support")}>Support</button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button className="btn btn-ghost" onClick={onLogout}>Sign out</button>

      <div className="danger-zone">
        {!confirming ? (
          <button className="btn btn-danger-ghost" onClick={() => setConfirming(true)}>Delete account</button>
        ) : (
          <>
            <p className="danger-text">
              This permanently deletes your account, all your clients and all their measurements. It cannot be undone.
            </p>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password to confirm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => { setConfirming(false); setPassword(""); setError(""); }}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteAccount} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ADD CLIENT FORM ──────────────────────────────────────────────────────────

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
      const res = await api.addMeasurement(client.id, { outfitType, description, notes, fields });
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
              inputMode="decimal"
              min="0"
              step="any"
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
  const [loadError, setLoadError]       = useState("");

  useBackHandler(onBack);

  useEffect(() => {
    api.getMeasurements(client.id)
      .then((data) => setMeasurements(Array.isArray(data) ? data : []))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [client.id]);

  const handleAdd = (m) => {
    setMeasurements((prev) => [m, ...prev]);
    setShowAdd(false);
    onToast("Measurement saved.");
  };

  const handleDelete = async (measId) => {
    if (!window.confirm("Delete this measurement?")) return;
    try {
      await api.deleteMeasurement(client.id, measId);
      setMeasurements((prev) => prev.filter((m) => m.id !== measId));
      onToast("Measurement deleted.");
    } catch (err) {
      onToast(err.message);
    }
  };

  const handleExport = async (m) => {
    try {
      await exportMeasurement(client, m, tailor?.shopName);
    } catch (err) {
      onToast(`Couldn't export PDF: ${err.message}`);
    }
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
      ) : loadError ? (
        <div className="empty-state"><p>{loadError}</p></div>
      ) : measurements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📐</div>
          <p>No measurements recorded yet.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add First Measurement</button>
        </div>
      ) : (
        <div className="meas-list">
          {measurements.map((m) => (
            <div key={m.id} className="meas-card">
              <div className="meas-card-header" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                <div>
                  <span className="outfit-badge">{m.outfitType}</span>
                  <span className="meas-desc">{m.description}</span>
                </div>
                <div className="meas-card-actions">
                  <span className="meas-date">{formatDate(m.createdAt)}</span>
                  <button
                    className="icon-btn action-btn"
                    title="Export PDF"
                    onClick={(e) => { e.stopPropagation(); handleExport(m); }}
                  >↓ PDF</button>
                  <button
                    className="icon-btn action-btn danger"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                  >✕</button>
                  <span className="chevron">{expanded === m.id ? "▲" : "▼"}</span>
                </div>
              </div>
              {expanded === m.id && (
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
  const [loadError, setLoadError] = useState("");
  const latestRequest = useRef(0);

  const fetchClients = useCallback(async () => {
    // Ignore responses to searches the user has already typed past.
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const data = search.trim() ? await api.searchClients(search) : await api.getClients();
      if (requestId !== latestRequest.current) return;
      setClients(Array.isArray(data) ? data : []);
      setLoadError("");
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setClients([]);
      setLoadError(err.message);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
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
    try {
      await api.deleteClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
      onToast("Client deleted.");
    } catch (err) {
      onToast(err.message);
    }
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
      ) : loadError ? (
        <div className="empty-state">
          <p>{loadError}</p>
          <button className="btn btn-ghost" onClick={fetchClients}>Try again</button>
        </div>
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
            <div key={c.id} className="table-row" onClick={() => onSelect(c)}>
              <span className="client-name-cell">{c.name}</span>
              <span className="mono">{c.clientId}</span>
              <span>{c.phone || "—"}</span>
              <span>{formatDate(c.createdAt)}</span>
              <span>
                <button className="icon-btn danger" title="Delete client" onClick={(e) => handleDelete(e, c.id, c.name)}>✕</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tailor,         setTailor]         = useState(null);
  const [authChecked,    setAuthChecked]     = useState(false);
  const [authScreen,     setAuthScreen]      = useState("login"); // "login" | "forgot" | "reset"
  const [view,           setView]           = useState("clients");
  const [selectedClient, setSelectedClient] = useState(null);
  const [showAccount,    setShowAccount]    = useState(false);
  const [toast,          setToast]          = useState(null);

  // Detect ?resetToken=<token> in the URL (web only; emails now link to the
  // server-hosted reset page, but older links point here).
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");

  // ON MOUNT: CHECK AUTH
  useEffect(() => {
    // If a reset token is present, skip auth check and go straight to reset screen
    if (resetToken) { setAuthChecked(true); return; }

    const token = localStorage.getItem("tb_token");
    if (!token) { setAuthChecked(true); return; }

    api.me()
      .then((data) => setTailor(data.tailor))
      .catch((err) => {
        // Keep the session when offline; only a rejected token signs you out.
        if (err.status === 401) localStorage.removeItem("tb_token");
      })
      .finally(() => setAuthChecked(true));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = useCallback(() => {
    localStorage.removeItem("tb_token");
    setTailor(null);
    setAuthScreen("login");
    setView("clients");
    setSelectedClient(null);
    setShowAccount(false);
  }, []);

  // Any request rejected with 401 means the session expired or was revoked.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, handleLogout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleLogout);
  }, [handleLogout]);

  // Light status-bar icons over the dark app header; dark icons on the light sign-in screens.
  useEffect(() => {
    if (!IS_NATIVE) return;
    SystemBars.setStyle({ style: tailor ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }, [tailor]);

  const handleAuth  = (t) => {
    setTailor(t);
    // Remove the reset token query param from the URL if present
    if (resetToken) window.history.replaceState({}, "", window.location.pathname);
  };

  const showToast    = useCallback((msg) => setToast({ msg, id: Date.now() }), []);
  const hideToast    = useCallback(() => setToast(null), []);
  const selectClient = (c) => { setSelectedClient(c); setView("detail"); };

  const handleDeleted = () => {
    handleLogout();
    showToast("Your account has been deleted.");
  };

  const toastEl = toast && <Toast key={toast.id} msg={toast.msg} onClose={hideToast} />;

  if (!authChecked) return (
    <>
      <style>{CSS}</style>
      <div className="app"><Spinner /></div>
    </>
  );

  // ── Unauthenticated screens ──────────────────────────────────────────────
  if (!tailor) {
    // Password reset link from email
    if (resetToken) return (
      <>
        <style>{CSS}</style>
        <ResetPasswordScreen resetToken={resetToken} onAuth={handleAuth} />
      </>
    );

    if (authScreen === "forgot") return (
      <>
        <style>{CSS}</style>
        <ForgotPasswordScreen onBack={() => setAuthScreen("login")} />
      </>
    );

    return (
      <>
        <style>{CSS}</style>
        <AuthPage onAuth={handleAuth} onForgotPassword={() => setAuthScreen("forgot")} />
        {toastEl}
      </>
    );
  }

  // ── Authenticated app ────────────────────────────────────────────────────
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
            <button className="logout-btn" onClick={() => setShowAccount(true)} title="Account">Account</button>
          </div>
        </header>

        {showAccount && (
          <Modal title="Account" onClose={() => setShowAccount(false)}>
            <AccountPanel
              onUpdated={setTailor}
              onLogout={handleLogout}
              onDeleted={handleDeleted}
              onToast={showToast}
            />
          </Modal>
        )}

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

        {toastEl}
      </div>
    </AuthContext.Provider>
  );
}

// STYLES
const CSS = `

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

  body { background: var(--bg); color: var(--text); font-family: var(--serif); font-size: 16px; line-height: 1.6; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
  .app { min-height: 100vh; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom, 0px); }

  /* ── AUTH ── */
  .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px)); background: var(--bg); }
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
  .forgot-link { font-family: var(--mono); font-size: 12px; color: var(--text-muted); text-decoration: none; opacity: 0.75; transition: opacity 0.15s; }
  .forgot-link:hover { opacity: 1; text-decoration: underline; }

  /* ── RESET PASSWORD UI ── */
  .reset-hint { font-size: 14px; color: var(--text-muted); margin-bottom: 4px; line-height: 1.5; }
  .reset-success-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); text-align: center; margin-bottom: 8px; }
  .reset-success-icon { font-size: 32px; }
  .reset-success-text { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

  /* ── HEADER ── */
  .header { background: var(--text); color: var(--accent-fg); border-bottom: 2px solid var(--text); padding-top: env(safe-area-inset-top, 0px); position: sticky; top: 0; z-index: 50; }
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
  .input { width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--serif); font-size: 16px; background: var(--surface); color: var(--text); outline: none; transition: border 0.15s; }
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
  .overlay { position: fixed; inset: 0; background: rgba(26,25,22,0.55); display: flex; align-items: center; justify-content: center; z-index: 100; padding: calc(20px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px)); }
  .modal { background: var(--surface); border-radius: var(--radius); width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--border); }
  .modal-title { font-family: var(--serif); font-size: 18px; font-weight: 500; }
  .modal-body { padding: 20px; }

  /* ── SPINNER ── */
  .spinner { width: 28px; height: 28px; border: 2px solid var(--border); border-top-color: var(--text); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── TOAST ── */
  .toast { position: fixed; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); max-width: calc(100% - 32px); left: 50%; transform: translateX(-50%); background: var(--text); color: var(--accent-fg); padding: 10px 20px; border-radius: var(--radius); font-family: var(--mono); font-size: 13px; z-index: 200; box-shadow: var(--shadow-lg); animation: fadeUp 0.2s ease; }
  @keyframes fadeUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* ── EMPTY ── */
  .empty-state { text-align: center; padding: 64px 24px; color: var(--text-muted); }
  .empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
  .empty-state p { margin-bottom: 20px; font-size: 16px; }

  /* ── CONSENT / LEGAL ── */
  .consent { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-top: 4px; }
  .consent input { width: 18px; height: 18px; margin-top: 2px; flex-shrink: 0; accent-color: var(--text); }
  .legal-links { display: flex; justify-content: center; gap: 8px; margin-top: 16px; font-size: 12px; color: var(--text-faint); }
  .legal-links .link-btn { font-size: 12px; color: var(--text-faint); text-decoration: none; }

  /* ── ACCOUNT ── */
  .account-email { font-size: 15px; word-break: break-all; }
  .inline-row { display: flex; gap: 8px; }
  .account-links { display: flex; flex-wrap: wrap; gap: 16px; }
  .danger-zone { margin-top: 12px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
  .danger-text { font-size: 14px; color: var(--danger); }
  .btn-danger { background: var(--danger); color: #fff; border-color: var(--danger); }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-danger-ghost { background: transparent; color: var(--danger); border-color: var(--border); }
  .btn-danger-ghost:hover { background: var(--danger-light); }

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