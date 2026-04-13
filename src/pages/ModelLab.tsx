import { useState } from "react";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Brain, Play, Info } from "lucide-react";

const models = {
  regression: ["Linear Regression", "Ridge", "Lasso", "SVR", "Decision Tree"],
  classification: ["Logistic Regression", "KNN", "SVM", "Naive Bayes", "Random Forest", "XGBoost", "AdaBoost"],
};

const hyperparamsMap: Record<string, { label: string; min: number; max: number; step: number; default: number; explanation: string }[]> = {
  "Linear Regression": [],
  "Ridge": [{ label: "alpha", min: 0.01, max: 10, step: 0.01, default: 1, explanation: "Controla cuánto penalizamos los coeficientes grandes. Mayor alpha = modelo más simple." }],
  "Lasso": [{ label: "alpha", min: 0.01, max: 10, step: 0.01, default: 1, explanation: "Similar a Ridge, pero puede eliminar variables irrelevantes por completo." }],
  "SVR": [
    { label: "C", min: 0.1, max: 100, step: 0.1, default: 1, explanation: "Penalización por errores. Mayor C = se ajusta más a los datos de entrenamiento." },
    { label: "epsilon", min: 0.01, max: 1, step: 0.01, default: 0.1, explanation: "Margen de tolerancia del error." },
  ],
  "Decision Tree": [
    { label: "max_depth", min: 1, max: 30, step: 1, default: 5, explanation: "Profundidad máxima del árbol. Más profundo = más complejo." },
    { label: "min_samples_split", min: 2, max: 50, step: 1, default: 2, explanation: "Mínimo de muestras para dividir un nodo." },
  ],
  "Logistic Regression": [{ label: "C", min: 0.01, max: 100, step: 0.01, default: 1, explanation: "Inversa de la regularización. Menor C = mayor regularización." }],
  "KNN": [{ label: "n_neighbors", min: 1, max: 50, step: 1, default: 5, explanation: "Número de vecinos a considerar. Pocos = más detallado, muchos = más suave." }],
  "SVM": [
    { label: "C", min: 0.1, max: 100, step: 0.1, default: 1, explanation: "Penalización por errores en la clasificación." },
    { label: "kernel", min: 0, max: 2, step: 1, default: 0, explanation: "0=linear, 1=rbf, 2=poly" },
  ],
  "Naive Bayes": [],
  "Random Forest": [
    { label: "n_estimators", min: 10, max: 500, step: 10, default: 100, explanation: "Número de árboles en el bosque." },
    { label: "max_depth", min: 1, max: 30, step: 1, default: 10, explanation: "Profundidad máxima de cada árbol." },
  ],
  "XGBoost": [
    { label: "n_estimators", min: 10, max: 500, step: 10, default: 100, explanation: "Número de boosting rounds." },
    { label: "learning_rate", min: 0.01, max: 1, step: 0.01, default: 0.1, explanation: "Tasa de aprendizaje. Menor = más lento pero más preciso." },
    { label: "max_depth", min: 1, max: 15, step: 1, default: 6, explanation: "Profundidad máxima de cada árbol." },
  ],
  "AdaBoost": [
    { label: "n_estimators", min: 10, max: 500, step: 10, default: 50, explanation: "Número de estimadores débiles." },
    { label: "learning_rate", min: 0.01, max: 2, step: 0.01, default: 1, explanation: "Peso de cada estimador en la combinación final." },
  ],
};

export default function ModelLab() {
  const [taskType, setTaskType] = useState<"regression" | "classification">("classification");
  const [selectedModel, setSelectedModel] = useState("Random Forest");
  const [trainSplit, setTrainSplit] = useState([80]);
  const [params, setParams] = useState<Record<string, number>>({});

  const hyperparams = hyperparamsMap[selectedModel] || [];

  const getParam = (label: string, def: number) => params[label] ?? def;

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Model Lab</h1>
        <p className="section-subtitle mt-1">Configura y entrena modelos de Machine Learning</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Entrenamiento de modelos"
        technicalContent="Se implementa un pipeline scikit-learn con preprocessing (StandardScaler, OneHotEncoder), train/test split estratificado, entrenamiento con los hiperparámetros seleccionados y evaluación con métricas estándar (accuracy, precision, recall, F1 para clasificación; RMSE, MAE, R² para regresión)."
        didacticTitle="Sencillo: ¿Qué hago aquí?"
        didacticContent="Aquí eliges qué tipo de problema resolver (¿predecir un número o una categoría?), seleccionas un 'algoritmo' (la receta), ajustas sus configuraciones y le das a Entrenar. ¡El sistema hará todo el trabajo pesado!"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Tipo de tarea</h3>
            <div className="flex gap-2">
              {(["regression", "classification"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTaskType(t); setSelectedModel(models[t][0]); setParams({}); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-heading font-medium transition-all ${
                    taskType === t ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {t === "regression" ? "Regresión" : "Clasificación"}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Modelo</h3>
            <div className="space-y-1">
              {models[taskType].map((m) => (
                <button
                  key={m}
                  onClick={() => { setSelectedModel(m); setParams({}); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedModel === m ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-sm mb-4">Train / Test Split</h3>
            <Slider value={trainSplit} onValueChange={setTrainSplit} min={50} max={95} step={5} className="mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Train: {trainSplit[0]}%</span>
              <span>Test: {100 - trainSplit[0]}%</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-heading font-semibold">{selectedModel}</h3>
            </div>

            {hyperparams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este modelo no tiene hiperparámetros ajustables.</p>
            ) : (
              <div className="space-y-6">
                {hyperparams.map((hp) => (
                  <div key={hp.label}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-mono font-medium">{hp.label}</label>
                      <span className="text-sm font-mono text-primary font-bold">{getParam(hp.label, hp.default)}</span>
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
          </div>

          <Button className="w-full h-12 font-heading font-semibold text-base gap-2">
            <Play className="h-4 w-4" />
            Entrenar modelo
          </Button>
        </div>
      </div>
    </div>
  );
}
