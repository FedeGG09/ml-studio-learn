import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet } from "@/api/client";
import { ExplanationBox } from "@/components/ExplanationBox";

type Metric = {
  id: number;
  run_id: number;
  metric_name: string;
  metric_value: number;
};

type Artifact = {
  id: number;
  run_id: number;
  artifact_type: string;
  artifact_key: string;
  created_at: string;
};

type Config = {
  id: number;
  run_id: number;
  params_json: string;
};

type Run = {
  id: number;
  experiment_id: number;
  model_name: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  error_message?: string | null;
  config?: Config | null;
  metrics?: Metric[];
  artifacts?: Artifact[];
  score?: number | null;
};

type Experiment = {
  id: number;
  dataset_id: number;
  experiment_name: string;
  problem_type: string;
  task_type?: string | null;
  target_column: string;
  train_size: number;
  test_size: number;
  train_split?: number | null;
  random_state: number;
  created_at: string;
  run_count: number;
  failed_runs: number;
  best_model: string | null;
  best_score: number | null;
  leaderboard: Run[];
};

type ExperimentsResponse = {
  ok: boolean;
  experiments: Experiment[];
};

type ExperimentDetailResponse = {
  ok: boolean;
  experiment: Experiment;
  runs: Run[];
  leaderboard: Run[];
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

function pickScore(run: Run) {
  if (!run.metrics || run.metrics.length === 0) return null;

  const metricMap = new Map<string, number>();
  for (const metric of run.metrics) {
    metricMap.set(metric.metric_name, Number(metric.metric_value));
  }

  return (
    metricMap.get("score") ??
    metricMap.get("f1") ??
    metricMap.get("r2") ??
    metricMap.get("accuracy") ??
    metricMap.get("roc_auc") ??
    null
  );
}

export default function TrainingResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datasetId = Number(searchParams.get("datasetId") ?? 1);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedExperimentSummary = useMemo(() => {
    return experiments.find((e) => e.id === selectedExperimentId) ?? null;
  }, [experiments, selectedExperimentId]);

  const leaderboardChart = useMemo(() => {
    const leaderboard = selectedExperiment?.leaderboard ?? [];
    return leaderboard
      .filter((r) => r.score !== null && r.score !== undefined)
      .map((r, index) => ({
        name: r.model_name,
        score: Number(r.score ?? 0),
        fill: COLORS[index % COLORS.length],
      }));
  }, [selectedExperiment]);

  const metricsChart = useMemo(() => {
    const runs = selectedExperiment?.runs ?? [];
    const rows: Array<{ model: string; metric: string; value: number }> = [];

    for (const run of runs) {
      for (const metric of run.metrics ?? []) {
        rows.push({
          model: run.model_name,
          metric: metric.metric_name,
          value: Number(metric.metric_value),
        });
      }
    }

    return rows;
  }, [selectedExperiment]);

  useEffect(() => {
    const loadExperiments = async () => {
      setLoadingList(true);
      setError(null);

      try {
        const data = await apiGet<ExperimentsResponse>(`/api/experiments?datasetId=${datasetId}`);
        if (data.ok) {
          const list = data.experiments ?? [];
          setExperiments(list);
          if (!selectedExperimentId && list.length > 0) {
            setSelectedExperimentId(list[0].id);
          }
        }
      } catch (err: any) {
        setError(err?.message ?? "Error cargando experimentos");
      } finally {
        setLoadingList(false);
      }
    };

    loadExperiments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedExperimentId) return;

      setLoadingDetail(true);
      setError(null);

      try {
        const data = await apiGet<ExperimentDetailResponse>(`/api/experiments/${selectedExperimentId}`);
        if (data.ok) {
          const runs = (data.runs ?? []).map((run) => ({
            ...run,
            score: pickScore(run),
          }));

          setSelectedExperiment({
            ...data,
            runs,
            leaderboard: (data.leaderboard ?? []).map((run) => ({
              ...run,
              score: pickScore(run),
            })),
          });
        }
      } catch (err: any) {
        setError(err?.message ?? "Error cargando detalle");
        setSelectedExperiment(null);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadDetail();
  }, [selectedExperimentId]);

  const bestRun = selectedExperiment?.leaderboard?.[0] ?? null;
  const totalRuns = selectedExperiment?.runs?.length ?? 0;
  const failedRuns = selectedExperimentSummary?.failed_runs ?? 0;
  const successfulRuns = totalRuns - failedRuns;

  const avgDuration = useMemo(() => {
    const durations =
      selectedExperiment?.runs
        ?.map((r) => Number(r.duration_ms ?? 0))
        .filter((n) => Number.isFinite(n) && n > 0) ?? [];

    if (!durations.length) return null;
    return Math.round(durations.reduce((acc, n) => acc + n, 0) / durations.length);
  }, [selectedExperiment]);

  const latestArtifacts = useMemo(() => {
    const all = selectedExperiment?.runs ?? [];
    return all.flatMap((run) =>
      (run.artifacts ?? []).map((artifact) => ({
        ...artifact,
        model_name: run.model_name,
      }))
    );
  }, [selectedExperiment]);

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="section-title">Training Results</h1>
          <p className="section-subtitle mt-1">
            Historial real de experimentos, métricas y artifacts guardados en D1.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/model-lab"
            className="rounded-xl px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Model Lab
          </Link>
          <Link
            to="/comparison"
            className="rounded-xl px-4 py-2 text-sm font-medium bg-muted/60 hover:bg-muted transition-colors"
          >
            Comparison
          </Link>
        </div>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: entrenamiento persistido"
        technicalContent="Cada experimento guarda runs, configuraciones, métricas y artifacts en D1. El ranking se calcula desde la tabla de métricas y queda disponible para comparar versiones."
        didacticTitle="Sencillo: ¿Qué veo acá?"
        didacticContent="Ves qué modelo salió mejor, con qué parámetros, cuánto tardó y qué tan bien se comportó cada corrida."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Dataset</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Elegir dataset</label>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={datasetId}
                onChange={(e) => setSearchParams({ datasetId: e.target.value })}
              >
                <option value={1}>Retail Sales Forecasting</option>
                <option value={2}>SaaS Churn Classification</option>
              </select>
            </div>

            <div className="mt-4 rounded-xl border border-border/60 p-3 text-sm">
              <div className="font-medium">Dataset ID: {datasetId}</div>
              <div className="text-muted-foreground text-xs mt-1">
                Aquí se listan los experimentos guardados para ese dataset.
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Experimentos</h3>

            {loadingList ? (
              <p className="text-sm text-muted-foreground">Cargando experimentos...</p>
            ) : experiments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay experimentos para este dataset.
              </p>
            ) : (
              <div className="space-y-2">
                {experiments.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => setSelectedExperimentId(exp.id)}
                    className={`w-full text-left rounded-2xl border p-3 transition-all ${
                      selectedExperimentId === exp.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="text-sm font-medium">{exp.experiment_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {exp.problem_type} · target: {exp.target_column}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Runs: {exp.run_count} · Failed: {exp.failed_runs} · Best:{" "}
                      {exp.best_model ?? "—"}
                      {exp.best_score !== null && exp.best_score !== undefined
                        ? ` (${exp.best_score})`
                        : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-heading font-semibold text-sm">Resumen del experimento</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedExperimentSummary
                    ? selectedExperimentSummary.experiment_name
                    : "Seleccioná un experimento"}
                </p>
              </div>
              {loadingDetail && (
                <div className="text-xs text-muted-foreground">Cargando detalle...</div>
              )}
            </div>

            {selectedExperimentSummary ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Tipo</div>
                  <div className="font-medium">{selectedExperimentSummary.problem_type}</div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Target</div>
                  <div className="font-medium">{selectedExperimentSummary.target_column}</div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Runs</div>
                  <div className="font-medium">{totalRuns}</div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Successful</div>
                  <div className="font-medium">{successfulRuns}</div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Best model</div>
                  <div className="font-medium">{selectedExperimentSummary.best_model ?? "—"}</div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Best score</div>
                  <div className="font-medium">
                    {selectedExperimentSummary.best_score !== null &&
                    selectedExperimentSummary.best_score !== undefined
                      ? selectedExperimentSummary.best_score
                      : "—"}
                  </div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Avg duration</div>
                  <div className="font-medium">{avgDuration ?? "—"} ms</div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Random state</div>
                  <div className="font-medium">{selectedExperimentSummary.random_state}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No hay detalle para mostrar.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="font-heading font-semibold text-sm mb-4">
                Ranking de modelos
              </h3>
              {leaderboardChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={leaderboardChart} margin={{ top: 12, right: 20, bottom: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="score" radius={[10, 10, 0, 0]}>
                      {leaderboardChart.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">Sin ranking disponible.</div>
              )}
            </div>

            <div className="glass-card p-5">
              <h3 className="font-heading font-semibold text-sm mb-4">
                Métricas por corrida
              </h3>
              {metricsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={metricsChart} margin={{ top: 12, right: 20, bottom: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name, props) => [
                        value,
                        `${props.payload.metric}`,
                      ]}
                    />
                    <Line type="monotone" dataKey="value" stroke="hsl(200,70%,50%)" strokeWidth={3} dot />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">No hay métricas para graficar.</div>
              )}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Detalle de runs</h3>

            {selectedExperiment?.runs?.length ? (
              <div className="space-y-4">
                {selectedExperiment.runs.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {run.model_name}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({run.status})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Score: {run.score !== null && run.score !== undefined ? run.score : "—"} ·{" "}
                          Duration: {run.duration_ms ?? "—"} ms
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Run ID #{run.id}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground mb-1">Params</div>
                        <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto">
                          {run.config?.params_json
                            ? JSON.stringify(JSON.parse(run.config.params_json), null, 2)
                            : "{}"}
                        </pre>
                      </div>

                      <div className="rounded-xl bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground mb-1">Metrics</div>
                        <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto">
                          {run.metrics?.length
                            ? JSON.stringify(
                                run.metrics.reduce((acc: Record<string, number>, m) => {
                                  acc[m.metric_name] = Number(m.metric_value);
                                  return acc;
                                }, {}),
                                null,
                                2
                              )
                            : "{}"}
                        </pre>
                      </div>
                    </div>

                    {run.error_message && (
                      <div className="mt-3 text-sm text-red-500">
                        {run.error_message}
                      </div>
                    )}

                    {run.artifacts?.length ? (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-2">
                          Artifacts
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {run.artifacts.map((artifact) => (
                            <span
                              key={artifact.id}
                              className="rounded-full border border-border/60 px-3 py-1 text-xs"
                            >
                              {artifact.artifact_type}: {artifact.artifact_key}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No hay runs para mostrar.</div>
            )}
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">
              Artifacts del experimento
            </h3>

            {latestArtifacts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {latestArtifacts.map((artifact) => (
                  <span
                    key={artifact.id}
                    className="rounded-full border border-border/60 px-3 py-1 text-xs"
                  >
                    {artifact.model_name}: {artifact.artifact_type} · {artifact.artifact_key}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Todavía no hay artifacts.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}