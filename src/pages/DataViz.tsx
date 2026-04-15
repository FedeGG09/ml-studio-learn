import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet, apiPost } from "@/api/client";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleHelp, Sparkles, X, ChartColumnBig, Database, WandSparkles } from "lucide-react";

type ChartType = "bar" | "line" | "scatter" | "pie";
type Aggregation = "sum" | "avg" | "count" | "min" | "max";

type DatasetSummary = {
  id: number;
  name: string;
  description?: string | null;
  source_type?: string | null;
  storage_key?: string | null;
  preview_key?: string | null;
  row_count?: number | null;
  column_count?: number | null;
  target_column?: string | null;
  table_name?: string | null;
  inferred_problem_type?: string | null;
};

type ColumnMeta = {
  id: number;
  dataset_id: number;
  column_name: string;
  data_type: string;
  is_target: number;
  has_nulls: number;
  null_count: number;
  unique_count: number;
};

type DatasetProfileResponse = {
  ok: boolean;
  dataset: DatasetSummary;
  columns: ColumnMeta[];
  preview: Record<string, unknown>[];
  stats: Record<string, unknown>;
};

type SqlExecuteResponse = {
  ok: boolean;
  results: Record<string, unknown>[];
  meta?: unknown;
  error?: string;
};

type VisualPoint = {
  label?: string | number;
  value?: number;
  x?: number;
  y?: number;
  name?: string;
};

const COLORS = [
  "hsl(160,72%,50%)",
  "hsl(200,70%,50%)",
  "hsl(280,70%,60%)",
  "hsl(40,90%,55%)",
  "hsl(0,80%,60%)",
  "hsl(120,60%,45%)",
  "hsl(320,65%,58%)",
];

const chartDescriptions: Record<
  ChartType,
  {
    technicalTitle: string;
    technicalContent: string;
    didacticTitle: string;
    didacticContent: string;
  }
> = {
  bar: {
    technicalTitle: "Técnico: barras agregadas",
    technicalContent:
      "Se agrupan categorías y se aplica una agregación sobre una variable numérica o un conteo de filas para comparar magnitudes entre grupos.",
    didacticTitle: "Sencillo: ¿Cómo funciona?",
    didacticContent:
      "Sirve para comparar valores entre grupos, como ventas por región o cantidad de casos por categoría.",
  },
  line: {
    technicalTitle: "Técnico: serie ordenada",
    technicalContent:
      "Se ordenan los valores por una dimensión y se visualiza la evolución de una métrica agregada en ese orden.",
    didacticTitle: "Sencillo: ¿Cómo funciona?",
    didacticContent:
      "Te muestra una tendencia. Es útil cuando querés ver cómo cambia algo en el tiempo o en un orden natural.",
  },
  scatter: {
    technicalTitle: "Técnico: dispersión numérica",
    technicalContent:
      "Se proyectan dos variables numéricas en ejes X e Y para observar correlación, clusters y valores atípicos.",
    didacticTitle: "Sencillo: ¿Cómo funciona?",
    didacticContent:
      "Cada punto es una fila del dataset. Te ayuda a ver si dos números se mueven juntos o no.",
  },
  pie: {
    technicalTitle: "Técnico: composición porcentual",
    technicalContent:
      "Se agregan categorías y se visualiza el peso relativo de cada grupo sobre el total.",
    didacticTitle: "Sencillo: ¿Cómo funciona?",
    didacticContent:
      "Muestra qué parte representa cada grupo dentro del total.",
  },
};

function isNumericType(dataType: string) {
  return ["INTEGER", "REAL"].includes(String(dataType).toUpperCase());
}

