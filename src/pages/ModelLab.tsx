import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Brain, Play, Info, FlaskConical } from "lucide-react";

const models = {
  regression: [
    "Linear Regression",
    "Ridge",
    "Lasso",
    "SVR",
    "Decision Tree",
  ],
  classification: [
    "Logistic Regression",
    "KNN",
    "SVM",
    "Naive Bayes",
    "Random Forest",
    "XGBoost",
    "AdaBoost",
  ],
};

const hyperparamsMap: Record<
  string,
  {
    label: string;
    min: number;
    max: number;
    step: number;
    default: number;
    explanation: string;
  }[]
> = {
  "Linear Regression": [],
  Ridge: [
    {
      label: "alpha",
      min: 0.01,
      max: 10,
      step: 0.01,
      default: 1,
      explanation:
        "Controla cuánto penalizamos coeficientes grandes.",
    },
  ],
  Lasso: [
    {
      label: "alpha",
      min: 0.01,
      max: 10,
      step: 0.01,
      default: 1,
      explanation:
        "Puede eliminar variables irrelevantes automáticamente.",
    },
  ],
  SVR: [
    {
      label: "C",
      min: 0.1,
      max: 100,
      step: 0.1,
      default: 1,
      explanation: "Penalización por errores.",
    },
    {
      label: "epsilon",
      min: 0.01,
      max: 1,
      step: 0.01,
      default: 0.1,
      explanation: "Margen de tolerancia del error.",
    },
  ],
  "Decision Tree": [
    {
      label: "max_depth",
      min: 1,
      max: 30,
      step: 1,
      default: 5,
      explanation: "Profundidad máxima del árbol.",
    },
  ],
  "Logistic Regression": [
    {
      label: "C",
      min: 0.01,
      max: 100,
      step: 0.01,
      default: 1,
      explanation: "Regularización del modelo.",
    },
  ],
  KNN: [
    {
      label: "n_neighbors",
      min: 1,
      max: 50,
      step: 1,
      default: 5,
      explanation: "Cantidad de vecinos.",
    },
  ],
  SVM: [
    {
      label: "C",
      min: 0.1,
      max: 100,
      step: 0.1,
      default: 1,
      explanation: "Penalización por errores.",
    },
  ],
  "Naive Bayes": [],
  "Random Forest": [
    {
      label: "n_estimators",
      min: 10,
      max: 500,
      step: 10,
      default: 100,
      explanation: "Cantidad de árboles.",
    },
    {
      label: "max_depth",
      min: 1,
      max: 30,
      step: 1,
      default: 10,
      explanation: "Profundidad máxima.",
    },
  ],
  XGBoost: [
    {
      label: "n_estimators",
      min: 10,
      max: 500,
      step: 10,
      default: 100,
      explanation: "Boosting rounds.",
    },
  ],
  AdaBoost: [
    {
      label: "n_estimators",
      min: 10,
      max: 500,
      step: 10,
      default: 50,
      explanation: "Cantidad de estimadores.",
    },
  ],
};

export default function ModelLab() {
  const navigate = useNavigate();
  const location = useLocation();

  const datasetId = location.state?.datasetId ?? 1;
  const datasetName = location.state?.datasetName ?? "Dataset";

  const [taskType, setTaskType] = useState<
    "regression" | "classification"
  >("classification");

  const [selectedModel, setSelectedModel] = useState("Random Forest");
  const [trainSplit, setTrainSplit] = useState([80]);
  const [params, setParams] = useState<Record<string, number>>({});
  const [benchmarkResults, setBenchmarkResults] = useState<any[]>([]);

  const hyperparams = hyperparamsMap[selectedModel] || [];

  const getParam = (label: string, def: number) =>
    params[label] ?? def;

  const runBenchmark = () => {
    const results = models[taskType].map((model) => {
      const success = Math.random() > 0.2;

      if (!success) {
        return {
          model,
          success: false,
          score: null,
          error: "Feature mismatch / convergence warning",
        };
      }

      return {
        model,
        success: true,
        score: Number((Math.random() * 0.3 + 0.7).toFixed(3)),
      };
    });

    setBenchmarkResults(
      results.sort((a, b) => (b.score || 0) - (a.score || 0))
    );
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Model Lab</h1>
        <p className="section-subtitle mt-1">
          Dataset: <span className="text-primary">{datasetName}</span>
        </p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Entrenamiento de modelos"
        technicalContent="Benchmark multi-modelo sobre dataset dinámico con tolerancia a errores por modelo."
        didacticTitle="Sencillo: ¿Qué hago aquí?"
        didacticContent="Podés probar un modelo puntual o correr todos para descubrir cuál funciona mejor."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">
              Tipo de tarea
            </h3>

            <div className="flex gap-2">
              {(["regression", "classification"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTaskType(t);
                    setSelectedModel(models[t][0]);
                    setParams({});
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs ${
                    taskType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50"
                  }`}
                >
                  {t === "regression"
                    ? "Regresión"
                    : "Clasificación"}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">
              Modelo
            </h3>

            {models[taskType].map((m) => (
              <button
                key={m}
                onClick={() => setSelectedModel(m)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${
                  selectedModel === m
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-muted/30"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-heading font-semibold">
                {selectedModel}
              </h3>
            </div>

            {hyperparams.map((hp) => (
              <div key={hp.label} className="mb-5">
                <div className="flex justify-between mb-2">
                  <span>{hp.label}</span>
                  <span>{getParam(hp.label, hp.default)}</span>
                </div>

                <Slider
                  value={[getParam(hp.label, hp.default)]}
                  onValueChange={([v]) =>
                    setParams({ ...params, [hp.label]: v })
                  }
                  min={hp.min}
                  max={hp.max}
                  step={hp.step}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button className="h-12 gap-2">
              <Play className="h-4 w-4" />
              Entrenar modelo
            </Button>

            <Button
              variant="secondary"
              className="h-12 gap-2"
              onClick={runBenchmark}
            >
              <FlaskConical className="h-4 w-4" />
              Benchmark all models
            </Button>
          </div>

          {benchmarkResults.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="font-heading font-semibold mb-4">
                Ranking de modelos
              </h3>

              <div className="space-y-2">
                {benchmarkResults.map((r, idx) => (
                  <div
                    key={r.model}
                    className="flex justify-between text-sm border-b pb-2"
                  >
                    <span>
                      #{idx + 1} {r.model}
                    </span>

                    <span>
                      {r.success
                        ? `Score: ${r.score}`
                        : `❌ ${r.error}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}