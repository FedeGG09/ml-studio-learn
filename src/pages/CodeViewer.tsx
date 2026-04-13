import { ExplanationBox } from "@/components/ExplanationBox";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const pipelineCode = `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# 1. Cargar datos
df = pd.read_csv("dataset_demo.csv")

# 2. Separar features y target
X = df.drop("category", axis=1)
y = df["category"]

# 3. Definir preprocesamiento
numeric_features = ["age", "income", "score", "tenure"]
categorical_features = ["education"]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), numeric_features),
        ("cat", OneHotEncoder(drop="first"), categorical_features),
    ]
)

# 4. Crear pipeline
pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    ))
])

# 5. Train/Test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# 6. Entrenar
pipeline.fit(X_train, y_train)

# 7. Evaluar
y_pred = pipeline.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
print(classification_report(y_test, y_pred))`;

export default function CodeViewer() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="section-title">Code Viewer</h1>
        <p className="section-subtitle mt-1">Pipeline generado automáticamente para tu experimento</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Pipeline generado"
        technicalContent="Se genera código Python usando scikit-learn Pipelines que encapsulan preprocesamiento (scaling, encoding) y el modelo en un objeto serializable. Esto garantiza reproducibilidad y evita data leakage entre train/test."
        didacticTitle="Sencillo: ¿Qué es este código?"
        didacticContent="Este es el código Python que hace exactamente lo mismo que configuraste en el Model Lab. Puedes copiarlo, descargarlo y ejecutarlo en tu computadora o en Google Colab. ¡Es tu receta completa lista para usar!"
      />

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive/60" />
            <div className="h-3 w-3 rounded-full bg-chart-4/60" />
            <div className="h-3 w-3 rounded-full bg-primary/60" />
            <span className="ml-3 text-xs text-muted-foreground font-mono">pipeline.py</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <Copy className="h-3 w-3" /> Copiar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <Download className="h-3 w-3" /> Descargar
            </Button>
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          <pre className="font-mono text-sm leading-relaxed">
            {pipelineCode.split("\n").map((line, i) => (
              <div key={i} className="flex">
                <span className="w-8 text-right pr-4 text-muted-foreground/40 select-none text-xs">{i + 1}</span>
                <span className={line.startsWith("#") ? "text-muted-foreground" : line.includes("import") ? "text-chart-2" : "text-foreground"}>
                  {line}
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
