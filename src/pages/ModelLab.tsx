import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Play, Info, FlaskConical, Rocket, Trophy } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/api/client";

type TaskType = "regression" | "classification";

type TrainResult = {
  model: string;
  success: boolean;
  score: number | null;
  error?: string | null;
  duration_ms: number;
  params?: Record<string, string | number | boolean>;
  metrics?: Record<string, number> | null;
};

type ModelDoc = {
  name: string;
  technical: string;
  simple: string;
};

const fallbackModels: Record<TaskType, string[]> = {
  regression: ["Linear Regression", "Ridge", "Lasso", "SVR", "Decision Tree"],
  classification: ["Logistic Regression", "KNN", "SVM", "Naive Bayes", "Random Forest", "XGBoost", "AdaBoost"],
};

const modelDocs: Record<string, ModelDoc> = {
  "Linear Regression": {
    name: "Linear Regression",
    technical: "Ajusta una relación lineal entre variables de entrada y una salida continua minimizando el error cuadrático.",
    simple: "Traza una línea para predecir un número.",
  },
  Ridge: {
    name: "Ridge",
    technical: "Regresión lineal con regularización L2 para reducir coeficientes grandes y mejorar estabilidad.",
    simple: "Es como Linear Regression, pero más estable.",
  },
  Lasso: {
    name: "Lasso",
    technical: "Regresión lineal con regularización L1, útil para selección de variables y sparsity.",
    simple: "Puede apagar variables que no aportan.",
  },
  SVR: {
    name: "SVR",
    technical: "Support Vector Regression busca una función robusta dentro de un margen de tolerancia.",
    simple: "Intenta predecir números sin reaccionar de más al ruido.",
  },
  "Decision Tree": {
    name: "Decision Tree",
    technical: "Divide el espacio de variables en reglas jerárquicas para modelar relaciones no lineales.",
    simple: "Hace preguntas una por una hasta llegar a una decisión.",
  },
  "Logistic Regression": {
    name: "Logistic Regression",
    technical: "Modelo lineal para clasificación que estima probabilidades mediante una función logística.",
    simple: "Predice si algo pertenece o no a una clase.",
  },
  KNN: {
    name: "KNN",
    technical: "Clasifica usando la cercanía de los ejemplos vecinos en el espacio de características.",
    simple: "Mira a los más parecidos y vota.",
  },
  SVM: {
    name: "SVM",
    technical: "Encuentra un hiperplano de máximo margen para separar clases.",
    simple: "Traza una frontera que deje a los grupos mejor separados.",
  },
  "Naive Bayes": {
    name: "Naive Bayes",
    technical: "Clasificador probabilístico basado en la regla de Bayes con independencia condicional asumida.",
    simple: "Calcula probabilidades para cada clase.",
  },
  "Random Forest": {
    name: "Random Forest",
    technical: "Ensamble de árboles entrenados sobre subconjuntos de datos y variables para reducir varianza.",
    simple: "Muchos árboles votan juntos.",
  },
  XGBoost: {
    name: "XGBoost",
    technical: "Gradient boosting optimizado que construye árboles secuenciales corrigiendo errores previos.",
    simple: "Va mejorando paso a paso con árboles.",
  },
  AdaBoost: {
    name: "AdaBoost",
    technical: "Ensamble boosting que repondera ejemplos difíciles y combina estimadores débiles.",
    simple: "Se enfoca más en los casos difíciles.",
  },
};

const hyperparamsMap: Record<
  string,
  { label: string; min: number; max: number; step: number; default: number; explanation: string }[]