function isDateLike(value: unknown) {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{4}\/\d{2}\/\d{2}/.test(value);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function safeString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildQuery(params: {
  chartType: ChartType;
  tableName: string;
  xColumn?: string;
  yColumn?: string;
  aggregation?: Aggregation;
  limit: number;
}) {
  const { chartType, tableName, xColumn, yColumn, aggregation = "sum", limit } = params;
  const quotedTable = `"${tableName}"`;
  const safeLimit = Math.max(5, Math.min(limit, 500));

  if (chartType === "scatter") {
    if (!xColumn || !yColumn) return "";
    return `
      SELECT
        "${xColumn}" AS x,
        "${yColumn}" AS y
      FROM ${quotedTable}
      WHERE "${xColumn}" IS NOT NULL
        AND "${yColumn}" IS NOT NULL
      LIMIT ${safeLimit}
    `;
  }

  if (!xColumn) return "";

  const aggExpr =
    aggregation === "count"
      ? "COUNT(*)"
      : yColumn
        ? `${aggregation.toUpperCase()}("${yColumn}")`
        : "COUNT(*)";

  const orderDir = chartType === "line" ? "ASC" : "DESC";

  return `
    SELECT
      "${xColumn}" AS label,
      ROUND(${aggExpr}, 2) AS value
    FROM ${quotedTable}
    WHERE "${xColumn}" IS NOT NULL
    GROUP BY "${xColumn}"
    ORDER BY value ${orderDir}
    LIMIT ${safeLimit}
  `;
}

function inferInitialChartType(columns: ColumnMeta[], preview: Record<string, unknown>[]): ChartType {
  const numericCols = columns.filter((c) => isNumericType(c.data_type));
  const dateLikeCols = columns.filter((c) => {
    const firstValue = preview[0]?.[c.column_name];
    return isDateLike(firstValue);
  });
  const categoricalCols = columns.filter((c) => !isNumericType(c.data_type));

  if (numericCols.length >= 2) return "scatter";
  if (dateLikeCols.length >= 1 && numericCols.length >= 1) return "line";
  if (categoricalCols.length >= 1 && numericCols.length >= 1) return "bar";
  return "pie";
}

function getSmartPreset(profile: DatasetProfileResponse | null) {
  const columns = profile?.columns ?? [];
  const preview = profile?.preview ?? [];

  const numericCols = columns.filter((c) => isNumericType(c.data_type));
  const categoricalCols = columns.filter((c) => !isNumericType(c.data_type));
  const dateLikeCols = columns.filter((c) => {
    const firstValue = preview[0]?.[c.column_name];
    return isDateLike(firstValue);
  });

  if (numericCols.length >= 2) {
    return {
      chartType: "scatter" as ChartType,
      xColumn: numericCols[0].column_name,
      yColumn: numericCols[1].column_name,
      aggregation: "sum" as Aggregation,
      limit: 200,
    };
  }

  if (dateLikeCols.length >= 1 && numericCols.length >= 1) {
    return {
      chartType: "line" as ChartType,
      xColumn: dateLikeCols[0].column_name,
      yColumn: numericCols[0].column_name,
      aggregation: "avg" as Aggregation,
      limit: 24,
    };
  }

  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    return {
      chartType: "bar" as ChartType,
      xColumn: categoricalCols[0].column_name,
      yColumn: numericCols[0].column_name,
      aggregation: "sum" as Aggregation,
      limit: 12,
    };
  }

  if (categoricalCols.length >= 1) {
    return {
      chartType: "pie" as ChartType,
      xColumn: categoricalCols[0].column_name,
      yColumn: "",
      aggregation: "count" as Aggregation,
      limit: 8,
    };
  }

  return {
    chartType: "bar" as ChartType,
    xColumn: columns[0]?.column_name ?? "",
    yColumn: numericCols[0]?.column_name ?? "",
    aggregation: "count" as Aggregation,
    limit: 12,
  };
}

