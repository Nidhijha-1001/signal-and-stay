import { useState } from "react";
import { ArrowRight, Check, CircleHelp, RotateCcw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../api";
import { formatFeature, ImpactMarker, PageHeading, RiskPill } from "../components/Shared";
import type { Explanation, Risk } from "../types";

interface PredictionResult {
  probability: number;
  predicted_churn: boolean;
  threshold: number;
  risk_category: Risk;
  selected_model: string;
  explanations: Explanation[];
  recommendations: string[];
}

const fields = [
  { key: "gender", label: "Gender", options: ["Female", "Male"] },
  { key: "SeniorCitizen", label: "Senior citizen", options: ["0", "1"] },
  { key: "Partner", label: "Partner", options: ["Yes", "No"] },
  { key: "Dependents", label: "Dependents", options: ["Yes", "No"] },
  { key: "PhoneService", label: "Phone service", options: ["Yes", "No"] },
  { key: "MultipleLines", label: "Multiple lines", options: ["No", "Yes", "No phone service"] },
  { key: "InternetService", label: "Internet service", options: ["Fiber optic", "DSL", "No"] },
  { key: "OnlineSecurity", label: "Online security", options: ["No", "Yes", "No internet service"] },
  { key: "OnlineBackup", label: "Online backup", options: ["No", "Yes", "No internet service"] },
  { key: "DeviceProtection", label: "Device protection", options: ["No", "Yes", "No internet service"] },
  { key: "TechSupport", label: "Tech support", options: ["No", "Yes", "No internet service"] },
  { key: "StreamingTV", label: "Streaming TV", options: ["No", "Yes", "No internet service"] },
  { key: "StreamingMovies", label: "Streaming movies", options: ["No", "Yes", "No internet service"] },
  { key: "Contract", label: "Contract", options: ["Month-to-month", "One year", "Two year"] },
  { key: "PaperlessBilling", label: "Paperless billing", options: ["Yes", "No"] },
  { key: "PaymentMethod", label: "Payment method", options: ["Electronic check", "Mailed check", "Bank transfer (automatic)", "Credit card (automatic)"] },
] as const;

const defaults: Record<string, string | number> = {
  gender: "Female", SeniorCitizen: 0, Partner: "No", Dependents: "No", tenure: 12,
  PhoneService: "Yes", MultipleLines: "No", InternetService: "Fiber optic",
  OnlineSecurity: "No", OnlineBackup: "No", DeviceProtection: "No", TechSupport: "No",
  StreamingTV: "No", StreamingMovies: "No", Contract: "Month-to-month",
  PaperlessBilling: "Yes", PaymentMethod: "Electronic check", MonthlyCharges: 70, TotalCharges: 840,
};

export default function Predict() {
  const [values, setValues] = useState<Record<string, string | number>>({ ...defaults });
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: key === "SeniorCitizen" ? Number(value) : value }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<PredictionResult>("/predict", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          tenure: Number(values.tenure),
          MonthlyCharges: Number(values.MonthlyCharges),
          TotalCharges: Number(values.TotalCharges),
        }),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Prediction request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeading eyebrow="PREDICTION DESK / 03" title="A single customer, in focus." description="Model a profile, get a calibrated risk estimate, and see which customer signals shaped the score." action={<span className="model-stamp"><span className="live-dot" /> LIVE MODEL</span>} />
      <div className="prediction-layout">
        <form className="prediction-form" onSubmit={submit}>
          <div className="form-topline"><span>PROFILE INPUT</span><span>01 — 19 ATTRIBUTES</span></div>
          <div className="form-section-heading"><span className="form-number">01</span><div><h2>Customer profile</h2><p>Choose the closest current account values.</p></div></div>
          <div className="form-grid">
            {fields.slice(0, 4).map((field) => (
              <label className="form-field" key={field.key}><span>{field.label}</span><select value={values[field.key]} onChange={(event) => update(field.key, event.target.value)}>{field.options.map((option) => <option key={option} value={option}>{field.key === "SeniorCitizen" ? option === "1" ? "Yes" : "No" : option}</option>)}</select></label>
            ))}
          </div>
          <div className="form-rule" />
          <div className="form-section-heading"><span className="form-number">02</span><div><h2>Service &amp; billing</h2><p>Subscription, support, and payment signals.</p></div></div>
          <div className="form-grid">
            {fields.slice(4).map((field) => (
              <label className="form-field" key={field.key}><span>{field.label}</span><select value={values[field.key]} onChange={(event) => update(field.key, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select></label>
            ))}
          </div>
          <div className="form-rule" />
          <div className="form-section-heading"><span className="form-number">03</span><div><h2>Tenure &amp; charges</h2><p>Values use the same units as the source dataset.</p></div></div>
          <div className="form-grid form-grid-numbers">
            {[
              ["tenure", "Tenure", "Months", 0, 100],
              ["MonthlyCharges", "Monthly charges", "USD / month", 0, 10000],
              ["TotalCharges", "Total charges", "USD / lifetime", 0, 1000000],
            ].map(([key, label, unit, min, max]) => (
              <label className="form-field" key={String(key)}><span>{label}</span><div className="number-input"><input type="number" min={Number(min)} max={Number(max)} step={key === "tenure" ? 1 : 0.01} required value={values[String(key)]} onChange={(event) => setValues((current) => ({ ...current, [String(key)]: event.target.value }))} /><small>{unit}</small></div></label>
            ))}
          </div>
          <div className="form-bottom"><span><CircleHelp size={14} /> No customer data is stored by this demo.</span><button className="button-primary" disabled={loading}>{loading ? <span className="button-loader" /> : <Sparkles size={15} />}{loading ? "Scoring profile" : "Run prediction"}<ArrowRight size={15} /></button></div>
        </form>

        <aside className={`prediction-result ${result ? "has-result" : ""}`}>
          <div className="result-topline"><span>PREDICTION SIGNAL</span><span>{result ? result.selected_model.toUpperCase() : "AWAITING INPUT"}</span></div>
          {error && <div className="inline-error">{error}</div>}
          {!result && !error && (
            <div className="result-empty">
              <div className="empty-orbit"><span /><i /><b /></div>
              <p className="eyebrow">A PROFILE, NOT A PERSONA</p>
              <h2>Risk is a signal.<br /><em>Context is yours.</em></h2>
              <p>Submit a profile to see its estimated churn probability, contributing factors, and possible next steps.</p>
              <div className="result-empty-note"><span>01</span> Predictions use the saved model trained from the Telco dataset.</div>
            </div>
          )}
          {result && (
            <motion.div className="result-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="result-label"><span>ESTIMATED CHURN PROBABILITY</span><RiskPill risk={result.risk_category} /></div>
              <div className="result-number">{Math.round(result.probability * 100)}<small>%</small></div>
              <div className="score-gauge result-gauge"><i style={{ width: `${result.probability * 100}%` }} /></div>
              <div className="result-decision"><span className={`decision-dot ${result.predicted_churn ? "decision-high" : ""}`} />{result.predicted_churn ? "Flag for retention review" : "No churn alert at current threshold"}<small>decision cutoff: {Math.round(result.threshold * 100)}%</small></div>
              <div className="result-divider" />
              <div className="section-label"><span>WHY THIS SCORE</span><small>directional vs. typical customer</small></div>
              {result.explanations.slice(0, 5).map((item) => (
                <div className="explanation-row" key={item.feature}><div><strong>{formatFeature(item.feature)}</strong><small>{String(item.value ?? "—")}</small></div><ImpactMarker impact={item.impact} /></div>
              ))}
              <div className="result-divider" />
              <div className="section-label"><span>POSSIBLE NEXT STEPS</span></div>
              {result.recommendations.map((item) => <p className="action-line" key={item}><Check size={14} />{item}</p>)}
              <p className="result-caveat"><CircleHelp size={13} /> Factor effects compare against a typical customer profile; they are not causal explanations.</p>
              <button className="reset-button" onClick={() => { setResult(null); setValues({ ...defaults }); }}><RotateCcw size={14} /> Clear profile &amp; start again</button>
            </motion.div>
          )}
        </aside>
      </div>
    </div>
  );
}
