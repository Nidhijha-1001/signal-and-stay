import { ArrowUpRight, X } from "lucide-react";
import type { Customer, Explanation } from "../types";
import { formatFeature, ImpactMarker, RiskPill } from "./Shared";

type DetailCustomer = Customer & {
  explanations?: Explanation[];
  recommendations?: string[];
};

export function CustomerDetail({
  customer,
  onClose,
}: {
  customer: DetailCustomer | null;
  onClose: () => void;
}) {
  if (!customer) return null;
  return (
    <aside className="customer-drawer">
      <div className="drawer-topline"><span className="eyebrow">CUSTOMER PROFILE</span><button className="icon-button" onClick={onClose} aria-label="Close customer profile"><X size={17} /></button></div>
      <div className="drawer-heading">
        <div><h2>{customer.customerID}</h2><p>{customer.Contract} · {customer.tenure} {customer.tenure === 1 ? "month" : "months"}</p></div>
        <RiskPill risk={customer.RiskCategory} />
      </div>
      <div className="drawer-score"><span>Churn probability</span><strong>{Math.round(customer.ChurnProbability * 100)}<small>%</small></strong><div className="score-gauge"><i style={{ width: `${customer.ChurnProbability * 100}%` }} /></div></div>
      <div className="profile-facts">
        <div><span>Monthly charges</span><b>${customer.MonthlyCharges.toFixed(2)}</b></div>
        <div><span>Tenure</span><b>{customer.tenure} {customer.tenure === 1 ? "month" : "months"}</b></div>
        <div><span>Internet</span><b>{customer.InternetService}</b></div>
        <div><span>Payment</span><b>{customer.PaymentMethod.replace(" (automatic)", "")}</b></div>
        <div><span>Actual outcome</span><b>{customer.ActualChurn === "Yes" ? "Churned" : "Retained"}</b></div>
      </div>
      <section className="drawer-section">
        <div className="section-label"><span>WHY THIS SCORE</span><small>vs. typical customer</small></div>
        {customer.explanations?.slice(0, 5).map((item) => (
          <div className="explanation-row" key={item.feature}>
            <div><strong>{formatFeature(item.feature)}</strong><small>{String(item.value ?? "—")}</small></div>
            <ImpactMarker impact={item.impact} />
          </div>
        ))}
        {!customer.explanations?.length && <p className="muted-copy">Individual factor analysis is unavailable for this profile.</p>}
      </section>
      <section className="drawer-section">
        <div className="section-label"><span>POSSIBLE NEXT STEPS</span></div>
        {customer.recommendations?.map((item) => <p className="action-line" key={item}><ArrowUpRight size={14} />{item}</p>)}
      </section>
      <p className="drawer-footnote">Impact estimates compare this profile with a typical customer baseline. They are directional, not causal.</p>
    </aside>
  );
}
