import { useState } from "react";
import { Play, Clock, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplanationBox } from "@/components/ExplanationBox";

const sampleQueries = [
  "SELECT * FROM dataset LIMIT 10;",
  "SELECT category, COUNT(*) as count, AVG(score) as avg_score FROM dataset GROUP BY category;",
  "SELECT education, AVG(income) as avg_income FROM dataset GROUP BY education ORDER BY avg_income DESC;",
];

const queryResult = [
  { category: "A", count: 620, avg_score: 78.3 },
  { category: "B", count: 510, avg_score: 82.1 },
  { category: "C", count: 370, avg_score: 71.9 },
];

export default function SqlLab() {
  const [query, setQuery] = useState(sampleQueries[1]);
  const [executed, setExecuted] = useState(true);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="section-title">SQL Lab</h1>
        <p className="section-subtitle mt-1">Ejecuta consultas SQL sobre tus datasets</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Motor SQL"
        technicalContent="Se utiliza un motor SQL in-browser (DuckDB-WASM o SQL.js) que permite ejecutar consultas estándar SQL sobre DataFrames cargados en memoria. Soporta JOINs, aggregaciones, window functions y subqueries."
        didacticTitle="Sencillo: ¿Qué es SQL?"
        didacticContent="SQL es un lenguaje para hacer preguntas a tus datos. En vez de buscar manualmente en una tabla, le escribes una pregunta como '¿cuántos alumnos hay por categoría?' y el sistema te da la respuesta al instante."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
              <span className="text-xs font-heading font-semibold text-muted-foreground">Editor SQL</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => setExecuted(true)}>
                  <Play className="h-3 w-3 mr-1" /> Ejecutar
                </Button>
              </div>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent p-4 font-mono text-sm resize-none focus:outline-none min-h-[120px] text-foreground"
              spellCheck={false}
            />
          </div>

          {executed && (
            <div className="glass-card p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-heading font-semibold text-muted-foreground">Resultado — 3 filas · 12ms</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {["category", "count", "avg_score"].map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.map((row, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{row.category}</td>
                        <td>{row.count}</td>
                        <td>{row.avg_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card p-4">
            <h3 className="font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">
              <Clock className="h-3 w-3 inline mr-1" /> Historial
            </h3>
            <div className="space-y-2">
              {sampleQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(q); setExecuted(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-mono truncate"
                >
                  {q.substring(0, 40)}...
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Tablas</h3>
            <div className="space-y-1">
              {["dataset", "experiments", "results"].map((t) => (
                <div key={t} className="px-3 py-1.5 rounded text-xs font-mono text-primary hover:bg-primary/5 cursor-pointer">{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
