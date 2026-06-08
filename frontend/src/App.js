import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:8000";

async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROLES = {
  super_admin:       { label: "Super Admin",       color: "#7c3aed", icon: "👑" },
  receptionist:      { label: "Receptionist",      color: "#0891b2", icon: "🏢" },
  enquiry_officer:   { label: "Enquiry Officer",   color: "#059669", icon: "🔍" },
  counsellor:        { label: "Counsellor",        color: "#d97706", icon: "🎓" },
  admission_officer: { label: "Admission Officer", color: "#dc2626", icon: "📋" },
  enrollment_officer:{ label: "Enrollment Officer",color: "#7c3aed", icon: "📝" },
  visa_officer:      { label: "Visa Officer",      color: "#0284c7", icon: "✈️" },
  student:           { label: "Student",           color: "#16a34a", icon: "👨‍🎓" },
};

const STAGES = [
  { key: "reception",  label: "Reception",   step: 1, color: "#0891b2" },
  { key: "enquiry",    label: "Enquiry",     step: 2, color: "#059669" },
  { key: "counsellor", label: "Counselling", step: 3, color: "#d97706" },
  { key: "admission",  label: "Admission",   step: 4, color: "#dc2626" },
  { key: "enrollment", label: "Enrollment",  step: 5, color: "#7c3aed" },
  { key: "visa",       label: "Visa",        step: 6, color: "#0284c7" },
  { key: "completed",  label: "Completed",   step: 7, color: "#16a34a" },
];

const STAGE_FEES = { registration: 5000, counselling: 10000, admission: 20000, enrollment: 15000, visa: 25000 };
const DOC_TYPES = [
  "passport","photograph","marksheet_10","marksheet_12","graduation_docs",
  "resume","counselling_notes","university_shortlist","sop","lor",
  "offer_letter","application_docs","enrollment_letter","tuition_fee_receipt",
  "confirmation_letter","visa_form","bank_statement","financial_docs","visa_decision_letter"
];

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────

function Badge({ children, color = "#6b7280" }) {
  return (
    <span style={{ background: color + "20", color, border: `1px solid ${color}40`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600, letterSpacing: 0.3, display: "inline-block", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Alert({ type, children, onClose }) {
  const cfg = {
    error:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "⚠️" },
    success: { bg: "#f0fdf4", border: "#86efac", text: "#166534", icon: "✓"  },
    info:    { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "ℹ"  },
  }[type] || { bg: "#f9fafb", border: "#d1d5db", text: "#374151", icon: "•" };
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span>{cfg.icon}</span>
      <span style={{ color: cfg.text, fontSize: 14, flex: 1 }}>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: cfg.text, fontSize: 16 }}>×</button>}
    </div>
  );
}

