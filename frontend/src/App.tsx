import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowUpRight, BarChart3, ChevronDown, CircleUserRound, Compass, Menu, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import Overview from "./pages/Overview";
import Customers from "./pages/Customers";
import Predict from "./pages/Predict";
import Performance from "./pages/Performance";
import Recommendations from "./pages/Recommendations";
import { api } from "./api";
import type { Customer } from "./types";

type PageId = "overview" | "customers" | "predict" | "performance" | "recommendations";

const navigation: { id: PageId; label: string; short: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", short: "01", icon: Compass },
  { id: "customers", label: "Customer file", short: "02", icon: Users },
  { id: "predict", label: "Prediction desk", short: "03", icon: Sparkles },
  { id: "performance", label: "Model evidence", short: "04", icon: BarChart3 },
  { id: "recommendations", label: "Retention playbook", short: "05", icon: ArrowUpRight },
];

const pageTitles: Record<PageId, string> = {
  overview: "Customer intelligence",
  customers: "Customer file",
  predict: "Prediction desk",
  performance: "Model evidence",
  recommendations: "Retention playbook",
};

function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [pendingCustomer, setPendingCustomer] = useState<Customer | null>(null);
  const [modelReady, setModelReady] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    const handleNavigation = (event: Event) => {
      const target = (event as CustomEvent<PageId>).detail;
      if (navigation.some((item) => item.id === target)) setPage(target);
    };
    api<{ model_available: boolean }>("/health")
      .then((health) => setModelReady(health.model_available))
      .catch(() => setModelReady(false));
    window.addEventListener("navigate", handleNavigation);
    return () => { window.clearInterval(timer); window.removeEventListener("navigate", handleNavigation); };
  }, []);

  const selectPage = (next: PageId) => {
    setPage(next);
    setPendingCustomer(null);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openCustomer = (customer: Customer) => {
    setPendingCustomer(customer);
    setPage("customers");
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-lockup" onClick={() => selectPage("overview")} aria-label="Go to overview">
          <span className="brand-mark"><i /><b /><em /></span>
          <span className="brand-name">signal<span>&amp;</span>stay<small>RETENTION INTELLIGENCE</small></span>
        </button>
        <div className="topbar-center"><span className="workspace-label">WORKSPACE</span><span className="workspace-name">Customer portfolio <ChevronDown size={14} /></span></div>
        <div className="topbar-right">
          <span className="clock-stamp">{clock.toLocaleDateString("en-US", { month: "short", day: "2-digit" })} <i /> {clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
          <span className="topbar-divider" />
          <span className="analyst-profile"><span className="analyst-avatar">A</span><span>Analyst<br /><small>LOCAL SESSION</small></span></span>
          <button className="mobile-menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Toggle navigation">{mobileMenu ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </header>

      <div className="app-body">
        <nav className={`rail ${mobileMenu ? "rail-open" : ""}`} aria-label="Main navigation">
          <div className="rail-section-label">INTELLIGENCE</div>
          {navigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={`rail-link ${page === item.id ? "rail-active" : ""}`} onClick={() => selectPage(item.id)} aria-current={page === item.id ? "page" : undefined}><span className="rail-index">{item.short}</span><Icon size={16} strokeWidth={1.8} /><span>{item.label}</span>{page === item.id && <i className="rail-marker" />}</button>;
          })}
          <div className="rail-bottom">
            <div className="rail-status"><span className={`live-dot ${modelReady === false ? "status-offline" : ""}`} /><span>{modelReady === null ? "CHECKING MODEL" : modelReady ? "MODEL ACTIVE" : "TRAINING REQUIRED"}<small>IBM TELCO · HOLDOUT V1</small></span></div>
            <div className="rail-privacy"><ShieldCheck size={14} /><span>Local inference<br /><small>Inputs are not stored</small></span></div>
            <a className="rail-docs" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">API documentation <ArrowUpRight size={13} /></a>
          </div>
        </nav>

        {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}

        <main className="main-content">
          <div className="breadcrumbs"><span>INTELLIGENCE</span><span>/</span><strong>{pageTitles[page]}</strong><span className="crumb-right"><Activity size={13} /> MODEL STATUS: <b className={modelReady === false ? "status-text-offline" : ""}>{modelReady === null ? "CHECKING" : modelReady ? "READY" : "TRAINING NEEDED"}</b></span></div>
          <AnimatePresence mode="wait">
            <motion.div key={page} className="page-frame" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>
              {page === "overview" && <Overview onCustomerSelect={openCustomer} />}
              {page === "customers" && <Customers initialCustomer={pendingCustomer} />}
              {page === "predict" && <Predict />}
              {page === "performance" && <Performance />}
              {page === "recommendations" && <Recommendations />}
            </motion.div>
          </AnimatePresence>
          <footer className="app-footer"><span>© 2026 SIGNAL &amp; STAY</span><span>CHURN IS A SIGNAL, NOT A DESTINY.</span><span><CircleUserRound size={12} /> CUSTOMER INTELLIGENCE WORKSPACE</span></footer>
        </main>
      </div>
    </div>
  );
}

export default App;
