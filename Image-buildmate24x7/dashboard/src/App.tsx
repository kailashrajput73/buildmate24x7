import { FormEvent, useEffect, useState } from "react";
import FolderManager from "./FolderManager";
import UploadManager from "./UploadManager";

type User = { id: string; email: string; display_name: string | null };
type LoginResult = { access_token: string; token_type: string; expires_in: number; user: User };

const API = "";

async function getHealth(): Promise<string> {
  try {
    const response = await fetch(`${API}/health/ready`);
    return response.ok ? "Connected" : "Database unavailable";
  } catch {
    return "API unavailable";
  }
}

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [health, setHealth] = useState("Checking");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [folderRefresh, setFolderRefresh] = useState(0);

  useEffect(() => {
    void getHealth().then(setHealth);
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Sign in failed");
      const result = body as LoginResult;
      setToken(result.access_token);
      setUser(result.user);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (token) await fetch(`${API}/api/v1/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setToken(null);
    setUser(null);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPasswordMessage("");
    try {
      const response = await fetch(`${API}/api/v1/auth/password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail ?? "Password change failed");
      }
      setToken(null);
      setUser(null);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated. Sign in with your new password.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password change failed");
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="BuildMate Image Cloud home"><span className="brand-mark">B</span><span>BuildMate <b>Image Cloud</b></span></a>
        <div className="health"><span className={health === "Connected" ? "dot good" : "dot"} />{health}</div>
      </header>
      <section className="content">
        <div className="eyebrow">ADMINISTRATION</div>
        <h1>{user ? `Welcome, ${user.display_name || user.email}` : "Sign in to your workspace"}</h1>
        <p className="intro">Your independent image management workspace.</p>
        {user ? (
          <>
            <div className="card signed-in">
              <div className="avatar">{user.email.slice(0, 1).toUpperCase()}</div>
              <div><strong>{user.email}</strong><p>Administrator account</p></div>
              <button className="button secondary" onClick={() => void signOut()}>Sign out</button>
            </div>
            <UploadManager token={token!} onUploaded={() => setFolderRefresh((value) => value + 1)} />
            <FolderManager token={token!} refreshKey={folderRefresh} />
            <form className="card password-card" onSubmit={(event) => void changePassword(event)}>
              <h2>Change password</h2>
              <label htmlFor="current-password">Current password</label>
              <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={14} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              {error && <p className="error" role="alert">{error}</p>}
              <button className="button" type="submit">Update password</button>
            </form>
          </>
        ) : (
          <form className="card" onSubmit={(event) => void signIn(event)}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            <p className="hint">Use the administrator account configured for this deployment.</p>
          </form>
        )}
        {passwordMessage && <p className="success" role="status">{passwordMessage}</p>}
        <div className="foundation-note"><span>✓</span><div><strong>Folder management is ready</strong><p>Organize image assets with nested folders. Uploads are available through the authenticated API; image library browsing and transformations are planned for later phases.</p></div></div>
      </section>
      <footer>BuildMate Image Cloud <span>Independent service</span></footer>
    </main>
  );
}
