import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExplanationBox } from "@/components/ExplanationBox";
import { MetricCard } from "@/components/MetricCard";
import {
  AlertTriangle,
  CheckCircle2,
  Columns,
  Database,
  FileText,
  Plus,
  Rocket,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";

type DerivedOp = "concat" | "sum" | "difference" | "product" | "ratio";

type DerivedRow = {
  id: string;
  name: string;
  op: DerivedOp;
  left: string;
  right: string;
  separator: string;
};

type DatasetRow = {
  id: number;
  name: string;
  description?: string | null;
  source_type?: string | null;
  storage_key?: string | null;
  preview_key?: string | null;
  row_count?: number | null;
  column_count?: number | null;
  target_column?: string | null;
  inferred_problem_type?: "regression" | "classification";
};

type ColumnRow = {
  id?: number;
  column_name: string;
  data_type: string;
  is_target?: number;
  has_nulls?: number;
  null_count?: number;
  unique_count?: number;
};

type ProfileResponse = {
  ok: boolean;
  dataset: DatasetRow;
  columns: ColumnRow[];
  preview: Record<string, unknown>[];
  stats: Record<string, unknown>;
};

type PrepareResponse = {
  ok: boolean;
  prepared_dataset_id: number;
  preparation_id: number;
  table_name: string;
  dataset: DatasetRow;
  columns: ColumnRow[];
  preview: Record<string, unknown>[];
  stats: Record<string, unknown>;
  error?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.error || `Error GET ${path}`);
  }
  return data as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.error || `Error POST ${path}`);
  }
  return data as T;
}

function isNumericType(t?: string) {
  return ["INTEGER", "REAL"].includes(String(t || "").toUpperCase());
}

function defaultSelectedMap(columns: ColumnRow[], targetColumn: string) {
  const out: Record<string, boolean> = {};
  columns.forEach((c) => {
    if (c.column_name !== targetColumn) out[c.column_name] = true;
  });
  return out;
}

function defaultRenameMap(columns: ColumnRow[]) {
  const out: Record<string, string> = {};
  columns.forEach((c) => {
    out[c.column_name] = "";
  });
  return out;
}

