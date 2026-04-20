# ML Studio Learn

**Laboratorio interactivo para exploración de datos, visualización, SQL y Machine Learning**

[Ver demo interactiva](https://ml-studio-learn.gravinadavilafederico.workers.dev/data-viz)  
[Ver repositorio](https://github.com/FedeGG09/ml-studio-learn)

---

## Descripción

ML Studio Learn es una plataforma web diseñada para acompañar el ciclo completo de trabajo con datos: desde la carga y exploración inicial de un dataset, pasando por consultas SQL y visualización interactiva, hasta la experimentación con modelos de Machine Learning y la comparación de resultados.

El proyecto combina una interfaz moderna, una experiencia didáctica y un enfoque práctico para convertir datos en información útil para la toma de decisiones.

---

## ¿Qué hace este proyecto?

La aplicación centraliza distintas etapas del flujo de trabajo analítico en un solo entorno:

- **Carga de datasets** para comenzar el análisis de forma rápida.
- **Exploración de datasets** con perfilado, columnas, nulos, preview y estadísticas.
- **SQL Lab** para ejecutar consultas sobre los datos y guardar historial de consultas.
- **Data Viz** para construir gráficos interactivos de manera flexible.
- **Model Lab** para entrenar modelos de Machine Learning.
- **Training Results** para revisar resultados de entrenamiento.
- **Experiment Comparison** para comparar corridas y evaluar desempeño.
- **Admin Datasets** para administrar datasets disponibles.
- **Code Viewer** para inspeccionar el código relacionado con cada parte del flujo.

---

## Demo interactiva

La demo principal de visualización permite:

- elegir un dataset disponible,
- detectar automáticamente una configuración inicial recomendada,
- seleccionar el tipo de gráfico,
- definir columnas de análisis,
- aplicar agregaciones,
- explorar relaciones entre variables numéricas y categóricas,
- visualizar barras, líneas, dispersión y tortas de manera dinámica.

Además, incorpora una capa explicativa que acompaña cada visualización con una descripción técnica y una versión simple para facilitar la interpretación.

---

## Tecnologías utilizadas

### Frontend
- **React**
- **TypeScript**
- **Vite**
- **React Router**
- **React Query**
- **Tailwind CSS**
- **shadcn/ui**
- **Radix UI**
- **Lucide React**
- **Recharts**
- **Sonner**

### Backend / infraestructura
- **Hono**
- **Cloudflare Workers**
- **Cloudflare D1**

### Calidad y desarrollo
- **Vitest**
- **ESLint**
- **Zod**
- **TanStack Query**

---

## Funcionalidades destacadas

### Exploración de datos
El usuario puede revisar un dataset con información clave como columnas, tipos de datos, nulos, valores únicos, preview y estadísticas resumidas.

### SQL interactivo
Se pueden ejecutar consultas SQL reales sobre la base de datos, con historial persistente y ejemplos de consulta para acelerar el análisis.

### Visualización inteligente
La sección de Data Viz sugiere configuraciones iniciales en función de la estructura del dataset y facilita la construcción de gráficos sin fricción.

### Enfoque didáctico
El proyecto no solo muestra resultados: también explica qué está pasando y por qué, ayudando a interpretar mejor cada análisis.

### Experiencia modular
La app está organizada en módulos claros, lo que permite navegar entre exploración, SQL, visualización, modelos y resultados sin perder contexto.

---

## Estructura general del proyecto

- `src/pages` → pantallas principales de la aplicación
- `src/components` → componentes reutilizables
- `src/api` → cliente y acceso a datos
- `worker` → lógica serverless
- `cloudflare` → esquema y datos de ejemplo
- `public` → recursos estáticos

---

## Objetivo del proyecto

El objetivo de ML Studio Learn es ofrecer un entorno práctico e ինտuitivo para trabajar con datos de extremo a extremo, uniendo análisis exploratorio, consulta SQL, visualización y machine learning en una sola experiencia.

Es un proyecto pensado para mostrar criterio técnico, capacidad de organización y entendimiento integral del ciclo de vida de un producto de datos.

---

## Instalación local

```bash
git clone https://github.com/FedeGG09/ml-studio-learn.git
cd ml-studio-learn
npm install
npm run dev
