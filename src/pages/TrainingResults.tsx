import { ExplanationBox } from "@/components/ExplanationBox";
import { MetricCard } from "@/components/MetricCard";
import { Target, TrendingUp, BarChart, Percent } from "lucide-react";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

const confusionMatrix = [
  [142, 8, 3],
  [5, 128, 12],
  [2, 7, 143],
];

const featureImportance = [
  { name: "income", value: 0.32 },
  { name: "score", value: 0.28 },
  { name: "age", value: 0.18 },
  { name: "tenure", value: 0.12 },
  { name: "education", value: 0.07 },
  { name: "category", value: 0.03 },
];

const radarData = [
  { metric: "Accuracy", value: 94.2 },
  { metric: "Precision", value: 92.8 },
  { metric: "Recall", value: 93.5 },
  { metric: "F1 Score", value: 93.1 },
  { metric: "AUC-ROC", value: 96.4 },
];

export default function TrainingResults() {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Training Results</h1>
        <p className="section-subtitle mt-1">Random Forest — Clasificación — dataset_demo.csv</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Métricas de evaluación"
        technicalContent="Accuracy = aciertos/total. Precision = verdaderos positivos/(verdaderos positivos + falsos positivos). Recall = verdaderos positivos/(verdaderos positivos + falsos negativos). F1 = media armónica de precision y recall. AUC-ROC mide la capacidad de discriminación del clasificador."
        didacticTitle="Sencillo: ¿Cómo sé si el modelo es bueno?"
        didacticContent="Imagina que el modelo es un estudiante en un examen. La accuracy es su nota general. La precision mide si cuando dice 'sí', realmente es 'sí'. El recall mide si encuentra todos los 'sí' que existen. ¡Cuanto más alto, mejor!"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Accuracy" value="94.2%" icon={<Target className="h-5 w-5" />} trend={{ value: 2.1, label: "" }} />
        <MetricCard title="Precision" value="92.8%" icon={<Percent className="h-5 w-5" />} />
        <MetricCard title="Recall" value="93.5%" icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard title="F1 Score" value="93.1%" icon={<BarChart className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="font-heading font-semibold text-sm mb-4">Matriz de confusión</h3>
          <div className="grid grid-cols-3 gap-1 max-w-xs mx-auto">
            {confusionMatrix.flat().map((val, i) => {
              const row = Math.floor(i / 3);
              const col = i % 3;
              const isDiag = row === col;
              return (
                <div
                  key={i}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-mono font-bold ${
                    isDiag ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {val}
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-4 mt-3">
            {["A", "B", "C"].map((l) => (
              <span key={l} className="text-xs text-muted-foreground">Class {l}</span>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-heading font-semibold text-sm mb-4">Métricas (Radar)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(213,25%,18%)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(210,15%,55%)", fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: "hsl(210,15%,55%)", fontSize: 10 }} domain={[0, 100]} />
              <Radar dataKey="value" stroke="hsl(160,72%,50%)" fill="hsl(160,72%,50%)" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">Feature Importance</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ReBarChart data={featureImportance} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,25%,18%)" />
            <XAxis type="number" stroke="hsl(210,15%,55%)" fontSize={12} />
            <YAxis type="category" dataKey="name" stroke="hsl(210,15%,55%)" fontSize={12} width={80} />
            <Tooltip contentStyle={{ background: "hsl(213,50%,11%)", border: "1px solid hsl(213,25%,18%)", borderRadius: 8, color: "hsl(160,100%,95%)", fontSize: 12 }} />
            <Bar dataKey="value" fill="hsl(160,72%,50%)" radius={[0, 6, 6, 0]} />
          </ReBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
