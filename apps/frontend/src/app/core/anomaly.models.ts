// Reflète le modèle Prisma `Anomaly` du backend (dates en ISO 8601)
export interface Anomaly {
  id: string;
  windowStart: string;
  windowEnd: string;
  totalLogs: number;
  errorCount: number;
  distinctUrls: number;
  simulateFailureCount: number;
  errorRate: number;
  anomalyScore: number;
  isFalsePositive: boolean;
  createdAt: string;
}

// Réponse de GET /api/anomalies/stats
export interface AnomalyStats {
  total: number;
  last24h: number;
  falsePositives: number;
  latest: Anomaly | null;
  hourly: { hour: string; count: number }[];
}

// Paramètres optionnels de GET /api/anomalies
export interface AnomalyQuery {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
  falsePositive?: boolean;
}

// Une page de résultats : le total vient de l'en-tête X-Total-Count
export interface Page<T> {
  items: T[];
  total: number;
}
