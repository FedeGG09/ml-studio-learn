import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Play, Clock3, Database, FileCode2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/api/client";

type QueryResult = {
  ok: boolean;
  results: Record<string, unknown>[];
  meta?: unknown;
  error?: string;
};

type HistoryItem = {
  id: number;
  dataset_id: number | null;
  query_name: string | null;
  query_text: string;
  created_at: string;
};

const exampleQueries = [
  {
    label: "Retail revenue by region",
    sql: `SELECT region, ROUND(SUM(revenue), 2) AS total_revenue
FROM retail_sales
GROUP BY region
ORDER BY total_revenue DESC;`,
  },
  {
    label: "Retail avg units by category",
    sql: `SELECT product_category, ROUND(AVG(units_sold), 2) AS avg_units
FROM retail_sales
GROUP BY product_category
ORDER BY avg_units DESC;`,
  },
  {
    label: "SaaS churn by plan",
    sql: `SELECT plan, ROUND(AVG(churn) * 100, 2) AS churn_rate_pct
FROM saas_churn
GROUP BY plan
ORDER BY churn_rate_pct DESC;`,
  },
];

export default function SqlLab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [datasetIdInput, setDatasetIdInput] = useState(searchParams.get("datasetId") ?? "");
  const [query, setQuery] = useState(exampleQueries[0].sql);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const datasetId = useMemo(() => {
    const n = Number(datasetIdInput);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [datasetIdInput]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiGet<{ ok: boolean; queries: HistoryItem[] }>(
        datasetId ? `/api/sql/history?datasetId=${datasetId}` : "/api/sql/history"
      );
      if (data.ok) setHistory(data.queries ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Error cargando historial");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const execute = async () => {
    setLoading(true);
    setResult(null);

    try {
      const data = await apiPost<QueryResult>("/api/sql/execute", {
        query,
        datasetId,
        queryName: "Manual SQL",
      });

      setResult(data);
      toast.success("Consulta ejecutada");
      loadHistory();
    } catch (err: any) {
      toast.error(err?.message ?? "Error ejecutando SQL");
      setResult({
        ok: false,
        results: [],
        error: err?.message ?? "Error ejecutando SQL",
      });
    } finally {
      setLoading(false);
    }
  };

  const rows = result?.results ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">SQL Lab</h1>
        <p className="section-subtitle mt-1">
          Ejecuta SQL real sobre D1 y guarda el historial de consultas.
        </p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: SQL sobre D1"
        technicalContent="Las consultas SELECT, WITH, PRAGMA y EXPLAIN se ejecutan directamente en Cloudflare D1. Las consultas quedan registradas para auditoría y aprendizaje."
        didacticTitle="Sencillo: ¿Qué hago aquí?"
        didacticContent="Escribís SQL, lo ejecutás y ves el resultado como si fuera una mini consola de análisis de datos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCode2 className="h-4 w-4" />
                Editor SQL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Dataset ID opcional
                  </label>
                  <Input
                    value={datasetIdInput}
                    onChange={(e) => setDatasetIdInput(e.target.value)}
                    placeholder="Ej: 1"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Sugerencias rápidas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {exampleQueries.map((ex) => (
                      <Button
                        key={ex.label}
                        variant="secondary"
                        size="sm"
                        onClick={() => setQuery(ex.sql)}
                      >
                        {ex.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[240px] font-mono text-sm"
                placeholder="Escribí tu consulta SQL aquí..."
              />

              <div className="flex flex-wrap gap-3">
                <Button onClick={execute} disabled={loading} className="gap-2">
                  <Play className="h-4 w-4" />
                  {loading ? "Ejecutando..." : "Ejecutar consulta"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery(exampleQueries[0].sql);
                    setResult(null);
                  }}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>

                <Button
                  variant="secondary"
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="gap-2"
                >
                  <Clock3 className="h-4 w-4" />
                  Historial
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setSearchParams(datasetId ? { datasetId: String(datasetId) } : {})}
                  className="gap-2"
                >
                  <Database className="h-4 w-4" />
                  Fijar filtro
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              {result?.error && (
                <div className="mb-4 text-sm text-red-500">
                  {result.error}
                </div>
              )}

              {rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx}>
                          {columns.map((col) => (
                            <td key={col}>{String(row[col] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap bg-muted/20 p-4 rounded-2xl overflow-x-auto">
                  {result ? JSON.stringify(result.meta ?? result, null, 2) : "Todavía no ejecutaste una consulta."}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Historial de consultas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay consultas guardadas todavía.
                </p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setQuery(item.query_text)}
                    className="w-full text-left rounded-2xl border border-border/60 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {item.query_name ?? `Query #${item.id}`}
                    </div>
                    <div className="text-[11px] line-clamp-4 font-mono whitespace-pre-wrap">
                      {item.query_text}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}