function Spinner({ size = 20, color = "#4f46e5" }) {
  return (
    <div style={{ width: size, height: size, border: `3px solid #e5e7eb`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
  );
}

function Card({ children, style = {} }) {
  return <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 6px #0000000d", border: "1px solid #f0f0f0", ...style }}>{children}</div>;
}

function Modal({ title, onClose, children, width = 540 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px #0003" }}>
        <div style={{ padding: "20px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6" }}>
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
      <input {...props} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${error ? "#f87171" : "#d1d5db"}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fafafa", color: "#111827", transition: "border-color 0.15s", ...props.style }}
        onFocus={e => e.target.style.borderColor = "#4f46e5"}
        onBlur={e => e.target.style.borderColor = error ? "#f87171" : "#d1d5db"} />
      {error && <span style={{ fontSize: 12, color: "#ef4444", marginTop: 3, display: "block" }}>{error}</span>}
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>}
      <select {...props} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", background: "#fafafa", color: "#111827", boxSizing: "border-box", cursor: "pointer", ...props.style }}>
        {children}
      </select>
    </div>
  );
}

function Btn({ children, variant = "primary", loading, size = "md", ...props }) {
  const styles = {
    primary:   { background: "#4f46e5", color: "#fff", border: "none" },
    secondary: { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" },
    danger:    { background: "#ef4444", color: "#fff", border: "none" },
    success:   { background: "#10b981", color: "#fff", border: "none" },
    ghost:     { background: "transparent", color: "#4f46e5", border: "1px solid #4f46e5" },
    warning:   { background: "#f59e0b", color: "#fff", border: "none" },
  };
  const sizes = { sm: "6px 12px", md: "9px 18px", lg: "12px 24px" };
  return (
    <button {...props} disabled={loading || props.disabled}
      style={{ ...styles[variant], padding: sizes[size], borderRadius: 8, fontSize: size === "sm" ? 13 : 14, fontWeight: 600, cursor: loading || props.disabled ? "not-allowed" : "pointer", opacity: loading || props.disabled ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6, transition: "opacity 0.15s", whiteSpace: "nowrap", ...props.style }}>
      {loading && <Spinner size={14} color={variant === "secondary" ? "#4f46e5" : "#fff"} />}
      {children}
    </button>
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
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: done ? "#10b981" : active ? stage.color : "#f3f4f6", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", color: done || active ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 700, transition: "all 0.3s" }}>
                  {done ? "✓" : stage.step}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: "nowrap" }}>{stage.label}</span>
              </div>
              {i < 5 && <div style={{ flex: 1, height: 2, background: done ? "#10b981" : "#e5e7eb", margin: "0 4px", marginBottom: 18, transition: "background 0.3s" }} />}
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e && e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password"); return; }
    setLoading(true); setError("");
    try {
      const data = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ username: email, password }) });
      onLogin(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}} *{box-sizing:border-box}`}</style>

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.5s ease" }}>

        {/* Logo & Branding */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 20, marginBottom: 18, boxShadow: "0 12px 32px #6366f150", position: "relative" }}>
            {/* Globe SVG icon */}
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <circle cx="19" cy="19" r="16" stroke="white" strokeWidth="2" fill="none"/>
              <ellipse cx="19" cy="19" rx="7" ry="16" stroke="white" strokeWidth="1.5" fill="none"/>
              <line x1="3" y1="19" x2="35" y2="19" stroke="white" strokeWidth="1.5"/>
              <line x1="5" y1="12" x2="33" y2="12" stroke="white" strokeWidth="1"/>
              <line x1="5" y1="26" x2="33" y2="26" stroke="white" strokeWidth="1"/>
            </svg>
          </div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.5 }}>VisaFlow</h1>
          <p style={{ color: "#a5b4fc", fontSize: 13, margin: 0, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>Immigration Workflow System</p>
        </div>

        {/* Login Card */}
        <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 20, padding: "32px 32px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "#111827" }}>Welcome back</h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280" }}>Sign in to your account to continue</p>

          {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email address</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>📧</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus
                  style={{ width: "100%", padding: "11px 12px 11px 38px", border: "1.5px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", background: "#fafafa", color: "#111827", transition: "border-color 0.15s" }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "#d1d5db"} />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔒</span>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                  style={{ width: "100%", padding: "11px 40px 11px 38px", border: "1.5px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", background: "#fafafa", color: "#111827", transition: "border-color 0.15s" }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "#d1d5db"} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af", padding: 0, lineHeight: 1 }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "12px", background: loading ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px #6366f140", transition: "all 0.2s" }}>
              {loading ? <><Spinner size={18} color="#fff" /> Signing in…</> : "Sign In →"}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: "14px 16px", background: "#f8f7ff", borderRadius: 10, border: "1px solid #e0e7ff" }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 0.5 }}>Quick Access</p>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6b7280" }}>Students: use your student code (e.g. STU-12345) as both email identifier and password</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["Super Admin","admin@iwms.com","admin123"],["Receptionist","reception@iwms.com","demo123"]].map(([label, u, p]) => (
                <button key={label} onClick={() => { setEmail(u); setPassword(p); }}
                  style={{ padding: "4px 10px", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#7c3aed", cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, color: "#6366f150", fontSize: 12 }}>
          VisaFlow © 2025 · Immigration Workflow Management System
        </p>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ user, activeTab, setActiveTab, onLogout, unreadCount = 0 }) {
  const role = user.role;

  const allNavItems = {
    super_admin: [
      { id: "dashboard",      icon: "📊", label: "Dashboard"    },
      { id: "students",       icon: "👥", label: "Students"     },
      { id: "officers",       icon: "👔", label: "Officers"     },
      { id: "payments",       icon: "💰", label: "Payments"     },
      { id: "refunds",        icon: "↩️", label: "Refunds"      },
      { id: "notifications",  icon: "🔔", label: "Notifications", badge: unreadCount > 0 ? unreadCount : null },
    ],
    receptionist: [
      { id: "students",  icon: "👥", label: "Students"  },
      { id: "payments",  icon: "💰", label: "Payments"  },
      { id: "notifications", icon: "🔔", label: "Notifications" },
    ],
    enquiry_officer: [
      { id: "students",  icon: "👥", label: "Students"  },
      { id: "payments",  icon: "💰", label: "Payments"  },
      { id: "notifications", icon: "🔔", label: "Notifications" },
    ],
    counsellor: [
      { id: "students",  icon: "👥", label: "Students"  },
      { id: "payments",  icon: "💰", label: "Payments"  },
      { id: "notifications", icon: "🔔", label: "Notifications" },
    ],
    admission_officer: [
      { id: "students",  icon: "👥", label: "Students"  },
      { id: "payments",  icon: "💰", label: "Payments"  },
      { id: "notifications", icon: "🔔", label: "Notifications" },
    ],
    enrollment_officer: [
      { id: "students",  icon: "👥", label: "Students"  },
      { id: "payments",  icon: "💰", label: "Payments"  },
      { id: "notifications", icon: "🔔", label: "Notifications" },
    ],
    visa_officer: [
      { id: "students",  icon: "👥", label: "Students"  },
      { id: "payments",  icon: "💰", label: "Payments"  },
      { id: "refunds",   icon: "↩️", label: "Refunds"   },
      { id: "notifications", icon: "🔔", label: "Notifications" },
    ],
    student: [
      { id: "progress",   icon: "📈", label: "My Progress" },
      { id: "documents",  icon: "📄", label: "Documents"   },
      { id: "payments",   icon: "💰", label: "Payments"    },
      { id: "notifications", icon: "🔔", label: "Notifications" },
    ],
  };

  const nav = allNavItems[role] || [];
  const r = ROLES[role] || {};

  return (
    <div style={{ width: 220, height: "100vh", background: "#0f172a", position: "fixed", left: 0, top: 0, display: "flex", flexDirection: "column", zIndex: 100, borderRight: "1px solid #1e293b" }}>
      {/* Brand */}
      <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 38 38" fill="none">
              <circle cx="19" cy="19" r="14" stroke="white" strokeWidth="2.5" fill="none"/>
              <ellipse cx="19" cy="19" rx="6" ry="14" stroke="white" strokeWidth="1.8" fill="none"/>
              <line x1="5" y1="19" x2="33" y2="19" stroke="white" strokeWidth="1.8"/>
              <line x1="7" y1="13" x2="31" y2="13" stroke="white" strokeWidth="1.2"/>
              <line x1="7" y1="25" x2="31" y2="25" stroke="white" strokeWidth="1.2"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: "#f1f5f9", letterSpacing: -0.3 }}>VisaFlow</p>
            <p style={{ margin: 0, fontSize: 10, color: "#64748b", letterSpacing: 0.3 }}>IWMS</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, background: r.color + "30", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{r.label}</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
        {nav.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, border: "none", cursor: "pointer", background: activeTab === item.id ? "#4f46e520" : "transparent", color: activeTab === item.id ? "#818cf8" : "#94a3b8", fontSize: 14, fontWeight: activeTab === item.id ? 600 : 400, textAlign: "left", transition: "all 0.15s", marginBottom: 2, borderLeft: activeTab === item.id ? "3px solid #818cf8" : "3px solid transparent" }}>
            <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge != null && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 9, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{item.badge}</span>}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: 12, borderTop: "1px solid #1e293b" }}>
        <button onClick={onLogout} style={{ width: "100%", padding: "9px 12px", background: "#7f1d1d20", border: "1px solid #7f1d1d40", borderRadius: 8, color: "#fca5a5", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
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
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>Students by Stage</h3>
          {STAGES.map(stage => {
            const count = stats?.students_by_stage?.[stage.key] || 0;
            const max = Math.max(...Object.values(stats?.students_by_stage || { _: 1 }), 1);
            return (
              <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 80, fontSize: 12, color: "#6b7280", flexShrink: 0 }}>{stage.label}</span>
                <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: stage.color, borderRadius: 4, transition: "width 0.5s" }} />
                </div>
                <span style={{ width: 24, fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "right" }}>{count}</span>
              </div>
            );
          })}
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>Officer Workload</h3>
          {workload.length === 0
            ? <p style={{ color: "#9ca3af", fontSize: 14 }}>No active assignments</p>
            : workload.map(w => (
              <div key={w.officer_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{w.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{ROLES[w.role]?.label || w.role}</p>
                </div>
                <Badge color={w.active_students > 5 ? "#dc2626" : "#059669"}>{w.active_students} students</Badge>
              </div>
            ))}
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

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/students", {}, token).then(setStudents).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, code…"
          style={{ flex: 1, minWidth: 200, padding: "8px 14px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff" }} />
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          style={{ padding: "8px 14px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, background: "#fff", outline: "none" }}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #f3f4f6" }}>
                  {["Code", "Name", "Email", "Phone", "Stage", "Status", "Action"].map(h => (
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
                    <td style={{ padding: "12px 14px" }}><Btn size="sm" variant="ghost" onClick={() => onSelectStudent(s)}>View →</Btn></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No students found</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showRegModal && <RegisterStudentModal token={token} user={user} onClose={() => setShowRegModal(false)} onSuccess={() => { setShowRegModal(false); load(); }} />}
    </div>
  );
}

// ─── REGISTER STUDENT MODAL ───────────────────────────────────────────────────
function RegisterStudentModal({ token, onClose, onSuccess }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", address: "", passport_number: "", payment_mode: "cash", transaction_ref: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.first_name || !form.last_name || !form.email) { setError("First name, last name and email are required"); return; }
    setLoading(true); setError("");
    try { const data = await apiFetch("/api/students", { method: "POST", body: JSON.stringify(form) }, token); setSuccess(data); }
    catch (e) { setError(e.message); }
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
            <p style={{ margin: 0, fontSize: 13, color: "#0369a1" }}>Email: <strong>{success.email}</strong></p>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13 }}>Login credentials created. Student logs in using their student code as password.</p>
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
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#166534" }}>Registration Fee: ₹5,000</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Select label="Payment Mode" value={form.payment_mode} onChange={e => set("payment_mode", e.target.value)}>
            {["cash","upi","card","bank_transfer"].map(m => <option key={m} value={m}>{m.replace(/_/g, " ").toUpperCase()}</option>)}
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
  // nextStageOfficers: only officers for the NEXT stage — fetched via open endpoint,
  // no admin auth required. Any officer can see who they can hand off to.
  const [nextStageOfficers, setNextStageOfficers] = useState([]);

  // Which stage comes after the student's current stage
  const NEXT_STAGE_MAP = {
    reception:  "enquiry",
    enquiry:    "counsellor",
    counsellor: "admission",
    admission:  "enrollment",
    enrollment: "visa",
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/students/${student.id}`, {}, token);
      setDetail(d);
      setStudent(d);

      // After reloading the student, fetch eligible officers for the NEXT stage.
      // Uses /api/officers/for-stage which is open to all authenticated users.
      const nextStage = NEXT_STAGE_MAP[d.current_stage];
      if (nextStage) {
        const officers = await apiFetch(`/api/officers/for-stage?stage=${nextStage}`, {}, token).catch(() => []);
        setNextStageOfficers(officers || []);
      } else {
        setNextStageOfficers([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [student.id, token]);

  useEffect(() => { reload(); }, [reload]);

  // ── Handler: advance student to next stage with a chosen officer ──
  const advanceStage = async (nextOfficerId, notes) => {
    try {
      await apiFetch(`/api/students/${student.id}/advance-stage`, {
        method: "POST",
        body: JSON.stringify({ student_id: student.id, next_officer_id: nextOfficerId, notes }),
      }, token);
      setSuccess("✅ Student moved to next stage and officer assigned!");
      reload();
    } catch (e) { setError(e.message); }
  };

  // ── Handler: mark current stage requirements complete (unlocks advance) ──
  const markComplete = async () => {
    try {
      await apiFetch(`/api/students/${student.id}/mark-complete`, { method: "POST" }, token);
      setSuccess("✅ Stage marked complete — you can now assign the next officer.");
      reload();
    } catch (e) { setError(e.message); }
  };

  // ── Handler: update in-progress status ──
  const updateStatus = async (s) => {
    try {
      await apiFetch(`/api/students/${student.id}/stage-status`, {
        method: "PATCH",
        body: JSON.stringify({ stage_status: s }),
      }, token);
      setSuccess("Status updated.");
      reload();
    } catch (e) { setError(e.message); }
  };

  // ── Handler: collect stage fee ──
  const collectPayment = async (stage, mode, ref) => {
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ student_id: student.id, stage, payment_mode: mode, transaction_ref: ref }),
      }, token);
      setSuccess("💳 Payment recorded!");
      reload();
    } catch (e) { setError(e.message); }
  };

  // ── Handler: visa decision (visa officer only) ──
  const recordVisaDecision = async (decision, notes) => {
    try {
      await apiFetch("/api/visa/decision", {
        method: "POST",
        body: JSON.stringify({ student_id: student.id, decision, notes }),
      }, token);
      setSuccess("Visa decision recorded!");
      reload();
    } catch (e) { setError(e.message); }
  };

  const stageColor = STAGES.find(s => s.key === student.current_stage)?.color || "#6b7280";
  const tabs = [
    { id: "overview",  label: "Overview"  },
    { id: "documents", label: "Documents" },
    { id: "payments",  label: "Payments"  },
    { id: "activity",  label: "Activity"  },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
        ← Back to Students
      </button>

      {error   && <Alert type="error"   onClose={() => setError("")}  >{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess("")}>{success}</Alert>}

      {/* Student header card */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 52, height: 52, background: "#4f46e510", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👨‍🎓</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>{student.first_name} {student.last_name}</h3>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <Badge color="#4f46e5">{student.student_code}</Badge>
              <Badge color={stageColor}>{student.current_stage}</Badge>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{student.stage_status?.replace(/_/g, " ")}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Email</p>
            <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>{student.email}</p>
            {student.phone && <><p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>Phone</p><p style={{ margin: 0, fontSize: 13, color: "#374151" }}>{student.phone}</p></>}
          </div>
        </div>
        <div style={{ marginTop: 12 }}><ProgressTracker currentStage={student.current_stage} /></div>
      </Card>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "2px solid #f3f4f6" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: activeTab === t.id ? 700 : 400, color: activeTab === t.id ? "#4f46e5" : "#6b7280", borderBottom: activeTab === t.id ? "2px solid #4f46e5" : "2px solid transparent", marginBottom: -2, transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div>
        : (
          <>
            {activeTab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Card>
                  <h4 style={{ margin: "0 0 14px", fontWeight: 700, color: "#111827" }}>Student Info</h4>
                  {[
                    ["Target Country", student.target_country || "—"],
                    ["Target Course",  student.target_course  || "—"],
                    ["University",     student.target_university || "—"],
                    ["Date of Birth",  student.date_of_birth  || "—"],
                    ["Passport",       student.passport_number || "—"],
                    ["Registered",     new Date(student.registered_at).toLocaleDateString()],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f9fafb", fontSize: 13 }}>
                      <span style={{ color: "#6b7280" }}>{k}</span>
                      <span style={{ fontWeight: 600, color: "#111827" }}>{v}</span>
                    </div>
                  ))}
                </Card>

                <Card>
                  <h4 style={{ margin: "0 0 14px", fontWeight: 700, color: "#111827" }}>Stage Actions</h4>
                  <StageActions
                    student={student}
                    user={user}
                    nextStageOfficers={nextStageOfficers}
                    onAdvance={advanceStage}
                    onMarkComplete={markComplete}
                    onUpdateStatus={updateStatus}
                    onCollectPayment={collectPayment}
                    onVisaDecision={recordVisaDecision}
                    payments={detail?.payments || []}
                  />
                </Card>
              </div>
            )}
            {activeTab === "documents" && <DocumentsTab studentId={student.id} token={token} user={user} />}
            {activeTab === "payments"  && <PaymentsTab payments={detail?.payments || []} />}
            {activeTab === "activity"  && <ActivityTab logs={detail?.audit_logs || []} />}
          </>
        )
      }
    </div>
  );
}

