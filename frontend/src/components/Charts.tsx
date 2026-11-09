import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Metrics } from "../types";

const COLORS = ["#ed725c", "#e7ae54", "#8ba994"];
const AXIS_STYLE = { fontSize: 11, fill: "#82909a", fontFamily: "DM Mono" };

export function RiskDonut({ data }: { data: { risk: string; customers: number }[] }) {
  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="customers" nameKey="risk" innerRadius={66} outerRadius={94} paddingAngle={3} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((entry) => <Cell key={entry.risk} fill={entry.risk === "High" ? COLORS[0] : entry.risk === "Medium" ? COLORS[1] : COLORS[2]} />)}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), `${name} risk`]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center"><strong>{data.reduce((sum, item) => sum + item.customers, 0).toLocaleString()}</strong><span>customers</span></div>
    </div>
  );
}

export function SegmentBars({ data, label = "name" }: { data: { name: string; churn_rate: number }[]; label?: string }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 8, left: -20 }}>
        <CartesianGrid vertical={false} stroke="#e9e5de" />
        <XAxis dataKey={label} tick={AXIS_STYLE} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
        <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Observed churn"]} />
        <Bar dataKey="churn_rate" fill="#ed725c" radius={[4, 4, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ImportanceBars({ data }: { data: { feature: string; importance: number }[] }) {
  const chartData = [...data].filter((item) => item.importance > 0).slice(0, 8).reverse();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 18 }}>
        <CartesianGrid horizontal={false} stroke="#e9e5de" />
        <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="feature" width={112} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value: number) => [value.toFixed(4), "AUC decrease"]} />
        <Bar dataKey="importance" fill="#203849" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ModelRoc({ models }: { models: Record<string, Metrics> }) {
  const lineColors = ["#ed725c", "#426b78", "#d9a144"];
  const chartData = Array.from({ length: 41 }, (_, index) => {
    const x = index / 40;
    const point: Record<string, number> = { fpr: x, baseline: x };
    Object.entries(models).forEach(([name, metrics]) => {
      const curve = metrics.roc_curve;
      const idx = curve.false_positive_rate.findIndex((value) => value >= x);
      point[name] = idx < 0
        ? 1
        : curve.true_positive_rate[Math.max(0, idx - (curve.false_positive_rate[idx] > x ? 1 : 0))];
    });
    return point;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 18, bottom: 6, left: -18 }}>
        <CartesianGrid stroke="#e9e5de" />
        <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
        <YAxis type="number" domain={[0, 1]} tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
        <Tooltip formatter={(value: number, name: string) => [`${(value * 100).toFixed(1)}%`, name]} labelFormatter={(value) => `False positive rate: ${(Number(value) * 100).toFixed(0)}%`} />
        <Legend />
        <Line dataKey="baseline" name="Chance" stroke="#b9b9b1" strokeDasharray="4 5" dot={false} isAnimationActive={false} />
        {Object.keys(models).map((name, index) => <Line key={name} dataKey={name} stroke={lineColors[index % lineColors.length]} strokeWidth={2.2} dot={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ModelPrecisionRecall({
  models,
  prevalence,
}: {
  models: Record<string, Metrics>;
  prevalence: number;
}) {
  const colors = ["#ed725c", "#426b78", "#d9a144"];
  const points = Array.from({ length: 41 }, (_, index) => {
    const recall = index / 40;
    const point: Record<string, number> = { recall, baseline: prevalence };
    Object.entries(models).forEach(([name, metrics]) => {
      const pairs = metrics.precision_recall_curve.recall
        .map((value, pairIndex) => ({
          recall: value,
          precision: metrics.precision_recall_curve.precision[pairIndex],
        }))
        .sort((left, right) => left.recall - right.recall);
      const rightIndex = pairs.findIndex((pair) => pair.recall >= recall);
      if (rightIndex <= 0) {
        point[name] = pairs[0]?.precision ?? prevalence;
      } else {
        const left = pairs[rightIndex - 1];
        const right = pairs[rightIndex];
        const span = right.recall - left.recall;
        const offset = span ? (recall - left.recall) / span : 0;
        point[name] = left.precision + (right.precision - left.precision) * offset;
      }
    });
    return point;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points} margin={{ top: 8, right: 18, bottom: 6, left: -18 }}>
        <CartesianGrid stroke="#e9e5de" />
        <XAxis dataKey="recall" type="number" domain={[0, 1]} tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
        <YAxis type="number" domain={[0, 1]} tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
        <Tooltip formatter={(value: number, name: string) => [`${(value * 100).toFixed(1)}%`, name]} labelFormatter={(value) => `Recall: ${(Number(value) * 100).toFixed(0)}%`} />
        <Legend />
        <Line dataKey="baseline" name="Churn prevalence" stroke="#b9b9b1" strokeDasharray="4 5" dot={false} isAnimationActive={false} />
        {Object.keys(models).map((name, index) => <Line key={name} dataKey={name} stroke={colors[index % colors.length]} strokeWidth={2.2} dot={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MetricBars({ models }: { models: Record<string, Metrics> }) {
  const data = Object.entries(models).map(([name, metrics]) => ({
    name: name.replace(" ", "\n"),
    "Recall": metrics.recall,
    "Precision": metrics.precision,
    "F2": metrics.f2,
  }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
        <CartesianGrid vertical={false} stroke="#e9e5de" />
        <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 1]} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value: number) => [value.toFixed(3)]} />
        <Legend />
        <Bar dataKey="Recall" fill="#ed725c" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Precision" fill="#426b78" radius={[3, 3, 0, 0]} />
        <Line dataKey="F2" stroke="#d9a144" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ChargeDistribution({
  values,
}: {
  values: Record<string, { mean: number; median: number }>;
}) {
  const data = [
    { name: "Retained", mean: values.No?.mean ?? 0, median: values.No?.median ?? 0 },
    { name: "Churned", mean: values.Yes?.mean ?? 0, median: values.Yes?.median ?? 0 },
  ];
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
        <CartesianGrid vertical={false} stroke="#e9e5de" />
        <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
        <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`]} />
        <Legend />
        <Bar dataKey="mean" name="Mean" fill="#ed725c" radius={[3, 3, 0, 0]} />
        <Bar dataKey="median" name="Median" fill="#426b78" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ServiceRates({
  rates,
}: {
  rates: Record<string, Record<string, number>>;
}) {
  const data = Object.entries(rates).map(([service, values]) => ({
    name: service.replace(/([a-z])([A-Z])/g, "$1 $2"),
    subscribed: values.Yes ?? 0,
    notSubscribed: values.No ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 8, left: -18 }}>
        <CartesianGrid vertical={false} stroke="#e9e5de" />
        <XAxis dataKey="name" tick={{ ...AXIS_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
        <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Observed churn"]} />
        <Legend />
        <Bar dataKey="subscribed" name="Service: yes" fill="#426b78" radius={[3, 3, 0, 0]} />
        <Bar dataKey="notSubscribed" name="Service: no" fill="#ed725c" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CorrelationList({
  values,
}: {
  values: Record<string, Record<string, number>>;
}) {
  const correlations = Object.entries(values)
    .filter(([feature]) => feature !== "Churn")
    .map(([feature, row]) => ({ feature, value: row.Churn ?? 0 }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .slice(0, 6);
  return (
    <div className="correlation-list">
      {correlations.map(({ feature, value }) => (
        <div className="correlation-row" key={feature}>
          <span>{feature.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
          <div className="correlation-track"><i style={{ width: `${Math.min(Math.abs(value), 1) * 100}%`, marginLeft: value < 0 ? `${(1 - Math.min(Math.abs(value), 1)) * 100}%` : 0, background: value < 0 ? "#426b78" : "#ed725c" }} /></div>
          <b className={value < 0 ? "correlation-negative" : ""}>{value > 0 ? "+" : ""}{value.toFixed(2)}</b>
        </div>
      ))}
    </div>
  );
}

export function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const maximum = Math.max(1, ...matrix.flat());
  const cells = [
    { label: "Correct retention", value: matrix[0]?.[0] ?? 0, row: "Actual retained", col: "Predicted retained" },
    { label: "False churn alert", value: matrix[0]?.[1] ?? 0, row: "Actual retained", col: "Predicted churn" },
    { label: "Missed churn", value: matrix[1]?.[0] ?? 0, row: "Actual churn", col: "Predicted retained" },
    { label: "Detected churn", value: matrix[1]?.[1] ?? 0, row: "Actual churn", col: "Predicted churn" },
  ];
  return (
    <div className="confusion-grid">
      {cells.map((cell, index) => (
        <div key={cell.label} className={`confusion-cell confusion-${index}`} style={{ background: `rgba(237, 114, 92, ${0.07 + 0.45 * cell.value / maximum})` }}>
          <span>{cell.label}</span><strong>{cell.value.toLocaleString()}</strong><small>{cell.row} · {cell.col}</small>
        </div>
      ))}
    </div>
  );
}
