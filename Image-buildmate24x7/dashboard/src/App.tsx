import { FormEvent, useEffect, useState } from "react";
import Workspace from "./Workspace";

type User={id:string;email:string;display_name:string|null};
type LoginResult={user:User};
export default function App(){
  const [token,setToken]=useState<string|null>(null);const [user,setUser]=useState<User|null>(null);const [checking,setChecking]=useState(true);const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;void fetch("/api/v1/auth/me",{credentials:"same-origin"}).then(async r=>{if(r.ok){const current=await r.json() as User;if(active){setUser(current);setToken("")}}}).catch(()=>{}).finally(()=>{if(active)setChecking(false)});return()=>{active=false}},[]);
  async function signIn(e:FormEvent){e.preventDefault();setError("");setBusy(true);try{const r=await fetch("/api/v1/auth/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const data=await r.json();if(!r.ok)throw new Error(data.detail||"Sign in failed");const result=data as LoginResult;setToken("");setUser(result.user);setPassword("");if(!location.hash)location.hash="#/dashboard"}catch(reason){setError(reason instanceof Error?reason.message:"Unable to sign in")}finally{setBusy(false)}}
  async function signOut(){await fetch("/api/v1/auth/logout",{method:"POST",credentials:"same-origin",headers:token?{Authorization:`Bearer ${token}`}:{}}).catch(()=>{});setToken(null);setUser(null)}
  if(checking)return <main className="login-shell"><p role="status">Restoring your session…</p></main>;
  if(user&&token!==null)return <Workspace token={token} user={user} onSignOut={()=>void signOut()}/>;
  return <main className="login-shell"><div className="login-brand"><span className="brand-mark">B</span>BuildMate <b>Image Cloud</b></div><form className="login-panel" onSubmit={e=>void signIn(e)}><div className="eyebrow">IMAGE WORKSPACE</div><h1>Welcome back</h1><p>Sign in to manage your image library.</p><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/>{error&&<p className="error" role="alert">{error}</p>}<button className="primary-action" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><small>Use the administrator account configured for this deployment.</small></form></main>
}
