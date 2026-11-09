import { useCallback } from "react";
import { ArrowUpRight, CircleAlert, Compass, MessageCircle, Wallet, Wrench } from "lucide-react";
import { api } from "../api";
import { ErrorState, LoadingState, PageHeading, useLoad } from "../components/Shared";
import type { RecommendationOpportunity } from "../types";

interface RecommendationsData {
  opportunities: RecommendationOpportunity[];
  actions: { title: string; audience: string; rationale: string }[];
  caveat: string;
}

const icons = [Compass, MessageCircle, Wallet, Wrench];

export default function Recommendations() {
  const load = useCallback(() => api<RecommendationsData>("/recommendations"), []);
  const state = useLoad(load, [load]);
  if (state.loading) return <LoadingState label="Finding retention opportunities" />;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Recommendations unavailable."} retry={state.retry} />;
  const data = state.data;

  return (
    <div className="page-enter">
      <PageHeading eyebrow="RETENTION PLAYBOOK / 05" title="Turn a signal into a conversation." description="Start with the groups most represented among high-risk profiles. Validate the reason before choosing the response." action={<span className="recommend-stamp"><CircleAlert size={14} /> HYPOTHESES, NOT PROMISES</span>} />

      <section className="playbook-lead">
        <div><p className="eyebrow">A MORE HUMAN RETENTION LOOP</p><h2>Notice.<br /><em>Ask. Adapt.</em></h2></div>
        <p>These segments are descriptive patterns in a public dataset. They are useful for deciding where to listen first — not evidence that a discount, product change, or script will prevent churn.</p>
        <div className="loop-stages"><span>01 / Notice</span><span>02 / Ask</span><span>03 / Test</span><span>04 / Learn</span></div>
      </section>

      <section className="opportunity-section">
        <div className="section-title-row"><div><p className="eyebrow">01 / WHERE TO START</p><h2>Retention opportunities</h2></div><span className="chart-caption">High-risk profiles · ranked by group size</span></div>
        <div className="opportunity-table">
          <div className="opportunity-table-head"><span>SEGMENT SIGNAL</span><span>PROFILES</span><span>SHARE OF HIGH RISK</span><span>AVG. MONTHLY BILL</span></div>
          {data.opportunities.map((item, index) => (
            <div className="opportunity-table-row" key={item.segment}><span className="opportunity-name"><i>0{index + 1}</i>{item.segment}</span><strong>{item.customers.toLocaleString()}</strong><div className="share-meter"><span>{Math.round(item.share_of_high_risk * 100)}%</span><i><b style={{ width: `${item.share_of_high_risk * 100}%` }} /></i></div><span className="opportunity-bill">${item.avg_monthly_charges.toFixed(2)}</span></div>
          ))}
        </div>
      </section>

      <section className="action-cards-section">
        <div className="section-title-row"><div><p className="eyebrow">02 / CONVERSATION STARTERS</p><h2>Actions to test with care</h2></div><span className="chart-caption">Human review before outreach</span></div>
        <div className="action-cards">
          {data.actions.map((action, index) => {
            const Icon = icons[index % icons.length];
            return <article className="action-card" key={action.title}><div className="action-card-index">0{index + 1}<Icon size={17} /></div><h3>{action.title}</h3><span className="action-audience">{action.audience}</span><p>{action.rationale}</p><div className="action-card-foot"><span>TEST &amp; LEARN</span><ArrowUpRight size={15} /></div></article>;
          })}
        </div>
      </section>

      <section className="ethics-note"><CircleAlert size={18} /><div><strong>Keep the customer in the loop.</strong><p>{data.caveat} Follow your organization's privacy, consent, and fair-treatment standards when using customer-level predictions.</p></div></section>
    </div>
  );
}
