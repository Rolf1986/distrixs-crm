const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Onjuiste combinatie van e-mailadres en wachtwoord.",
  missing: "Vul zowel e-mailadres als wachtwoord in.",
  ratelimit: "Te veel inlogpogingen. Probeer het over 15 minuten opnieuw.",
  server: "Er ging iets mis — probeer het opnieuw.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#0f172a", margin: 0 }}>Distrixs CRM</h1>
          <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>Log in op je account</p>
        </div>
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "24px" }}>
          {errorMessage && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", marginBottom: "16px" }}>
              {errorMessage}
            </div>
          )}
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