export default function DataViz() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number>(
    Number(searchParams.get("datasetId") ?? 0) || 0
  );
  const [profile, setProfile] = useState<DatasetProfileResponse | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [aggregation, setAggregation] = useState<Aggregation>("sum");
  const [limit, setLimit] = useState(12);
  const [chartData, setChartData] = useState<VisualPoint[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);

  const dataset = useMemo(() => {
    return datasets.find((d) => Number(d.id) === Number(selectedDatasetId)) ?? null;
  }, [datasets, selectedDatasetId]);

  const columns = profile?.columns ?? [];
  const numericColumns = columns.filter((c) => isNumericType(c.data_type));
  const categoricalColumns = columns.filter((c) => !isNumericType(c.data_type));
  const activeDescription = chartDescriptions[chartType];
  const currentTableName =
    profile?.dataset?.table_name ||
    profile?.dataset?.storage_key ||
    dataset?.table_name ||
    dataset?.storage_key ||
    "";

  const xOptions = useMemo(() => {
    if (chartType === "scatter") return numericColumns;
    return [...categoricalColumns, ...numericColumns];
  }, [chartType, categoricalColumns, numericColumns]);

  const yOptions = useMemo(() => {
    if (chartType === "scatter") return numericColumns;
    return numericColumns;
  }, [chartType, numericColumns]);

  const smartPreset = useMemo(() => getSmartPreset(profile), [profile]);

  useEffect(() => {
    const loadDatasets = async () => {
      setLoadingDatasets(true);
      setError(null);

      try {
        const data = await apiGet<{ ok: boolean; datasets: DatasetSummary[] }>("/api/datasets");
        if (data.ok) {
          const list = data.datasets ?? [];
          setDatasets(list);

          const urlDatasetId = Number(searchParams.get("datasetId") ?? 0);
          const initialDatasetId = urlDatasetId || Number(list[0]?.id ?? 0) || 0;
          setSelectedDatasetId(initialDatasetId);
        }
      } catch (err: any) {
        setError(err?.message ?? "Error cargando datasets");
      } finally {
        setLoadingDatasets(false);
      }
    };

    loadDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!selectedDatasetId) return;

      setLoadingProfile(true);
      setError(null);

      try {
        const data = await apiGet<DatasetProfileResponse>(
          `/api/datasets/${selectedDatasetId}/profile`
        );

        if (data.ok) {
          setProfile(data);

          const preset = getSmartPreset(data);
          setChartType(preset.chartType);
          setXColumn(preset.xColumn);
          setYColumn(preset.yColumn);
          setAggregation(preset.aggregation);
          setLimit(preset.limit);
        }
      } catch (err: any) {
        setError(err?.message ?? "Error cargando dataset");
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [selectedDatasetId]);

  useEffect(() => {
    if (!profile?.dataset?.table_name) return;

    const query = buildQuery({
      chartType,
      tableName: profile.dataset.table_name,
      xColumn,
      yColumn,
      aggregation,
      limit,
    });

    if (!query) {
      setChartData([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setQueryLoading(true);
      setError(null);

      try {
        const data = await apiPost<SqlExecuteResponse>("/api/sql/execute", {
          query,
          datasetId: selectedDatasetId,
          queryName: `DataViz ${chartType} - ${xColumn}${yColumn ? ` / ${yColumn}` : ""}`,
        });

        if (!data.ok) {
          throw new Error(data.error || "Error ejecutando visualización");
        }

        const results = data.results ?? [];

        if (chartType === "scatter") {
          const normalized = results
            .map((row) => ({
              x: toNumber((row as any).x),
              y: toNumber((row as any).y),
            }))
            .filter((row) => row.x !== null && row.y !== null) as Array<{ x: number; y: number }>;

          setChartData(normalized);
        } else {
          const normalized = results.map((row) => ({
            label: safeString((row as any).label),
            value: Number((row as any).value ?? 0),
          }));
          setChartData(normalized);
        }
      } catch (err: any) {
        setError(err?.message ?? "Error construyendo visualización");
        setChartData([]);
      } finally {
        setQueryLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [profile, chartType, xColumn, yColumn, aggregation, limit, selectedDatasetId]);

  const totalRows = Number(profile?.dataset?.row_count ?? profile?.preview?.length ?? 0);
  const targetColumn = profile?.dataset?.target_column ?? "";
  const targetType = profile?.dataset?.inferred_problem_type ?? "classification";

  const pieData = useMemo(() => {
    if (chartType !== "pie") return [];
    return chartData.map((item) => ({
      name: safeString(item.label),
      value: Number(item.value ?? 0),
    }));
  }, [chartData, chartType]);

  const renderChart = () => {
    if (queryLoading) {
      return <div className="p-6 text-sm text-muted-foreground">Construyendo gráfico...</div>;
    }

    if (!chartData.length) {
      return (
        <div className="p-6 text-sm text-muted-foreground">
          Seleccioná un dataset y ajustá columnas para generar una visualización.
        </div>
      );
    }

    if (chartType === "scatter") {
      return (
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" name={xColumn} />
            <YAxis dataKey="y" name={yColumn} />
            <Tooltip />
            <Scatter data={chartData} fill="hsl(200,70%,50%)" />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="hsl(160,72%,50%)" strokeWidth={3} dot />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={420}>
          <PieChart>
            <Tooltip />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={150}
              label
            >
              {pieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={chartData} margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="hsl(280,70%,60%)" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const applySmartPreset = () => {
    const preset = getSmartPreset(profile);
    setChartType(preset.chartType);
    setXColumn(preset.xColumn);
    setYColumn(preset.yColumn);
    setAggregation(preset.aggregation);
    setLimit(preset.limit);
  };

  return (
    <div className="space-y-8 max-w-7xl relative">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="section-title">Data Viz</h1>
          <p className="section-subtitle mt-1">
            Explorá gráficos reales sobre el dataset activo.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/sql-lab"
            className="rounded-xl px-4 py-2 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
          >
            SQL Lab
          </Link>
          <Link
            to="/model-lab"
            className="rounded-xl px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Model Lab
          </Link>
        </div>
      </div>

      <ExplanationBox
        technicalTitle={activeDescription.technicalTitle}
        technicalContent={activeDescription.technicalContent}
        didacticTitle={activeDescription.didacticTitle}
        didacticContent={activeDescription.didacticContent}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Dataset
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-xs text-muted-foreground">Elegir dataset</label>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={selectedDatasetId}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setSelectedDatasetId(next);
                  setSearchParams(next ? { datasetId: String(next) } : {});
                }}
              >
                {loadingDatasets ? (
                  <option value={0}>Cargando datasets...</option>
                ) : (
                  datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))
                )}
              </select>

              {dataset && (
                <div className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{dataset.name}</div>
                  <div className="mt-1">
                    Filas: {dataset.row_count ?? "—"} · Columnas: {dataset.column_count ?? "—"}
                  </div>
                  <div className="mt-1">
                    Target: {targetColumn || "—"} · Tipo: {targetType}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ChartColumnBig className="h-4 w-4" />
                Tipo de gráfico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {(["bar", "line", "scatter", "pie"] as ChartType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    className={`rounded-xl px-3 py-2 text-sm transition-all ${
                      chartType === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "bar" ? "Barra" : t === "line" ? "Línea" : t === "scatter" ? "Scatter" : "Pie"}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Columnas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Eje X / Grupo</label>
                <select
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  value={xColumn}
                  onChange={(e) => setXColumn(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {xOptions.map((col) => (
                    <option key={col.column_name} value={col.column_name}>
                      {col.column_name} ({col.data_type})
                    </option>
                  ))}
                </select>
              </div>

              {chartType === "scatter" ? (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Eje Y</label>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={yColumn}
                    onChange={(e) => setYColumn(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {yOptions.map((col) => (
                      <option key={col.column_name} value={col.column_name}>
                        {col.column_name} ({col.data_type})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Métrica</label>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={yColumn}
                    onChange={(e) => setYColumn(e.target.value)}
                  >
                    <option value="">COUNT(*)</option>
                    {yOptions.map((col) => (
                      <option key={col.column_name} value={col.column_name}>
                        {col.column_name} ({col.data_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Agregación</label>
                <select
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  value={aggregation}
                  onChange={(e) => setAggregation(e.target.value as Aggregation)}
                  disabled={chartType === "scatter"}
                >
                  <option value="sum">SUM</option>
                  <option value="avg">AVG</option>
                  <option value="count">COUNT</option>
                  <option value="min">MIN</option>
                  <option value="max">MAX</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Límite de categorías: {limit}
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={1}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <Button
                onClick={applySmartPreset}
                variant="secondary"
                className="w-full gap-2"
              >
                <WandSparkles className="h-4 w-4" />
                Sugerir configuración
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Rows</div>
                  <div className="font-medium">{totalRows}</div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Columns</div>
                  <div className="font-medium">{columns.length}</div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Numéricas</div>
                  <div className="font-medium">{numericColumns.length}</div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Categorías</div>
                  <div className="font-medium">{categoricalColumns.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-heading font-semibold text-sm">Visualización</h3>
                <p className="text-xs text-muted-foreground">
                  {currentTableName ? `Tabla: ${currentTableName}` : "Seleccioná un dataset para comenzar"}
                </p>
              </div>
              {queryLoading && (
                <div className="text-xs text-muted-foreground">Actualizando...</div>
              )}
            </div>

            {loadingProfile ? (
              <div className="p-6 text-sm text-muted-foreground">Cargando dataset...</div>
            ) : error ? (
              <div className="p-6 text-sm text-red-500">{error}</div>
            ) : (
              renderChart()
            )}
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Preview SQL</h3>
            {profile?.preview?.length ? (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      {Object.keys(profile.preview[0] ?? {}).map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.preview.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((value, i) => (
                          <td key={i}>{String(value ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No hay preview disponible.
              </div>
            )}
          </div>
        </div>
      </div>

      {helpOpen ? (
        <div className="fixed bottom-6 right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)]">
          <Card className="shadow-2xl border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Ayuda rápida
                </CardTitle>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="rounded-full p-1 hover:bg-muted transition-colors"
                  aria-label="Cerrar ayuda"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Esta pantalla te ayuda a convertir datos en gráficos reales sin tocar SQL.
              </p>

              <div className="space-y-2">
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="font-medium text-xs mb-1">1. Elegí un dataset</div>
                  <div className="text-xs text-muted-foreground">
                    El panel izquierdo carga las columnas reales desde D1.
                  </div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="font-medium text-xs mb-1">2. Elegí el gráfico</div>
                  <div className="text-xs text-muted-foreground">
                    Barra, línea, scatter o pie. Si no sabés cuál usar, tocá “Sugerir configuración”.
                  </div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="font-medium text-xs mb-1">3. Ajustá columnas</div>
                  <div className="text-xs text-muted-foreground">
                    X define el grupo, Y define la métrica y la agregación cambia el cálculo.
                  </div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="font-medium text-xs mb-1">4. Pasá a entrenar</div>
                  <div className="text-xs text-muted-foreground">
                    Cuando tengas una buena vista, usá Model Lab para entrenar con target y parámetros.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <button
        onClick={() => setHelpOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Abrir ayuda"
      >
        <CircleHelp className="h-6 w-6" />
      </button>
    </div>
  );
}