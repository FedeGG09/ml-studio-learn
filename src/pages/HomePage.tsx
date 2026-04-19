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
  Wrench,
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
    title: "Data Prep Workspace",
    desc: "Limpieza, features y versionado de datasets",
    icon: Wrench,
    href: "/data-prep",
    color: "bg-yellow-500/10 text-yellow-500",
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
    href: "/datasets/1",
  },
  {
    id: 2,
    title: "SaaS Churn Classification",
    desc: "Dataset sintético de churn para clasificación",
    icon: Users,
    color: "bg-chart-4/10 text-chart-4",
    href: "/datasets/2",
  },
];

const modelDocs = [
  {
    name: "Linear Regression",
    href: "/model-lab?model=Linear%20Regression",
    technical:
      "Ajusta una relación lineal entre variables de entrada y una salida continua minimizando el error cuadrático.",
    simple: "Traza una línea para predecir un número.",
  },
  {
    name: "Ridge",
    href: "/model-lab?model=Ridge",
    technical:
      "Regresión lineal con regularización L2 para reducir coeficientes grandes y mejorar estabilidad.",
    simple: "Es como Linear Regression, pero más estable.",
  },
  {
    name: "Lasso",
    href: "/model-lab?model=Lasso",
    technical:
      "Regresión lineal con regularización L1, útil para selección de variables y sparsity.",
    simple: "Puede apagar variables que no aportan.",
  },
  {
    name: "SVR",
    href: "/model-lab?model=SVR",
    technical:
      "Support Vector Regression busca una función robusta dentro de un margen de tolerancia.",
    simple: "Intenta predecir números sin reaccionar de más a ruido.",
  },
  {
    name: "Decision Tree",
    href: "/model-lab?model=Decision%20Tree",
    technical:
      "Divide el espacio de variables en reglas jerárquicas para modelar relaciones no lineales.",
    simple: "Hace preguntas una por una hasta llegar a una decisión.",
  },
  {
    name: "Logistic Regression",
    href: "/model-lab?model=Logistic%20Regression",
    technical:
      "Modelo lineal para clasificación que estima probabilidades mediante una función logística.",
    simple: "Predice si algo pertenece o no a una clase.",
  },
  {
    name: "KNN",
    href: "/model-lab?model=KNN",
    technical:
      "Clasifica usando la cercanía de los ejemplos vecinos en el espacio de características.",
    simple: "Mira a los más parecidos y vota.",
  },
  {
    name: "SVM",
    href: "/model-lab?model=SVM",
    technical:
      "Encuentra un hiperplano de máximo margen para separar clases.",
    simple: "Traza una frontera que deje a los grupos mejor separados.",
  },
  {
    name: "Naive Bayes",
    href: "/model-lab?model=Naive%20Bayes",
    technical:
      "Clasificador probabilístico basado en la regla de Bayes con independencia condicional asumida.",
    simple: "Calcula probabilidades para cada clase.",
  },
  {
    name: "Random Forest",
    href: "/model-lab?model=Random%20Forest",
    technical:
      "Ensamble de árboles entrenados sobre subconjuntos de datos y variables para reducir varianza.",
    simple: "Muchos árboles votan juntos.",
  },
  {
    name: "XGBoost",
    href: "/model-lab?model=XGBoost",
    technical:
      "Gradient boosting optimizado que construye árboles secuenciales corrigiendo errores previos.",
    simple: "Va mejorando paso a paso con árboles.",
  },
  {
    name: "AdaBoost",
    href: "/model-lab?model=AdaBoost",
    technical:
      "Ensamble boosting que repondera ejemplos difíciles y combina estimadores débiles.",
    simple: "Se enfoca más en los casos difíciles.",
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

      <div>
        <h2 className="font-heading font-semibold text-lg mb-4">
          Datasets demo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {featuredDatasets.map((dataset) => (
            <Link
              key={dataset.id}
              to={dataset.href}
              className="glass-card p-5 group hover:border-primary/30 transition-all duration-300"
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

      <div>
        <h2 className="font-heading font-semibold text-lg mb-4">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
        technicalContent="El pipeline completo sigue: ingesta de datos (CSV/SQL) → EDA (exploración estadística) → feature engineering → selección de modelo → entrenamiento con cross-validation → evaluación con métricas → comparación de experimentos."
        didacticTitle="Sencillo: ¿Cómo funciona?"
        didacticContent="Traés los datos, los explorás, probás gráficos, entrenás modelos y comparás resultados para elegir la mejor receta."
      />

      <div className="glass-card p-6">
        <h2 className="font-heading font-semibold text-lg mb-3">
          Modelos disponibles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {modelDocs.map((m) => (
            <Link
              key={m.name}
              to={m.href}
              className="rounded-2xl border border-border/60 p-4 hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold text-sm">{m.name}</div>
                <span className="text-[11px] rounded-full bg-muted/50 px-2 py-1">
                  ver en Model Lab
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="mb-2">
                  <span className="font-medium text-foreground">Técnico:</span>{" "}
                  {m.technical}
                </div>
                <div>
                  <span className="font-medium text-foreground">Sencillo:</span>{" "}
                  {m.simple}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}