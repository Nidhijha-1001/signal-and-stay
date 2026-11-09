import { useCallback, useState } from "react";
import { ArrowDown, BadgeCheck } from "lucide-react";
import { api } from "../api";
import { ChargeDistribution, ConfusionMatrix, CorrelationList, ImportanceBars, MetricBars, ModelPrecisionRecall, ModelRoc, SegmentBars, ServiceRates } from "../components/Charts";
import { ErrorState, LoadingState, PageHeading, useLoad } from "../components/Shared";
import type { Metrics, ModelPerformance } from "../types";

interface PerformanceResponse {
  performance: ModelPerformance;
  feature_importance: { method: string; features: { feature: string; importance: number; std: number }[] };
  eda: {
    row_count: number;
    churn_count: number;
    retained_count: number;
    churn_rate: number;
    missing_values: Record<string, number>;
    duplicates_removed: number;
    churn_by_gender: Record<string, number>;
    churn_by_payment_method: Record<string, number>;
    churn_by_internet_service: Record<string, number>;
    monthly_charges_by_churn: Record<string, { mean: number; median: number }>;
    service_churn_rates: Record<string, Record<string, number>>;
    numeric_correlation: Record<string, Record<string, number>>;
  };
}

const metricLabels: [keyof Metrics, string][] = [
  ["recall", "Recall"], ["precision", "Precision"], ["f1", "F1 score"], ["f2", "F2 score"],
  ["roc_auc", "ROC-AUC"], ["pr_auc", "PR-AUC"], ["accuracy", "Accuracy"],
];

