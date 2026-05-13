export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#0f172a", margin: 0 }}>Distrixs CRM</h1>
          <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>Log in op je account</p>
        </div>
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "24px" }}>
          <form method="POST" action="/api/auth/do-login">
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>E-mailadres</label>
              <input type="email" name="email" required autoFocus
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                placeholder="naam@distrixs.nl" />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>Wachtwoord</label>
              <input type="password" name="password" required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                placeholder="••••••••" />
            </div>
            <button type="submit"
              style={{ width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 16px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
              Inloggen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
