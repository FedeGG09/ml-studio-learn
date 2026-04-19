import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { datasetsApi } from "@/api/datasets";
import { apiPost } from "@/api/client";
import { ExplanationBox } from "@/components/ExplanationBox";
import { MetricCard } from "@/components/MetricCard";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  FileText,
  Plus,
  Rocket,
  Save,
  Trash2,
  WandSparkles,
  Wrench,
} from "lucide-react";

type DerivedOp = "concat" | "sum" | "difference" | "product" | "ratio";

type DerivedColumnRow = {
  id: string;
  name: string;
  op: DerivedOp;
  left: string;
  right: string;
  separator: string;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function isNumericType(type?: string) {
  return ["INTEGER", "REAL"].includes(String(type || "").toUpperCase());
}

export default function DataPrep() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datasetIdFromUrl = Number(searchParams.get("datasetId") || 0);

  const { data: datasetsData } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetsApi.list(),
  });

  const [selectedDatasetId, setSelectedDatasetId] = useState<number>(datasetIdFromUrl);
  const [versionName, setVersionName] = useState("Prepared version");
  const [targetColumn, setTargetColumn] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>({});
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});
  const [derivedColumns, setDerivedColumns] = useState<DerivedColumnRow[]>([]);
  const [saveResult, setSaveResult] = useState<any>(null);

  const initializedForDatasetRef = useRef<number | null>(null);

  useEffect(() => {
    if (datasetIdFromUrl && datasetIdFromUrl !== selectedDatasetId) {
      setSelectedDatasetId(datasetIdFromUrl);
    }
  }, [datasetIdFromUrl, selectedDatasetId]);

  useEffect(() => {
    const firstId = datasetsData?.datasets?.[0]?.id;
    if (!selectedDatasetId && firstId) {
      setSelectedDatasetId(Number(firstId));
      setSearchParams({ datasetId: String(firstId) });
    }
  }, [datasetsData, selectedDatasetId, setSearchParams]);

  const activeDatasetId = selectedDatasetId || datasetIdFromUrl || Number(datasetsData?.datasets?.[0]?.id || 0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dataset-profile", activeDatasetId],
    queryFn: () => datasetsApi.profile(activeDatasetId),
    enabled: !!activeDatasetId,
  });

  useEffect(() => {
    if (!data?.ok || !activeDatasetId) return;

    if (initializedForDatasetRef.current === activeDatasetId) return;

    const cols = data.columns || [];
    const currentTarget =
      cols.find((c: any) => Number(c.is_target) === 1)?.column_name ||
      data.dataset?.target_column ||
      cols[cols.length - 1]?.column_name ||
      "";

    setTargetColumn(currentTarget);
    setVersionName("Prepared version");
    setSelectedFeatures(
      cols.reduce((acc: Record<string, boolean>, col: any) => {
        if (col.column_name && col.column_name !== currentTarget) {
          acc[col.column_name] = true;
        }
        return acc;
      }, {})
    );
    setRenameMap(
      cols.reduce((acc: Record<string, string>, col: any) => {
        if (col.column_name) acc[col.column_name] = "";
        return acc;
      }, {})
    );
    setDerivedColumns([]);
    setSaveResult(null);
    initializedForDatasetRef.current = activeDatasetId;
  }, [data, activeDatasetId]);

  const selectedDataset = useMemo(() => {
    return datasetsData?.datasets?.find((d: any) => Number(d.id) === Number(activeDatasetId)) ?? null;
  }, [datasetsData, activeDatasetId]);

  const columns = data?.columns ?? [];
  const preview = data?.preview ?? [];
  const dataset = data?.dataset ?? selectedDataset ?? null;
  const stats = data?.stats ?? {};

  const selectedFeatureList = columns
    .map((c: any) => c.column_name)
    .filter((name: string) => selectedFeatures[name]);

  const totalNulls = columns.reduce((acc: number, col: any) => acc + Number(col.null_count || 0), 0);
  const numericColumns = columns.filter((c: any) => isNumericType(c.data_type)).length;

  const allFeatureCandidates = columns.filter((c: any) => c.column_name !== targetColumn);

  const prepareMutation = useMutation({
    mutationFn: async () => {
      if (!activeDatasetId) {
        throw new Error("Seleccioná un dataset");
      }

      const payload = {
        versionName,
        targetColumn,
        selectedFeatures: selectedFeatureList,
        renameMap,
        derivedColumns: derivedColumns
          .filter((row) => row.name.trim() && row.left.trim())
          .map((row) => ({
            name: row.name.trim(),
            op: row.op,
            left: row.left.trim(),
            right: row.right.trim() || undefined,
            separator: row.separator,
          })),
        taskType: dataset?.inferred_problem_type || "classification",
      };

      return apiPost(`/api/datasets/${activeDatasetId}/prepare`, payload);
    },
    onSuccess: (result) => {
      setSaveResult(result);
    },
  });

  if (isLoading && activeDatasetId) {
    return <div className="p-6">Cargando Data Prep...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error cargando dataset</div>;
  }

  const preparedDatasetId = saveResult?.prepared_dataset_id ?? saveResult?.dataset?.id;
  const preparedTarget = saveResult?.dataset?.target_column ?? targetColumn;
  const problemType = dataset?.inferred_problem_type || "classification";

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

        <div className="flex flex-wrap gap-3">
          {preparedDatasetId ? (
            <Link
              to={`/model-lab?datasetId=${preparedDatasetId}&target=${encodeURIComponent(preparedTarget)}&problemType=${problemType}`}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-lg"
            >
              <Rocket className="h-4 w-4" />
              Ir a Model Lab
            </Link>
          ) : null}
        </div>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: qué hace esta pantalla"
        technicalContent="Permite seleccionar features, renombrar columnas, crear columnas derivadas y guardar una versión procesada del dataset en D1."
        didacticTitle="Simple: para qué sirve"
        didacticContent="Acá dejás el dataset listo antes de entrenar: elegís qué columnas usar, limpiás nombres y armás variables nuevas."
      />

      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Dataset activo</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={activeDatasetId || ""}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setSelectedDatasetId(nextId);
                  setSearchParams(nextId ? { datasetId: String(nextId) } : {});
                  initializedForDatasetRef.current = null;
                  setSaveResult(null);
                }}
                className="w-full sm:w-[320px] rounded-xl border border-border bg-background px-4 py-3 text-sm"
              >
                <option value="">Elegí un dataset</option>
                {(datasetsData?.datasets ?? []).map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {dataset ? (
                <Link
                  to={`/datasets/${activeDatasetId}`}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-3 border border-border hover:border-primary transition-all"
                >
                  Ver dataset
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex-1">
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
            <MetricCard title="Columnas" value={dataset.column_count} icon={<Database className="h-5 w-5" />} />
            <MetricCard title="Filas" value={dataset.row_count} icon={<FileText className="h-5 w-5" />} />
            <MetricCard title="Nulos" value={totalNulls} icon={<AlertTriangle className="h-5 w-5" />} />
            <MetricCard title="Numéricas" value={numericColumns} icon={<WandSparkles className="h-5 w-5" />} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-heading font-semibold text-sm">Features y target</h3>
                <span className="text-xs text-muted-foreground">
                  {selectedFeatureList.length} features seleccionadas
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
                    {columns.map((col: any) => {
                      const isTarget = col.column_name === targetColumn;
                      return (
                        <tr key={col.id ?? col.column_name}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!selectedFeatures[col.column_name]}
                              disabled={isTarget}
                              onChange={(e) =>
                                setSelectedFeatures((prev) => ({
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
                                onChange={() => setTargetColumn(col.column_name)}
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
                <p className="font-medium text-foreground mb-1">Sugerencia</p>
                <p>
                  Dejá como target la columna que querés predecir. El resto queda como features de entrenamiento.
                </p>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-heading font-semibold text-sm">Columnas derivadas</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDerivedColumns((prev) => [
                      ...prev,
                      {
                        id: makeId(),
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
                {derivedColumns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No hay columnas derivadas todavía.
                  </div>
                ) : null}

                {derivedColumns.map((row, index) => (
                  <div key={row.id} className="rounded-2xl border border-border/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">Derivada #{index + 1}</div>
                      <button
                        type="button"
                        onClick={() =>
                          setDerivedColumns((prev) => prev.filter((item) => item.id !== row.id))
                        }
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
                            setDerivedColumns((prev) =>
                              prev.map((item) =>
                                item.id === row.id ? { ...item, name: e.target.value } : item
                              )
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
                            setDerivedColumns((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, op: e.target.value as DerivedOp }
                                  : item
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
                            setDerivedColumns((prev) =>
                              prev.map((item) =>
                                item.id === row.id ? { ...item, left: e.target.value } : item
                              )
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Elegí una columna</option>
                          {allFeatureCandidates.map((col: any) => (
                            <option key={col.column_name} value={col.column_name}>
                              {col.column_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Columna derecha</label>
                        <select
                          value={row.right}
                          onChange={(e) =>
                            setDerivedColumns((prev) =>
                              prev.map((item) =>
                                item.id === row.id ? { ...item, right: e.target.value } : item
                              )
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Opcional</option>
                          {allFeatureCandidates.map((col: any) => (
                            <option key={col.column_name} value={col.column_name}>
                              {col.column_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Separador</label>
                        <input
                          value={row.separator}
                          onChange={(e) =>
                            setDerivedColumns((prev) =>
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

              <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Uso rápido</p>
                <p>
                  <b>concat</b> une texto, <b>sum</b> suma, <b>difference</b> resta, <b>product</b> multiplica y{" "}
                  <b>ratio</b> divide con control de cero.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="font-heading font-semibold text-sm">Guardar versión procesada</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Se crea una nueva tabla en D1, se guarda la selección de variables y queda lista para Model Lab.
                </p>
              </div>

              <button
                type="button"
                onClick={() => prepareMutation.mutate()}
                disabled={prepareMutation.isPending || !targetColumn || selectedFeatureList.length === 0}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {prepareMutation.isPending ? "Guardando..." : "Create version"}
              </button>
            </div>

            {prepareMutation.isError ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {(prepareMutation.error as Error)?.message || "Error guardando la preparación"}
              </div>
            ) : null}

            {saveResult?.ok ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Versión creada con éxito
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-emerald-500/20 bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Nuevo dataset</div>
                    <div className="font-medium">{saveResult.dataset?.name}</div>
                    <div className="text-xs text-muted-foreground">ID {saveResult.prepared_dataset_id}</div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Tabla creada</div>
                    <div className="font-medium">{saveResult.table_name}</div>
                    <div className="text-xs text-muted-foreground">Target: {saveResult.dataset?.target_column}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/datasets/${saveResult.prepared_dataset_id}`}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                  >
                    Ver dataset preparado
                  </Link>
                  <Link
                    to={`/model-lab?datasetId=${saveResult.prepared_dataset_id}&target=${encodeURIComponent(
                      saveResult.dataset?.target_column || targetColumn
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
                  {columns.map((col: any) => (
                    <tr key={col.id}>
                      <td>{col.column_name}</td>
                      <td>{col.data_type}</td>
                      <td>{col.null_count}</td>
                      <td>{col.unique_count}</td>
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
                      {Object.values(row).map((value: any, i) => (
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
            <pre className="text-xs">{JSON.stringify(stats, null, 2)}</pre>
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