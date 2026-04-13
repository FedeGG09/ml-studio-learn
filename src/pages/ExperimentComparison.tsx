import { ExplanationBox } from "@/components/ExplanationBox";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const experiments = [
  { id: 1, model: "Random Forest", accuracy: 94.2, precision: 92.8, recall: 93.5, f1: 93.1, params: "n=100, depth=10", time: "2.3s" },
  { id: 2, model: "XGBoost", accuracy: 93.8, precision: 93.1, recall: 92.7, f1: 92.9, params: "n=100, lr=0.1", time: "1.8s" },
  { id: 3, model: "SVM", accuracy: 91.5, precision: 90.2, recall: 91.8, f1: 91.0, params: "C=1, rbf", time: "3.1s" },
  { id: 4, model: "KNN", accuracy: 88.3, precision: 87.5, recall: 88.9, f1: 88.2, params: "k=5", time: "0.4s" },
  { id: 5, model: "Logistic Reg.", accuracy: 85.1, precision: 84.3, recall: 85.7, f1: 85.0, params: "C=1", time: "0.2s" },
];

const chartData = experiments.map((e) => ({
  name: e.model,
  Accuracy: e.accuracy,
  Precision: e.precision,
  Recall: e.recall,
  F1: e.f1,
}));

export default function ExperimentComparison() {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Experiment Comparison</h1>
        <p className="section-subtitle mt-1">Compara resultados de distintos experimentos</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Comparación de experimentos"
        technicalContent="Se registra cada corrida con sus hiperparámetros, métricas, tiempo de entrenamiento y artefactos (modelo serializado, confusion matrix). Se pueden comparar side-by-side usando tablas y gráficos de barras agrupadas por métrica."
        didacticTitle="Sencillo: ¿Por qué comparar?"
        didacticContent="Imagina que pruebas varias recetas de pastel. Esta pantalla te muestra todas las pruebas lado a lado para que veas cuál quedó mejor. Así puedes elegir el modelo ganador para tu problema."
      />

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">Comparación visual</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,25%,18%)" />
            <XAxis dataKey="name" stroke="hsl(210,15%,55%)" fontSize={11} />
            <YAxis domain={[80, 100]} stroke="hsl(210,15%,55%)" fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(213,50%,11%)", border: "1px solid hsl(213,25%,18%)", borderRadius: 8, color: "hsl(160,100%,95%)", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Accuracy" fill="hsl(160,72%,50%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Precision" fill="hsl(200,70%,50%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Recall" fill="hsl(280,70%,60%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="F1" fill="hsl(40,90%,55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">Tabla de resultados</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {["#", "Modelo", "Accuracy", "Precision", "Recall", "F1", "Parámetros", "Tiempo"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp, i) => (
                <tr key={exp.id}>
                  <td>{exp.id}</td>
                  <td className="font-medium">{exp.model}</td>
                  <td className={i === 0 ? "text-primary font-bold" : ""}>{exp.accuracy}%</td>
                  <td>{exp.precision}%</td>
                  <td>{exp.recall}%</td>
                  <td>{exp.f1}%</td>
                  <td className="font-mono text-xs text-muted-foreground">{exp.params}</td>
                  <td className="text-muted-foreground">{exp.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