export default function Performance() {
  const [selected, setSelected] = useState<string | null>(null);
  const loadPerformance = useCallback(() => api<PerformanceResponse>("/performance"), []);
  const state = useLoad(loadPerformance, [loadPerformance]);
  if (state.loading) return <LoadingState label="Evaluating model evidence" />;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Model evaluation unavailable."} retry={state.retry} />;

  const { performance, feature_importance: importance, eda } = state.data;
  const modelName = selected && performance.models[selected] ? selected : performance.selected_model;
  const metrics = performance.models[modelName];
  return (
    <div className="page-enter">
      <PageHeading eyebrow="MODEL EVIDENCE / 04" title="Measure what matters." description="Three model families, one untouched holdout set, and a recall-first selection policy — because a missed churner has a cost." action={<span className="holdout-stamp"><BadgeCheck size={15} /> {performance.holdout_size.toLocaleString()} CUSTOMER HOLDOUT</span>} />

      <section className="model-verdict">
        <div className="verdict-icon"><BadgeCheck size={20} /></div>
        <div className="verdict-copy"><span>SELECTED FOR DEPLOYMENT</span><h2>{performance.selected_model}</h2><p>{performance.selection_criterion}</p></div>
        <div className="verdict-metric"><span>TEST RECALL</span><strong>{(performance.models[performance.selected_model].recall * 100).toFixed(1)}<small>%</small></strong></div>
        <div className="verdict-metric"><span>TEST ROC-AUC</span><strong>{performance.models[performance.selected_model].roc_auc.toFixed(3)}</strong></div>
        <div className="verdict-caveat">Recall is prioritized; inspect precision and review capacity before deploying outreach.</div>
      </section>

      <section className="model-comparison">
        <div className="section-title-row"><div><p className="eyebrow">01 / HELD-OUT PERFORMANCE</p><h2>Recall, precision &amp; balance</h2></div><span className="chart-caption">Threshold selected using out-of-fold training predictions</span></div>
        <div className="comparison-grid">
          <div className="chart-panel comparison-chart"><div className="chart-panel-head"><span>METRIC COMPARISON</span><span className="chart-unit">0 — 1 SCORE</span></div><MetricBars models={performance.models} /></div>
          <div className="comparison-notes">
            <div className="note-marker"><ArrowDown size={16} /><span>Read beyond accuracy</span></div>
            <h3>Missing churners matters.</h3>
            <p>Recall shows how many actual churners the model catches. F2 gives recall more weight than precision; PR-AUC summarizes the precision–recall trade-off across thresholds.</p>
            <div className="metric-callout"><span>SELECTED F2 SCORE</span><strong>{metrics.f2.toFixed(3)}</strong><small>Recall-weighted balance</small></div>
            <div className="threshold-callout"><span>OPERATING THRESHOLD</span><strong>{(metrics.threshold * 100).toFixed(1)}%</strong><small>{performance.threshold_policy}</small></div>
          </div>
        </div>
      </section>

      <section className="performance-mid-grid">
        <div className="chart-panel">
          <div className="section-title-row chart-section-title"><div><p className="eyebrow">02 / DISCRIMINATION</p><h2>ROC curves</h2></div><span className="chart-caption">Test set · higher is better</span></div>
          <ModelRoc models={performance.models} />
        </div>
        <div className="chart-panel">
          <div className="section-title-row chart-section-title"><div><p className="eyebrow">03 / PRECISION &amp; RECALL</p><h2>PR curves</h2></div><span className="chart-caption">Test set · prevalence baseline</span></div>
          <ModelPrecisionRecall models={performance.models} prevalence={eda.churn_rate} />
        </div>
      </section>

      <section className="confusion-section chart-panel">
        <div className="section-title-row chart-section-title"><div><p className="eyebrow">04 / ERROR PROFILE</p><h2>Confusion matrix</h2></div><select className="model-select" value={modelName} onChange={(event) => setSelected(event.target.value)}>{Object.keys(performance.models).map((name) => <option key={name}>{name}</option>)}</select></div>
          <ConfusionMatrix matrix={metrics.confusion_matrix} />
          <p className="matrix-caption">Actual labels are rows · model decisions are columns · threshold {metrics.threshold.toFixed(2)}</p>
      </section>

      <section className="importance-section">
        <div className="chart-panel importance-panel">
          <div className="section-title-row chart-section-title"><div><p className="eyebrow">04 / FEATURE INFLUENCE</p><h2>What moves the needle</h2></div><span className="chart-caption">Permutation importance · test ROC-AUC decrease</span></div>
          <div className="importance-chart"><ImportanceBars data={importance.features} /></div>
          <p className="method-note">{importance.method}. Correlated features can share or dilute importance; this ranks predictive signal, not causal impact.</p>
        </div>
        <aside className="data-quality">
          <div className="quality-header"><span>DATA QUALITY CHECK</span><BadgeCheck size={16} /></div>
          <strong>{eda.row_count.toLocaleString()}<small> rows analyzed</small></strong>
          <div className="quality-row"><span>Churned / retained</span><b>{eda.churn_count.toLocaleString()} / {eda.retained_count.toLocaleString()}</b></div>
          <div className="quality-row"><span>Missing fields</span><b>{Object.values(eda.missing_values).reduce((sum, count) => sum + count, 0)}</b></div>
          <div className="quality-row"><span>Duplicate records removed</span><b>{eda.duplicates_removed}</b></div>
          <p>Preprocessing is fitted inside each training fold. The test set remains separate until final evaluation.</p>
        </aside>
      </section>

      <section className="model-score-table">
        <div className="section-title-row"><div><p className="eyebrow">05 / FULL BENCHMARK</p><h2>Model scorecard</h2></div><span className="chart-caption">Independent holdout metrics</span></div>
        <div className="table-scroll"><table className="customer-table scorecard-table"><thead><tr><th>Algorithm</th>{metricLabels.map(([, label]) => <th key={label}>{label}</th>)}<th>Threshold</th></tr></thead><tbody>
          {Object.entries(performance.models).map(([name, value]) => <tr key={name} className={name === performance.selected_model ? "selected-row" : ""}><td><strong>{name}</strong>{name === performance.selected_model && <span className="selected-tag">SELECTED</span>}</td>{metricLabels.map(([key]) => <td key={key}>{Number(value[key]).toFixed(3)}</td>)}<td>{value.threshold.toFixed(3)}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="eda-section">
        <div className="section-title-row"><div><p className="eyebrow">06 / EXPLORATORY DATA ANALYSIS</p><h2>Customer patterns, before the model</h2></div><span className="chart-caption">Historical dataset relationships</span></div>
        <div className="eda-grid">
          <div className="chart-panel"><div className="chart-panel-head"><span>GENDER</span><span className="chart-unit">OBSERVED CHURN</span></div><SegmentBars data={Object.entries(eda.churn_by_gender).map(([name, churn_rate]) => ({ name, churn_rate }))} /></div>
          <div className="chart-panel"><div className="chart-panel-head"><span>INTERNET SERVICE</span><span className="chart-unit">OBSERVED CHURN</span></div><SegmentBars data={Object.entries(eda.churn_by_internet_service).map(([name, churn_rate]) => ({ name, churn_rate }))} /></div>
          <div className="chart-panel"><div className="chart-panel-head"><span>PAYMENT METHOD</span><span className="chart-unit">OBSERVED CHURN</span></div><SegmentBars data={Object.entries(eda.churn_by_payment_method).map(([name, churn_rate]) => ({ name: name.replace(" (automatic)", "").replace(" check", ""), churn_rate }))} /></div>
          <div className="chart-panel"><div className="chart-panel-head"><span>MONTHLY CHARGES</span><span className="chart-unit">USD / MONTH</span></div><ChargeDistribution values={eda.monthly_charges_by_churn} /></div>
          <div className="chart-panel service-eda"><div className="chart-panel-head"><span>OPTIONAL SERVICE PATTERNS</span><span className="chart-unit">YES VS. NO</span></div><ServiceRates rates={eda.service_churn_rates} /></div>
          <div className="chart-panel"><div className="chart-panel-head"><span>NUMERIC CORRELATION WITH CHURN</span><span className="chart-unit">PEARSON r</span></div><CorrelationList values={eda.numeric_correlation} /><p className="matrix-caption">Correlation describes association only; it does not establish cause.</p></div>
        </div>
      </section>
    </div>
  );
}
