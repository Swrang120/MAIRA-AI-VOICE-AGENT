import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AudioLines, BadgeCheck, Check, ChevronRight, CircleDollarSign, Crown, Headphones, LayoutDashboard, LogOut, Mic2, RefreshCw, ShieldCheck, Users, X } from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabaseClient";
import "./admin.css";

const tabs = [
  ["Overview", LayoutDashboard], ["Voice Cloning", Mic2], ["Voice Library", Headphones],
  ["Users & Access", Users], ["Subscriptions", Crown], ["Creator Earnings", CircleDollarSign], ["Activity", Activity]
];
const money = n => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(Number(n || 0));
const idFor = name => "MR-" + String(name || "VOICE").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5).padEnd(5,"X") + "-" + Date.now().toString().slice(-6);
function AdminApp() {
  const [session,setSession] = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [role,setRole] = useState("");
  const [loginMode,setLoginMode] = useState("google");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [tab,setTab] = useState("Overview");
  const [users,setUsers] = useState([]);
  const [voices,setVoices] = useState([]);
  const [requests,setRequests] = useState([]);
  const [plans,setPlans] = useState([]);
  const [earnings,setEarnings] = useState([]);
  const [subscriptions,setSubscriptions] = useState([]);
  const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(false);
  const [voiceName,setVoiceName] = useState("");
  const [voiceLanguage,setVoiceLanguage] = useState("Hindi");
  const [ownerId,setOwnerId] = useState("");
  const [sample,setSample] = useState(null);
  const [consent,setConsent] = useState(false);
  const [publishConsent,setPublishConsent] = useState(false);
  const [voiceDescription,setVoiceDescription] = useState("");
  const [cloneBusy,setCloneBusy] = useState(false);
  const [newPlanName,setNewPlanName] = useState("");
  const [newPlanPrice,setNewPlanPrice] = useState("");
  const [newPlanCharacters,setNewPlanCharacters] = useState("10000");
  const flash = msg => { setNotice(msg); window.setTimeout(()=>setNotice(""),5000); };

  const loadAll = useCallback(async () => {
    if (!supabase || !session || role !== "admin") return;
    setLoading(true);
    const results = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,role,created_at").order("created_at",{ascending:false}).limit(500),
      supabase.from("voice_profiles").select("*").order("created_at",{ascending:false}).limit(500),
      supabase.from("voice_clone_requests").select("*").order("created_at",{ascending:false}).limit(500),
      supabase.from("voice_subscription_plans").select("*").order("created_at",{ascending:false}),
      supabase.from("voice_creator_earnings").select("*").order("created_at",{ascending:false}).limit(500),
      supabase.from("voice_subscriptions").select("*").order("created_at",{ascending:false}).limit(500),
    ]);
    const [u,v,r,p,e,s] = results;
    const err = results.find(x=>x.error)?.error;
    if (err) flash("Some admin data could not load: " + err.message);
    if (!u.error) setUsers(u.data||[]);
    if (!v.error) setVoices(v.data||[]);
    if (!r.error) setRequests(r.data||[]);
    if (!p.error) setPlans(p.data||[]);
    if (!e.error) setEarnings(e.data||[]);
    if (!s.error) setSubscriptions(s.data||[]);
    setLoading(false);
  },[session,role]);

  useEffect(()=>{
    if (!supabase) { setAuthLoading(false); return; }
    let alive=true;
    const check = async nextSession => {
      if (!alive) return;
      setSession(nextSession);
      if (!nextSession?.user) { setRole(""); setAuthLoading(false); return; }
      const {data,error} = await supabase.from("profiles").select("role").eq("id",nextSession.user.id).maybeSingle();
      if (!alive) return;
      setRole(error ? "" : data?.role || "user");
      setAuthLoading(false);
    };
    supabase.auth.getSession().then(({data})=>check(data.session));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{check(next);});
    return ()=>{alive=false;listener.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{ if(role==="admin"&&session) loadAll(); },[role,session,loadAll]);

  const signIn = async () => {
    if (!supabase) return flash("Supabase environment is not configured.");
    setBusy(true);
    try {
      if(loginMode==="google"){
        const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/admin.html"}});
        if(error) throw error;
      } else {
        if(!email.trim()||!password) throw new Error("Enter the admin email and password.");
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
      }
    } catch(e){flash(e.message||"Sign-in failed.");}
    finally{setBusy(false);}
  };
  const saveVoice = async e => {
    e.preventDefault();
    if(!voiceName.trim()||!ownerId||!sample||!consent) return flash("Enter voice name, assign the owner, upload a sample and confirm consent.");
    setCloneBusy(true);
    try{
      const base64 = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(sample);});
      const {data:sessionData}=await supabase.auth.getSession();
      const token=sessionData?.session?.access_token;
      if(!token) throw new Error("Please sign in again before creating a voice clone.");
      const resp=await fetch("/api/elevenlabs/clone",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({name:voiceName.trim(),description:voiceDescription.trim(),sampleBase64:base64,fileName:sample.name,consent:true})});
      const data=await resp.json();
      if(!resp.ok) throw new Error(data.error||"Voice cloning failed.");
      const row={public_voice_id:idFor(voiceName),name:voiceName.trim(),language:voiceLanguage,profile_type:"Clone",description:voiceDescription.trim(),status:"active",owner_id:ownerId,provider:"elevenlabs",provider_voice_id:data.voice_id,consent_confirmed:true,created_by:session.user.id,visibility:publishConsent?"public":"private",public_listing_consent:publishConsent,public_listing_consent_at:publishConsent?new Date().toISOString():null,owner_payout_percent:30};
      const {error}=await supabase.from("voice_profiles").insert(row);
      if(error) throw new Error("Clone was created by the voice service, but MAIRA could not save its profile. Admin must reconcile it before retrying. "+error.message);
      flash(publishConsent?"Voice cloned and listed publicly (owner opt-in recorded).":"Voice cloned and saved privately for the selected user.");
      setVoiceName("");setVoiceDescription("");setSample(null);setConsent(false);setPublishConsent(false);await loadAll();setTab("Voice Library");
    }catch(e){flash(e.message||"Could not create voice clone.");}
    finally{setCloneBusy(false);}
  };
  const updateVoice = async (voice,patch) => {
    const {error}=await supabase.from("voice_profiles").update(patch).eq("id",voice.id);
    if(error) flash(error.message); else {flash("Voice settings saved.");await loadAll();}
  };
  const updateRequest = async (request,status) => {
    const {error}=await supabase.from("voice_clone_requests").update({status,updated_at:new Date().toISOString(),admin_notes:"Updated in MAIRA Admin"}).eq("id",request.id);
    if(error) flash(error.message); else {flash("Request status updated.");await loadAll();}
  };
  const addPlan = async e => {
    e.preventDefault();
    const price=Number(newPlanPrice), chars=Number(newPlanCharacters);
    if(!newPlanName.trim()||!Number.isFinite(price)||price<0||!Number.isInteger(chars)||chars<0) return flash("Enter valid plan details.");
    const {error}=await supabase.from("voice_subscription_plans").insert({code:newPlanName.toLowerCase().replace(/[^a-z0-9]+/g,"_")+"_"+Date.now().toString().slice(-4),name:newPlanName.trim(),price_inr:price,billing_period:"monthly",included_characters:chars,is_active:true});
    if(error) flash(error.message); else {setNewPlanName("");setNewPlanPrice("");flash("Subscription plan created. Payment collection is not enabled yet.");await loadAll();}
  };
  const setPlanActive = async (p,is_active) => {const {error}=await supabase.from("voice_subscription_plans").update({is_active}).eq("id",p.id);if(error)flash(error.message);else await loadAll();};
  const updateEarning = async (e,status) => {const {error}=await supabase.from("voice_creator_earnings").update({status,paid_at:status==="paid"?new Date().toISOString():null}).eq("id",e.id);if(error)flash(error.message);else{flash("Creator ledger status updated. Mark Paid only after an actual payment.");await loadAll();}};
  const togglePublic = async v => {
    if(v.visibility!=="public"&&!v.public_listing_consent){flash("Cannot publish: the voice owner has not opted in to public listing.");return;}
    await updateVoice(v,{visibility:v.visibility==="public"?"private":"public",public_listing_consent:v.visibility==="public"?false:true,public_listing_consent_at:v.visibility==="public"?null:(v.public_listing_consent_at||new Date().toISOString())});
  };
  const signOut = async()=>{await supabase?.auth.signOut();window.location.href="/admin.html";};

  if(authLoading) return <div className="admin-loading"><div className="admin-logo">M</div><h1>MAIRA Admin</h1><p>Checking secure access…</p></div>;
  if(!session) return <div className="admin-auth-wrap"><div className="admin-auth-card"><div className="admin-logo"><AudioLines/></div><div className="admin-kicker">RESTRICTED CONTROL CENTER</div><h1>MAIRA <span>Admin</span></h1><p>Sign in with an account that has the administrator role.</p>{!supabaseConfigured&&<div className="admin-alert">Supabase environment variables are missing.</div>}<div className="admin-auth-tabs"><button className={loginMode==="google"?"active":""} onClick={()=>setLoginMode("google")}>Google</button><button className={loginMode==="password"?"active":""} onClick={()=>setLoginMode("password")}>Email + Password</button></div>{loginMode==="password"&&<><label>Email<input value={email} type="email" onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label><label>Password<input value={password} type="password" onChange={e=>setPassword(e.target.value)}/></label></>}<button className="admin-primary wide" disabled={busy||!supabaseConfigured} onClick={signIn}>{busy?"Please wait…":loginMode==="google"?"Continue with Google":"Sign in securely"}</button><a className="admin-back" href="/">← Back to MAIRA Voice Studio</a>{notice&&<div className="admin-alert">{notice}</div>}</div></div>;
  if(role!=="admin") return <div className="admin-auth-wrap"><div className="admin-auth-card"><div className="admin-logo"><ShieldCheck/></div><div className="admin-kicker">ACCESS RESTRICTED</div><h1>Admin access required</h1><p>This account does not have the MAIRA administrator role. The admin panel is not available to regular users.</p><button className="admin-primary wide" onClick={signOut}>Sign out</button><a className="admin-back" href="/">Open user website</a></div></div>;

  const pending=requests.filter(r=>["pending_review","approved","in_progress"].includes(r.status)).length;
  const activeVoices=voices.filter(v=>v.status==="active").length;
  return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><div className="admin-logo"><AudioLines/></div><div><b>MAIRA<span>.</span></b><small>ADMIN CONTROL CENTER</small></div></div><div className="admin-identity"><ShieldCheck/><div><b>Administrator</b><small>{session.user.email}</small></div></div><div className="admin-nav-label">MANAGEMENT</div>{tabs.map(([name,Icon])=><button key={name} className={"admin-nav "+(tab===name?"active":"")} onClick={()=>setTab(name)}><Icon size={18}/>{name}<ChevronRight size={14}/></button>)}<div className="admin-side-bottom"><a href="/">↗ Open user website</a><button onClick={signOut}><LogOut size={16}/> Sign out</button></div></aside><main className="admin-main"><header className="admin-topbar"><div><div className="admin-kicker">SECURE ADMINISTRATOR WORKSPACE</div><h1>{tab}</h1></div><div className="admin-top-actions"><span className="admin-live"><i/> Connected</span><button className="admin-icon-button" onClick={loadAll} title="Refresh"><RefreshCw size={17}/></button></div></header><div className="admin-content">
  {tab==="Overview"&&<><div className="admin-welcome"><div><span className="admin-kicker">PLATFORM CONTROL</span><h2>Everything in one place.</h2><p>Private voices by default. Public listing only with recorded creator permission.</p></div><ShieldCheck size={42}/></div><div className="admin-stats"><Metric icon={Users} label="User accounts" value={users.length}/><Metric icon={Headphones} label="Voice profiles" value={voices.length}/><Metric icon={Mic2} label="Open requests" value={pending}/><Metric icon={Crown} label="Active plans" value={plans.filter(p=>p.is_active).length}/><Metric icon={CircleDollarSign} label="Pending creator earnings" value={money(earnings.filter(e=>e.status==="pending"||e.status==="approved").reduce((a,e)=>a+Number(e.creator_amount||0),0))}/></div><div className="admin-grid-two"><section className="admin-panel"><PanelTitle title="Recent voice profiles" action={()=>setTab("Voice Library")}/>{voices.slice(0,6).map(v=><div className="admin-row" key={v.id}><div className="admin-row-icon"><AudioLines/></div><div className="admin-row-main"><b>{v.name}</b><small>{v.language} · {v.visibility||"private"}</small></div><span className={"admin-chip "+v.status}>{v.status}</span></div>)}{!voices.length&&<Empty>Voice profiles will appear here.</Empty>}</section><section className="admin-panel"><PanelTitle title="Clone request queue" action={()=>setTab("Voice Cloning")}/>{requests.slice(0,6).map(r=><div className="admin-row" key={r.id}><div className="admin-row-icon"><Mic2/></div><div className="admin-row-main"><b>{r.requested_name}</b><small>{r.language} · {r.status}</small></div><button className="admin-small-button" onClick={()=>setTab("Voice Cloning")}>Review</button></div>)}{!requests.length&&<Empty>No clone requests.</Empty>}</section></div></>}
  {tab==="Voice Cloning"&&<><div className="admin-section-intro"><h2>Create a voice clone</h2><p>Only create a clone with the speaker's explicit permission. Private is the default; the owner can opt in to public listing.</p></div><form className="admin-panel admin-form" onSubmit={saveVoice}><div className="admin-form-grid"><label>Voice display name<input value={voiceName} onChange={e=>setVoiceName(e.target.value)} required placeholder="Creator's voice name"/></label><label>Language<select value={voiceLanguage} onChange={e=>setVoiceLanguage(e.target.value)}>{["Hindi","English","Assamese","Bodo","Multilingual","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label className="full">Assign private voice to user<select value={ownerId} onChange={e=>setOwnerId(e.target.value)} required><option value="">Choose account…</option>{users.map(u=><option value={u.id} key={u.id}>{u.display_name||u.email||u.id} — {u.email||u.id}</option>)}</select><small>Only the selected account can see and use a private voice.</small></label><label className="full">Description<textarea value={voiceDescription} onChange={e=>setVoiceDescription(e.target.value)} placeholder="Voice style and permitted use"/></label><label className="full">Audio sample (MP3, WAV, M4A, AAC, OGG or WEBM; max 10 MB)<input type="file" accept="audio/*,video/webm" onChange={e=>setSample(e.target.files?.[0]||null)} required/><small>{sample?sample.name+" · "+(sample.size/1024/1024).toFixed(2)+" MB":"Upload a clear sample from one speaker."}</small></label></div><label className="admin-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I have documented the speaker's permission to create this voice clone.</label><label className="admin-check"><input type="checkbox" checked={publishConsent} onChange={e=>setPublishConsent(e.target.checked)}/> The voice owner has separately agreed to public listing and the 30% creator-share terms.</label><div className="admin-form-footer"><span>Private by default · creator share set to 30% if public</span><button className="admin-primary" disabled={cloneBusy}>{cloneBusy?"Creating clone…":"Create and save voice clone"}</button></div></form><section className="admin-panel"><PanelTitle title="Clone requests awaiting review"/>{requests.map(r=><div className="admin-request-row" key={r.id}><div><b>{r.requested_name}</b><small>{r.request_code} · {r.language} · {r.created_at?new Date(r.created_at).toLocaleString():""}</small><p>{r.notes||r.consent_notes||"No additional notes"}</p></div><select value={r.status} onChange={e=>updateRequest(r,e.target.value)}><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></div>)}{!requests.length&&<Empty>No voice cloning requests have been submitted.</Empty>}</section></>}
  {tab==="Voice Library"&&<section className="admin-panel"><PanelTitle title="All voice profiles" subtitle="Private voices are assigned to one account. Public listing requires recorded opt-in."/><div className="admin-table-wrap"><table><thead><tr><th>Voice</th><th>Owner</th><th>Access</th><th>Status</th><th>Creator share</th><th>Actions</th></tr></thead><tbody>{voices.map(v=><tr key={v.id}><td><b>{v.name}</b><small>{v.public_voice_id} · {v.language}</small></td><td>{users.find(u=>u.id===v.owner_id)?.email||"Unassigned"}</td><td><span className={"admin-chip "+(v.visibility||"private")}>{v.visibility||"private"}</span></td><td><select value={v.status} onChange={e=>updateVoice(v,{status:e.target.value})}><option value="pending">Pending</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="rejected">Rejected</option></select></td><td>{v.visibility==="public"?"30%":"—"}</td><td><div className="admin-actions"><button className="admin-small-button" onClick={()=>togglePublic(v)}>{v.visibility==="public"?"Make private":"Publish"}</button><button className="admin-small-button danger" onClick={()=>updateVoice(v,{status:"inactive"})}>Disable</button></div></td></tr>)}</tbody></table></div>{!voices.length&&<Empty>No voices in the database yet.</Empty>}</section>}
  {tab==="Users & Access"&&<section className="admin-panel"><PanelTitle title="User directory" subtitle="Role assignment is protected in the database. Never grant admin rights from a public form."/><div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Account ID</th><th>Role</th><th>Joined</th><th>Private voices</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.display_name||"MAIRA user"}</b><small>{u.email||"Email unavailable"}</small></td><td><code>{u.id}</code></td><td><span className={"admin-chip "+u.role}>{u.role}</span></td><td>{u.created_at?new Date(u.created_at).toLocaleDateString():"—"}</td><td>{voices.filter(v=>v.owner_id===u.id&&v.visibility!=="public").length}</td></tr>)}</tbody></table></div></section>}
  {tab==="Subscriptions"&&<><section className="admin-panel"><PanelTitle title="Create subscription plan" subtitle="Plan catalogue is managed here. Payment processing is not connected, so plans do not collect money yet."/><form className="admin-plan-form" onSubmit={addPlan}><label>Plan name<input value={newPlanName} onChange={e=>setNewPlanName(e.target.value)} placeholder="Creator monthly" required/></label><label>Monthly price (INR)<input type="number" min="0" step="0.01" value={newPlanPrice} onChange={e=>setNewPlanPrice(e.target.value)} required/></label><label>Included characters<input type="number" min="0" step="1" value={newPlanCharacters} onChange={e=>setNewPlanCharacters(e.target.value)} required/></label><button className="admin-primary">Add plan</button></form></section><section className="admin-panel"><PanelTitle title="Subscription plans"/>{plans.map(p=><div className="admin-plan-row" key={p.id}><div><b>{p.name}</b><small>{p.billing_period} · {Number(p.included_characters||0).toLocaleString("en-IN")} characters</small></div><strong>{money(p.price_inr)}</strong><span className={"admin-chip "+(p.is_active?"active":"inactive")}>{p.is_active?"Active":"Hidden"}</span><button className="admin-small-button" onClick={()=>setPlanActive(p,!p.is_active)}>{p.is_active?"Hide":"Activate"}</button></div>)}{!plans.length&&<Empty>No subscription plans created.</Empty>}</section><section className="admin-panel"><PanelTitle title="Current subscriptions"/><div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Period</th></tr></thead><tbody>{subscriptions.map(s=><tr key={s.id}><td>{users.find(u=>u.id===s.user_id)?.email||s.user_id}</td><td>{plans.find(p=>p.id===s.plan_id)?.name||s.plan_id}</td><td>{s.status}</td><td>{s.ends_at?new Date(s.ends_at).toLocaleDateString():"—"}</td></tr>)}</tbody></table></div></section></>}
  {tab==="Creator Earnings"&&<section className="admin-panel"><PanelTitle title="Creator revenue ledger" subtitle="30% is the configured default creator share for eligible public voice revenue. Mark Paid only after payment is actually sent."/><div className="admin-table-wrap"><table><thead><tr><th>Voice / Creator</th><th>Eligible gross</th><th>Creator share</th><th>Platform share</th><th>Status</th><th>Action</th></tr></thead><tbody>{earnings.map(e=><tr key={e.id}><td><b>{voices.find(v=>v.id===e.voice_profile_id)?.name||e.voice_profile_id}</b><small>{users.find(u=>u.id===e.creator_id)?.email||e.creator_id}</small></td><td>{money(e.gross_amount)}</td><td>{money(e.creator_amount)} ({e.share_percent}%)</td><td>{money(e.platform_amount)}</td><td>{e.status}</td><td><select value={e.status} onChange={ev=>updateEarning(e,ev.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></td></tr>)}</tbody></table></div>{!earnings.length&&<Empty>Creator earnings will appear after billing/usage events are wired to the ledger.</Empty>}</section>}
  {tab==="Activity"&&<section className="admin-panel"><PanelTitle title="Usage and activity"/><p className="admin-muted">Voice usage events are recorded in the database. Detailed generation history will appear after the generation endpoint writes verified usage and revenue ledger rows.</p><div className="admin-stats"><Metric icon={Activity} label="Usage events" value="—"/><Metric icon={CircleDollarSign} label="Recorded creator payouts" value={money(earnings.filter(e=>e.status==="paid").reduce((a,e)=>a+Number(e.creator_amount||0),0))}/></div></section>}
  {loading&&<div className="admin-loading-strip">Refreshing database records…</div>}
  </div></main>{notice&&<div className="admin-toast">{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}</div>;
}
function Metric({icon:Icon,label,value}){return <div className="admin-metric"><div className="admin-metric-icon"><Icon size={18}/></div><small>{label}</small><b>{value}</b></div>}
function PanelTitle({title,subtitle,action}){return <div className="admin-panel-title"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action&&<button className="admin-small-button" onClick={action}>View all →</button>}</div>}
function Empty({children}){return <div className="admin-empty">{children}</div>}
createRoot(document.getElementById("root")).render(<AdminApp/>);
