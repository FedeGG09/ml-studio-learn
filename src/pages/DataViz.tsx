import { useState } from "react";
import { ExplanationBox } from "@/components/ExplanationBox";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const barData = [
  { name: "A", value: 620 }, { name: "B", value: 510 }, { name: "C", value: 370 },
];

const scatterData = Array.from({ length: 50 }, (_, i) => ({
  x: 18 + Math.random() * 47,
  y: 20000 + Math.random() * 100000,
}));

const lineData = Array.from({ length: 12 }, (_, i) => ({
  month: `M${i + 1}`,
  score: 60 + Math.random() * 35,
}));

const pieData = [
  { name: "Bachelor", value: 45 },
  { name: "Master", value: 30 },
  { name: "PhD", value: 15 },
  { name: "High School", value: 10 },
];

const COLORS = ["hsl(160,72%,50%)", "hsl(200,70%,50%)", "hsl(280,70%,60%)", "hsl(40,90%,55%)"];

const chartTypes = ["Bar", "Scatter", "Line", "Pie"] as const;

export default function DataViz() {
  const [active, setActive] = useState<typeof chartTypes[number]>("Bar");

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Data Viz</h1>
        <p className="section-subtitle mt-1">Visualizaciones interactivas de tus datos</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Visualización de datos"
        technicalContent="Se generan gráficos SVG interactivos con Recharts. Los datos se procesan client-side con binning, aggregation y sampling para datasets grandes. Soporta zoom, hover tooltips, y selección de ejes dinámicos."
        didacticTitle="Sencillo: ¿Para qué sirven los gráficos?"
        didacticContent="Los gráficos te ayudan a ver patrones en tus datos que no puedes notar solo con números. Un gráfico de barras muestra comparaciones, uno de dispersión muestra relaciones, y uno de línea muestra tendencias."
      />

      <div className="flex gap-2">
        {chartTypes.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`px-4 py-2 rounded-lg text-sm font-heading font-medium transition-all ${
              active === t ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="glass-card p-6">
        <ResponsiveContainer width="100%" height={400}>
          {active === "Bar" ? (
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,25%,18%)" />
              <XAxis dataKey="name" stroke="hsl(210,15%,55%)" fontSize={12} />
              <YAxis stroke="hsl(210,15%,55%)" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(213,50%,11%)", border: "1px solid hsl(213,25%,18%)", borderRadius: 8, color: "hsl(160,100%,95%)", fontSize: 12 }} />
              <Bar dataKey="value" fill="hsl(160,72%,50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : active === "Scatter" ? (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,25%,18%)" />
              <XAxis dataKey="x" name="Age" stroke="hsl(210,15%,55%)" fontSize={12} />
              <YAxis dataKey="y" name="Income" stroke="hsl(210,15%,55%)" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(213,50%,11%)", border: "1px solid hsl(213,25%,18%)", borderRadius: 8, color: "hsl(160,100%,95%)", fontSize: 12 }} />
              <Scatter data={scatterData} fill="hsl(155,100%,58%)" />
            </ScatterChart>
          ) : active === "Line" ? (
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,25%,18%)" />
              <XAxis dataKey="month" stroke="hsl(210,15%,55%)" fontSize={12} />
              <YAxis stroke="hsl(210,15%,55%)" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(213,50%,11%)", border: "1px solid hsl(213,25%,18%)", borderRadius: 8, color: "hsl(160,100%,95%)", fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="hsl(160,72%,50%)" strokeWidth={2} dot={{ fill: "hsl(155,100%,58%)", r: 4 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip contentStyle={{ background: "hsl(213,50%,11%)", border: "1px solid hsl(213,25%,18%)", borderRadius: 8, color: "hsl(160,100%,95%)", fontSize: 12 }} />
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={140} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
