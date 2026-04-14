import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { datasetsApi } from "@/api/datasets";
import { ExplanationBox } from "@/components/ExplanationBox";
import { MetricCard } from "@/components/MetricCard";
import {
  Columns,
  Hash,
  AlertTriangle,
  BarChart,
} from "lucide-react";

export default function DatasetExplorer() {
  const { id } = useParams();
  const datasetId = Number(id || 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dataset-profile", datasetId],
    queryFn: () => datasetsApi.profile(datasetId),
  });

  if (isLoading) {
    return <div className="p-6">Cargando dataset...</div>;
  }

  if (error || !data?.ok) {
    return <div className="p-6 text-red-500">Error cargando dataset</div>;
  }

  const { dataset, columns, preview, stats } = data;

  const totalNulls = columns.reduce(
    (acc: number, col: any) => acc + (col.null_count || 0),
    0
  );

  const numericColumns = columns.filter((c: any) =>
    ["INTEGER", "REAL"].includes(c.data_type)
  ).length;

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">{dataset.name}</h1>
        <p className="section-subtitle mt-1">{dataset.description}</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Perfilado de Dataset"
        technicalContent="Se obtiene metadata desde D1, columnas reales, preview SQL y KPIs agregados."
        didacticTitle="Simple: ¿Qué veo?"
        didacticContent="Esta pantalla muestra tu dataset real almacenado en Cloudflare D1."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Columnas"
          value={dataset.column_count}
          icon={<Columns className="h-5 w-5" />}
        />
        <MetricCard
          title="Filas"
          value={dataset.row_count}
          icon={<Hash className="h-5 w-5" />}
        />
        <MetricCard
          title="Nulos"
          value={totalNulls}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <MetricCard
          title="Numéricas"
          value={numericColumns}
          icon={<BarChart className="h-5 w-5" />}
        />
      </div>

      {/* Tabla columnas */}
      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">
          Detalle por columna
        </h3>

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

      {/* Preview real */}
      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">
          Preview del dataset
        </h3>

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

      {/* Stats */}
      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">
          Estadísticas
        </h3>
        <pre className="text-xs">{JSON.stringify(stats, null, 2)}</pre>
      </div>
    </div>
  );
}