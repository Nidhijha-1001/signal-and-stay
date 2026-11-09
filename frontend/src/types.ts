export type Risk = "High" | "Medium" | "Low";

export interface Customer {
  customerID: string;
  gender: string;
  SeniorCitizen: number;
  Partner: string;
  Dependents: string;
  tenure: number;
  PhoneService: string;
  MultipleLines: string;
  InternetService: string;
  OnlineSecurity: string;
  OnlineBackup: string;
  DeviceProtection: string;
  TechSupport: string;
  StreamingTV: string;
  StreamingMovies: string;
  Contract: string;
  PaperlessBilling: string;
  PaymentMethod: string;
  MonthlyCharges: number;
  TotalCharges: number | null;
  ActualChurn: "Yes" | "No";
  ChurnProbability: number;
  PredictedChurn: "Yes" | "No";
  RiskCategory: Risk;
}

export interface Explanation {
  feature: string;
  value: string | number | null;
  baseline: string | number | null;
  impact: number;
  direction: "increases" | "reduces" | "neutral";
}

export interface RecommendationOpportunity {
  segment: string;
  customers: number;
  share_of_high_risk: number;
  avg_monthly_charges: number;
}

export interface Metrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  f2: number;
  roc_auc: number;
  pr_auc: number;
  threshold: number;
  cv_recall: number;
  confusion_matrix: number[][];
  roc_curve: { false_positive_rate: number[]; true_positive_rate: number[] };
  precision_recall_curve: { precision: number[]; recall: number[] };
}

export interface ModelPerformance {
  selected_model: string;
  selection_criterion: string;
  threshold_policy: string;
  holdout_size: number;
  dataset_size: number;
  models: Record<string, Metrics>;
  summary: Record<string, Record<string, number>>;
}