export default function DataPrep() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datasetIdFromUrl = Number(searchParams.get("datasetId") || 0);

  const [selectedDatasetId, setSelectedDatasetId] = useState<number>(datasetIdFromUrl);
  const [versionName, setVersionName] = useState("Prepared version");
  const [targetColumn, setTargetColumn] = useState("");
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});
  const [derivedRows, setDerivedRows] = useState<DerivedRow[]>([]);
  const [result, setResult] = useState<PrepareResponse | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (datasetIdFromUrl && datasetIdFromUrl !== selectedDatasetId) {
      setSelectedDatasetId(datasetIdFromUrl);
    }
  }, [datasetIdFromUrl, selectedDatasetId]);

  const { data: datasetsData } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => apiGet<{ ok: boolean; datasets: DatasetRow[] }>("/api/datasets"),
  });

  const activeDatasetId =
    selectedDatasetId || datasetIdFromUrl || Number(datasetsData?.datasets?.[0]?.id || 0);

  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ["dataset-profile", activeDatasetId],
    queryFn: () => apiGet<ProfileResponse>(`/api/datasets/${activeDatasetId}/profile`),
    enabled: !!activeDatasetId,
  });

  const columns = profileData?.columns ?? [];
  const preview = profileData?.preview ?? [];
  const dataset = profileData?.dataset ?? datasetsData?.datasets?.find((d) => Number(d.id) === Number(activeDatasetId));
  const stats = profileData?.stats ?? {};

  useEffect(() => {
    if (!profileData?.ok || !activeDatasetId) return;

    setLocalError(null);
    setResult(null);

    const currentTarget =
      columns.find((c) => Number(c.is_target) === 1)?.column_name ||
      dataset?.target_column ||
      columns[columns.length - 1]?.column_name ||
      "";

    setTargetColumn(currentTarget);
    setSelectedMap(defaultSelectedMap(columns, currentTarget));
    setRenameMap(defaultRenameMap(columns));
    setDerivedRows([]);
    setVersionName("Prepared version");
  }, [profileData, activeDatasetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const numericColumns = useMemo(
    () => columns.filter((c) => isNumericType(c.data_type)).length,
    [columns]
  );

  const totalNulls = useMemo(
    () => columns.reduce((acc, c) => acc + Number(c.null_count || 0), 0),
    [columns]
  );

  const selectedCount = useMemo(
    () => Object.entries(selectedMap).filter(([, v]) => v).length,
    [selectedMap]
  );

  const visibleColumnOptions = useMemo(
    () => columns.map((c) => c.column_name).filter((name) => name !== targetColumn),
    [columns, targetColumn]
  );

  const problemType = dataset?.inferred_problem_type || "classification";

  async function handlePrepare() {
    if (!activeDatasetId) {
      setLocalError("Seleccioná un dataset.");
      return;
    }

    const selectedFeatures = columns
      .map((c) => c.column_name)
      .filter((name) => selectedMap[name] && name !== targetColumn);

    if (selectedFeatures.length === 0) {
      setLocalError("Seleccioná al menos una feature.");
      return;
    }

    const payload = {
      versionName,
      targetColumn,
      selectedFeatures,
      renameMap,
      derivedColumns: derivedRows
        .filter((r) => r.name.trim() && r.left.trim())
        .map((r) => ({
          name: r.name.trim(),
          op: r.op,
          left: r.left.trim(),
          right: r.right.trim() || undefined,
          separator: r.separator,
        })),
      taskType: problemType,
    };

    setLocalError(null);

    try {
      const prepared = await apiPost<PrepareResponse>(`/api/datasets/${activeDatasetId}/prepare`, payload);
      setResult(prepared);
    } catch (e: any) {
      setLocalError(e?.message || "Error preparando el dataset");
    }
  }

  if (isLoading && activeDatasetId) {
    return <div className="p-6">Cargando Data Prep...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error cargando dataset</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground mb-3">
            <Wrench className="h-3.5 w-3.5" />
            Data Prep Workspace
          </div>
          <h1 className="section-title">Preparación de datos</h1>
          <p className="section-subtitle mt-1">
            Limpieza, renombrado, columnas derivadas y selección de features antes del entrenamiento.
          </p>
        </div>

        {result?.prepared_dataset_id ? (
          <Link
            to={`/model-lab?datasetId=${result.prepared_dataset_id}&target=${encodeURIComponent(
              result.dataset?.target_column || targetColumn
            )}&problemType=${problemType}`}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-lg"
          >
            <Rocket className="h-4 w-4" />
            Ir a Model Lab
          </Link>
        ) : null}
      </div>

      <ExplanationBox
        technicalTitle="Técnico"
        technicalContent="Esta pantalla prepara una versión nueva del dataset en D1: permite elegir variables, renombrar columnas, crear derivadas y persistir la preparación."
        didacticTitle="Simple"
        didacticContent="Acá dejás los datos listos para entrenar: elegís qué usar, cómo se llaman las columnas y qué variables nuevas querés crear."
      />

      <div className="glass-card p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Dataset activo</label>
            <select
              value={activeDatasetId || ""}
              onChange={(e) => {
                const nextId = Number(e.target.value);
                setSelectedDatasetId(nextId);
                setSearchParams(nextId ? { datasetId: String(nextId) } : {});
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
            >
              <option value="">Elegí un dataset</option>
              {(datasetsData?.datasets || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Nombre de la versión</label>
            <input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
              placeholder="Prepared version"
            />
          </div>
        </div>
      </div>

      {dataset ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Columnas" value={dataset.column_count ?? columns.length} icon={<Columns className="h-5 w-5" />} />
            <MetricCard title="Filas" value={dataset.row_count ?? 0} icon={<FileText className="h-5 w-5" />} />
            <MetricCard title="Nulos" value={totalNulls} icon={<AlertTriangle className="h-5 w-5" />} />
            <MetricCard title="Numéricas" value={numericColumns} icon={<Database className="h-5 w-5" />} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-heading font-semibold text-sm">Features y target</h3>
                <span className="text-xs text-muted-foreground">
                  {selectedCount} seleccionadas
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Usar</th>
                      <th>Columna</th>
                      <th>Tipo</th>
                      <th>Rename</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((col) => {
                      const isTarget = col.column_name === targetColumn;
                      return (
                        <tr key={col.id ?? col.column_name}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!selectedMap[col.column_name]}
                              disabled={isTarget}
                              onChange={(e) =>
                                setSelectedMap((prev) => ({
                                  ...prev,
                                  [col.column_name]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="font-medium">{col.column_name}</td>
                          <td>{col.data_type}</td>
                          <td>
                            <input
                              value={renameMap[col.column_name] || ""}
                              onChange={(e) =>
                                setRenameMap((prev) => ({
                                  ...prev,
                                  [col.column_name]: e.target.value,
                                }))
                              }
                              placeholder={col.column_name}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                            />
                          </td>
                          <td>
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="radio"
                                name="targetColumn"
                                checked={isTarget}
                                onChange={() => {
                                  setTargetColumn(col.column_name);
                                  setSelectedMap((prev) => {
                                    const next = { ...prev };
                                    next[col.column_name] = false;
                                    return next;
                                  });
                                }}
                              />
                              {isTarget ? "🎯" : "-"}
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
                Dejá como target la columna que querés predecir. El resto queda disponible como feature.
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-heading font-semibold text-sm">Columnas derivadas</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDerivedRows((prev) => [
                      ...prev,
                      {
                        id: uid(),
                        name: "",
                        op: "concat",
                        left: "",
                        right: "",
                        separator: " ",
                      },
                    ])
                  }
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm border border-border hover:border-primary transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>

              <div className="space-y-3">
                {derivedRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No hay columnas derivadas todavía.
                  </div>
                ) : null}

                {derivedRows.map((row, index) => (
                  <div key={row.id} className="rounded-2xl border border-border/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">Derivada #{index + 1}</div>
                      <button
                        type="button"
                        onClick={() => setDerivedRows((prev) => prev.filter((item) => item.id !== row.id))}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs border border-border hover:border-destructive hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Quitar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Nombre nuevo</label>
                        <input
                          value={row.name}
                          onChange={(e) =>
                            setDerivedRows((prev) =>
                              prev.map((item) => (item.id === row.id ? { ...item, name: e.target.value } : item))
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                          placeholder="ej: customer_value"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Operación</label>
                        <select
                          value={row.op}
                          onChange={(e) =>
                            setDerivedRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id ? { ...item, op: e.target.value as DerivedOp } : item
                              )
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="concat">concat</option>
                          <option value="sum">sum</option>
                          <option value="difference">difference</option>
                          <option value="product">product</option>
                          <option value="ratio">ratio</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Columna izquierda</label>
                        <select
                          value={row.left}
                          onChange={(e) =>
                            setDerivedRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id ? { ...item, left: e.target.value } : item
                              )
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Elegí una columna</option>
                          {visibleColumnOptions.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Columna derecha</label>
                        <select
                          value={row.right}
                          onChange={(e) =>
                            setDerivedRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id ? { ...item, right: e.target.value } : item
                              )
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Opcional</option>
                          {visibleColumnOptions.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Separador</label>
                        <input
                          value={row.separator}
                          onChange={(e) =>
                            setDerivedRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id ? { ...item, separator: e.target.value } : item
                              )
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                          placeholder=" "
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="font-heading font-semibold text-sm">Guardar versión procesada</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Se crea una nueva tabla en D1 y queda lista para entrenamiento.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePrepare}
                disabled={!targetColumn || selectedCount === 0}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Crear versión
              </button>
            </div>

            {localError ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {localError}
              </div>
            ) : null}

            {result?.ok ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Versión creada con éxito
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-emerald-500/20 bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Nuevo dataset</div>
                    <div className="font-medium">{result.dataset?.name}</div>
                    <div className="text-xs text-muted-foreground">ID {result.prepared_dataset_id}</div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Tabla creada</div>
                    <div className="font-medium">{result.table_name}</div>
                    <div className="text-xs text-muted-foreground">Target: {result.dataset?.target_column}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/datasets/${result.prepared_dataset_id}`}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                  >
                    Ver dataset preparado
                  </Link>
                  <Link
                    to={`/model-lab?datasetId=${result.prepared_dataset_id}&target=${encodeURIComponent(
                      result.dataset?.target_column || targetColumn
                    )}&problemType=${problemType}`}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 text-white hover:opacity-90 transition-all"
                  >
                    <Rocket className="h-4 w-4" />
                    Entrenar con esta versión
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Detalle por columna</h3>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Columna</th>
                    <th>Tipo</th>
                    <th>Nulos</th>
                    <th>Únicos</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr key={col.id ?? col.column_name}>
                      <td>{col.column_name}</td>
                      <td>{col.data_type}</td>
                      <td>{col.null_count ?? 0}</td>
                      <td>{col.unique_count ?? 0}</td>
                      <td>{col.is_target ? "🎯" : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Preview del dataset</h3>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    {Object.keys(preview[0] || {}).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row: any, idx: number) => (
                    <tr key={idx}>
                      {Object.values(row).map((value: any, i: number) => (
                        <td key={i}>{String(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Estadísticas</h3>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(stats, null, 2)}</pre>
          </div>
        </>
      ) : (
        <div className="glass-card p-6 text-sm text-muted-foreground">
          Elegí un dataset para comenzar con la preparación.
        </div>
      )}
    </div>
  );
}