> = {
  "Linear Regression": [],
  Ridge: [{ label: "alpha", min: 0.01, max: 10, step: 0.01, default: 1, explanation: "Penaliza coeficientes grandes." }],
  Lasso: [{ label: "alpha", min: 0.01, max: 10, step: 0.01, default: 1, explanation: "Puede eliminar variables irrelevantes." }],
  SVR: [
    { label: "C", min: 0.1, max: 100, step: 0.1, default: 1, explanation: "Penalización por errores." },
    { label: "epsilon", min: 0.01, max: 1, step: 0.01, default: 0.1, explanation: "Margen de tolerancia." },
  ],
  "Decision Tree": [
    { label: "max_depth", min: 1, max: 30, step: 1, default: 5, explanation: "Profundidad máxima del árbol." },
    { label: "min_samples_split", min: 2, max: 50, step: 1, default: 2, explanation: "Mínimo de muestras para dividir." },
  ],
  "Logistic Regression": [
    { label: "C", min: 0.01, max: 100, step: 0.01, default: 1, explanation: "Regularización del modelo." },
    { label: "max_iter", min: 100, max: 5000, step: 100, default: 1000, explanation: "Iteraciones máximas." },
  ],
  KNN: [{ label: "n_neighbors", min: 1, max: 50, step: 1, default: 5, explanation: "Cantidad de vecinos." }],
  SVM: [
    { label: "C", min: 0.1, max: 100, step: 0.1, default: 1, explanation: "Penalización por errores." },
    { label: "kernel", min: 0, max: 2, step: 1, default: 0, explanation: "0=linear, 1=rbf, 2=poly" },
  ],
  "Naive Bayes": [],
  "Random Forest": [
    { label: "n_estimators", min: 10, max: 500, step: 10, default: 100, explanation: "Cantidad de árboles." },
    { label: "max_depth", min: 1, max: 30, step: 1, default: 10, explanation: "Profundidad máxima." },
  ],
  XGBoost: [
    { label: "n_estimators", min: 10, max: 500, step: 10, default: 100, explanation: "Boosting rounds." },
    { label: "learning_rate", min: 0.01, max: 1, step: 0.01, default: 0.1, explanation: "Tasa de aprendizaje." },
    { label: "max_depth", min: 1, max: 15, step: 1, default: 6, explanation: "Profundidad máxima." },
  ],
  AdaBoost: [
    { label: "n_estimators", min: 10, max: 500, step: 10, default: 50, explanation: "Cantidad de estimadores." },
    { label: "learning_rate", min: 0.01, max: 2, step: 0.01, default: 1, explanation: "Peso de cada estimador." },
  ],
};

