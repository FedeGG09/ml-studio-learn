import { ExplanationBox } from "@/components/ExplanationBox";
import { MetricCard } from "@/components/MetricCard";
import { Database, FileText, Beaker, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const datasets = [
  { name: "dataset_demo.csv", rows: 1500, cols: 12, size: "2.3 MB", uploaded: "2026-04-12" },
  { name: "iris.csv", rows: 150, cols: 5, size: "12 KB", uploaded: "2026-04-10" },
  { name: "housing_prices.csv", rows: 20640, cols: 9, size: "1.4 MB", uploaded: "2026-04-08" },
];

export default function AdminDatasets() {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Admin / Datasets</h1>
        <p className="section-subtitle mt-1">Gestión de datasets, consultas y experimentos</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Persistencia"
        technicalContent="Los datasets, consultas SQL, corridas de entrenamiento y artefactos (modelos serializados, métricas, confusion matrices) se persisten en una base de datos relacional con referencia al usuario, timestamp y configuración completa del pipeline."
        didacticTitle="Sencillo: ¿Qué hay aquí?"
        didacticContent="Esta es tu 'oficina de control'. Desde aquí puedes ver todos los datos que has subido, eliminar los que ya no necesitas y administrar todo tu trabajo en la plataforma."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Datasets" value={3} icon={<Database className="h-5 w-5" />} />
        <MetricCard title="Consultas guardadas" value={8} icon={<FileText className="h-5 w-5" />} />
        <MetricCard title="Experimentos" value={12} icon={<Beaker className="h-5 w-5" />} />
      </div>

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">Datasets cargados</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {["Nombre", "Filas", "Columnas", "Tamaño", "Subido", "Acciones"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.name}>
                  <td className="font-mono text-primary text-sm">{d.name}</td>
                  <td>{d.rows.toLocaleString()}</td>
                  <td>{d.cols}</td>
                  <td className="text-muted-foreground">{d.size}</td>
                  <td className="text-muted-foreground">{d.uploaded}</td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Download className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
