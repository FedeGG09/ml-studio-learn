import { MetricCard } from "@/components/MetricCard";
import { ExplanationBox } from "@/components/ExplanationBox";
import {
  Database,
  Brain,
  BarChart3,
  TrendingUp,
  Upload,
  Beaker,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const quickActions = [
  {
    title: "Upload Dataset",
    desc: "Carga un archivo CSV para comenzar",
    icon: Upload,
    href: "/upload",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "SQL Lab",
    desc: "Ejecuta consultas SQL sobre tus datos",
    icon: Database,
    href: "/sql-lab",
    color: "bg-chart-2/10 text-chart-2",
  },
  {
    title: "Data Viz",
    desc: "Crea visualizaciones interactivas",
    icon: BarChart3,
    href: "/data-viz",
    color: "bg-chart-3/10 text-chart-3",
  },
  {
    title: "Model Lab",
    desc: "Entrena modelos de ML",
    icon: Brain,
    href: "/model-lab",
    color: "bg-chart-4/10 text-chart-4",
  },
];

const featuredDatasets = [
  {
    id: 1,
    title: "Retail Sales Forecasting",
    desc: "Dataset sintético de ventas minoristas para regresión",
    icon: ShoppingCart,
    color: "bg-chart-3/10 text-chart-3",
  },
  {
    id: 2,
    title: "SaaS Churn Classification",
    desc: "Dataset sintético de churn para clasificación",
    icon: Users,
    color: "bg-chart-4/10 text-chart-4",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title gradient-text text-3xl">
          Bienvenido a ML Playground
        </h1>
        <p className="section-subtitle mt-2">
          Tu laboratorio interactivo para aprender Machine Learning paso a paso
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Datasets"
          value={3}
          subtitle="Cargados"
          icon={<Database className="h-5 w-5" />}
        />
        <MetricCard
          title="Experimentos"
          value={12}
          subtitle="Ejecutados"
          icon={<Beaker className="h-5 w-5" />}
        />
        <MetricCard
          title="Mejor Accuracy"
          value="94.2%"
          subtitle="Random Forest"
          icon={<TrendingUp className="h-5 w-5" />}
          trend={{ value: 2.1, label: "vs anterior" }}
        />
        <MetricCard
          title="Modelos"
          value={12}
          subtitle="Disponibles"
          icon={<Brain className="h-5 w-5" />}
        />
      </div>

      {/* DATASETS DEMO CLICKABLES */}
      <div>
        <h2 className="font-heading font-semibold text-lg mb-4">
          Datasets demo
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {featuredDatasets.map((dataset) => (
            <Link
              key={dataset.id}
              to={`/datasets/${dataset.id}`}
              className="glass-card p-5 group hover:border-primary/30 hover:scale-[1.01] transition-all duration-300"
            >
              <div
                className={`h-10 w-10 rounded-lg ${dataset.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                <dataset.icon className="h-5 w-5" />
              </div>

              <h3 className="font-heading font-semibold text-sm">
                {dataset.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {dataset.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="font-heading font-semibold text-lg mb-4">
          Acciones rápidas
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className="glass-card p-5 group hover:border-primary/30 transition-all duration-300"
            >
              <div
                className={`h-10 w-10 rounded-lg ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                <action.icon className="h-5 w-5" />
              </div>

              <h3 className="font-heading font-semibold text-sm">
                {action.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {action.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Flujo de trabajo"
        technicalContent="El pipeline completo sigue: ingesta de datos (CSV/SQL) → EDA (exploración estadística) → feature engineering → selección de modelo → entrenamiento con cross-validation → evaluación con métricas (accuracy, F1, RMSE) → comparación de experimentos."
        didacticTitle="Sencillo: ¿Cómo funciona?"
        didacticContent="Piensa en esto como una cocina: primero traes los ingredientes (tus datos), los revisas (exploración), los preparas (limpieza), eliges una receta (modelo), cocinas (entrenas) y pruebas el resultado (métricas). ¡Así de simple!"
      />

      <div className="glass-card p-6">
        <h2 className="font-heading font-semibold text-lg mb-3">
          Modelos disponibles
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            "Linear Regression",
            "Ridge",
            "Lasso",
            "SVR",
            "Decision Tree",
            "Logistic Regression",
            "KNN",
            "SVM",
            "Naive Bayes",
            "Random Forest",
            "XGBoost",
            "AdaBoost",
          ].map((m) => (
            <div
              key={m}
              className="px-3 py-2 rounded-lg bg-muted/50 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-default"
            >
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}