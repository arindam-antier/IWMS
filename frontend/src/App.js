import { useState, useEffect, useCallback } from "react";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:8000";

async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",   // send & receive the httpOnly iwms_token cookie
    });
  } catch (networkErr) {
    throw new Error("Cannot reach server. Make sure the backend is running on " + API_BASE);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

async function apiUpload(path, formData, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROLES = {
  super_admin: { label: "Super Admin", color: "#7c3aed", icon: "👑" },
  receptionist: { label: "Receptionist", color: "#0891b2", icon: "🏢" },
  enquiry_officer: { label: "Enquiry Officer", color: "#059669", icon: "🔍" },
  counsellor: { label: "Counsellor", color: "#d97706", icon: "🎓" },
  admission_officer: { label: "Admission Officer", color: "#dc2626", icon: "📋" },
  enrollment_officer: { label: "Enrollment Officer", color: "#7c3aed", icon: "📝" },
  visa_officer: { label: "Visa Officer", color: "#0284c7", icon: "✈️" },
  student: { label: "Student", color: "#16a34a", icon: "👨‍🎓" },
};

const STAGES = [
  { key: "reception", label: "Reception", step: 1, color: "#0891b2" },
  { key: "enquiry", label: "Enquiry", step: 2, color: "#059669" },
  { key: "counsellor", label: "Counselling", step: 3, color: "#d97706" },
  { key: "admission", label: "Admission", step: 4, color: "#dc2626" },
  { key: "enrollment", label: "Enrollment", step: 5, color: "#7c3aed" },
  { key: "visa", label: "Visa", step: 6, color: "#0284c7" },
  { key: "completed", label: "Completed", step: 7, color: "#16a34a" },
];

const STAGE_FEES = {
  registration: 5000,
  counselling: 10000,
  admission: 20000,
  enrollment: 15000,
  visa: 25000,
};

const DOC_TYPES = [
  "passport","photograph","marksheet_10","marksheet_12","graduation_docs",
  "resume","counselling_notes","university_shortlist","sop","lor",
  "offer_letter","application_docs","enrollment_letter","tuition_fee_receipt",
  "confirmation_letter","visa_form","bank_statement","financial_docs","visa_decision_letter"
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Badge({ children, color = "#6b7280" }) {
  return (
    <span style={{
      background: color + "20",
      color,
      border: `1px solid ${color}40`,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.3,
      display: "inline-block",
    }}>{children}</span>
  );
}

function Alert({ type, children, onClose }) {
  const cfg = {
    error: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "⚠️" },
    success: { bg: "#f0fdf4", border: "#86efac", text: "#166534", icon: "✓" },
    info: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "ℹ" },
  }[type] || { bg: "#f9fafb", border: "#d1d5db", text: "#374151", icon: "•" };
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span>{cfg.icon}</span>
      <span style={{ color: cfg.text, fontSize: 14, flex: 1 }}>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: cfg.text, fontSize: 16 }}>×</button>}
    </div>
  );
}

function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `3px solid #e5e7eb`,
      borderTopColor: "#4f46e5",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      display: "inline-block"
    }} />
  );
}

function Modal({ title, onClose, children, width = 540 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px #0003" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6", paddingBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Input({ label, error, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>}
      <input
        {...props}
        style={{
          width: "100%", padding: "9px 12px", border: `1.5px solid ${error ? "#f87171" : "#d1d5db"}`,
          borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box",
          background: "#fafafa", color: "#111827",
          transition: "border-color 0.15s",
          ...props.style
        }}
        onFocus={e => e.target.style.borderColor = "#4f46e5"}
        onBlur={e => e.target.style.borderColor = error ? "#f87171" : "#d1d5db"}
      />
      {error && <span style={{ fontSize: 12, color: "#ef4444", marginTop: 3, display: "block" }}>{error}</span>}
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>}
      <select {...props} style={{
        width: "100%", padding: "9px 12px", border: "1.5px solid #d1d5db",
        borderRadius: 8, fontSize: 14, outline: "none", background: "#fafafa",
        color: "#111827", boxSizing: "border-box", cursor: "pointer",
        ...props.style
      }}>
        {children}
      </select>
    </div>
  );
}

function Btn({ children, variant = "primary", loading, size = "md", ...props }) {
  const styles = {
    primary: { background: "#4f46e5", color: "#fff", border: "none" },
    secondary: { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" },
    danger: { background: "#ef4444", color: "#fff", border: "none" },
    success: { background: "#10b981", color: "#fff", border: "none" },
    ghost: { background: "transparent", color: "#4f46e5", border: "1px solid #4f46e5" },
  };
  const sizes = { sm: "6px 12px", md: "9px 18px", lg: "12px 24px" };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      style={{
        ...styles[variant],
        padding: sizes[size],
        borderRadius: 8,
        fontSize: size === "sm" ? 13 : 14,
        fontWeight: 600,
        cursor: loading || props.disabled ? "not-allowed" : "pointer",
        opacity: loading || props.disabled ? 0.7 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "opacity 0.15s",
        whiteSpace: "nowrap",
        ...props.style
      }}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 6px #0000000d", border: "1px solid #f0f0f0", ...style }}>
      {children}
    </div>
  );
}