// ─── STAGE ACTIONS ────────────────────────────────────────────────────────────
// Workflow for each officer:
//   Step 1: Work on student (set status: pending / in_progress)
//   Step 2: Mark Requirements Complete  ← explicit gate button
//   Step 3: Assign next officer + Advance stage  ← only unlocked after Step 2
function StageActions({ student, user, nextStageOfficers, onAdvance, onUpdateStatus, onCollectPayment, onVisaDecision, onMarkComplete, payments }) {
  const [nextOfficerId, setNextOfficerId] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [visaNotes, setVisaNotes] = useState("");
  const [loadingMark, setLoadingMark] = useState(false);
  const [loadingAdvance, setLoadingAdvance] = useState(false);
  const [loadingPay, setLoadingPay] = useState(false);
  const [loadingVisa, setLoadingVisa] = useState(false);

  const stage = student.current_stage;
  const stageStatus = student.stage_status;

  // Which payment stage maps to this workflow stage
  const stagePaymentMap = { reception: "registration", counsellor: "counselling", admission: "admission", enrollment: "enrollment", visa: "visa" };
  const currentPayStage = stagePaymentMap[stage];
  const paidStages = payments.map(p => p.stage);
  const currentFeePaid = paidStages.includes(currentPayStage);

  // nextStageOfficers already contains only officers for the next stage,
  // filtered and returned by /api/officers/for-stage. No client-side filtering needed.
  const eligibleOfficers = nextStageOfficers || [];

  // Is this stage already marked as complete?
  const completedStatuses = ["completed", "admission_completed", "enrollment_completed"];
  const isStageComplete = completedStatuses.includes(stageStatus);

  // Stages where officer can mark complete + advance
  const canMarkComplete = ["reception","enquiry","counsellor","admission","enrollment"].includes(stage) && !isStageComplete;
  const canAdvance = ["reception","enquiry","counsellor","admission","enrollment"].includes(stage) && isStageComplete;

  // In-progress statuses the officer can set while working
  const workingStatuses = {
    reception:  ["pending","in_progress"],
    enquiry:    ["pending","in_progress"],
    counsellor: ["pending","in_progress"],
    admission:  ["admission_in_progress"],
    enrollment: ["enrollment_in_progress"],
  };
  const currentWorkingStatuses = workingStatuses[stage] || [];

  // Step labels for display
  const STAGE_LABELS_UI = { reception: "Reception", enquiry: "Enquiry", counsellor: "Counselling", admission: "Admission", enrollment: "Enrollment", visa: "Visa" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── COMPLETED BADGE ── */}
      {stage === "completed" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
          <p style={{ margin: 0, fontWeight: 700, color: "#16a34a", fontSize: 15 }}>All stages complete!</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4ade80" }}>Visa journey finished</p>
        </div>
      )}

      {/* ── STEP 1: PAYMENT ── */}
      {currentPayStage && !currentFeePaid && (
        <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#16a34a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>1</div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: 0.5 }}>Collect {currentPayStage} Fee</p>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "#16a34a" }}>₹{STAGE_FEES[currentPayStage]?.toLocaleString()}</p>
          <select value={payMode} onChange={e => setPayMode(e.target.value)} style={{ width: "100%", marginBottom: 6, padding: "8px 10px", border: "1.5px solid #86efac", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" }}>
            {["cash","upi","card","bank_transfer"].map(m => <option key={m} value={m}>{m.replace(/_/g," ").toUpperCase()}</option>)}
          </select>
          <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Transaction ref (optional)" style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #86efac", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
          <Btn variant="success" loading={loadingPay} onClick={async () => { setLoadingPay(true); await onCollectPayment(currentPayStage, payMode, payRef); setLoadingPay(false); }} style={{ width: "100%" }}>
            Record Payment
          </Btn>
        </div>
      )}
      {currentPayStage && currentFeePaid && (
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #bbf7d0" }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#166534" }}>{currentPayStage.charAt(0).toUpperCase() + currentPayStage.slice(1)} fee collected</p>
            <p style={{ margin: 0, fontSize: 11, color: "#16a34a" }}>₹{STAGE_FEES[currentPayStage]?.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ── STEP 2: WORKING STATUS ── */}
      {currentWorkingStatuses.length > 0 && !isStageComplete && stage !== "completed" && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#6b7280", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>2</div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>Update Working Status</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {currentWorkingStatuses.map(s => (
              <button key={s} onClick={async () => { await onUpdateStatus(s); }}
                style={{ flex: 1, padding: "8px 4px", background: stageStatus === s ? "#374151" : "#f3f4f6", color: stageStatus === s ? "#fff" : "#6b7280", border: `1.5px solid ${stageStatus === s ? "#374151" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 3: MARK COMPLETE ── */}
      {canMarkComplete && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#d97706", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>3</div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5 }}>Mark Requirements Complete</p>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
            All {STAGE_LABELS_UI[stage]} requirements are done? Confirm to unlock stage advancement.
          </p>
          <Btn variant="warning" loading={loadingMark} onClick={async () => { setLoadingMark(true); await onMarkComplete(); setLoadingMark(false); }} style={{ width: "100%" }}>
            ✓ Mark {STAGE_LABELS_UI[stage]} Complete
          </Btn>
        </div>
      )}

      {/* ── STEP 4: ASSIGN & ADVANCE (only after complete) ── */}
      {canAdvance && (
        <div style={{ background: "#eff6ff", border: "2px solid #3b82f6", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>4</div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5 }}>Assign Next Officer & Advance</p>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#3b82f6" }}>
            ✓ Stage complete — select the next officer to hand off to
          </p>
          {eligibleOfficers.length > 0 ? (
            <>
              <select value={nextOfficerId} onChange={e => setNextOfficerId(e.target.value)}
                style={{ width: "100%", marginBottom: 8, padding: "9px 10px", border: "1.5px solid #93c5fd", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none", cursor: "pointer" }}>
                <option value="">— Select next officer —</option>
                {eligibleOfficers.map(o => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </select>
              <input value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} placeholder="Handover notes (optional)"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #bfdbfe", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
              <Btn loading={loadingAdvance} disabled={!nextOfficerId}
                onClick={async () => { if (!nextOfficerId) return; setLoadingAdvance(true); await onAdvance(parseInt(nextOfficerId), advanceNotes); setLoadingAdvance(false); setNextOfficerId(""); setAdvanceNotes(""); }}
                style={{ width: "100%", fontSize: 14 }}>
                Advance to Next Stage →
              </Btn>
              {!nextOfficerId && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#93c5fd", textAlign: "center" }}>Select an officer to enable advance</p>}
            </>
          ) : (
            <div style={{ padding: "10px 12px", background: "#dbeafe", borderRadius: 8, fontSize: 12, color: "#1e40af" }}>
              ⚠️ No active officers found for the next stage. Ask Super Admin to create one.
            </div>
          )}
        </div>
      )}

      {/* ── Already advanced / completed stage indicator ── */}
      {isStageComplete && !canAdvance && stage !== "completed" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#166534" }}>Stage complete — student has been moved forward</p>
        </div>
      )}

      {/* ── VISA DECISION (stage 6 only) ── */}
      {stage === "visa" && (
        <div style={{ background: "#faf5ff", border: "1.5px solid #e9d5ff", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#7c3aed", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>✈</div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#5b21b6", textTransform: "uppercase", letterSpacing: 0.5 }}>Visa Decision</p>
          </div>
          <input value={visaNotes} onChange={e => setVisaNotes(e.target.value)} placeholder="Decision notes (optional)"
            style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e9d5ff", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { v: "visa_approved", label: "✓ Approve", bg: "#10b981", text: "#fff" },
              { v: "visa_rejected", label: "✗ Reject",  bg: "#ef4444", text: "#fff" },
              { v: "visa_on_hold",  label: "⏸ Hold",    bg: "#f59e0b", text: "#fff" },
            ].map(d => (
              <button key={d.v} onClick={async () => { setLoadingVisa(true); await onVisaDecision(d.v, visaNotes); setLoadingVisa(false); }}
                style={{ padding: "9px 4px", background: d.bg, color: d.text, border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s" }}>
                {d.label}
              </button>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#a78bfa", textAlign: "center" }}>Rejection auto-creates a refund request for Super Admin</p>
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENTS TAB ────────────────────────────────────────────────────────────
function DocumentsTab({ studentId, token, user }) {
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
    apiFetch(`/api/documents?student_id=${studentId}`, {}, token).then(setDocs).catch(e => setError(e.message)).finally(() => setLoading(false));
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
    try { await apiUpload("/api/documents", fd, token); setSuccess("Uploaded!"); setShowUpload(false); setFile(null); setNotes(""); load(); }
    catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const deleteDoc = async (id) => {
    if (!window.confirm("Delete this document?")) return;
    await apiFetch(`/api/documents/${id}`, { method: "DELETE" }, token).catch(e => setError(e.message));
    load();
  };

  const canUpload = user.role !== "student";
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
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])} style={{ width: "100%", fontSize: 13 }} />
            </div>
          </div>
          <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
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
                {canUpload && <Btn size="sm" variant="danger" onClick={() => deleteDoc(d.id)}>Delete</Btn>}
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
  const stageColor = s => ({ registration: "#0891b2", counselling: "#d97706", admission: "#dc2626", enrollment: "#7c3aed", visa: "#0284c7" })[s] || "#6b7280";
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
                <p style={{ margin: 0, fontSize: 11, color: "#d1d5db" }}>{new Date(l.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── OFFICERS PAGE (with activate/deactivate) ─────────────────────────────────
function OfficersPage({ token }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const load = () => {
    setLoading(true);
    apiFetch("/api/officers", {}, token).then(setOfficers).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const toggleActive = async (officer) => {
    const action = officer.is_active ? "deactivate" : "activate";
    const confirmMsg = officer.is_active
      ? `Deactivate ${officer.full_name}? They will no longer be able to log in.`
      : `Re-activate ${officer.full_name}? They will be able to log in again.`;
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(officer.id);
    try {
      await apiFetch(`/api/officers/${officer.id}/${action}`, { method: "PATCH" }, token);
      setSuccess(`${officer.full_name} has been ${action}d.`);
      load();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Officers</h2>
        <Btn onClick={() => setShowCreate(true)}>+ Create Officer</Btn>
      </div>

      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess("")}>{success}</Alert>}

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
          {officers.map(o => {
            const r = ROLES[o.role] || {};
            return (
              <Card key={o.id} style={{ opacity: o.is_active ? 1 : 0.75, border: o.is_active ? "1px solid #f0f0f0" : "1px solid #fca5a5" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, background: r.color + "20", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{r.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" }}>{o.full_name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.email}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <Badge color={r.color}>{r.label}</Badge>
                      <Badge color={o.is_active ? "#16a34a" : "#dc2626"}>{o.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                    {o.employee_id && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>EMP: {o.employee_id}</p>}
                    {o.phone && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>{o.phone}</p>}
                  </div>
                </div>

                {/* Activate / Deactivate toggle */}
                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  {o.is_active ? (
                    <Btn size="sm" variant="danger" loading={actionLoading === o.id} onClick={() => toggleActive(o)}>
                      Deactivate
                    </Btn>
                  ) : (
                    <Btn size="sm" variant="success" loading={actionLoading === o.id} onClick={() => toggleActive(o)}>
                      ✓ Activate
                    </Btn>
                  )}
                </div>
              </Card>
            );
          })}
          {officers.length === 0 && <p style={{ color: "#9ca3af", fontSize: 14, gridColumn: "1/-1", textAlign: "center", padding: 40 }}>No officers yet. Create one to get started.</p>}
        </div>
      )}

      {showCreate && <CreateOfficerModal token={token} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
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
      await apiFetch("/api/officers", { method: "POST", body: JSON.stringify({ ...form, experience_years: form.experience_years ? parseInt(form.experience_years) : null }) }, token);
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
          {Object.entries(STAGE_FEES).map(([stage]) => {
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
          <div style={{ overflowX: "auto" }}>
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
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── REFUNDS PAGE ─────────────────────────────────────────────────────────────
function RefundsPage({ token }) {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    apiFetch("/api/visa/refunds", {}, token).then(setRefunds).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const review = async (id, status) => {
    try { await apiFetch(`/api/visa/refunds/${id}`, { method: "PATCH", body: JSON.stringify({ status, admin_notes: "" }) }, token); setSuccess("Refund updated."); load(); }
    catch (e) { setError(e.message); }
  };

  const statusColor = { pending_approval: "#f59e0b", approved: "#10b981", rejected: "#ef4444", paid: "#0891b2" };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>Refund Requests</h2>
      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess("")}>{success}</Alert>}
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
                    <Btn size="sm" variant="success" onClick={() => review(r.id, "approved")}>Approve</Btn>
                    <Btn size="sm" variant="danger" onClick={() => review(r.id, "rejected")}>Reject</Btn>
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

// ─── NOTIFICATIONS PAGE ───────────────────────────────────────────────────────
function NotificationsPage({ token, onRead }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiFetch("/api/notifications", {}, token).then(d => { setNotifs(d); onRead && onRead(); }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const markRead = async (id) => { await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }, token).catch(() => {}); load(); };
  const markAll = async () => { await apiFetch("/api/notifications/read-all", { method: "PATCH" }, token).catch(() => {}); load(); };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Notifications</h2>
          {unread > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 9, padding: "2px 10px", fontSize: 13, fontWeight: 700 }}>{unread} new</span>}
        </div>
        {unread > 0 && <Btn size="sm" variant="secondary" onClick={markAll}>Mark All Read</Btn>}
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div> : (
        <div style={{ display: "grid", gap: 10 }}>
          {notifs.map(n => (
            <Card key={n.id} style={{ background: n.is_read ? "#fff" : "#eff6ff", border: n.is_read ? "1px solid #f0f0f0" : "1px solid #bfdbfe", padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: n.is_read ? "#d1d5db" : "#3b82f6", marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 3px", fontWeight: n.is_read ? 500 : 700, fontSize: 14, color: "#111827" }}>{n.title}</p>
                    <p style={{ margin: "0 0 5px", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{n.message}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#d1d5db" }}>{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
                {!n.is_read && <Btn size="sm" variant="secondary" onClick={() => markRead(n.id)} style={{ flexShrink: 0 }}>Mark Read</Btn>}
              </div>
            </Card>
          ))}
          {notifs.length === 0 && <Card><p style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>No notifications yet</p></Card>}
        </div>
      )}
    </div>
  );
}

// ─── STUDENT PROGRESS ─────────────────────────────────────────────────────────
function StudentProgress({ token }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/students/me/profile", {}, token).then(setStudent).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={40} /></div>;
  if (!student) return <Alert type="error">Could not load profile</Alert>;

  const stageColor = STAGES.find(s => s.key === student.current_stage)?.color || "#6b7280";

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>My Application Progress</h2>
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
      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 4px", color: "#374151", fontWeight: 700 }}>Workflow Progress</h4>
        <ProgressTracker currentStage={student.current_stage} />
      </Card>
      {(student.target_country || student.target_course) && (
        <Card>
          <h4 style={{ margin: "0 0 12px", color: "#374151", fontWeight: 700 }}>Study Preference</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {student.target_country && <div style={{ background: "#eff6ff", borderRadius: 8, padding: "10px 12px" }}><p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>Country</p><p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1d4ed8" }}>{student.target_country}</p></div>}
            {student.target_course && <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 12px" }}><p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>Course</p><p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{student.target_course}</p></div>}
            {student.target_university && <div style={{ background: "#faf5ff", borderRadius: 8, padding: "10px 12px" }}><p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>University</p><p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#6d28d9" }}>{student.target_university}</p></div>}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── STUDENT DOCUMENTS (self-view) ────────────────────────────────────────────
function StudentDocumentsForSelf({ token }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/students/me/profile", {}, token)
      .then(s => apiFetch(`/api/documents?student_id=${s.id}`, {}, token))
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

// ─── STUDENT PAYMENTS (self-view) ─────────────────────────────────────────────
function StudentPaymentsForSelf({ token }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/payments", {}, token).then(setPayments).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={36} /></div>;
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const stageColor = s => ({ registration: "#0891b2", counselling: "#d97706", admission: "#dc2626", enrollment: "#7c3aed", visa: "#0284c7" })[s] || "#6b7280";

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>My Payments</h2>
      <Card>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Total Paid</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#16a34a" }}>₹{total.toLocaleString()}</p>
          </div>
        </div>
        {payments.length === 0 ? <p style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>No payments yet</p> : payments.map(p => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div><Badge color={stageColor(p.stage)}>{p.stage}</Badge><p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>{p.payment_mode.toUpperCase()} • {new Date(p.paid_at).toLocaleDateString()}</p></div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#16a34a" }}>₹{p.amount.toLocaleString()}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem("iwms_auth") || "null"); } catch { return null; }
  });
  const [activeTab, setActiveTab] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (auth) {
      const role = auth.role;
      if (!activeTab) {
        if (role === "super_admin") setActiveTab("dashboard");
        else if (role === "student") setActiveTab("progress");
        else setActiveTab("students");
      }
    }
  }, [auth]);

  // Poll for unread notifications (admin only)
  useEffect(() => {
    if (!auth || auth.role !== "super_admin") return;
    const poll = () => {
      apiFetch("/api/notifications", {}, auth.access_token)
        .then(ns => setUnreadCount(ns.filter(n => !n.is_read).length))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [auth]);

  const handleLogin = (data) => {
    setAuth(data);
    localStorage.setItem("iwms_auth", JSON.stringify(data));
    const role = data.role;
    if (role === "super_admin") setActiveTab("dashboard");
    else if (role === "student") setActiveTab("progress");
    else setActiveTab("students");
    setSelectedStudent(null);
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem("iwms_auth");
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
      case "payments":
        if (auth.role === "student") return <StudentPaymentsForSelf token={auth.access_token} />;
        return <PaymentsPage token={auth.access_token} user={auth} />;
      case "refunds":       return <RefundsPage token={auth.access_token} />;
      case "notifications": return <NotificationsPage token={auth.access_token} onRead={() => setUnreadCount(0)} />;
      case "progress":      return <StudentProgress token={auth.access_token} />;
      case "documents":
        if (auth.role === "student") return <div><h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 20px" }}>My Documents</h2><StudentDocumentsForSelf token={auth.access_token} /></div>;
        return null;
      default: return <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Select a section from the sidebar</div>;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>
      <Sidebar user={auth} activeTab={activeTab} setActiveTab={t => { setActiveTab(t); setSelectedStudent(null); }} onLogout={handleLogout} unreadCount={unreadCount} />
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 32px", maxWidth: "100%", animation: "fadeUp 0.3s ease", overflowX: "hidden" }}>
        {mainContent()}
      </main>
    </div>
  );
}