import { useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  LogIn,
  ShieldCheck,
  UserPlus,
  Wrench
} from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Business Owner", email: "obaeed@officekhoj.bd", password: "demo123", icon: BriefcaseBusiness },
  { role: "Property Owner", email: "owner@officekhoj.bd", password: "demo123", icon: Building2 },
  { role: "Service Provider", email: "interior@officekhoj.bd", password: "demo123", icon: Wrench },
  { role: "Admin", email: "admin@officekhoj.bd", password: "admin123", icon: ShieldCheck }
];

const REGISTRATION_ROLES = [
  { value: "business-owner", label: "Business Owner" },
  { value: "property-owner", label: "Property Owner" },
  { value: "service-provider", label: "Service Provider" }
];

export default function AuthPage({ busy, error, onClearError, onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [registrationRole, setRegistrationRole] = useState("business-owner");
  const [localError, setLocalError] = useState("");

  async function submitLogin(event) {
    event.preventDefault();
    setLocalError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onLogin({ email: form.email, password: form.password });
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setLocalError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (form.password !== form.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    delete form.confirmPassword;
    await onRegister({
      ...form,
      coverageAreas: String(form.coverageAreas || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    });
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setLocalError("");
    onClearError?.();
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-labelledby="auth-brand-title">
        <div className="auth-brand-mark"><Building2 size={30} /></div>
        <span className="eyebrow">OfficeKhoj BD</span>
        <h1 id="auth-brand-title">Commercial spaces and setup services in one trusted workspace.</h1>
        <p>Search, list, book and communicate through a secure role-based account.</p>
        <div className="auth-role-summary">
          <span><BriefcaseBusiness size={17} />Business owners discover and book</span>
          <span><Building2 size={17} />Property owners manage spaces</span>
          <span><Wrench size={17} />Service providers publish packages</span>
          <span><ShieldCheck size={17} />Admins verify and moderate</span>
        </div>
      </section>

      <section className="auth-card" aria-label="OfficeKhoj authentication">
        <div className="auth-tabs" role="tablist" aria-label="Authentication options">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Login</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Register</button>
        </div>

        {mode === "login" ? (
          <>
            <div className="auth-card-head">
              <span className="eyebrow">Welcome back</span>
              <h2>Sign in to your workspace</h2>
              <p>Your JWT session will remain available after a page refresh.</p>
            </div>
            <form className="auth-form" onSubmit={submitLogin}>
              <label>Email<input name="email" type="email" autoComplete="email" required /></label>
              <label>Password<input name="password" type="password" autoComplete="current-password" minLength="6" required /></label>
              {(localError || error) ? <p className="auth-error" role="alert">{localError || error}</p> : null}
              <button className="action primary auth-submit" type="submit" disabled={busy}><LogIn size={17} />{busy ? "Signing in..." : "Sign in"}</button>
            </form>

            <div className="demo-login-section">
              <div className="auth-divider"><span>Showcase demo accounts</span></div>
              <div className="demo-login-grid">
                {DEMO_ACCOUNTS.map(({ role, email, password, icon: Icon }) => (
                  <button type="button" key={email} disabled={busy} onClick={() => onLogin({ email, password })}>
                    <Icon size={16} />
                    <span><strong>{role}</strong><small>{email}</small></span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="auth-card-head">
              <span className="eyebrow">Create account</span>
              <h2>Join OfficeKhoj BD</h2>
              <p>Property and service accounts require Admin verification before listing management.</p>
            </div>
            <form className="auth-form" onSubmit={submitRegistration}>
              <div className="field-row">
                <label>Name<input name="name" autoComplete="name" minLength="2" required /></label>
                <label>Phone<input name="phone" type="tel" autoComplete="tel" minLength="7" required /></label>
              </div>
              <label>Email<input name="email" type="email" autoComplete="email" required /></label>
              <label>Account type<select name="role" value={registrationRole} onChange={(event) => setRegistrationRole(event.target.value)}>{REGISTRATION_ROLES.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}</select></label>
              {registrationRole === "property-owner" ? (
                <div className="field-row">
                  <label>NID details<input name="nid" required /></label>
                  <label>Trade license<input name="tradeLicense" required /></label>
                </div>
              ) : null}
              {registrationRole === "service-provider" ? (
                <>
                  <label>Trade license<input name="tradeLicense" required /></label>
                  <label>Coverage areas<input name="coverageAreas" placeholder="Banani, Gulshan" required /></label>
                </>
              ) : null}
              <div className="field-row">
                <label>Password<input name="password" type="password" autoComplete="new-password" minLength="6" required /></label>
                <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength="6" required /></label>
              </div>
              {(localError || error) ? <p className="auth-error" role="alert">{localError || error}</p> : null}
              <button className="action primary auth-submit" type="submit" disabled={busy}><UserPlus size={17} />{busy ? "Creating account..." : "Create account"}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
