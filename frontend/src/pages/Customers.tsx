import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { api } from "../api";
import { CustomerDetail } from "../components/CustomerDetail";
import { CustomerTable } from "../components/CustomerTable";
import { ErrorState, LoadingState, PageHeading, useLoad } from "../components/Shared";
import type { Customer } from "../types";

interface CustomerPageData {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
}

export default function Customers({ initialCustomer = null }: { initialCustomer?: Customer | null }) {
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("all");
  const [contract, setContract] = useState("all");
  const [tenureMin, setTenureMin] = useState("");
  const [tenureMax, setTenureMax] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("ChurnProbability");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchText.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const query = new URLSearchParams({ page: String(page), page_size: "30" });
  query.set("sort_by", sortBy);
  query.set("direction", direction);
  if (search) query.set("search", search);
  if (risk !== "all") query.set("risk", risk);
  if (contract !== "all") query.set("contract", contract);
  if (tenureMin) query.set("tenure_min", tenureMin);
  if (tenureMax) query.set("tenure_max", tenureMax);
  const loadCustomers = useCallback(() => api<CustomerPageData>(`/customers?${query.toString()}`), [search, risk, contract, tenureMin, tenureMax, sortBy, direction, page]);
  const result = useLoad(loadCustomers, [loadCustomers]);
  const totalPages = Math.max(1, Math.ceil((result.data?.total ?? 0) / 30));

  const selectCustomer = async (customer: Customer) => {
    setSelected(customer);
    setDetail(null);
    setDetailError(null);
    try {
      setDetail(await api<Customer>(`/customers/${encodeURIComponent(customer.customerID)}`));
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "Could not load customer details.");
    }
  };
  useEffect(() => {
    if (initialCustomer) void selectCustomer(initialCustomer);
    // Load the selected profile once when navigating from the overview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomer?.customerID]);
  const clearFilters = () => {
    setSearchText("");
    setSearch("");
    setRisk("all");
    setContract("all");
    setTenureMin("");
    setTenureMax("");
    setPage(1);
  };

  return (
    <div className="page-enter">
      <PageHeading eyebrow="CUSTOMER FILE / 02" title="A closer look at risk." description="Search the portfolio, find the next conversation, and inspect the signals behind each score." action={<span className="filter-stamp"><Filter size={14} /> SCORED PROFILES</span>} />

      <section className="customer-workspace">
        <div className="filter-bar">
          <label className="search-field"><Search size={16} /><input ref={searchRef} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search customer ID" aria-label="Search customer ID" /><kbd>⌘ K</kbd></label>
          <div className="filter-select"><SlidersHorizontal size={14} /><select value={risk} onChange={(event) => { setRisk(event.target.value); setPage(1); }} aria-label="Filter by risk"><option value="all">All risk levels</option><option value="High">High risk</option><option value="Medium">Medium risk</option><option value="Low">Low risk</option></select></div>
          <div className="filter-select"><select value={contract} onChange={(event) => { setContract(event.target.value); setPage(1); }} aria-label="Filter by contract"><option value="all">All contracts</option><option>Month-to-month</option><option>One year</option><option>Two year</option></select></div>
          <label className="tenure-filter"><span>MIN MO</span><input type="number" min="0" max="72" value={tenureMin} onChange={(event) => { setTenureMin(event.target.value); setPage(1); }} placeholder="0" aria-label="Minimum tenure in months" /></label>
          <label className="tenure-filter"><span>MAX MO</span><input type="number" min="0" max="72" value={tenureMax} onChange={(event) => { setTenureMax(event.target.value); setPage(1); }} placeholder="72" aria-label="Maximum tenure in months" /></label>
          <button className="clear-filters" onClick={clearFilters}>Clear</button>
        </div>

        <div className="customer-results-head"><span><strong>{result.data?.total.toLocaleString() ?? "—"}</strong> profiles found</span><span>ORDERED BY CHURN PROBABILITY <i className="sort-caret" /></span></div>
        {result.loading ? <LoadingState label="Filtering customer portfolio" /> : result.error ? <ErrorState message={result.error} retry={result.retry} /> : <CustomerTable customers={result.data?.items ?? []} selected={selected?.customerID} onSelect={selectCustomer} sort={{ by: sortBy, direction, onChange: (field) => { setPage(1); setDirection(sortBy === field && direction === "desc" ? "asc" : "desc"); setSortBy(field); } }} />}
        <div className="pagination">
          <span>Page {page} of {totalPages}</span>
          <div><button className="pager-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="pager-button pager-next" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next <span>→</span></button></div>
        </div>
      </section>

      {selected && detail && <CustomerDetail customer={detail} onClose={() => { setSelected(null); setDetail(null); }} />}
      {selected && !detail && <div className="customer-drawer drawer-loading">{detailError ? <><strong>Profile unavailable</strong><p>{detailError}</p><button className="pager-button" onClick={() => selectCustomer(selected)}>Retry</button><button className="icon-button" onClick={() => setSelected(null)}>×</button></> : <LoadingState label="Opening customer profile" />}</div>}
    </div>
  );
}
