import { useCallback } from "react";
import { ArrowDownRight, ArrowUpRight, ArrowUpRightFromSquare, Sparkles } from "lucide-react";
import { api } from "../api";
import { CustomerTable } from "../components/CustomerTable";
import { ImportanceBars, RiskDonut, SegmentBars } from "../components/Charts";
import { AnimatedNumber, ErrorState, LoadingState, PageHeading, useLoad } from "../components/Shared";
import type { Customer, RecommendationOpportunity } from "../types";

interface OverviewData {
  total_customers: number;
  actual_churn_rate: number;
  predicted_churn_count: number;
  high_risk_count: number;
  average_churn_probability: number;
  selected_model: string;
  selected_model_metrics: { recall: number; roc_auc: number };
  risk_distribution: { risk: string; customers: number }[];
  churn_by_contract: { name: string; churn_rate: number }[];
  churn_by_tenure: { name: string; churn_rate: number }[];
  retention_opportunities: RecommendationOpportunity[];
}

interface CustomersData {
  items: Customer[];
}

interface PerformanceData {
  feature_importance: { features: { feature: string; importance: number }[] };
}

export default function Overview({ onCustomerSelect }: { onCustomerSelect: (customer: Customer) => void }) {
  const loadOverview = useCallback(() => api<OverviewData>("/overview"), []);
  const loadCustomers = useCallback(() => api<CustomersData>("/customers?page=1&page_size=6"), []);
  const loadPerformance = useCallback(() => api<PerformanceData>("/performance"), []);
  const overview = useLoad(loadOverview, [loadOverview]);
  const customers = useLoad(loadCustomers, [loadCustomers]);
  const performance = useLoad(loadPerformance, [loadPerformance]);

  if (overview.loading) return <LoadingState label="Reading customer signals" />;
  if (overview.error || !overview.data) return <ErrorState message={overview.error ?? "Overview unavailable."} retry={overview.retry} />;
  const data = overview.data;
  const opportunities = data.retention_opportunities.slice(0, 3);

  return (
    <div className="page-enter">
      <PageHeading eyebrow="RETENTION INTELLIGENCE / 01" title="The customers worth keeping." description="A clear read on who may leave, what signals matter, and where a thoughtful intervention could make a difference." action={<span className="dataset-stamp"><i /> IBM TELCO · {data.total_customers.toLocaleString()} PROFILES</span>} />

      <section className="overview-lead">
        <div className="lead-copy">
          <div className="lead-kicker"><span className="live-dot" /> RETENTION PULSE <span className="lead-divider" /> MODEL REFRESHED</div>
          <h2>Every cancellation<br />has a <em>lead-up.</em></h2>
          <p>Use the early signals to start a better conversation — before a customer makes their decision.</p>
          <div className="lead-stat-line">
            <div><strong><AnimatedNumber value={data.high_risk_count} /></strong><span>high-risk customers</span></div>
            <div className="lead-stat-separator" />
            <div><strong><AnimatedNumber value={data.average_churn_probability} format="percent" decimals={1} /></strong><span>average risk score</span></div>
          </div>
        </div>
        <div className="lead-visual">
          <div className="lead-visual-head"><span>RISK MIX</span><span>MODEL SCORED</span></div>
          <div className="lead-donut"><RiskDonut data={data.risk_distribution} /></div>
          <div className="risk-legend">
            {data.risk_distribution.map((item) => (
              <div key={item.risk}><span className={`legend-swatch swatch-${item.risk.toLowerCase()}`} /><span>{item.risk}</span><strong>{item.customers.toLocaleString()}</strong><small>{data.total_customers ? `${Math.round(item.customers / data.total_customers * 100)}%` : "0%"}</small></div>
            ))}
          </div>
        </div>
        <div className="lead-index">01—03</div>
      </section>

      <section className="metric-ribbon">
        <div className="ribbon-label">PORTFOLIO<br />READOUT</div>
        <div className="ribbon-metric"><span>Historical churn</span><strong><AnimatedNumber value={data.actual_churn_rate} format="percent" decimals={1} /></strong><small>observed in the dataset</small></div>
        <div className="ribbon-metric"><span>Predicted to leave</span><strong><AnimatedNumber value={data.predicted_churn_count} /></strong><small>at the tuned model threshold</small></div>
        <div className="ribbon-metric"><span>Model recall</span><strong><AnimatedNumber value={data.selected_model_metrics.recall} format="percent" decimals={1} /></strong><small>holdout churners detected</small></div>
        <div className="ribbon-model"><span>SELECTED MODEL</span><strong>{data.selected_model}</strong><small>Recall-first selection · ROC-AUC {data.selected_model_metrics.roc_auc.toFixed(3)}</small></div>
      </section>

      <section className="insight-grid">
        <div className="section-main">
          <div className="section-title-row"><div><p className="eyebrow">01 / CUSTOMER SIGNALS</p><h2>Where churn gathers</h2></div><span className="chart-caption">Observed historical churn rate</span></div>
          <div className="segment-charts">
            <div className="chart-panel"><div className="chart-panel-head"><span>CONTRACT TYPE</span><span className="chart-unit">CHURN RATE</span></div><SegmentBars data={data.churn_by_contract} /></div>
            <div className="chart-panel"><div className="chart-panel-head"><span>TENURE</span><span className="chart-unit">CHURN RATE</span></div><SegmentBars data={data.churn_by_tenure} /></div>
          </div>
        </div>
        <aside className="opportunity-note">
          <div className="opportunity-note-top"><Sparkles size={16} /><span>RETENTION OPPORTUNITY</span></div>
          <h3>A signal is not a verdict.</h3>
          <p>Start with the segments contributing the most high-risk customers — then validate the story one conversation at a time.</p>
          {opportunities.map((item, index) => (
            <div className="opportunity-row" key={item.segment}>
              <span className="opportunity-rank">0{index + 1}</span><span>{item.segment}</span><strong>{item.customers}</strong>
            </div>
          ))}
          <div className="opportunity-foot">Suggested areas to investigate · not causal findings</div>
        </aside>
      </section>

      <section className="lower-grid">
        <div className="leaderboard-section">
          <div className="section-title-row"><div><p className="eyebrow">02 / EARLY ATTENTION</p><h2>Risk leaderboard</h2></div><button className="text-link" onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "customers" }))}>See all customers <ArrowUpRightFromSquare size={14} /></button></div>
          {customers.loading ? <LoadingState label="Ranking customer signals" /> : customers.error ? <ErrorState message={customers.error} retry={customers.retry} /> : <CustomerTable customers={customers.data?.items ?? []} onSelect={onCustomerSelect} />}
          <div className="leaderboard-foot"><ArrowUpRight size={14} /> Highest predicted churn probability · holdout and cross-validated profiles</div>
        </div>
        <aside className="factor-card">
          <div className="factor-card-head"><div><p className="eyebrow">03 / MODEL CONTEXT</p><h2>Signals that matter</h2></div><span>GLOBAL</span></div>
          {performance.loading ? <LoadingState label="Calculating importance" /> : performance.error ? <ErrorState message={performance.error} retry={performance.retry} /> : <ImportanceBars data={performance.data?.feature_importance.features ?? []} />}
          <p className="factor-note"><ArrowDownRight size={14} /> Permutation importance on the untouched test set. Shows predictive contribution, not causation.</p>
        </aside>
      </section>
    </div>
  );
}
