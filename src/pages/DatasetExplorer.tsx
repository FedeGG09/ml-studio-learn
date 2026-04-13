import { ExplanationBox } from "@/components/ExplanationBox";
import { MetricCard } from "@/components/MetricCard";
import { Columns, Hash, AlertTriangle, BarChart } from "lucide-react";

const columns = [
  { name: "age", type: "int64", nulls: 0, unique: 45, mean: "34.2", std: "8.7", min: "18", max: "65" },
  { name: "income", type: "float64", nulls: 12, unique: 1200, mean: "52340", std: "15200", min: "18000", max: "120000" },
  { name: "education", type: "object", nulls: 3, unique: 4, mean: "—", std: "—", min: "—", max: "—" },
  { name: "score", type: "float64", nulls: 0, unique: 890, mean: "76.4", std: "12.3", min: "23.1", max: "99.8" },
  { name: "category", type: "object", nulls: 0, unique: 3, mean: "—", std: "—", min: "—", max: "—" },
  { name: "tenure", type: "int64", nulls: 5, unique: 30, mean: "5.8", std: "3.2", min: "0", max: "25" },
];

export default function DatasetExplorer() {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Dataset Explorer</h1>
        <p className="section-subtitle mt-1">Explora la estructura y estadísticos de tu dataset</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Análisis Exploratorio (EDA)"
        technicalContent="Se calculan estadísticos descriptivos (media, mediana, desviación estándar, cuartiles), se detectan valores nulos, tipos de datos, distribuciones por columna y correlaciones entre variables numéricas usando coeficientes de Pearson."
        didacticTitle="Sencillo: ¿Qué veo aquí?"
        didacticContent="Esta pantalla te muestra un resumen de tus datos: cuántas columnas tienes, de qué tipo son (números, texto), si hay datos faltantes y estadísticas básicas. Es como un chequeo médico de tu dataset."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Columnas" value={6} icon={<Columns className="h-5 w-5" />} />
        <MetricCard title="Filas" value="1,500" icon={<Hash className="h-5 w-5" />} />
        <MetricCard title="Nulos totales" value={20} subtitle="1.3% del total" icon={<AlertTriangle className="h-5 w-5" />} />
        <MetricCard title="Numéricas" value={4} subtitle="de 6 columnas" icon={<BarChart className="h-5 w-5" />} />
      </div>

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">Detalle por columna</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {["Columna", "Tipo", "Nulos", "Únicos", "Media", "Std", "Min", "Max"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col.name}>
                  <td className="font-mono text-primary text-xs">{col.name}</td>
                  <td><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{col.type}</span></td>
                  <td className={col.nulls > 0 ? "text-chart-4" : ""}>{col.nulls}</td>
                  <td>{col.unique}</td>
                  <td className="font-mono text-xs">{col.mean}</td>
                  <td className="font-mono text-xs">{col.std}</td>
                  <td className="font-mono text-xs">{col.min}</td>
                  <td className="font-mono text-xs">{col.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">Distribución de tipos de datos</h3>
        <div className="flex gap-4 items-end h-32">
          {[
            { label: "int64", count: 2, pct: 33 },
            { label: "float64", count: 2, pct: 33 },
            { label: "object", count: 2, pct: 33 },
          ].map((t) => (
            <div key={t.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-t-lg bg-primary/20 relative" style={{ height: `${t.pct}%` }}>
                <div className="absolute inset-0 rounded-t-lg bg-primary/40 animate-pulse-glow" style={{ height: "100%" }} />
              </div>
              <span className="text-xs font-mono text-muted-foreground">{t.label}</span>
              <span className="text-xs font-heading font-bold">{t.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