export default function ModelLab() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const locationState = (location.state ?? {}) as any;
  const datasetId = Number(searchParams.get("datasetId") ?? locationState.datasetId ?? 1);
  const targetFromUrl = searchParams.get("target") ?? locationState.target ?? "";
  const problemTypeFromUrl = searchParams.get("problemType") as TaskType | null;
  const modelFromUrl = searchParams.get("model") ?? "";

  const [taskType, setTaskType] = useState<TaskType>(problemTypeFromUrl ?? "classification");
  const [selectedModel, setSelectedModel] = useState<string>(modelFromUrl || "Random Forest");
  const [trainSplit, setTrainSplit] = useState([80]);
  const [params, setParams] = useState<Record<string, number>>({});
  const [singleResult, setSingleResult] = useState<TrainResult | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<TrainResult[]>([]);
  const [running, setRunning] = useState(false);

  const datasetQuery = useQuery({
    queryKey: ["dataset-profile", datasetId],
    queryFn: () => apiGet(`/api/datasets/${datasetId}/profile`),
    enabled: Number.isFinite(datasetId) && datasetId > 0,
  });

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: () => apiGet("/api/models"),
  });

  const historyQuery = useQuery({
    queryKey: ["experiments", datasetId],
    queryFn: () => apiGet(`/api/experiments?datasetId=${datasetId}`),
    enabled: Number.isFinite(datasetId) && datasetId > 0,
  });

  const availableModels: string[] = useMemo(() => {
    const apiModels = modelsQuery.data?.ok ? (modelsQuery.data as any)[taskType] : null;
    if (Array.isArray(apiModels) && apiModels.length > 0) {
      return apiModels.map((m: any) => (typeof m === "string" ? m : m.name));
    }
    return fallbackModels[taskType];
  }, [modelsQuery.data, taskType]);

  useEffect(() => {
    if (problemTypeFromUrl) {
      setTaskType(problemTypeFromUrl);
      return;
    }

    const inferred = (datasetQuery.data as any)?.dataset?.inferred_problem_type;
    if (inferred === "classification" || inferred === "regression") {
      setTaskType(inferred);
    }
  }, [problemTypeFromUrl, datasetQuery.data]);

  useEffect(() => {
    if (modelFromUrl && availableModels.includes(modelFromUrl)) {
      setSelectedModel(modelFromUrl);
      setParams({});
      return;
    }

    if (!availableModels.includes(selectedModel)) {
      setSelectedModel(availableModels[0] ?? "");
      setParams({});
    }
  }, [availableModels, modelFromUrl, selectedModel]);

  const datasetName =
    (datasetQuery.data as any)?.dataset?.name ??
    locationState.datasetName ??
    `Dataset ${datasetId}`;

  const targetColumn =
    targetFromUrl ||
    (datasetQuery.data as any)?.dataset?.target_column ||
    (datasetQuery.data as any)?.columns?.find((c: any) => c.is_target)?.column_name ||
    "";

  const currentHyperparams = hyperparamsMap[selectedModel] ?? [];
  const selectedDoc = modelDocs[selectedModel] ?? {
    name: selectedModel,
    technical: "No hay explicación cargada para este modelo.",
    simple: "Seleccioná otro modelo o completá el diccionario de descripciones.",
  };

  const getParam = (label: string, def: number) => params[label] ?? def;

  const selectedParams = () =>
    currentHyperparams.reduce<Record<string, number>>((acc, hp) => {
      acc[hp.label] = getParam(hp.label, hp.default);
      return acc;
    }, {});

  const runSingle = async () => {
    if (!datasetId || !selectedModel || !targetColumn) {
      toast.error("Seleccioná dataset y target antes de entrenar");
      return;
    }

    setRunning(true);
    try {
      const data = await apiPost<any>("/api/train", {
        datasetId,
        taskType,
        targetColumn,
        trainSplit: trainSplit[0],
        modelName: selectedModel,
        paramsByModel: {
          [selectedModel]: selectedParams(),
        },
        experimentName: `Single run - ${selectedModel}`,
      });

      if (!data.ok) {
        throw new Error(data.error || "Training failed");
      }

      const best = data.ranking?.[0] as TrainResult | undefined;
      setSingleResult(best ?? null);
      setBenchmarkResults(data.ranking ?? []);
      await queryClient.invalidateQueries({ queryKey: ["experiments", datasetId] });

      toast.success("Entrenamiento completado");
    } catch (err: any) {
      toast.error(err?.message ?? "Error entrenando modelo");
    } finally {
      setRunning(false);
    }
  };

  const runBenchmark = async () => {
    if (!datasetId || !targetColumn) {
      toast.error("Seleccioná dataset y target antes de benchmarkear");
      return;
    }

    setRunning(true);
    try {
      const data = await apiPost<any>("/api/train-all", {
        datasetId,
        taskType,
        targetColumn,
        trainSplit: trainSplit[0],
        models: availableModels,
        paramsByModel: {
          [selectedModel]: selectedParams(),
        },
        experimentName: `Benchmark - ${taskType} - ${datasetName}`,
      });

      if (!data.ok) {
        throw new Error(data.error || "Benchmark failed");
      }

      setBenchmarkResults(data.ranking ?? []);
      await queryClient.invalidateQueries({ queryKey: ["experiments", datasetId] });

      toast.success("Benchmark completado");
    } catch (err: any) {
      toast.error(err?.message ?? "Error ejecutando benchmark");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="section-title">Model Lab</h1>
          <p className="section-subtitle mt-1">
            Configura y entrena modelos de Machine Learning
          </p>
          <div className="mt-2 text-sm text-muted-foreground">
            Dataset: <span className="text-foreground font-medium">{datasetName}</span> · Target:{" "}
            <span className="text-foreground font-medium">{targetColumn || "pendiente"}</span>
          </div>
        </div>

        <Link
          to={`/datasets/${datasetId}`}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-lg"
        >
          <Rocket className="h-4 w-4" />
          Volver al dataset
        </Link>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Entrenamiento de modelos"
        technicalContent="Se implementa un pipeline con preprocessing, train/test split, entrenamiento con hiperparámetros y evaluación. El benchmark corre todos los modelos y guarda experimentos, métricas y artifacts en D1."
        didacticTitle="Sencillo: ¿Qué hago aquí?"
        didacticContent="Elegís si querés predecir un número o una categoría, ajustás parámetros o probás todos los modelos, y el sistema guarda los resultados para compararlos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Tipo de tarea</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(["regression", "classification"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTaskType(t);
                      setSelectedModel(fallbackModels[t][0] ?? "");
                      setParams({});
                      setSingleResult(null);
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("problemType", t);
                        next.delete("model");
                        return next;
                      });
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      taskType === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {t === "regression" ? "Regresión" : "Clasificación"}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Modelo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {availableModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedModel(m);
                      setParams({});
                      setSingleResult(null);
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("model", m);
                        return next;
                      });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedModel === m
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Train / Test Split</CardTitle>
            </CardHeader>
            <CardContent>
              <Slider
                value={trainSplit}
                onValueChange={setTrainSplit}
                min={50}
                max={95}
                step={5}
                className="mb-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Train: {trainSplit[0]}%</span>
                <span>Test: {100 - trainSplit[0]}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Historial del dataset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando historial...</p>
              ) : (historyQuery.data as any)?.experiments?.length ? (
                (historyQuery.data as any).experiments.map((exp: any) => (
                  <div key={exp.id} className="rounded-2xl border border-border/60 p-3">
                    <div className="text-sm font-medium">{exp.experiment_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {exp.problem_type} · target: {exp.target_column}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Runs: {exp.run_count} · Best: {exp.best_model ?? "—"}{" "}
                      {exp.best_score !== null && exp.best_score !== undefined ? `(${exp.best_score})` : ""}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay experimentos.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                {selectedDoc.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="text-xs text-muted-foreground mb-1">Técnico: ¿Qué hace?</div>
                <p className="text-sm">{selectedDoc.technical}</p>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="text-xs text-muted-foreground mb-1">Sencillo: ¿Cómo funciona?</div>
                <p className="text-sm">{selectedDoc.simple}</p>
              </div>

              {currentHyperparams.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este modelo no tiene hiperparámetros ajustables.
                </p>
              ) : (
                <div className="space-y-6">
                  {currentHyperparams.map((hp) => (
                    <div key={hp.label}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-mono font-medium">{hp.label}</label>
                        <span className="text-sm font-mono text-primary font-bold">
                          {getParam(hp.label, hp.default)}
                        </span>
                      </div>
                      <Slider
                        value={[getParam(hp.label, hp.default)]}
                        onValueChange={([v]) => setParams({ ...params, [hp.label]: v })}
                        min={hp.min}
                        max={hp.max}
                        step={hp.step}
                        className="mb-1"
                      />
                      <div className="flex items-start gap-1.5 mt-2">
                        <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">{hp.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              className="h-12 font-heading font-semibold text-base gap-2"
              onClick={runSingle}
              disabled={running}
            >
              <Play className="h-4 w-4" />
              Entrenar modelo
            </Button>

            <Button
              variant="secondary"
              className="h-12 font-heading font-semibold text-base gap-2"
              onClick={runBenchmark}
              disabled={running}
            >
              <FlaskConical className="h-4 w-4" />
              Benchmark all models
            </Button>
          </div>

          {singleResult && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm">Último entrenamiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Modelo: {singleResult.model}</div>
                <div>Estado: {singleResult.success ? "Done" : "Failed"}</div>
                <div>Score: {singleResult.score !== null ? singleResult.score : "—"}</div>
                <div>Duración: {singleResult.duration_ms} ms</div>
                {singleResult.error && <div className="text-red-500">{singleResult.error}</div>}
              </CardContent>
            </Card>
          )}

          {benchmarkResults.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Ranking de modelos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {benchmarkResults.map((r: any, idx: number) => (
                  <div
                    key={`${r.model}-${idx}`}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-border/50 pb-3"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        #{idx + 1} {r.model}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.success ? "Success" : "Failed"} · {r.duration_ms} ms
                      </div>
                    </div>

                    <div className="text-sm md:text-right">
                      {r.success ? (
                        <div>
                          Score: <span className="font-semibold">{r.score}</span>
                        </div>
                      ) : (
                        <div className="text-red-500">{r.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}