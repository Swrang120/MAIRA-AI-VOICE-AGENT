import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AudioLines, BadgeCheck, Bot, ChevronDown, CircleHelp, Clock3, Coins, Copy, Crown, CreditCard, Download, Headphones, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu, Mic2, Plus, Radio, Search, Settings2, ShieldCheck, Sparkles, SquarePlay, Trash2, Upload, UserRound, Users, Volume2, WandSparkles, X } from "lucide-react";
import "./style.css";
import { supabase, supabaseConfigured } from "./lib/supabaseClient";

const initialVoices = [
  { id: "MR-EN-0001", name: "Maira Studio", language: "English", type: "Studio", status: "Active", description: "Clear, friendly studio voice", createdAt: "Built-in" },
  { id: "MR-HI-0002", name: "Hindi Narrator", language: "Hindi", type: "Narration", status: "Active", description: "Warm Hindi narration voice", createdAt: "Built-in" },
  { id: "MR-MULTI-0003", name: "Creator Voice", language: "Multilingual", type: "Creator", status: "Active", description: "For explainers and social videos", createdAt: "Built-in" },
];
const makeId = (name, count) => {
  const prefix = (name || "VOICE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "X");
  return `MR-${prefix}-${String(count).padStart(4, "0")}`;
};
function App() {
  const [accountUser, setAccountUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [section, setSection] = useState("Overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [voices, setVoices] = useState(() => { try { return JSON.parse(localStorage.getItem("maira_voices")) || initialVoices; } catch { return initialVoices; } });
  const [requests, setRequests] = useState(() => { try { return JSON.parse(localStorage.getItem("maira_requests")) || []; } catch { return []; } });
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("Welcome to MAIRA AI Voice Studio. Your ideas, spoken naturally.");
  const [selectedVoice, setSelectedVoice] = useState("MR-EN-0001");
  const [showAddVoice, setShowAddVoice] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [voiceType, setVoiceType] = useState("Custom");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneLanguage, setCloneLanguage] = useState("Hindi");
  const [cloneNotes, setCloneNotes] = useState("");
  const [cloneGender, setCloneGender] = useState("Female");
  const [cloneCategory, setCloneCategory] = useState("Social Media");
  const [cloneDestination, setCloneDestination] = useState("private");
  const [cloneCustomerEmail, setCloneCustomerEmail] = useState("");
  const [cloneSample, setCloneSample] = useState(null);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneConsent, setCloneConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [elevenVoices, setElevenVoices] = useState([]);
  const [voiceLoadError, setVoiceLoadError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [filter, setFilter] = useState("All");
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [coinCurrency, setCoinCurrency] = useState("INR");
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [checkoutPack, setCheckoutPack] = useState("");
  const coinPacks = coinCurrency === "INR" ? [
    { coins: 999, price: 99, label: "Starter", note: "Try MAIRA voice generation" },
    { coins: 2699, price: 249, label: "Creator", note: "For regular short projects", popular: true },
    { coins: 5499, price: 499, label: "Pro Creator", note: "More room for longer scripts" },
    { coins: 11999, price: 999, label: "Studio", note: "For frequent voice generation" },
    { coins: 24999, price: 1999, label: "Studio Plus", note: "Best for high-volume use" }
  ] : [
    { coins: 999, price: 2, label: "Starter", note: "Try MAIRA voice generation" },
    { coins: 2699, price: 5, label: "Creator", note: "For regular short projects", popular: true },
    { coins: 5499, price: 10, label: "Pro Creator", note: "More room for longer scripts" },
    { coins: 11999, price: 20, label: "Studio", note: "For frequent voice generation" },
    { coins: 24999, price: 40, label: "Studio Plus", note: "Best for high-volume use" }
  ];
  useEffect(() => {
    if (!supabase) { setRoleLoading(false); return; }
    let alive = true;
    const loadIdentity = async (user) => {
      if (!alive) return;
      setAccountUser(user || null);
      setProfileName(user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "");
      if (!user) { setIsAdmin(false); setRoleLoading(false); return; }
      const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!alive) return;
      setIsAdmin(!error && profile?.role === "admin");
      const [voiceResult, planResult, subscriptionResult] = await Promise.all([
        supabase.from("voice_profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("voice_subscription_plans").select("*").eq("is_active", true).order("price_inr", { ascending: true }),
        supabase.from("voice_subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      ]);
      if (!alive) return;
      if (!voiceResult.error) setVoices((voiceResult.data || []).map(v => ({
        id: v.provider_voice_id ? "el:" + v.provider_voice_id : v.public_voice_id,
        dbId: v.id, name: v.name, language: v.language, type: v.profile_type || "Custom",
        status: v.status === "active" ? "Active" : "Inactive", description: v.description || "",
        createdAt: v.created_at, visibility: v.visibility || "private", ownerId: v.owner_id
      })));
      if (!planResult.error) setSubscriptionPlans(planResult.data || []);
      if (!subscriptionResult.error) setMySubscriptions(subscriptionResult.data || []);
      setRoleLoading(false);
    };
    supabase.auth.getUser().then(({ data }) => loadIdentity(data?.user || null)).catch(() => { if (alive) setRoleLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { loadIdentity(session?.user || null); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);
  const saveProfileName = async () => {
    const cleanName = profileName.trim();
    if (!cleanName) { setProfileNotice("Please enter a display name."); return; }
    if (!supabase || !accountUser) { setProfileNotice("Your account session is not ready. Please sign in again."); return; }
    setProfileSaving(true); setProfileNotice("");
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: cleanName } });
    setProfileSaving(false);
    if (error) { setProfileNotice(error.message); return; }
    setAccountUser(data.user);
    setProfileName(data.user?.user_metadata?.display_name || cleanName);
    setProfileNotice("Profile name saved successfully.");
  };
  const refreshWallet = async (quiet = false) => {
    if (!supabase || !accountUser) { setWalletBalance(0); return; }
    if (!quiet) setWalletLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/coins/wallet", { headers: { Authorization: "Bearer " + token } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load wallet.");
      setWalletBalance(Number(payload.balance || 0));
    } catch (error) { if (!quiet) notify(error.message || "Wallet could not be loaded."); }
    finally { setWalletLoading(false); }
  };
  useEffect(() => { if (accountUser) refreshWallet(true); else setWalletBalance(0); }, [accountUser?.id]);
  const buyCoinPack = async (pack) => {
    if (coinCurrency !== "INR") { notify("USDT checkout is not enabled yet. Please choose INR; no payment was taken."); return; }
    if (!supabase || !accountUser) { notify("Please sign in before buying coins."); return; }
    setCheckoutPack(pack.label); setNotice("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-maira-razorpay="true"]');
          if (existing) { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); if (window.Razorpay) resolve(); return; }
          const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.dataset.mairaRazorpay = "true"; script.onload = resolve; script.onerror = () => reject(new Error("Could not load secure Razorpay checkout. Check your internet connection.")); document.body.appendChild(script);
        });
      }
      const packCode = ({Starter:"starter",Creator:"creator","Pro Creator":"pro_creator",Studio:"studio","Studio Plus":"studio_plus"})[pack.label];
      const orderResponse = await fetch("/api/razorpay/create-order", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token}, body:JSON.stringify({packCode}) });
      const order = await orderResponse.json().catch(()=>({}));
      if (!orderResponse.ok) throw new Error(order.error || "Could not start checkout.");
      await new Promise((resolve, reject) => {
        let finished = false;
        const checkout = new window.Razorpay({ key:order.keyId, amount:order.amount, currency:order.currency, name:order.name, description:order.description, order_id:order.orderId, prefill:{email:accountUser.email||""}, theme:{color:"#d7ad5b"}, modal:{ ondismiss:()=>{ if(!finished) reject(new Error("Checkout closed. No coins were added unless payment was completed.")); } }, handler: async (payment) => {
          try {
            const verifyResponse = await fetch("/api/razorpay/verify-payment", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token}, body:JSON.stringify(payment) });
            const result = await verifyResponse.json().catch(()=>({}));
            if (!verifyResponse.ok || !result.success) throw new Error(result.error || "Payment verification is pending. Refresh your wallet before trying again.");
            finished = true; await refreshWallet(true); notify("Payment verified! " + Number(order.coins).toLocaleString("en-IN") + " coins added to your MAIRA wallet."); resolve();
          } catch (error) { finished = true; reject(error); }
        }});
        checkout.on("payment.failed", (event) => { finished=true; reject(new Error(event?.error?.description || "Payment failed. No coins were added.")); });
        checkout.open();
      });
    } catch (error) { notify(error.message || "Checkout could not be completed."); }
    finally { setCheckoutPack(""); }
  };
  const userEmail = accountUser?.email || accountUser?.phone || "Account details unavailable";
  const googleName = accountUser?.user_metadata?.full_name || accountUser?.user_metadata?.name || accountUser?.email?.split("@")[0] || "Maira User";
  const displayName = accountUser?.user_metadata?.display_name || googleName;
  const avatarLetter = (displayName.trim()[0] || userEmail[0] || "M").toUpperCase();
  useEffect(() => {
    let alive = true;
    const loadPermittedVoices = async () => {
      if (!supabase || !accountUser) { setElevenVoices([]); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setElevenVoices([]); return; }
      const response = await fetch("/api/elevenlabs/voices", { headers: { Authorization: "Bearer " + token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your MAIRA voices.");
      if (alive) { setElevenVoices(data.voices || []); setVoiceLoadError(""); }
    };
    loadPermittedVoices().catch(err => { if (alive) { setElevenVoices([]); setVoiceLoadError(err.message || "Your MAIRA voice library is unavailable."); } });
    return () => { alive = false; };
  }, [accountUser]);
  useEffect(() => localStorage.setItem("maira_voices", JSON.stringify(voices)), [voices]);
  useEffect(() => localStorage.setItem("maira_requests", JSON.stringify(requests)), [requests]);
  const activeVoices = voices.filter(v => v.status === "Active");
  const filteredVoices = useMemo(() => voices.filter(v => (filter === "All" || v.status === filter) && [v.name,v.id,v.language,v.type].join(" ").toLowerCase().includes(search.toLowerCase())), [voices,filter,search]);
  const notify = (msg) => { setNotice(msg); setTimeout(() => setNotice(""), 3500); };
  const retryVoiceLoad = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Please sign in to load your assigned voices.");
      const response = await fetch("/api/elevenlabs/voices", { headers: { Authorization: "Bearer " + token } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load voices.");
      setElevenVoices(payload.voices || []);
      setVoiceLoadError("");
    } catch (error) { setVoiceLoadError(error.message || "Could not load your voices."); }
  };
  const addVoice = (e) => {
    e.preventDefault();
    if (!voiceName.trim()) return;
    const voice = { id: makeId(voiceName, voices.length + 1), name: voiceName.trim(), language, type: voiceType, status: "Active", description: voiceDescription.trim() || "Admin-created voice profile", createdAt: new Date().toLocaleDateString("en-IN") };
    setVoices(prev => [voice, ...prev]); setSelectedVoice(voice.id); setVoiceName(""); setVoiceDescription(""); setShowAddVoice(false); setSection("Voice Library");
    notify("Voice profile created with a unique ID. Connect a voice engine to make it speak.");
  };
  const submitClone = async (e) => {
    e.preventDefault();
    if (!cloneName.trim() || !cloneSample) { notify("Voice name and audio sample are required."); return; }
    if (cloneDestination === "customer" && !cloneCustomerEmail.trim()) { notify("Enter the customer account email."); return; }
    if (!supabase || !accountUser) { notify("Please sign in first."); return; }
    setCloneBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const sampleBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the audio sample."));
        reader.readAsDataURL(cloneSample);
      });
      const response = await fetch("/api/elevenlabs/clone", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ name: cloneName.trim(), description: cloneNotes.trim(), sampleBase64, fileName: cloneSample.name, consent: cloneConsent, language: cloneLanguage, gender: cloneGender, profileType: cloneCategory, destination: cloneDestination, customerEmail: cloneCustomerEmail.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Voice cloning failed.");
      setRequests(prev => [{ id: payload.public_voice_id || payload.voice_id, name: payload.name || cloneName.trim(), language: cloneLanguage, notes: cloneNotes.trim(), status: "Completed", createdAt: new Date().toLocaleString("en-IN") }, ...prev]);
      setCloneName(""); setCloneNotes(""); setCloneCustomerEmail(""); setCloneSample(null); setCloneConsent(false); setShowClone(false); setSection("Voice Library");
      notify("Voice clone created. Private library copy retained; destination: " + cloneDestination + ".");
      const { data: dbVoices, error: dbError } = await supabase.from("voice_profiles").select("*").order("created_at", { ascending: false });
      if (!dbError) setVoices((dbVoices || []).map(v => ({ id: v.provider_voice_id ? "el:" + v.provider_voice_id : v.public_voice_id, dbId: v.id, name: v.name, language: v.language, type: v.profile_type || "Custom", status: v.status === "active" ? "Active" : "Inactive", description: v.description || "", createdAt: v.created_at, visibility: v.visibility || "private", ownerId: v.owner_id })));
      const refreshed = await fetch("/api/elevenlabs/voices", { headers: { Authorization: "Bearer " + token } });
      const voiceData = await refreshed.json().catch(() => ({}));
      if (refreshed.ok) setElevenVoices(voiceData.voices || []);
    } catch (error) { notify(error.message || "Voice cloning failed."); }
    finally { setCloneBusy(false); }
  };
  const removeVoice = (id) => { if (initialVoices.some(v=>v.id===id)) { notify("Built-in demo voices cannot be removed."); return; } setVoices(prev=>prev.filter(v=>v.id!==id)); notify("Voice profile removed."); };
  const speakDemo = async () => {
    if (!text.trim()) return notify("Please enter text first.");
    if (selectedVoice.startsWith("el:")) {
      setGenerating(true); setNotice("");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("Please sign in again before generating audio.");
        const response = await fetch("/api/elevenlabs/speech", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ voiceId: selectedVoice.slice(3), text: text.trim() })
        });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Speech generation failed."); }
        const blob = await response.blob();
        setAudioUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
        notify("MAIRA studio audio generated. Press Play in the audio player.");
      } catch (error) { notify(error.message || "Could not generate speech."); }
      finally { setGenerating(false); }
      return;
    }
    if (!("speechSynthesis" in window)) return notify("Speech preview is not supported in this browser.");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = { Hindi:"hi-IN", English:"en-US", Assamese:"as-IN", Bodo:"hi-IN", Multilingual:"en-IN" };
    utterance.lang = langMap[voices.find(v=>v.id===selectedVoice)?.language] || "en-IN";
    setGenerating(true); utterance.onend = () => setGenerating(false); utterance.onerror = () => setGenerating(false);
    window.speechSynthesis.speak(utterance);
    notify("Browser preview started. Select a MAIRA studio voice for generated MP3 audio.");
  };
  const nav = [
    { group:"WORKSPACE", items:[["Overview",LayoutDashboard],["Voice Studio",AudioLines],["Voice Library",Headphones]] },
    { group:"ACCOUNT", items:[["Usage & Activity",Activity],["Subscription",Crown],["Settings",Settings2]] },
  ];
  const pageIntro = {
    "Overview":["Your voice workspace","Create, organize and manage your voice identities."],
    "Voice Studio":["Voice Studio","Turn written scripts into audio previews."],
    "Voice Library":["Your voice library","Every voice profile has its own unique MAIRA Voice ID."],
    "Subscription":["Voice Subscription","Manage a subscription for your own MAIRA account."],
    "Usage & Activity":["Usage & Activity","Review activity and usage once the backend is connected."],

    "Settings":["Workspace settings","Manage your MAIRA workspace preferences."],
  };
  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu?"open":""}`}>
      <div className="brand"><div className="brand-mark"><AudioLines size={23}/></div><div><strong>MAIRA<span>.</span></strong><small>AI VOICE STUDIO</small></div><button className="mobile-close" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-icon">M</div><div><b>My Workspace</b><small>Free workspace</small></div><ChevronDown size={15}/></div>
      {nav.map(g=><div className="nav-group" key={g.group}><div className="nav-label">{g.group}</div>{g.items.map(([name,Icon])=><button key={name} className={`nav-item ${section===name?"selected":""}`} onClick={()=>{setSection(name);setMobileMenu(false)}}><Icon size={18}/><span>{name}</span>{name==="Voice Requests"&&requests.length>0&&<em>{requests.length}</em>}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Crown size={17}/></div><b>Build your voice brand</b><p>Manage unique voice IDs in one place.</p><button onClick={()=>setSection("Voice Library")}>Explore voice library <span>↗</span></button></div><div className="profile"><div className="avatar">S</div><div className="profile-text"><b>Workspace Owner</b><small>{isAdmin?"Admin preview mode":"Member preview"}</small></div><span className="profile-role-label">{roleLoading ? "Checking access…" : isAdmin ? "Admin access" : "Member account"}</span></div></div>
    </aside>
    {mobileMenu&&<div className="scrim" onClick={()=>setMobileMenu(false)}/>}
    <main className="main">
      <header className="topbar"><div className="top-left"><button className="menu-button" onClick={()=>setMobileMenu(true)}><Menu/></button><div className="breadcrumbs">Workspace <span>/</span> <b>{section}</b></div></div><div className="top-actions"><div className="status-pill"><span/> All systems preview</div><button className="icon-button" title="Help" onClick={()=>notify("Backend setup guide: connect Supabase Auth, database and a licensed voice API.")}><CircleHelp size={18}/></button><button className="maira-profile-trigger" title="Open profile" onClick={() => { setProfileOpen(v => !v); setProfileNotice(""); }} aria-label="Open profile"><span className="maira-profile-trigger-avatar">{avatarLetter}</span><span className="maira-profile-trigger-label">Profile</span><ChevronDown size={14}/></button>{profileOpen && <div className="maira-profile-popover">
  <div className="maira-profile-head"><div className="maira-profile-avatar">{avatarLetter}</div><div className="maira-profile-ident"><b>{displayName}</b><small>{userEmail}</small></div><button className="maira-profile-close" onClick={() => setProfileOpen(false)} aria-label="Close profile"><X size={16}/></button></div>
  <div className="maira-profile-google"><Mail size={16}/><div><small>LINKED EMAIL / LOGIN</small><b>{userEmail}</b></div></div>
  <label className="maira-profile-label">CUSTOM DISPLAY NAME<input value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder={googleName} maxLength={60}/></label>
  <button className="maira-profile-save" onClick={saveProfileName} disabled={profileSaving}>{profileSaving?"Saving…":"Save profile name"}</button>
  {profileNotice && <div className={profileNotice.includes("successfully")?"maira-profile-success":"maira-profile-message"}>{profileNotice}</div>}
  <div className="maira-profile-divider"/>
  <div className="maira-profile-plan"><div className="maira-plan-icon"><Crown size={17}/></div><div><b>Free Subscription</b><small>Current plan · billing not connected</small></div><span>FREE</span></div>
  <div className="maira-profile-coins"><Coins size={17}/><div><b>{walletLoading?"Loading…":walletBalance.toLocaleString("en-IN")+" Coins"}</b><small>Available MAIRA balance · <button className="text-link" onClick={()=>refreshWallet()}>Refresh</button></small></div></div>
  <button className="maira-profile-settings" onClick={()=>{setSection("Settings");setProfileOpen(false);}}><UserRound size={16}/> Account settings</button>
  <button className="maira-profile-logout" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setProfileNotice(error.message);}}><LogOut size={16}/> Sign out</button>
</div>}</div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow"><Sparkles size={14}/> MAIRA VOICE INTELLIGENCE</div><h1>{pageIntro[section]?.[0]}</h1><p>{pageIntro[section]?.[1]}</p></div><div className="heading-actions">{isAdmin&&<a className="btn-secondary" href="/admin.html" style={{textDecoration:"none"}}><ShieldCheck size={15}/> Admin Control Center</a>}</div></div>
        {section==="Overview"&&<><section className="hero-banner"><div className="hero-copy"><div className="hero-tag"><span className="pulse-dot"/> YOUR VOICE. YOUR IDENTITY.</div><h2>Give every idea<br/>a <span>voice of its own.</span></h2><p>Build a curated library of voice identities, preview scripts, and organize custom voice requests from one premium workspace.</p><div className="hero-buttons"><button className="btn-primary" onClick={()=>setSection("Voice Studio")}><WandSparkles size={17}/> Open Voice Studio</button><button className="btn-glass" onClick={()=>setSection("Subscription")}><Crown size={17}/> View subscriptions</button></div><div className="hero-foot"><ShieldCheck size={15}/> Voice cloning is for voices you own or have explicit permission to use.</div></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="voice-orb"><AudioLines size={54}/></div><div className="floating-chip chip-one"><span className="mini-wave">▂▅▇▃▆▂</span><div><b>Voice identity</b><small>Unique ID assigned</small></div></div><div className="floating-chip chip-two"><BadgeCheck size={19}/><div><b>Admin controlled</b><small>Library management</small></div></div><div className="visual-caption">SOUND THAT FEELS LIKE YOU <span>✦</span></div></div></section>
          <div className="stats-grid"><Stat icon={Headphones} label="Voice profiles" value={voices.length} detail="In your library" /><Stat icon={BadgeCheck} label="Active voices" value={activeVoices.length} detail="Ready profiles" /><Stat icon={Mic2} label="Clone requests" value={requests.length} detail="Submitted requests" /><Stat icon={Activity} label="Studio status" value="Preview" detail="Voice API not connected" /></div>
          <div className="section-row"><div><h2>Quick actions</h2><p>Jump straight into your workflow.</p></div><button className="text-link" onClick={()=>setSection("Voice Library")}>View all voices <span>→</span></button></div>
          <div className="quick-grid"><Quick icon={AudioLines} title="Generate speech" desc="Write a script and preview spoken audio." action="Open studio" onClick={()=>setSection("Voice Studio")}/><Quick icon={Crown} title="Voice subscriptions" desc="Review available plans for your account." action="View plans" onClick={()=>setSection("Subscription")}/><Quick icon={Headphones} title="Your voice library" desc="Open voices assigned to your account." action="Open library" onClick={()=>setSection("Voice Library")}/></div>
          <div className="section-row"><div><h2>Recently added voices</h2><p>Your latest voice identities.</p></div><button className="text-link" onClick={()=>setSection("Voice Library")}>Manage library →</button></div><VoiceTable voices={voices.slice(0,4)} onRemove={removeVoice}/></>}
        {section==="Voice Studio"&&<div className="studio-grid"><div className="panel script-panel"><div className="panel-title"><div><h2><AudioLines size={19}/> Text to speech</h2><p>Write your script and choose a voice profile.</p></div><span className="preview-label">BROWSER PREVIEW</span></div><label className="field-label">SCRIPT TEXT</label><textarea className="script-area" value={text} onChange={e=>setText(e.target.value)} maxLength={5000} placeholder="Type or paste your script here..."/><div className="text-meta"><span>{text.length} / 5,000 characters</span><button className="text-link" onClick={()=>setText("")}>Clear text</button></div><label className="field-label">SELECT A VOICE</label><div className="voice-picker-summary"><div className="voice-picker-summary-info"><b>{selectedVoice.startsWith("el:")?(elevenVoices.find(v=>v.voice_id===selectedVoice.slice(3))?.name||"MAIRA Voice"):(voices.find(v=>v.id===selectedVoice)?.name||"MAIRA Voice")}</b><small>Listen to voice samples before choosing.</small></div><button className="btn-primary voice-browse-button" onClick={()=>setShowVoicePicker(true)}><Headphones size={16}/> Browse voices</button></div>{showVoicePicker && <div className="voice-picker-overlay" role="dialog" aria-modal="true" aria-label="Choose a voice">
  <div className="voice-picker-modal">
    <div className="voice-picker-modal-head">
      <div><span className="eyebrow">MAIRA VOICE LIBRARY</span><h2>Choose your voice</h2><p>Only voices assigned to your account or publicly available are listed.</p></div>
      <button className="icon-button" onClick={() => setShowVoicePicker(false)} aria-label="Close voice library"><X size={18}/></button>
    </div>
    {elevenVoices.length > 0 ? <div className="voice-gallery-section">
      <div className="voice-gallery-heading"><div><b>Your available voices</b><p>Select a voice for your project.</p></div><span>{elevenVoices.length} voices</span></div>
      <div className="voice-gallery-grid">
        {elevenVoices.map(v => <article className={"voice-gallery-card" + (selectedVoice === "el:" + v.voice_id ? " is-selected" : "")} key={v.voice_id}>
          <div className="voice-gallery-card-top"><div className="voice-gallery-avatar">{(v.name || "M").split(/\s+/).slice(0,2).map(s => s[0]).join("").toUpperCase()}<span><AudioLines size={13}/></span></div><div className="voice-gallery-title"><b>{v.name}</b><small>{v.category || "MAIRA voice"}</small></div></div>
          <div className="voice-gallery-tags"><span>{v.labels?.language || "Multilingual"}</span><span>{v.labels?.visibility || "private"}</span></div>
          <div className="voice-no-sample">Voice sample preview</div>
          <button className="voice-use-button" onClick={() => { setSelectedVoice("el:" + v.voice_id); setShowVoicePicker(false); notify("Voice selected for your script."); }}>Use this voice</button>
        </article>)}
      </div>
    </div> : <div className="panel"><h2>No assigned voices yet</h2><p>Your Admin will add a private voice to your account, or publish a voice with the creator's permission.</p></div>}
    <div className="voice-picker-modal-foot"><span>MAIRA · Voice Studio</span><button className="btn-secondary" onClick={() => setShowVoicePicker(false)}>Close library</button></div>
  </div>
</div>}{voiceLoadError&&<div className="studio-notice"><CircleHelp size={17}/><div><b>Studio voice library unavailable</b><p>{voiceLoadError}</p><button className="text-link" onClick={retryVoiceLoad}>Retry connection</button></div></div>}<div className="studio-notice"><Sparkles size={17}/><div><b>{selectedVoice.startsWith("el:")?"MAIRA AI Voice":"Browser preview"}</b><p>{selectedVoice.startsWith("el:")?"Generate studio-quality MP3 audio using MAIRA voice services. Cost: 1 coin per 100 characters (minimum 1 coin).":"Choose a MAIRA studio voice for generated audio. Browser voices are only local previews."}</p></div></div>{audioUrl&&<audio controls src={audioUrl} style={{width:"100%",marginTop:14}}/>}<div className="studio-controls"><button className="btn-primary" onClick={speakDemo} disabled={generating}><Volume2 size={17}/>{generating?"Generating…":selectedVoice.startsWith("el:")?"Generate MP3 audio":"Play voice preview"}</button><button className="btn-secondary" onClick={()=>{window.speechSynthesis?.cancel();setGenerating(false);notify("Preview stopped.");}}>Stop</button></div></div><div className="panel voice-preview-panel"><div className="preview-art"><div className="preview-glow"/><AudioLines size={55}/><div className="wave-bars">{Array.from({length:28},(_,i)=><i key={i} style={{"--h":(12+(i*17)%44)+"px"}}/>)}</div></div><div className="voice-preview-info"><span className="status-tag"><span/> PROFILE SELECTED</span><h2>{voices.find(v=>v.id===selectedVoice)?.name||"Choose a voice"}</h2><p>{voices.find(v=>v.id===selectedVoice)?.description||"Select a voice profile to begin."}</p><div className="id-box"><div><small>MAIRA VOICE ID</small><b>{selectedVoice}</b></div><button className="icon-button" onClick={()=>{navigator.clipboard?.writeText(selectedVoice);notify("Voice ID copied.")}}><Copy size={16}/></button></div><div className="info-line"><span>Language</span><b>{voices.find(v=>v.id===selectedVoice)?.language||"—"}</b></div><div className="info-line"><span>Profile type</span><b>{voices.find(v=>v.id===selectedVoice)?.type||"—"}</b></div></div></div></div>}
        {section==="Voice Library"&&<><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, ID or language..."/></div><select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></div><div className="panel"><VoiceTable voices={filteredVoices} onRemove={()=>notify("Voice management is restricted to the MAIRA Admin Panel.")} detailed/></div><div className="hint-card"><ShieldCheck size={19}/><div><b>Voice IDs are permanent identifiers for profiles, not voice-generation credentials.</b><p>Creating an ID organizes the profile. To make it speak with a custom cloned voice, connect a supported voice engine and store its provider voice ID securely on the backend.</p></div></div></>}
        {section==="Voice Requests"&&<><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search requests..."/></div><button className="btn-primary" onClick={()=>setShowClone(true)}><Plus size={17}/> New request</button></div>{requests.length===0?<Empty icon={Mic2} title="No voice requests yet" desc="Submit a request for a new voice profile or an authorized voice clone." action="Request a voice" onClick={()=>setShowClone(true)}/>:<div className="request-list">{requests.filter(r=>[r.name,r.id,r.status].join(" ").toLowerCase().includes(search.toLowerCase())).map(r=><div className="request-card" key={r.id}><div className="request-icon"><Mic2/></div><div className="request-body"><div className="request-name">{r.name}<span className="pending-tag">{r.status}</span></div><p>{r.language} · {r.id}</p>{r.notes&&<p className="request-notes">{r.notes}</p>}<small>Submitted {r.createdAt}</small></div>{isAdmin&&<select className="filter-select" value={r.status} onChange={e=>setRequests(prev=>prev.map(x=>x.id===r.id?{...x,status:e.target.value}:x))}><option>Pending review</option><option>Approved</option><option>In progress</option><option>Completed</option><option>Rejected</option></select>}</div>)}</div>}<div className="hint-card"><LockKeyhole size={19}/><div><b>Production note</b><p>Requests are currently stored in this browser only. Supabase authentication, database policies and secure file upload are required for real user/admin workflows.</p></div></div></>}
        {section==="Admin Console"&&<><div className="admin-banner"><ShieldCheck size={22}/><div><b>Admin preview tools</b><p>This switch is only a visual demo, not secure administrator authentication. Real admin access must be enforced server-side.</p></div><button className={`btn-secondary ${isAdmin?"active-toggle":""}`} onClick={()=>setIsAdmin(v=>!v)}>{isAdmin?"Admin preview ON":"Enable demo preview"}</button></div><div className="stats-grid admin-stats"><Stat icon={Headphones} label="Voice profiles" value={voices.length} detail="Local browser data"/><Stat icon={Mic2} label="Voice requests" value={requests.length} detail="Local browser data"/><Stat icon={BadgeCheck} label="Active profiles" value={activeVoices.length} detail="Local browser data"/><Stat icon={Users} label="User accounts" value="—" detail="Connect Supabase Auth"/></div><div className="section-row"><div><h2>Voice profile management</h2><p>Create IDs, update status, and remove local demo profiles.</p></div><div className="heading-actions"><button className="btn-secondary" onClick={()=>{setCloneDestination("private");setShowClone(true);}}><Mic2 size={16}/> Clone voice</button><button className="btn-primary" onClick={()=>setShowAddVoice(true)}><Plus size={17}/> Add voice</button></div></div><div className="panel"><VoiceTable voices={voices} onRemove={removeVoice} detailed admin onStatus={(id,status)=>setVoices(prev=>prev.map(v=>v.id===id?{...v,status}:v))}/></div><div className="section-row"><div><h2>Voice clone queue</h2><p>Review incoming voice requests.</p></div><button className="text-link" onClick={()=>setSection("Voice Requests")}>Open queue →</button></div><div className="panel">{requests.length?requests.map(r=><div className="admin-request" key={r.id}><div><b>{r.name}</b><small>{r.id} · {r.language}</small></div><select className="filter-select" value={r.status} onChange={e=>setRequests(prev=>prev.map(x=>x.id===r.id?{...x,status:e.target.value}:x))}><option>Pending review</option><option>Approved</option><option>In progress</option><option>Completed</option><option>Rejected</option></select></div>):<p className="empty-inline">No requests to review yet.</p>}</div></>}
        {section==="AI Calling Agents"&&<ComingSoon icon={Radio} title="AI calling agents" desc="This module will let you configure inbound and outbound agents, choose a voice ID, write call flows, and review call outcomes." points={["Agent profiles and assigned voice IDs","Call scripts, greetings and business hours","Consent-aware calling controls and call logs"]}/>}
        {section==="Usage & Activity"&&<ComingSoon icon={Activity} title="Usage analytics will appear here" desc="Once Supabase and a voice provider are connected, this page can show generated characters, audio duration, request history and provider costs." points={["Text-to-speech usage","Voice request status","Daily activity and cost estimates"]}/>}
        {section==="Subscription"&&<><div className="admin-banner"><Coins size={22}/><div><b>MAIRA Coin Wallet · {walletBalance.toLocaleString("en-IN")} coins</b><p>Secure Razorpay checkout for INR packs. Coins are credited only after payment verification. TTS costs 1 coin per 100 characters (minimum 1); failed generations are not charged. Speech-to-text and voice browsing are free.</p></div></div><div className="section-row"><div><h2>Choose a coin pack</h2><p>One-time coin packs · currency-specific pricing</p></div><div className="heading-actions"><button className={coinCurrency==="INR"?"btn-primary":"btn-secondary"} onClick={()=>setCoinCurrency("INR")}>₹ INR</button><button className={coinCurrency==="USDT"?"btn-primary":"btn-secondary"} onClick={()=>setCoinCurrency("USDT")}>₮ USDT</button></div></div><div className="subscription-plan-grid">{coinPacks.map(p=><div className={"panel subscription-plan-card coin-pack-card"+(p.popular?" coin-pack-popular":"")} key={coinCurrency+p.coins}><div className="upgrade-icon"><Coins size={19}/></div>{p.popular&&<span className="preview-label">POPULAR</span>}<h2>{p.label}</h2><div className="subscription-price">{coinCurrency==="INR"?"₹":"$"}{p.price.toLocaleString("en-IN")}<small> {coinCurrency==="INR"?"INR":"USDT"}</small></div><p className="coin-pack-amount"><b>{p.coins.toLocaleString("en-IN")} Coins</b></p><p>{p.note}</p><button className="btn-primary" disabled={!!checkoutPack} onClick={()=>buyCoinPack(p)}>{checkoutPack===p.label?"Opening secure checkout…":coinCurrency==="INR"?"Buy coins securely":"USDT unavailable"}</button></div>)}</div><div className="panel"><h2>How coin usage will work</h2><div className="info-line"><span>Text to Speech</span><b>Coins deducted after successful generation</b></div><div className="info-line"><span>Speech to Text</span><b>No coin deduction</b></div><div className="info-line"><span>Voice cloning</span><b>Admin controlled · not a public feature</b></div><p className="muted">INR payments use Razorpay. USDT checkout is disabled until a compliant payment provider is configured. Never pay again if a payment is still verifying—refresh your wallet first.</p></div></>}
        {section==="Settings"&&<div className="settings-grid"><div className="panel"><h2>Workspace</h2><p className="muted">Basic workspace settings.</p><label className="field-label">WORKSPACE NAME</label><input className="input" defaultValue="My Workspace"/><label className="field-label">PLATFORM NAME</label><input className="input" defaultValue="MAIRA AI Voice Agent"/><button className="btn-primary" onClick={()=>notify("Demo settings only. Save settings after backend integration.")}>Save preferences</button></div><div className="panel"><h2>Security & integrations</h2><div className="integration-row"><div className="integration-icon"><LockKeyhole/></div><div><b>Supabase Auth</b><p>Login, sessions and admin roles</p></div><span className="not-connected">Not connected</span></div><div className="integration-row"><div className="integration-icon"><AudioLines/></div><div><b>Voice provider</b><p>Real TTS and custom voice IDs</p></div><span className="not-connected">Not connected</span></div><div className="integration-row"><div className="integration-icon"><Upload/></div><div><b>Secure voice uploads</b><p>Consent and sample management</p></div><span className="not-connected">Not connected</span></div></div></div>}
        <footer className="footer"><div className="footer-brand"><AudioLines size={16}/> MAIRA <span>AI VOICE STUDIO</span></div><span>Built for your voice identity journey.</span><span>Preview build · 2026</span></footer>
      </div>
    </main>
    {showAddVoice&&<Modal title="Create voice profile" subtitle="Name your voice. MAIRA will assign a unique profile ID." onClose={()=>setShowAddVoice(false)}><form onSubmit={addVoice}><label className="field-label">VOICE NAME *</label><input autoFocus className="input" value={voiceName} onChange={e=>setVoiceName(e.target.value)} placeholder="e.g. Swrang Hindi Voice" required maxLength={60}/><div className="form-two"><div><label className="field-label">LANGUAGE</label><select className="input" value={language} onChange={e=>setLanguage(e.target.value)}>{["Hindi","English","Assamese","Bodo","Multilingual","Other"].map(x=><option key={x}>{x}</option>)}</select></div><div><label className="field-label">PROFILE TYPE</label><select className="input" value={voiceType} onChange={e=>setVoiceType(e.target.value)}>{["Custom","Studio","Narration","Creator","Clone"].map(x=><option key={x}>{x}</option>)}</select></div></div><label className="field-label">DESCRIPTION</label><textarea className="input modal-textarea" value={voiceDescription} onChange={e=>setVoiceDescription(e.target.value)} placeholder="What is this voice for?"/><div className="id-preview"><span>ASSIGNED ID PREVIEW</span><b>{makeId(voiceName,voices.length+1)}</b><small>Generated on save · local demo ID</small></div><div className="modal-actions"><button type="button" className="btn-secondary" onClick={()=>setShowAddVoice(false)}>Cancel</button><button type="submit" className="btn-primary"><Plus size={16}/> Create profile</button></div></form></Modal>}
    {showClone&&<Modal title="Clone & distribute voice" subtitle="Create one voice clone, then keep it private and optionally publish or assign it." onClose={()=>!cloneBusy&&setShowClone(false)}><form onSubmit={submitClone}><label className="field-label">VOICE SAMPLE AUDIO *</label><input className="input" type="file" accept="audio/*,.webm" required onChange={e=>setCloneSample(e.target.files?.[0]||null)}/><small className="muted">Clear recording, one speaker, maximum 10 MB.</small><label className="field-label">VOICE NAME *</label><input autoFocus className="input" value={cloneName} onChange={e=>setCloneName(e.target.value)} placeholder="e.g. MAIRA Hindi Presenter" required maxLength={60}/><div className="form-two"><div><label className="field-label">VOICE GENDER</label><select className="input" value={cloneGender} onChange={e=>setCloneGender(e.target.value)}><option>Female</option><option>Male</option><option>Androgynous</option><option>Not specified</option></select></div><div><label className="field-label">LANGUAGE</label><select className="input" value={cloneLanguage} onChange={e=>setCloneLanguage(e.target.value)}>{["Hindi","English","Assamese","Bodo","Multilingual","Other"].map(x=><option key={x}>{x}</option>)}</select></div></div><label className="field-label">VOICE CATEGORY / USE CASE</label><select className="input" value={cloneCategory} onChange={e=>setCloneCategory(e.target.value)}>{["Educational","Social Media","Broadcast / News","Comedy","Storytelling","Marketing / Ads","Customer Support","Audiobook","Podcast","Gaming","Professional / Corporate","Conversational","Entertainment","Other"].map(x=><option key={x}>{x}</option>)}</select><label className="field-label">DESCRIPTION / VOICE STYLE</label><textarea className="input modal-textarea" value={cloneNotes} onChange={e=>setCloneNotes(e.target.value)} placeholder="Describe tone, accent, speaking pace, intended audience and use..."/><label className="field-label">DESTINATION (PRIVATE COPY IS ALWAYS RETAINED)</label><select className="input" value={cloneDestination} onChange={e=>setCloneDestination(e.target.value)}><option value="private">Private Library only</option><option value="public">Also publish to Public Library</option><option value="customer">Also assign to a customer account</option></select>{cloneDestination==="customer"&&<><label className="field-label">CUSTOMER GMAIL / EMAIL *</label><input className="input" type="email" value={cloneCustomerEmail} onChange={e=>setCloneCustomerEmail(e.target.value)} placeholder="customer@gmail.com" required/></>}<label className="consent-note" style={{display:"flex",gap:10,alignItems:"flex-start"}}><input type="checkbox" checked={cloneConsent} onChange={e=>setCloneConsent(e.target.checked)} required style={{marginTop:4}}/><ShieldCheck size={17}/><p>I confirm I own this voice or have the speaker's explicit permission to create and use this clone. Public listing requires permission to share it.</p></label><div className="modal-actions"><button type="button" className="btn-secondary" disabled={cloneBusy} onClick={()=>setShowClone(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={cloneBusy}><Mic2 size={16}/>{cloneBusy?"Cloning and saving…":"Clone voice & save"}</button></div></form></Modal>}
    {notice&&<div className="toast"><Sparkles size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
  </div>;
}
function Stat({icon:Icon,label,value,detail}){return <div className="stat-card"><div className="stat-top"><div className="stat-icon"><Icon size={18}/></div><span className="stat-detail">{detail}</span></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>}
function Quick({icon:Icon,title,desc,action,onClick}){return <button className="quick-card" onClick={onClick}><div className="quick-icon"><Icon size={20}/></div><h3>{title}</h3><p>{desc}</p><span>{action} <b>→</b></span></button>}
function VoiceTable({voices,onRemove,detailed=false,admin=false,onStatus}){if(!voices.length)return <Empty icon={Headphones} title="No voices found" desc="Try another search or create a new voice profile."/>;return <div className="table-wrap"><table><thead><tr><th>VOICE PROFILE</th><th>VOICE ID</th><th>LANGUAGE</th><th>STATUS</th>{detailed&&<th>TYPE</th>}<th></th></tr></thead><tbody>{voices.map(v=><tr key={v.id}><td><div className="voice-cell"><div className="voice-avatar"><AudioLines size={17}/></div><div><b>{v.name}</b><small>{v.description}</small></div></div></td><td><code>{v.id}</code><button className="copy-mini" title="Copy ID" onClick={()=>{navigator.clipboard?.writeText(v.id)}}><Copy size={13}/></button></td><td>{v.language}</td><td>{admin&&onStatus?<select className="status-select" value={v.status} onChange={e=>onStatus(v.id,e.target.value)}><option>Active</option><option>Inactive</option></select>:<span className={`table-status ${v.status==="Active"?"active":"inactive"}`}><i/>{v.status}</span>}</td>{detailed&&<td><span className="type-chip">{v.type}</span></td>}<td>{admin&&<div className="row-actions"><button title="Copy voice ID" onClick={()=>navigator.clipboard?.writeText(v.id)}><Copy size={15}/></button><button title="Remove profile" onClick={()=>onRemove(v.id)}><Trash2 size={15}/></button></div>}</td></tr>)}</tbody></table></div>}
function Empty({icon:Icon,title,desc,action,onClick}){return <div className="empty-state"><div className="empty-icon"><Icon size={26}/></div><h3>{title}</h3><p>{desc}</p>{action&&<button className="btn-primary" onClick={onClick}><Plus size={16}/>{action}</button>}</div>}
function ComingSoon({icon:Icon,title,desc,points}){return <div className="coming-panel panel"><div className="coming-icon"><Icon size={29}/></div><span className="preview-label">PLANNED MODULE</span><h2>{title}</h2><p>{desc}</p><div className="coming-points">{points.map(p=><div key={p}><BadgeCheck size={17}/>{p}</div>)}</div><div className="hint-card"><Sparkles size={18}/><div><b>Designed for the next integration phase</b><p>We will connect this module to the database and provider after core voice management is ready.</p></div></div></div>}
function Modal({title,subtitle,onClose,children}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}

function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("google");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!supabaseConfigured || !supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);
  const run = async (action) => {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error?.message || "Login failed. Please try again."); }
    finally { setBusy(false); }
  };
  const googleLogin = () => run(async () => {
    if (!supabaseConfigured || !supabase) throw new Error("Supabase client is not configured. Check Vercel environment variables.");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://maira-ai-voice-agent-swrang120.vercel.app" } });
    if (error) throw error;
  });
  const sendOtp = () => run(async () => {
    if (!supabaseConfigured || !supabase) throw new Error("Supabase client is not configured.");
    const isPhone = mode === "phone";
    const target = isPhone ? phone.trim() : email.trim();
    if (!target) throw new Error(isPhone ? "Enter your phone number with country code, e.g. +91..." : "Enter your email address.");
    const { error } = await supabase.auth.signInWithOtp(isPhone ? { phone: target } : { email: target, options: { shouldCreateUser: true } });
    if (error) throw error;
    setOtpSent(true); setMessage("OTP sent. Check your " + (isPhone ? "SMS messages." : "email inbox/spam folder."));
  });
  const verifyOtp = () => run(async () => {
    const isPhone = mode === "phone";
    const { error } = await supabase.auth.verifyOtp(isPhone ? { phone: phone.trim(), token: otp.trim(), type: "sms" } : { email: email.trim(), token: otp.trim(), type: "email" });
    if (error) throw error;
  });
  const passwordLogin = () => run(async () => {
    if (!email.trim() || !password) throw new Error("Enter your email and password.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  });
  const logout = () => run(async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; });
  if (loading) return <div className="maira-auth-screen"><div className="maira-auth-card"><div className="maira-auth-logo">M</div><h1>MAIRA<span>.</span></h1><p>Checking your secure session…</p></div></div>;
  if (!session) return <div className="maira-auth-screen"><div className="maira-auth-card">
    <div className="maira-auth-logo"><AudioLines size={30}/></div><div className="maira-auth-kicker">YOUR VOICE. YOUR IDENTITY.</div><h1>Welcome to <span>MAIRA</span></h1><p className="maira-auth-subtitle">Sign in securely to open your AI Voice Studio.</p>
    {!supabaseConfigured && <div className="maira-auth-alert">Supabase environment variables are missing in this deployment.</div>}
    <button className="maira-google-button" onClick={googleLogin} disabled={busy || !supabaseConfigured}><b>G</b> Continue with Google</button>
    <div className="maira-auth-divider"><span>or continue with</span></div>
    <div className="maira-auth-tabs"><button className={mode==="email"?"active":""} onClick={()=>{setMode("email");setOtpSent(false);setMessage("");}}>Email OTP</button><button className={mode==="phone"?"active":""} onClick={()=>{setMode("phone");setOtpSent(false);setMessage("");}}>Mobile OTP</button><button className={mode==="password"?"active":""} onClick={()=>{setMode("password");setOtpSent(false);setMessage("");}}>Password</button></div>
    {(mode==="email" || mode==="password") && <label className="maira-auth-label">GMAIL / EMAIL ADDRESS<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label>}
    {mode==="phone" && <label className="maira-auth-label">MOBILE NUMBER<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel"/></label>}
    {mode==="password" && <label className="maira-auth-label">PASSWORD<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/></label>}
    {(mode==="email" || mode==="phone") && otpSent && <label className="maira-auth-label">ONE-TIME PASSWORD (OTP)<input inputMode="numeric" value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Enter OTP" autoComplete="one-time-code"/></label>}
    {mode==="email" && <button className="maira-auth-submit" disabled={busy} onClick={otpSent?verifyOtp:sendOtp}>{busy?"Please wait…":otpSent?"Verify email OTP":"Send email OTP"}</button>}
    {mode==="phone" && <button className="maira-auth-submit" disabled={busy} onClick={otpSent?verifyOtp:sendOtp}>{busy?"Please wait…":otpSent?"Verify mobile OTP":"Send mobile OTP"}</button>}
    {mode==="password" && <button className="maira-auth-submit" disabled={busy} onClick={passwordLogin}>{busy?"Please wait…":"Sign in with password"}</button>}
    {message && <div className={message.startsWith("OTP sent")?"maira-auth-success":"maira-auth-alert"}>{message}</div>}
    <small className="maira-auth-foot">By continuing, you agree to use MAIRA responsibly. Mobile OTP requires an SMS provider configured in Supabase.</small>
  </div></div>;
  return <>{children}</>;
}

createRoot(document.getElementById("root")).render(<AuthGate><App/></AuthGate>);