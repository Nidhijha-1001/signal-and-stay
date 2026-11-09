import { motion } from "framer-motion";
import { AlertCircle, ArrowDownRight, ArrowUpRight, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Risk } from "../types";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading intelligence" }: { label?: string }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" size={18} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  const needsTraining = message.toLowerCase().includes("training command");
  return (
    <div className="error-state">
      <div className="error-mark"><AlertCircle size={19} /></div>
      <div>
        <strong>{needsTraining ? "Model artifacts not found" : "Could not load this view"}</strong>
        <p>{message}</p>
        {needsTraining && <code>cd backend &amp;&amp; python -m app.ml.train</code>}
      </div>
      <button className="icon-button" onClick={retry} aria-label="Retry request"><RefreshCw size={16} /></button>
    </div>
  );
}

export function useLoad<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (current) setData(result);
      })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof Error ? reason.message : "Unexpected API error.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
    // `loader` is intentionally represented by its explicit dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, reloadToken]);

  return { data, error, loading, retry: () => setReloadToken((value) => value + 1) };
}

export function AnimatedNumber({
  value,
  format = "number",
  decimals = 0,
}: {
  value: number;
  format?: "number" | "percent" | "currency";
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const formatted = format === "percent"
    ? `${(displayValue * 100).toFixed(decimals)}%`
    : format === "currency"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(displayValue)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(displayValue);
  return <span>{formatted}</span>;
}

export function RiskPill({ risk }: { risk: Risk | string }) {
  return <span className={`risk-pill risk-${risk.toLowerCase()}`}><i />{risk} risk</span>;
}

export function ProbabilityBar({ value }: { value: number }) {
  const color = value >= 0.6 ? "var(--coral)" : value >= 0.25 ? "var(--amber)" : "var(--mint)";
  return (
    <div className="probability-cell">
      <div className="probability-track"><motion.span initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} style={{ background: color }} /></div>
      <span>{Math.round(value * 100)}%</span>
    </div>
  );
}

export function ImpactMarker({ impact }: { impact: number }) {
  const positive = impact > 0;
  return (
    <span className={`impact-marker ${positive ? "impact-up" : "impact-down"}`}>
      {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {`${Math.abs(impact * 100).toFixed(1)} pts`}
    </span>
  );
}

export function formatFeature(name: string) {
  const pretty = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([a-z])([A-Z])/g, "$1 $2");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}
