import { ChevronRight, ExternalLink } from "lucide-react";
import type { Customer } from "../types";
import { ProbabilityBar, RiskPill } from "./Shared";

export function CustomerTable({
  customers,
  onSelect,
  selected,
  sort,
}: {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  selected?: string;
  sort?: { by: string; direction: "asc" | "desc"; onChange: (field: string) => void };
}) {
  if (!customers.length) {
    return <div className="empty-state"><span className="empty-index">00</span><strong>No customers match these filters</strong><p>Try a broader search or clear one of the filters.</p></div>;
  }
  return (
    <div className="table-scroll">
      <table className="customer-table">
        <thead><tr>
          <th><SortButton label="Customer" field="customerID" sort={sort} /></th><th>Risk signal</th><th>Contract</th><th><SortButton label="Tenure" field="tenure" sort={sort} /></th><th><SortButton label="Monthly" field="MonthlyCharges" sort={sort} /></th><th><SortButton label="Churn probability" field="ChurnProbability" sort={sort} /></th><th></th>
        </tr></thead>
        <tbody>
          {customers.map((customer, index) => (
            <tr
              key={customer.customerID}
              className={selected === customer.customerID ? "selected-row" : ""}
              onClick={() => onSelect(customer)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(customer);
                }
              }}
              style={{ animationDelay: `${Math.min(index, 9) * 35}ms` }}
            >
              <td><span className="customer-id">{customer.customerID}</span><small>{customer.InternetService === "No" ? "Phone service" : customer.InternetService}</small></td>
              <td><RiskPill risk={customer.RiskCategory} /></td>
              <td>{customer.Contract}</td>
              <td>{customer.tenure} mo</td>
              <td>${customer.MonthlyCharges.toFixed(2)}</td>
              <td><ProbabilityBar value={customer.ChurnProbability} /></td>
              <td><button className="row-action" aria-label={`Open ${customer.customerID}`}><ChevronRight size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-note"><span>Scores are model estimates, not confirmed cancellation intent.</span><ExternalLink size={13} /></div>
    </div>
  );
}

function SortButton({
  label,
  field,
  sort,
}: {
  label: string;
  field: string;
  sort?: { by: string; direction: "asc" | "desc"; onChange: (field: string) => void };
}) {
  if (!sort) return <>{label}</>;
  const active = sort.by === field;
  return (
    <button className={`sort-button ${active ? "sort-active" : ""}`} onClick={() => sort.onChange(field)}>
      {label}{active && <span>{sort.direction === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}