// ─── PROGRESS TRACKER ────────────────────────────────────────────────────────
function ProgressTracker({ currentStage }) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);
  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
        {STAGES.filter(s => s.key !== "completed").map((stage, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          const color = done ? "#10b981" : active ? stage.color : "#d1d5db";
          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: done ? "#10b981" : active ? stage.color : "#f3f4f6",
                  border: `2px solid ${color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: done || active ? "#fff" : "#9ca3af",
                  fontSize: 13, fontWeight: 700,
                  transition: "all 0.3s",
                }}>
                  {done ? "✓" : stage.step}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: "nowrap", textAlign: "center" }}>
                  {stage.label}
                </span>
              </div>
              {i < STAGES.filter(s => s.key !== "completed").length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? "#10b981" : "#e5e7eb", margin: "0 4px", marginBottom: 18, transition: "background 0.3s" }} />
              )}
            </div>
          );
        })}
      </div>
      {currentStage === "completed" && (
        <div style={{ textAlign: "center", marginTop: 12, padding: "12px 24px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #86efac" }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <p style={{ margin: "4px 0 0", color: "#16a34a", fontWeight: 700 }}>Visa Journey Complete!</p>
        </div>
      )}
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Please enter your email / student code and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      try { localStorage.setItem("iwms_auth", JSON.stringify(data)); } catch (_) {}
      onLogin(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => { if (e.key === "Enter") handleLogin(); };

  /* ── Plane SVG logo ─────────────────────────────────────────────────────── */
  const PlaneLogo = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="14" fill="url(#logoGrad)"/>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#4f46e5"/>
        </linearGradient>
      </defs>
      {/* Fuselage */}
      <path d="M8 26 L32 14 C35 12.5 38 13.5 39 16 C40 18.5 38.5 21 35.5 22 L26 25.5 L28 34 L23 36 L19 27 L13 29 L12 32 L8 33 L9 28 Z"
        fill="white" opacity="0.95"/>
      {/* Wing highlight */}
      <path d="M18 23 L35 16 L30 24 L18 25 Z" fill="white" opacity="0.3"/>
      {/* Contrail dots */}
      <circle cx="5" cy="30" r="1.2" fill="white" opacity="0.4"/>
      <circle cx="3" cy="33" r="0.8" fill="white" opacity="0.25"/>
    </svg>
  );

  /* ── Left illustration panel ────────────────────────────────────────────── */
  const LeftPanel = () => (
    <div style={{
      flex: 1,
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 56px",
      position: "relative",
      overflow: "hidden",
      borderRight: "1px solid #f0f0f0",
    }}>

      {/* Subtle grid background */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.035 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4f46e5" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>

      {/* Soft colour blobs */}
      <div style={{ position:"absolute", top:-80, right:-80, width:320, height:320, borderRadius:"50%", background:"radial-gradient(circle, #ede9fe 0%, transparent 70%)", opacity:0.6 }}/>
      <div style={{ position:"absolute", bottom:-60, left:-60, width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle, #dbeafe 0%, transparent 70%)", opacity:0.7 }}/>

      {/* Main SVG illustration */}
      <svg viewBox="0 0 400 320" width="380" height="304" style={{ marginBottom:40, position:"relative", zIndex:1 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eff6ff"/>
            <stop offset="100%" stopColor="#f0f9ff"/>
          </linearGradient>
          <linearGradient id="globeTop" x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#60a5fa"/>
            <stop offset="100%" stopColor="#1d4ed8"/>
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0"/>
          </radialGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1d4ed8" floodOpacity="0.15"/>
          </filter>
          <clipPath id="gc"><circle cx="200" cy="170" r="110"/></clipPath>
        </defs>

        {/* Sky background oval */}
        <ellipse cx="200" cy="170" r="140" fill="url(#skyGrad)" opacity="0.6"/>

        {/* Globe */}
        <circle cx="200" cy="170" r="110" fill="url(#globeTop)" filter="url(#shadow)"/>

        {/* Land masses */}
        <g clipPath="url(#gc)" fill="white" opacity="0.18">
          <ellipse cx="175" cy="145" rx="34" ry="24" transform="rotate(-12 175 145)"/>
          <ellipse cx="228" cy="158" rx="26" ry="36" transform="rotate(8 228 158)"/>
          <ellipse cx="158" cy="185" rx="20" ry="15" transform="rotate(-5 158 185)"/>
          <ellipse cx="240" cy="130" rx="16" ry="11" transform="rotate(18 240 130)"/>
          <ellipse cx="200" cy="205" rx="34" ry="13" transform="rotate(3 200 205)"/>
          <ellipse cx="168" cy="118" rx="12" ry="8" transform="rotate(-20 168 118)"/>
        </g>

        {/* Latitude lines */}
        <g clipPath="url(#gc)" stroke="white" strokeWidth="0.7" fill="none" opacity="0.12">
          <ellipse cx="200" cy="170" rx="110" ry="22"/>
          <ellipse cx="200" cy="170" rx="100" ry="50"/>
          <ellipse cx="200" cy="170" rx="78" ry="78"/>
          <ellipse cx="200" cy="170" rx="44" ry="96"/>
        </g>
        {/* Longitude lines */}
        <g clipPath="url(#gc)" stroke="white" strokeWidth="0.7" fill="none" opacity="0.12">
          <line x1="200" y1="60" x2="200" y2="280"/>
          <ellipse cx="200" cy="170" rx="55" ry="110" transform="rotate(50 200 170)"/>
          <ellipse cx="200" cy="170" rx="55" ry="110" transform="rotate(-50 200 170)"/>
        </g>

        {/* Shine on globe */}
        <ellipse cx="175" cy="130" rx="38" ry="24" fill="white" opacity="0.09" transform="rotate(-20 175 130)"/>

        {/* Orbit ring */}
        <ellipse cx="200" cy="170" rx="148" ry="38" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="7 5" opacity="0.7"/>

        {/* Airplane on the orbit */}
        <g transform="translate(338 136) rotate(-22)">
          {/* Body */}
          <path d="M0 0 L-20 7 L-17 0 L-20 -7 Z" fill="white"/>
          {/* Wings */}
          <path d="M-7 3 L-20 13 L-19 7 Z" fill="white" opacity="0.75"/>
          <path d="M-7 -3 L-20 -13 L-19 -7 Z" fill="white" opacity="0.75"/>
          {/* Tail */}
          <path d="M-16 0 L-21 -5 L-20 0 L-21 5 Z" fill="white" opacity="0.55"/>
          {/* Window glow */}
          <circle cx="-6" cy="0" r="2.5" fill="#bfdbfe"/>
        </g>

        {/* Pin A — departure */}
        <g transform="translate(162 138)">
          <circle r="8" fill="#34d399"/>
          <circle r="4" fill="white"/>
          <circle r="12" fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.4"/>
          <circle r="17" fill="none" stroke="#34d399" strokeWidth="1" opacity="0.2"/>
        </g>

        {/* Dashed route line */}
        <path d="M 162 138 Q 195 100 238 158" stroke="#6ee7b7" strokeWidth="1.5" strokeDasharray="5 4" fill="none" opacity="0.7"/>

        {/* Pin B — destination */}
        <g transform="translate(238 158)">
          <circle r="8" fill="#f59e0b"/>
          <circle r="4" fill="white"/>
          <circle r="12" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4"/>
        </g>

        {/* Passport card */}
        <g transform="translate(42 48)">
          <rect x="0" y="0" width="84" height="56" rx="6" fill="white" filter="url(#shadow)" opacity="0.95"/>
          <rect x="0" y="0" width="84" height="16" rx="6" fill="#4f46e5"/>
          <rect x="0" y="10" width="84" height="6" fill="#4f46e5"/>
          <text x="8" y="12" fontSize="7" fill="white" fontFamily="sans-serif" fontWeight="700">PASSPORT</text>
          <rect x="8" y="22" width="22" height="26" rx="3" fill="#eff6ff"/>
          <circle cx="19" cy="31" r="6" fill="#bfdbfe"/>
          <rect x="36" y="22" width="36" height="4" rx="2" fill="#e5e7eb"/>
          <rect x="36" y="30" width="28" height="3" rx="2" fill="#e5e7eb"/>
          <rect x="36" y="37" width="32" height="3" rx="2" fill="#e5e7eb"/>
          <rect x="8" y="52" width="68" height="2" rx="1" fill="#e5e7eb"/>
        </g>

        {/* Visa stamp */}
        <g transform="translate(276 44)">
          <rect x="0" y="0" width="72" height="50" rx="5" fill="white" filter="url(#shadow)" opacity="0.95"/>
          <rect x="4" y="4" width="64" height="42" rx="3" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="3 2"/>
          <text x="36" y="17" fontSize="6.5" fill="#4f46e5" fontFamily="sans-serif" fontWeight="800" textAnchor="middle">VISA</text>
          <text x="36" y="27" fontSize="5.5" fill="#6b7280" fontFamily="sans-serif" textAnchor="middle">APPROVED</text>
          <path d="M24 36 L30 42 L48 30" stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>

        {/* Cloud shapes */}
        <g fill="white" opacity="0.55">
          <ellipse cx="80" cy="230" rx="22" ry="10"/>
          <ellipse cx="68" cy="230" rx="14" ry="9"/>
          <ellipse cx="94" cy="230" rx="14" ry="8"/>
        </g>
        <g fill="white" opacity="0.4">
          <ellipse cx="310" cy="255" rx="26" ry="11"/>
          <ellipse cx="296" cy="255" rx="15" ry="10"/>
          <ellipse cx="328" cy="255" rx="16" ry="9"/>
        </g>

        {/* Stage labels floating */}
        <g fontFamily="sans-serif" fontSize="8.5" fontWeight="700">
          <rect x="32" y="268" width="58" height="18" rx="9" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1"/>
          <text x="61" y="280" fill="#1d4ed8" textAnchor="middle">Reception</text>
          <rect x="100" y="268" width="52" height="18" rx="9" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1"/>
          <text x="126" y="280" fill="#059669" textAnchor="middle">Enquiry</text>
          <rect x="162" y="268" width="62" height="18" rx="9" fill="#fffbeb" stroke="#fde68a" strokeWidth="1"/>
          <text x="193" y="280" fill="#d97706" textAnchor="middle">Counselling</text>
          <rect x="234" y="268" width="56" height="18" rx="9" fill="#fef2f2" stroke="#fecaca" strokeWidth="1"/>
          <text x="262" y="280" fill="#dc2626" textAnchor="middle">Admission</text>
          <rect x="300" y="268" width="56" height="18" rx="9" fill="#f5f3ff" stroke="#ddd6fe" strokeWidth="1"/>
          <text x="328" y="280" fill="#7c3aed" textAnchor="middle">Enrollment</text>
        </g>
      </svg>

      {/* Tagline */}
      <div style={{ textAlign:"center", position:"relative", zIndex:1 }}>
        <h2 style={{ margin:"0 0 8px", fontSize:22, fontWeight:800, color:"#1e1b4b", letterSpacing:-0.5 }}>
          VisaFlow IWMS
        </h2>
        <p style={{ margin:0, fontSize:14, color:"#6b7280", lineHeight:1.7, maxWidth:340 }}>
          End-to-end immigration workflow management.<br/>
          Track every student from Reception to Visa.
        </p>
      </div>
    </div>
  );

  /* ── Right login panel ──────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight:"100vh", display:"flex", fontFamily:"'Segoe UI', system-ui, sans-serif", background:"#fff" }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeRight { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:translateX(0); } }
        .lf-input { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:14px; outline:none; background:#fafafa; color:#111827; transition:border-color 0.15s, box-shadow 0.15s; box-sizing:border-box; font-family:inherit; }
        .lf-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.12); background:#fff; }
        .lf-btn { width:100%; padding:13px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; font-family:inherit; box-shadow:0 4px 14px rgba(79,70,229,0.3); }
        .lf-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 22px rgba(79,70,229,0.42); }
        .lf-btn:active:not(:disabled) { transform:translateY(0); }
        .lf-btn:disabled { opacity:0.65; cursor:not-allowed; }
        * { box-sizing:border-box; }
      `}</style>

      <LeftPanel />

      {/* Right: Form */}
      <div style={{
        width: 440, flexShrink:0, background:"#fff",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        padding:"52px 48px",
        animation:"fadeRight 0.4s ease",
      }}>

        {/* Logo + title */}
        <div style={{ marginBottom:36, textAlign:"center" }}>
          <PlaneLogo size={52} />
          <h2 style={{ margin:"16px 0 4px", fontSize:24, fontWeight:800, color:"#111827", letterSpacing:-0.5 }}>
            Welcome back
          </h2>
          <p style={{ margin:0, fontSize:14, color:"#9ca3af" }}>
            Sign in to your IWMS account
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            width:"100%", marginBottom:18,
            background:"#fef2f2", border:"1px solid #fecaca",
            borderRadius:10, padding:"11px 14px",
            display:"flex", gap:8, alignItems:"flex-start",
          }}>
            <span style={{ fontSize:15 }}>⚠️</span>
            <span style={{ color:"#b91c1c", fontSize:13, lineHeight:1.55 }}>{error}</span>
          </div>
        )}

        {/* Email / code field */}
        <div style={{ width:"100%", marginBottom:14 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:6 }}>
            Email or Student Code
          </label>
          <input
            className="lf-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={onKey}
            placeholder="admin@iwms.com  or  STU-12345"
            autoComplete="username"
            autoFocus
          />
        </div>

        {/* Password field */}
        <div style={{ width:"100%", marginBottom:28 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:6 }}>
            Password
          </label>
          <div style={{ position:"relative" }}>
            <input
              className="lf-input"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={onKey}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{ paddingRight:46 }}
            />
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowPass(v => !v)}
              tabIndex={-1}
              style={{
                position:"absolute", right:13, top:"50%", transform:"translateY(-50%)",
                background:"none", border:"none", cursor:"pointer",
                color:"#9ca3af", fontSize:18, lineHeight:1, padding:2,
              }}
              title={showPass ? "Hide" : "Show"}
            >
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          className="lf-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading && <Spinner size={16} />}
          {loading ? "Signing in…" : "Sign In →"}
        </button>

        {/* Hint box */}
        <div style={{
          marginTop:24, width:"100%",
          background:"#f9fafb", border:"1px solid #f0f0f0",
          borderRadius:10, padding:"13px 16px",
        }}>
          <p style={{ margin:"0 0 5px", fontSize:11.5, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6 }}>
            How to log in
          </p>
          <p style={{ margin:"0 0 3px", fontSize:13, color:"#6b7280" }}>
            <strong style={{ color:"#374151" }}>Officers & Admin —</strong> use your email
          </p>
          <p style={{ margin:0, fontSize:13, color:"#6b7280" }}>
            <strong style={{ color:"#374151" }}>Students —</strong> use your email or student code (STU-XXXXX)
          </p>
        </div>

        <p style={{ marginTop:32, fontSize:12, color:"#d1d5db", textAlign:"center" }}>
          VisaFlow IWMS &middot; Immigration Workflow Management System
        </p>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ user, activeTab, setActiveTab, onLogout, onChangePassword }) {
  const role = user.role;

  const adminNav = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "students",  label: "Students",  icon: "👥" },
    { id: "officers",  label: "Officers",  icon: "👔" },
    { id: "payments",  label: "Payments",  icon: "💰" },
    { id: "refunds",   label: "Refunds",   icon: "↩️" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
  ];

  const officerNav = [
    { id: "students",      label: "My Students",    icon: "👥" },
    { id: "payments",      label: "Payments",       icon: "💰" },
    { id: "notifications", label: "Notifications",  icon: "🔔" },
  ];

  const studentNav = [
    { id: "progress",      label: "My Progress",   icon: "🗺️" },
    { id: "documents",     label: "Documents",     icon: "📁" },
    { id: "payments",      label: "Payments",      icon: "💰" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
  ];

  const nav = role === "super_admin" ? adminNav
    : role === "student" ? studentNav
    : officerNav;

  const roleInfo = ROLES[role] || {};

  return (
    <div style={{ width: 220, background: "#0f172a", height: "100vh", position: "fixed", left: 0, top: 0, display: "flex", flexDirection: "column", zIndex: 100 }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✈</div>
          <div>
            <p style={{ margin: 0, color: "#f8fafc", fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>IWMS</p>
            <p style={{ margin: 0, color: "#64748b", fontSize: 10 }}>Immigration System</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: roleInfo.color + "30", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, border: `1px solid ${roleInfo.color}50` }}>
            {roleInfo.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: "#f1f5f9", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</p>
            <p style={{ margin: 0, color: "#64748b", fontSize: 11 }}>{roleInfo.label}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
        {nav.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 9, border: "none", cursor: "pointer",
              background: activeTab === item.id ? "#4f46e510" : "transparent",
              color: activeTab === item.id ? "#818cf8" : "#94a3b8",
              fontSize: 14, fontWeight: activeTab === item.id ? 600 : 400,
              textAlign: "left", transition: "all 0.15s", marginBottom: 2,
              borderLeft: activeTab === item.id ? "3px solid #818cf8" : "3px solid transparent",
            }}>
            <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: 12, borderTop: "1px solid #1e293b" }}>
        <button onClick={onChangePassword}
          style={{ width: "100%", padding: "9px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          🔑 Change Password
        </button>
        <button onClick={onLogout}
          style={{ width: "100%", padding: "9px 12px", background: "#7f1d1d20", border: "1px solid #7f1d1d40", borderRadius: 8, color: "#fca5a5", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/admin/stats", {}, token),
      apiFetch("/api/admin/officers/workload", {}, token),
    ]).then(([s, w]) => { setStats(s); setWorkload(w); }).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={40} /></div>;

  const kpis = [
    { label: "Total Students", value: stats?.total_students, icon: "👥", color: "#4f46e5" },
    { label: "Total Officers", value: stats?.total_officers, icon: "👔", color: "#059669" },
    { label: "Total Revenue", value: `₹${(stats?.total_revenue || 0).toLocaleString()}`, icon: "💰", color: "#d97706" },
    { label: "Pending Refunds", value: stats?.pending_refunds, icon: "↩️", color: "#dc2626" },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>System Dashboard</h2>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <Card key={k.label} style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 46, height: 46, background: k.color + "15", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: k.color }}>{k.value ?? "—"}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{k.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Stage Distribution */}
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>Students by Stage</h3>
          {STAGES.map(stage => {
            const count = stats?.students_by_stage?.[stage.key] || 0;
            const max = Math.max(...Object.values(stats?.students_by_stage || {}));
            return (
              <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 80, fontSize: 12, color: "#6b7280", flexShrink: 0 }}>{stage.label}</span>
                <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${max ? (count / max) * 100 : 0}%`, height: "100%", background: stage.color, borderRadius: 4, transition: "width 0.5s" }} />
                </div>
                <span style={{ width: 24, fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "right" }}>{count}</span>
              </div>
            );
          })}
        </Card>

        {/* Officer Workload */}
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>Officer Workload</h3>
          {workload.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 14 }}>No data</p> : (
            workload.map(w => (
              <div key={w.officer_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{w.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{ROLES[w.role]?.label || w.role}</p>
                </div>
                <Badge color={w.active_students > 5 ? "#dc2626" : "#059669"}>{w.active_students} students</Badge>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── STUDENTS LIST ────────────────────────────────────────────────────────────
function StudentsList({ token, user, onSelectStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showRegModal, setShowRegModal] = useState(false);
  const [error, setError] = useState("");

  const isReceptionist = user.role === "receptionist" || user.role === "super_admin";
  const isAdmin = user.role === "super_admin";

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/students", {}, token)
      .then(setStudents).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const deleteStudent = async (id, name, code) => {
    if (!window.confirm(`\u26a0\ufe0f Permanently delete ${name} (${code})?\n\nThis removes all their records, documents and payments. This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/students/${id}`, { method: "DELETE" }, token);
      load();
    } catch (e) { setError(e.message); }
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || `${s.first_name} ${s.last_name} ${s.email} ${s.student_code}`.toLowerCase().includes(q);
    const matchStage = !stageFilter || s.current_stage === stageFilter;
    return matchQ && matchStage;
  });

  const stageColor = (stage) => STAGES.find(s => s.key === stage)?.color || "#6b7280";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Students</h2>
        {isReceptionist && <Btn onClick={() => setShowRegModal(true)}>+ Register Student</Btn>}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, code…"
          style={{ flex: 1, minWidth: 200, padding: "8px 14px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff" }} />
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          style={{ padding: "8px 14px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, background: "#fff", outline: "none" }}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #f3f4f6" }}>
                {["Code", "Name", "Email", "Phone", "Stage", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "12px 14px" }}><Badge color="#4f46e5">{s.student_code}</Badge></td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 14, color: "#111827" }}>{s.first_name} {s.last_name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#6b7280" }}>{s.email}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#6b7280" }}>{s.phone || "—"}</td>
                  <td style={{ padding: "12px 14px" }}><Badge color={stageColor(s.current_stage)}>{s.current_stage}</Badge></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#9ca3af" }}>{s.stage_status?.replace(/_/g, " ")}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn size="sm" variant="ghost" onClick={() => onSelectStudent(s)}>View →</Btn>
                      {isAdmin && (
                        <Btn size="sm" variant="danger" onClick={() => deleteStudent(s.id, `${s.first_name} ${s.last_name}`, s.student_code)}>Delete</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showRegModal && <RegisterStudentModal token={token} user={user} onClose={() => setShowRegModal(false)} onSuccess={() => { setShowRegModal(false); load(); }} />}
    </div>
  );
}

function RegisterStudentModal({ token, user, onClose, onSuccess }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", address: "", passport_number: "", password: "", payment_mode: "cash", transaction_ref: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.first_name || !form.last_name || !form.email) { setError("First name, last name and email are required"); return; }
    if (!form.password || form.password.length < 6) { setError("Password is required and must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      const data = await apiFetch("/api/students", { method: "POST", body: JSON.stringify(form) }, token);
      setSuccess({ ...data, plainPassword: form.password });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (success) {
    return (
      <Modal title="Student Registered!" onClose={onSuccess}>
        <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Registration Successful</p>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: 16, margin: "12px 0", textAlign: "left" }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "#0369a1" }}>Student Code: <strong>{success.student_code}</strong></p>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "#0369a1" }}>Name: <strong>{success.first_name} {success.last_name}</strong></p>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "#0369a1" }}>Email: <strong>{success.email}</strong></p>
            <p style={{ margin: 0, fontSize: 13, color: "#0369a1" }}>Password: <strong style={{ fontFamily: "monospace" }}>{success.plainPassword}</strong></p>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13 }}>A welcome email with these credentials has been sent to the student.</p>
          <Btn onClick={onSuccess} style={{ marginTop: 8 }}>Done</Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Register New Student" onClose={onClose} width={580}>
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Input label="First Name *" value={form.first_name} onChange={e => set("first_name", e.target.value)} />
        <Input label="Last Name *" value={form.last_name} onChange={e => set("last_name", e.target.value)} />
        <Input label="Email *" type="email" value={form.email} onChange={e => set("email", e.target.value)} />
        <Input label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} />
        <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} />
        <Input label="Passport Number" value={form.passport_number} onChange={e => set("passport_number", e.target.value)} />
      </div>
      <Input label="Address" value={form.address} onChange={e => set("address", e.target.value)} />
      <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#6d28d9" }}>🔑 Student Login Credentials</p>
        <Input label="Initial Password *" type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min 6 characters — will be sent in welcome email" />
      </div>
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#166534" }}>Registration Fee: ₹5,000</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Select label="Payment Mode" value={form.payment_mode} onChange={e => set("payment_mode", e.target.value)}>
            {["cash", "upi", "card", "bank_transfer"].map(m => <option key={m} value={m}>{m.replace(/_/g, " ").toUpperCase()}</option>)}
          </Select>
          <Input label="Transaction Ref" value={form.transaction_ref} onChange={e => set("transaction_ref", e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn loading={loading} onClick={submit}>Register & Create Account</Btn>
      </div>
    </Modal>
  );
}

// ─── STUDENT DETAIL ───────────────────────────────────────────────────────────
function StudentDetail({ student: initialStudent, token, user, onBack }) {
  const [student, setStudent] = useState(initialStudent);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [officers, setOfficers] = useState([]);
  const [resetTarget, setResetTarget] = useState(null);  // for admin password reset

  const reload = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/students/${student.id}`, {}, token)
      .then(d => { setDetail(d); setStudent(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [student.id, token]);

  useEffect(() => {
    reload();
    // Fetch officers for stage advance: admins get all, officers use the for-stage endpoint
    if (user.role === "super_admin") {
      apiFetch("/api/officers", {}, token).then(setOfficers).catch(() => {});
    } else {
      // Use the for-stage endpoint for each possible next stage
      const nextStageMap = {
        receptionist: "enquiry",
        enquiry_officer: "counsellor",
        counsellor: "admission",
        admission_officer: "enrollment",
        enrollment_officer: "visa",
      };
      const nextStage = nextStageMap[user.role];
      if (nextStage) {
        apiFetch(`/api/officers/for-stage?stage=${nextStage}`, {}, token)
          .then(setOfficers).catch(() => {});
      }
    }
  }, [reload, token, user.role]);

  const advanceStage = async (nextOfficerId, notes) => {
    try {
      await apiFetch(`/api/students/${student.id}/advance-stage`, {
        method: "POST", body: JSON.stringify({ student_id: student.id, next_officer_id: nextOfficerId, notes })
      }, token);
      setSuccess("Stage advanced successfully!");
      reload();
    } catch (e) { setError(e.message); }
  };

  const updateStatus = async (status, notes) => {
    try {
      await apiFetch(`/api/students/${student.id}/stage-status`, {
        method: "PATCH", body: JSON.stringify({ stage_status: status, notes })
      }, token);
      setSuccess("Status updated!");
      reload();
    } catch (e) { setError(e.message); }
  };

  const collectPayment = async (stage, mode, ref, notes) => {
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ student_id: student.id, stage, payment_mode: mode, transaction_ref: ref, notes })
      }, token);
      setSuccess("Payment recorded!");
      reload();
    } catch (e) { setError(e.message); }
  };

  const recordVisaDecision = async (decision, notes) => {
    try {
      await apiFetch("/api/visa/decision", {
        method: "POST",
        body: JSON.stringify({ student_id: student.id, decision, notes })
      }, token);
      setSuccess("Visa decision recorded!");
      reload();
    } catch (e) { setError(e.message); }
  };

  const markStageComplete = async () => {
    try {
      await apiFetch(`/api/students/${student.id}/mark-complete`, { method: "POST" }, token);
      setSuccess("Stage marked as complete!");
      reload();
    } catch (e) { setError(e.message); }
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "payments", label: "Payments" },
    { id: "activity", label: "Activity" },
  ];

  const stageColor = STAGES.find(s => s.key === student.current_stage)?.color || "#6b7280";
  const canAdvance = user.role === "super_admin" || ["receptionist","enquiry_officer","counsellor","admission_officer","enrollment_officer"].includes(user.role);
  const isVisa = user.role === "visa_officer" || user.role === "super_admin";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 600 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>{student.first_name} {student.last_name}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <Badge color="#4f46e5">{student.student_code}</Badge>
            <Badge color={stageColor}>{student.current_stage}</Badge>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{student.stage_status?.replace(/_/g, " ")}</span>
          </div>
        </div>
        {user.role === "super_admin" && (
          <Btn size="sm" variant="secondary" onClick={() => setResetTarget({
            id: (detail?.user_id || student?.user_id),
            full_name: `${student.first_name} ${student.last_name}`,
            email: student.email,
          })}>
            🔑 Reset Password
          </Btn>
        )}
      </div>

      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess("")}>{success}</Alert>}

      {/* Progress */}
      <Card style={{ marginBottom: 16 }}>
        <ProgressTracker currentStage={student.current_stage} />
      </Card>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#f9fafb", borderRadius: 10, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: activeTab === t.id ? "#fff" : "transparent",
              color: activeTab === t.id ? "#4f46e5" : "#6b7280",
              boxShadow: activeTab === t.id ? "0 1px 4px #0001" : "none", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <>
          {activeTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Personal Info */}
              <Card>
                <h4 style={{ margin: "0 0 14px", color: "#374151", fontWeight: 700 }}>Personal Information</h4>
                {[
                  ["Email", detail?.email], ["Phone", detail?.phone], ["DOB", detail?.date_of_birth],
                  ["Passport", detail?.passport_number], ["Address", detail?.address],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <span style={{ width: 80, color: "#9ca3af", flexShrink: 0 }}>{k}</span>
                    <span style={{ color: "#111827", fontWeight: v ? 500 : 400 }}>{v || "—"}</span>
                  </div>
                ))}
              </Card>

              {/* Academic/Preference */}
              <Card>
                <h4 style={{ margin: "0 0 14px", color: "#374151", fontWeight: 700 }}>Study Preference</h4>
                {[
                  ["Country", detail?.target_country], ["Course", detail?.target_course], ["University", detail?.target_university],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <span style={{ width: 80, color: "#9ca3af", flexShrink: 0 }}>{k}</span>
                    <span style={{ color: "#111827", fontWeight: v ? 500 : 400 }}>{v || "—"}</span>
                  </div>
                ))}

                {/* Assigned officer */}
                {detail?.assignments?.filter(a => a.is_active).map(a => (
                  <div key={a.id} style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", marginTop: 12 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>Assigned Officer</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#1e40af" }}>{a.officer?.full_name} ({a.stage})</p>
                  </div>
                ))}
              </Card>

              {/* Stage Actions */}
              {user.role !== "student" && (
                <Card style={{ gridColumn: "1 / -1" }}>
                  <h4 style={{ margin: "0 0 14px", color: "#374151", fontWeight: 700 }}>Stage Actions</h4>
                  <StageActions
                    student={student} user={user} officers={officers}
                    onAdvance={advanceStage} onUpdateStatus={updateStatus}
                    onCollectPayment={collectPayment} onVisaDecision={recordVisaDecision}
                    onMarkComplete={markStageComplete}
                    payments={detail?.payments || []}
                  />
                </Card>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentsTab studentId={student.id} token={token} user={user} currentStage={student.current_stage} />
          )}

          {activeTab === "payments" && (
            <PaymentsTab payments={detail?.payments || []} />
          )}

          {activeTab === "activity" && (
            <ActivityTab logs={detail?.audit_logs || []} />
          )}
        </>
      )}

      {resetTarget && (
        <AdminResetPasswordModal token={token} target={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  );
}

// ─── STAGE ACTIONS ────────────────────────────────────────────────────────────
function StageActions({ student, user, officers, onAdvance, onUpdateStatus, onCollectPayment, onVisaDecision, onMarkComplete, payments }) {
  const [advancing, setAdvancing]       = useState(false);
  const [nextOfficerId, setNextOfficerId] = useState("");
  const [notes, setNotes]               = useState("");
  const [payMode, setPayMode]           = useState("cash");
  const [payRef, setPayRef]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [markLoading, setMarkLoading]   = useState(false);
  const [markDone, setMarkDone]         = useState(false);   // local success state

  const stage       = student.current_stage;
  const stageStatus = student.stage_status;
  const paidStages  = payments.map(p => p.stage);

  // ── Payment: which fee belongs to which stage, and which ROLE collects it ──
  const stageFeeConfig = {
    reception:  { payStage: "registration", role: "receptionist"       },
    counsellor: { payStage: "counselling",  role: "counsellor"         },
    admission:  { payStage: "admission",    role: "admission_officer"  },
    enrollment: { payStage: "enrollment",   role: "enrollment_officer" },
    visa:       { payStage: "visa",         role: "visa_officer"       },
  };
  const feeConfig       = stageFeeConfig[stage];
  const currentPayStage = feeConfig?.payStage;
  const currentFeePaid  = paidStages.includes(currentPayStage);
  // Only show fee collection to the officer whose role matches this stage
  const canCollectFee   = feeConfig && (user.role === feeConfig.role || user.role === "super_admin");

  // ── Stage advance: which officer role handles the NEXT stage ──
  const nextStageRoleMap = {
    reception:  "enquiry_officer",
    enquiry:    "counsellor",
    counsellor: "admission_officer",
    admission:  "enrollment_officer",
    enrollment: "visa_officer",
  };
  const nextRole       = nextStageRoleMap[stage];
  const eligibleOfficers = officers.filter(o => o.role === nextRole && o.is_active);

  // ── Status options per stage ──
  const stageStatuses = {
    reception:  ["pending","in_progress"],
    enquiry:    ["pending","in_progress"],
    counsellor: ["pending","in_progress"],
    admission:  ["admission_in_progress"],
    enrollment: ["enrollment_in_progress"],
    visa:       ["visa_in_progress"],
    completed:  [],
  };
  const statuses = stageStatuses[stage] || [];

  // ── Is stage marked complete? (gate for advance) ──
  const completedStatuses = ["completed","admission_completed","enrollment_completed"];
  const isStageComplete   = completedStatuses.includes(stageStatus);

  const canMarkAndAdvance = ["reception","enquiry","counsellor","admission","enrollment"].includes(stage);
  // Only the officer whose role owns this stage (or super admin) should see actions
  const stageOwnerRole = {
    reception: "receptionist", enquiry: "enquiry_officer", counsellor: "counsellor",
    admission: "admission_officer", enrollment: "enrollment_officer", visa: "visa_officer",
  };
  const isOwner = user.role === stageOwnerRole[stage] || user.role === "super_admin";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>

      {/* ── Working status (only owner, only while not yet complete) ── */}
      {isOwner && statuses.length > 0 && !isStageComplete && (
        <div style={{ background: "#f9fafb", borderRadius: 10, padding: 14 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#374151" }}>Working Status</p>
          <select value="" onChange={async e => { if (!e.target.value) return; await onUpdateStatus(e.target.value); }}
            style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none", cursor: "pointer" }}>
            <option value="">Set status…</option>
            {statuses.map(s => (
              <option key={s} value={s} style={{ fontWeight: stageStatus === s ? 700 : 400 }}>
                {stageStatus === s ? "✓ " : ""}{s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
            Current: <strong>{stageStatus?.replace(/_/g, " ")}</strong>
          </p>
        </div>
      )}

      {/* ── Fee collection (only correct role, only if not yet paid) ── */}
      {canCollectFee && currentPayStage && !currentFeePaid && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 14 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#166534" }}>
            Collect {currentPayStage.replace(/_/g, " ")} Fee
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: "#16a34a" }}>₹{STAGE_FEES[currentPayStage]?.toLocaleString()}</p>
          <select value={payMode} onChange={e => setPayMode(e.target.value)}
            style={{ width: "100%", marginBottom: 6, padding: "8px 10px", border: "1.5px solid #86efac", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" }}>
            {["cash","upi","card","bank_transfer"].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
          <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Transaction ref (optional)"
            style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #86efac", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
          <Btn variant="success" onClick={async () => { setLoading(true); await onCollectPayment(currentPayStage, payMode, payRef); setLoading(false); }} loading={loading} style={{ width: "100%" }}>
            Record Payment
          </Btn>
        </div>
      )}
      {canCollectFee && currentPayStage && currentFeePaid && (
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#166534" }}>{currentPayStage} fee collected</p>
            <p style={{ margin: 0, fontSize: 12, color: "#16a34a" }}>₹{STAGE_FEES[currentPayStage]?.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ── Mark Complete + Advance (owner only) ── */}
      {isOwner && canMarkAndAdvance && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>Stage Completion</p>

          {/* Mark complete button — disabled once already complete */}
          {!isStageComplete ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280" }}>
                Done with all {stage} requirements? Mark complete to unlock stage advance.
              </p>
              <Btn
                variant="warning"
                loading={markLoading}
                disabled={markDone}
                onClick={async () => {
                  setMarkLoading(true);
                  await onMarkComplete();
                  setMarkDone(true);    // prevent double-click
                  setMarkLoading(false);
                }}
                style={{ width: "100%", marginBottom: 8 }}>
                {markDone ? "✓ Marking Complete…" : "✓ Mark Stage Complete"}
              </Btn>
            </>
          ) : (
            <div style={{ background: "#d1fae5", borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <span>✅</span>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#065f46" }}>
                Stage marked complete — assign the next officer below
              </p>
            </div>
          )}

          {/* Advance — only visible after stage is complete */}
          {isStageComplete && (
            eligibleOfficers.length > 0 ? (
              <>
                <select value={nextOfficerId} onChange={e => setNextOfficerId(e.target.value)}
                  style={{ width: "100%", marginBottom: 8, padding: "8px 10px", border: "1.5px solid #93c5fd", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" }}>
                  <option value="">Select next officer…</option>
                  {eligibleOfficers.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                </select>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Handover notes (optional)"
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #bfdbfe", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                <Btn
                  variant="primary"
                  disabled={!nextOfficerId}
                  onClick={async () => {
                    if (!nextOfficerId) return;
                    setAdvancing(true);
                    await onAdvance(parseInt(nextOfficerId), notes);
                    setAdvancing(false);
                    setNextOfficerId("");
                    setNotes("");
                  }}
                  loading={advancing}
                  style={{ width: "100%" }}>
                  Advance to Next Stage →
                </Btn>
                {!nextOfficerId && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#93c5fd", textAlign: "center" }}>
                    Select an officer to enable advance
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                No {nextRole?.replace(/_/g, " ")}s available. Ask Super Admin to create one.
              </p>
            )
          )}
        </div>
      )}

      {/* ── Visa Decision (visa officer only) ── */}
      {stage === "visa" && (user.role === "visa_officer" || user.role === "super_admin") && (
        <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 14 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#6d28d9" }}>Visa Decision</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {[
              { v: "visa_approved", label: "✓ Approve", color: "#10b981" },
              { v: "visa_rejected", label: "✗ Reject",  color: "#ef4444" },
              { v: "visa_on_hold",  label: "⏸ Hold",    color: "#f59e0b" },
            ].map(d => (
              <button key={d.v} onClick={async () => { setLoading(true); await onVisaDecision(d.v, notes); setLoading(false); }}
                style={{ flex: 1, padding: "8px 4px", background: d.color, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {d.label}
              </button>
            ))}
          </div>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Decision notes (optional)"
            style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e9d5ff", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#a78bfa", textAlign: "center" }}>
            Rejection auto-creates a refund request for Super Admin
          </p>
        </div>
      )}

      {/* ── Completed ── */}
      {stage === "completed" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 20, textAlign: "center", gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <p style={{ margin: 0, fontWeight: 700, color: "#16a34a", fontSize: 16 }}>All stages complete!</p>
          <p style={{ margin: "6px 0 0", color: "#4ade80", fontSize: 13 }}>Visa journey finished successfully</p>
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENTS TAB ────────────────────────────────────────────────────────────
function DocumentsTab({ studentId, token, user, currentStage }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    apiFetch(`/api/documents?student_id=${studentId}`, {}, token)
      .then(setDocs).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [studentId, token]);

  const handleUpload = async () => {
    if (!file) { setError("Please select a file"); return; }
    const fd = new FormData();
    fd.append("student_id", studentId);
    fd.append("document_type", docType);
    fd.append("notes", notes);
    fd.append("file", file);
    setUploading(true); setError("");
    try {
      await apiUpload("/api/documents", fd, token);
      setSuccess("Document uploaded!"); setShowUpload(false); setFile(null); setNotes("");
      load();
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const deleteDoc = async (id) => {
    if (!window.confirm("Delete this document?")) return;
    await apiFetch(`/api/documents/${id}`, { method: "DELETE" }, token).catch(e => setError(e.message));
    load();
  };

  // Students can upload their own docs; officers can upload for their students
  const canUpload = true;
  // Only officers/admin can delete documents
  const canDelete = user.role !== "student";

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Documents ({docs.length})</h4>
        {canUpload && <Btn size="sm" onClick={() => setShowUpload(s => !s)}>+ Upload Document</Btn>}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {showUpload && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Select label="Document Type" value={docType} onChange={e => setDocType(e.target.value)}>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>)}
            </Select>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>File *</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])}
                style={{ width: "100%", fontSize: 13 }} />
            </div>
          </div>
          <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn size="sm" variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Btn>
            <Btn size="sm" loading={uploading} onClick={handleUpload}>Upload</Btn>
          </div>
        </div>
      )}

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spinner /></div> : (
        docs.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 24 }}>No documents yet</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {docs.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{d.file_name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{d.document_type.replace(/_/g, " ")} • {d.file_size_kb}KB • {new Date(d.uploaded_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {canDelete && (
                  <Btn size="sm" variant="danger" onClick={() => deleteDoc(d.id)}>Delete</Btn>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

// ─── PAYMENTS TAB ─────────────────────────────────────────────────────────────
function PaymentsTab({ payments }) {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const stageColor = (stage) => ({ registration: "#0891b2", counselling: "#d97706", admission: "#dc2626", enrollment: "#7c3aed", visa: "#0284c7" })[stage] || "#6b7280";

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Payment History</h4>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Total Paid</p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#16a34a" }}>₹{total.toLocaleString()}</p>
        </div>
      </div>

      {payments.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 24 }}>No payments yet</p> : (
        payments.map(p => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <Badge color={stageColor(p.stage)}>{p.stage}</Badge>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>{p.payment_mode.toUpperCase()} {p.transaction_ref ? `• ${p.transaction_ref}` : ""} • {new Date(p.paid_at).toLocaleDateString()}</p>
            </div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#16a34a" }}>₹{p.amount.toLocaleString()}</p>
          </div>
        ))
      )}
    </Card>
  );
}

// ─── ACTIVITY TAB ─────────────────────────────────────────────────────────────
function ActivityTab({ logs }) {
  return (
    <Card>
      <h4 style={{ margin: "0 0 16px", fontWeight: 700, color: "#111827" }}>Activity Log</h4>
      {logs.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 24 }}>No activity</p> : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: "#f0f0f0" }} />
          {logs.map(l => (
            <div key={l.id} style={{ display: "flex", gap: 14, marginBottom: 14, position: "relative" }}>
              <div style={{ width: 22, height: 22, background: "#4f46e5", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <div style={{ width: 8, height: 8, background: "#fff", borderRadius: "50%" }} />
              </div>
              <div style={{ paddingTop: 2 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{l.action.replace(/_/g, " ")}</p>
                {l.detail && <p style={{ margin: "2px 0", fontSize: 12, color: "#6b7280" }}>{l.detail}</p>}
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{new Date(l.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── OFFICERS PAGE ────────────────────────────────────────────────────────────
function OfficersPage({ token }) {
  const [officers, setOfficers]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // officer to reset password
  const [error, setError]             = useState("");

  const load = () => {
    setLoading(true);
    apiFetch("/api/officers", {}, token).then(setOfficers).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const deactivate = async (id, name) => {
    if (!window.confirm(`Deactivate ${name}? They will no longer be able to log in.`)) return;
    await apiFetch(`/api/officers/${id}/deactivate`, { method: "PATCH" }, token).catch(e => setError(e.message));
    load();
  };

  const activate = async (id, name) => {
    if (!window.confirm(`Re-activate ${name}?`)) return;
    await apiFetch(`/api/officers/${id}/activate`, { method: "PATCH" }, token).catch(e => setError(e.message));
    load();
  };

  const deleteOfficer = async (id, name) => {
    if (!window.confirm(`\u26a0\ufe0f Permanently delete ${name}?\n\nThis removes their account entirely and cannot be undone.`)) return;
    try {
      await apiFetch(`/api/officers/${id}/permanent`, { method: "DELETE" }, token);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Officers</h2>
        <Btn onClick={() => setShowCreate(true)}>+ Create Officer</Btn>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {officers.map(o => {
            const r = ROLES[o.role] || {};
            const isAdmin = o.role === "super_admin";
            return (
              <Card key={o.id}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, background: r.color + "20", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{r.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" }}>{o.full_name}</p>
                    <p style={{ margin: "2px 0", fontSize: 12, color: "#6b7280" }}>{o.email}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <Badge color={r.color}>{r.label}</Badge>
                      <Badge color={o.is_active ? "#16a34a" : "#dc2626"}>{o.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                    {o.employee_id && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9ca3af" }}>ID: {o.employee_id}</p>}
                  </div>
                </div>
                {!isAdmin && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <Btn size="sm" variant="secondary" onClick={() => setResetTarget(o)}>🔑 Reset Password</Btn>
                    {o.is_active
                      ? <Btn size="sm" variant="warning" onClick={() => deactivate(o.id, o.full_name)}>Deactivate</Btn>
                      : <Btn size="sm" variant="success" onClick={() => activate(o.id, o.full_name)}>Activate</Btn>
                    }
                    <Btn size="sm" variant="danger" onClick={() => deleteOfficer(o.id, o.full_name)}>Delete</Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showCreate  && <CreateOfficerModal token={token} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
      {resetTarget && <AdminResetPasswordModal token={token} target={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}

// ─── CREATE OFFICER MODAL ─────────────────────────────────────────────────────
function CreateOfficerModal({ token, onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "receptionist", employee_id: "", specialisation: "", experience_years: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const officerRoles = Object.entries(ROLES).filter(([k]) => !["super_admin","student"].includes(k));

  const submit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.role) { setError("Name, email, password and role are required"); return; }
    setLoading(true); setError("");
    try {
      const body = {
        ...form,
        phone:            form.phone.trim()          || null,
        employee_id:      form.employee_id.trim()    || null,
        specialisation:   form.specialisation.trim() || null,
        experience_years: form.experience_years      ? parseInt(form.experience_years) : null,
      };
      await apiFetch("/api/officers", { method: "POST", body: JSON.stringify(body) }, token);
      onSuccess();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Create Officer Account" onClose={onClose}>
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Input label="Full Name *" value={form.full_name} onChange={e => set("full_name", e.target.value)} />
        <Input label="Email *" type="email" value={form.email} onChange={e => set("email", e.target.value)} />
        <Input label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} />
        <Input label="Password *" type="password" value={form.password} onChange={e => set("password", e.target.value)} />
        <Select label="Role *" value={form.role} onChange={e => set("role", e.target.value)}>
          {officerRoles.map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </Select>
        <Input label="Employee ID" value={form.employee_id} onChange={e => set("employee_id", e.target.value)} />
        <Input label="Specialisation" value={form.specialisation} onChange={e => set("specialisation", e.target.value)} />
        <Input label="Experience (years)" type="number" value={form.experience_years} onChange={e => set("experience_years", e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn loading={loading} onClick={submit}>Create Officer</Btn>
      </div>
    </Modal>
  );
}

// ─── PAYMENTS PAGE ────────────────────────────────────────────────────────────
function PaymentsPage({ token, user }) {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p1 = apiFetch("/api/payments", {}, token).then(setPayments);
    const p2 = user.role === "super_admin" ? apiFetch("/api/payments/summary", {}, token).then(setSummary) : Promise.resolve();
    Promise.all([p1, p2]).catch(console.error).finally(() => setLoading(false));
  }, [token, user.role]);

  const stageColors = { registration: "#0891b2", counselling: "#d97706", admission: "#dc2626", enrollment: "#7c3aed", visa: "#0284c7" };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>Payments</h2>

      {user.role === "super_admin" && summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          {Object.entries(STAGE_FEES).map(([stage, _]) => {
            const s = summary[stage] || { total: 0, count: 0 };
            return (
              <Card key={stage} style={{ textAlign: "center" }}>
                <Badge color={stageColors[stage]}>{stage}</Badge>
                <p style={{ margin: "8px 0 2px", fontSize: 20, fontWeight: 800, color: "#111827" }}>₹{s.total.toLocaleString()}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{s.count} payments</p>
              </Card>
            );
          })}
          <Card style={{ textAlign: "center", background: "#f0fdf4" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#16a34a", fontWeight: 700 }}>GRAND TOTAL</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#16a34a" }}>₹{(summary.grand_total || 0).toLocaleString()}</p>
          </Card>
        </div>
      )}

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Student ID", "Stage", "Amount", "Mode", "Ref", "Date"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>#{p.student_id}</td>
                  <td style={{ padding: "12px 16px" }}><Badge color={stageColors[p.stage]}>{p.stage}</Badge></td>
                  <td style={{ padding: "12px 16px", fontSize: 15, fontWeight: 700, color: "#16a34a" }}>₹{p.amount.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{p.payment_mode}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{p.transaction_ref || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{new Date(p.paid_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No payments</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── CHANGE PASSWORD MODAL ────────────────────────────────────────────────────
function ChangePasswordModal({ token, onClose }) {
  const [form, setForm]     = useState({ current_password: "", new_password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.current_password || !form.new_password || !form.confirm) { setError("All fields are required."); return; }
    if (form.new_password !== form.confirm) { setError("New passwords do not match."); return; }
    if (form.new_password.length < 6) { setError("New password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: form.current_password, new_password: form.new_password }) }, token);
      setSuccess(true);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <Modal title="Change Your Password" onClose={onClose} width={420}>
      {success ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#111827", margin: "0 0 16px" }}>Password changed successfully!</p>
          <Btn onClick={onClose}>Done</Btn>
        </div>
      ) : (
        <>
          {error && <Alert type="error">{error}</Alert>}
          <Input label="Current Password" type="password" value={form.current_password} onChange={e => set("current_password", e.target.value)} />
          <Input label="New Password" type="password" value={form.new_password} onChange={e => set("new_password", e.target.value)} />
          <Input label="Confirm New Password" type="password" value={form.confirm} onChange={e => set("confirm", e.target.value)} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn loading={loading} onClick={submit}>Update Password</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── ADMIN RESET PASSWORD MODAL ───────────────────────────────────────────────
function AdminResetPasswordModal({ token, target, onClose }) {
  const [newPw, setNewPw]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!target.id) { setError("Student user account not found. Try refreshing the page."); return; }
    if (!newPw || !confirm) { setError("Both fields are required."); return; }
    if (newPw !== confirm) { setError("Passwords do not match."); return; }
    if (newPw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/api/auth/admin-reset-password", { method: "POST", body: JSON.stringify({ user_id: target.id, new_password: newPw }) }, token);
      setSuccess(true);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <Modal title={`Reset Password — ${target.full_name}`} onClose={onClose} width={420}>
      {success ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#111827", margin: "0 0 4px" }}>Password reset successfully!</p>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px" }}>Share the new password with {target.full_name}.</p>
          <Btn onClick={onClose}>Done</Btn>
        </div>
      ) : (
        <>
          {error && <Alert type="error">{error}</Alert>}
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
            Set a new password for <strong>{target.full_name}</strong> ({target.email}).
            They will need this to log in next time.
          </p>
          <Input label="New Password" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn loading={loading} variant="danger" onClick={submit}>Reset Password</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── NOTIFICATIONS PAGE ───────────────────────────────────────────────────────
function NotificationsPage({ token }) {
  const [notifs, setNotifs]   = useState([]);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/notifications", {}, token),
      apiFetch("/api/audit?limit=200", {}, token),
    ]).then(([n, l]) => { setNotifs(n); setLogs(l); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const markRead = async (id) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }, token).catch(() => {});
    load();
  };

  const markAll = async () => {
    await apiFetch("/api/notifications/read-all", { method: "PATCH" }, token).catch(() => {});
    load();
  };

  // Map action strings to readable labels + icons
  const actionMeta = (action) => {
    if (action.includes("REGISTER"))           return { icon: "🎓", color: "#4f46e5", label: "Student Registered" };
    if (action.includes("STAGE_ADVANCE"))      return { icon: "➡️", color: "#0891b2", label: "Stage Advanced" };
    if (action.includes("PAYMENT"))            return { icon: "💰", color: "#d97706", label: "Payment Collected" };
    if (action.includes("VISA_APPROVED"))      return { icon: "✅", color: "#16a34a", label: "Visa Approved" };
    if (action.includes("VISA_REJECTED"))      return { icon: "❌", color: "#dc2626", label: "Visa Rejected" };
    if (action.includes("VISA_ON_HOLD"))       return { icon: "⏸️", color: "#f59e0b", label: "Visa On Hold" };
    if (action.includes("DOCUMENT"))           return { icon: "📄", color: "#7c3aed", label: "Document" };
    if (action.includes("OFFICER_CREAT"))      return { icon: "👔", color: "#059669", label: "Officer Created" };
    if (action.includes("OFFICER_DEACT"))      return { icon: "🚫", color: "#dc2626", label: "Officer Deactivated" };
    if (action.includes("OFFICER_ACT"))        return { icon: "✅", color: "#16a34a", label: "Officer Activated" };
    if (action.includes("OFFICER_DELET"))      return { icon: "🗑️", color: "#dc2626", label: "Officer Deleted" };
    if (action.includes("STUDENT_DELET"))      return { icon: "🗑️", color: "#dc2626", label: "Student Deleted" };
    if (action.includes("PASSWORD"))           return { icon: "🔑", color: "#6d28d9", label: "Password Changed" };
    if (action.includes("REFUND"))             return { icon: "↩️", color: "#0891b2", label: "Refund" };
    if (action.includes("STATUS"))             return { icon: "🔄", color: "#6b7280", label: "Status Updated" };
    return { icon: "📋", color: "#6b7280", label: action.replace(/_/g, " ") };
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
          Notifications
          {unread > 0 && <span style={{ marginLeft: 10, background: "#ef4444", color: "#fff", borderRadius: 12, padding: "2px 9px", fontSize: 13, fontWeight: 700 }}>{unread}</span>}
        </h2>
        {unread > 0 && <Btn size="sm" variant="secondary" onClick={markAll}>Mark All Read</Btn>}
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <div style={{ display: "grid", gap: 8 }}>
          {/* Real notifications first */}
          {notifs.map(n => (
            <Card key={`n-${n.id}`} style={{ background: n.is_read ? "#fff" : "#eff6ff", border: n.is_read ? "1px solid #f0f0f0" : "1px solid #bfdbfe" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>🔔</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 3px", fontWeight: n.is_read ? 500 : 700, fontSize: 14, color: "#111827" }}>{n.title}</p>
                    <p style={{ margin: "0 0 4px", fontSize: 13, color: "#6b7280" }}>{n.message}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#d1d5db" }}>{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
                {!n.is_read && <Btn size="sm" variant="secondary" onClick={() => markRead(n.id)} style={{ flexShrink: 0 }}>Mark Read</Btn>}
              </div>
            </Card>
          ))}

          {/* Audit log events shown as activity cards */}
          {logs.map(l => {
            const meta = actionMeta(l.action);
            return (
              <Card key={`l-${l.id}`} style={{ border: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, background: meta.color + "15", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                      {l.stage && <Badge color="#4f46e5">{l.stage}</Badge>}
                    </div>
                    {l.detail && <p style={{ margin: "3px 0", fontSize: 12, color: "#6b7280" }}>{l.detail}</p>}
                    <p style={{ margin: 0, fontSize: 11, color: "#d1d5db" }}>{new Date(l.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            );
          })}

          {notifs.length === 0 && logs.length === 0 && (
            <Card><p style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>No notifications yet</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
function RefundsPage({ token }) {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    apiFetch("/api/visa/refunds", {}, token).then(setRefunds).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const review = async (id, status, notes) => {
    await apiFetch(`/api/visa/refunds/${id}`, { method: "PATCH", body: JSON.stringify({ status, admin_notes: notes }) }, token).catch(e => setError(e.message));
    load();
  };

  const statusColor = { pending_approval: "#f59e0b", approved: "#10b981", rejected: "#ef4444", paid: "#0891b2" };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>Refund Requests</h2>
      {error && <Alert type="error">{error}</Alert>}

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <div style={{ display: "grid", gap: 12 }}>
          {refunds.map(r => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Student #{r.student_id}</p>
                    <Badge color={statusColor[r.status] || "#6b7280"}>{r.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "#dc2626" }}>₹{r.amount.toLocaleString()}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Reason: {r.reason} • {new Date(r.created_at).toLocaleDateString()}</p>
                  {r.admin_notes && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Notes: {r.admin_notes}</p>}
                </div>
                {r.status === "pending_approval" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn size="sm" variant="success" onClick={() => review(r.id, "approved", "")}>Approve</Btn>
                    <Btn size="sm" variant="danger" onClick={() => review(r.id, "rejected", "")}>Reject</Btn>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {refunds.length === 0 && <Card><p style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>No refund requests</p></Card>}
        </div>
      )}
    </div>
  );
}

// ─── STUDENT PROGRESS PAGE ────────────────────────────────────────────────────
function StudentProgress({ token }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/students/me/profile", {}, token)
      .then(setStudent).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={40} /></div>;
  if (!student) return <Alert type="error">Could not load profile</Alert>;

  const stageColor = STAGES.find(s => s.key === student.current_stage)?.color || "#6b7280";

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>My Application Progress</h2>

      {/* Student Info Card */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, background: "#4f46e510", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>👨‍🎓</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>{student.first_name} {student.last_name}</h3>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <Badge color="#4f46e5">{student.student_code}</Badge>
              <Badge color={stageColor}>{student.current_stage}</Badge>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{student.stage_status?.replace(/_/g, " ")}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Progress Tracker */}
      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 4px", color: "#374151", fontWeight: 700 }}>Workflow Progress</h4>
        <ProgressTracker currentStage={student.current_stage} />
      </Card>

      {/* Study Info */}
      {(student.target_country || student.target_course || student.target_university) && (
        <Card>
          <h4 style={{ margin: "0 0 12px", color: "#374151", fontWeight: 700 }}>Study Preference</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {student.target_country && (
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "10px 12px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>Country</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1d4ed8" }}>{student.target_country}</p>
              </div>
            )}
            {student.target_course && (
              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 12px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>Course</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{student.target_course}</p>
              </div>
            )}
            {student.target_university && (
              <div style={{ background: "#faf5ff", borderRadius: 8, padding: "10px 12px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>University</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#6d28d9" }}>{student.target_university}</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Restore auth from localStorage so page refresh doesn't log out
  const [auth, setAuth] = useState(() => {
    try {
      const saved = localStorage.getItem("iwms_auth");
      return saved ? JSON.parse(saved) : null;
    } catch (_) { return null; }
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem("iwms_auth");
      if (!saved) return null;
      const data = JSON.parse(saved);
      if (data.role === "super_admin") return "dashboard";
      if (data.role === "student") return "progress";
      return "students";
    } catch (_) { return null; }
  });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogin = (data) => {
    setAuth(data);
    const role = data.role;
    if (role === "super_admin") setActiveTab("dashboard");
    else if (role === "student") setActiveTab("progress");
    else setActiveTab("students");
    setSelectedStudent(null);
  };

  const handleLogout = async () => {
    // Call logout endpoint to clear the httpOnly cookie on the server side
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch (_) {}
    // Also clear the in-memory / localStorage copy
    try { localStorage.removeItem("iwms_auth"); } catch (_) {}
    setAuth(null);
    setActiveTab(null);
    setSelectedStudent(null);
  };

  if (!auth) return <LoginPage onLogin={handleLogin} />;

  const mainContent = () => {
    if (selectedStudent && activeTab === "students") {
      return <StudentDetail student={selectedStudent} token={auth.access_token} user={auth} onBack={() => setSelectedStudent(null)} />;
    }
    switch (activeTab) {
      case "dashboard":     return <AdminDashboard token={auth.access_token} />;
      case "students":      return <StudentsList token={auth.access_token} user={auth} onSelectStudent={s => setSelectedStudent(s)} />;
      case "officers":      return <OfficersPage token={auth.access_token} />;
      case "payments":      return <PaymentsPage token={auth.access_token} user={auth} />;
      case "refunds":       return <RefundsPage token={auth.access_token} />;
      case "notifications": return <NotificationsPage token={auth.access_token} />;
      case "progress": return <StudentProgress token={auth.access_token} />;
      case "documents": return auth.role === "student" ? (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>My Documents</h2>
          <StudentDocumentsForSelf token={auth.access_token} />
        </div>
      ) : null;
      default: return <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Select a section from the sidebar</div>;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>
      <Sidebar user={auth} activeTab={activeTab} setActiveTab={t => { setActiveTab(t); setSelectedStudent(null); }} onLogout={handleLogout} onChangePassword={() => setShowChangePassword(true)} />
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 28px 28px", maxWidth: "100%", animation: "fadeUp 0.3s ease" }}>
        {mainContent()}
      </main>
      {showChangePassword && <ChangePasswordModal token={auth.access_token} onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}

// ─── STUDENT DOCUMENTS (self-view) ────────────────────────────────────────────
function StudentDocumentsForSelf({ token }) {
  const [studentId, setStudentId] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/students/me/profile", {}, token)
      .then(s => {
        setStudentId(s.id);
        return apiFetch(`/api/documents?student_id=${s.id}`, {}, token);
      })
      .then(setDocs).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div>;

  return (
    <Card>
      <h4 style={{ margin: "0 0 16px", fontWeight: 700, color: "#111827" }}>Documents ({docs.length})</h4>
      {docs.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 24 }}>No documents uploaded yet</p> : (
        docs.map(d => (
          <div key={d.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{d.file_name}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{d.document_type.replace(/_/g, " ")} • {d.stage} • {new Date(d.uploaded_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}