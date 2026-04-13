import { useState } from "react";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Button } from "@/components/ui/button";

export default function UploadDataset() {
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState<{ name: string; rows: number; cols: number } | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploaded({ name: "dataset_demo.csv", rows: 1500, cols: 12 });
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="section-title">Upload Dataset</h1>
        <p className="section-subtitle mt-1">Carga tu archivo CSV para comenzar a explorar</p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Ingesta de datos"
        technicalContent="El sistema parsea archivos CSV usando streaming para archivos grandes, infiere tipos de columna (numérico, categórico, datetime), detecta el encoding (UTF-8, Latin-1) y el delimitador automáticamente."
        didacticTitle="Sencillo: ¿Qué hago aquí?"
        didacticContent="Arrastra tu archivo de datos (como una tabla de Excel guardada en formato CSV) al recuadro. El sistema lo leerá automáticamente y te mostrará qué contiene. ¡No necesitas programar nada!"
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => setUploaded({ name: "dataset_demo.csv", rows: 1500, cols: 12 })}
        className={`glass-card p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
          dragOver ? "glow-border bg-primary/5" : "hover:border-primary/20"
        }`}
      >
        {uploaded ? (
          <div className="text-center animate-slide-up">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="font-heading font-semibold">{uploaded.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {uploaded.rows.toLocaleString()} filas · {uploaded.cols} columnas
            </p>
            <Button className="mt-4" variant="outline" onClick={(e) => { e.stopPropagation(); setUploaded(null); }}>
              Subir otro archivo
            </Button>
          </div>
        ) : (
          <>
            <Upload className={`h-12 w-12 mb-4 ${dragOver ? "text-primary animate-pulse-glow" : "text-muted-foreground"}`} />
            <p className="font-heading font-semibold">Arrastra tu archivo CSV aquí</p>
            <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
            <div className="flex gap-2 mt-4">
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">.csv</span>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">.tsv</span>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">max 50MB</span>
            </div>
          </>
        )}
      </div>

      {uploaded && (
        <div className="glass-card p-5 animate-slide-up">
          <h3 className="font-heading font-semibold text-sm mb-3">Vista previa</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["ID", "Age", "Income", "Education", "Score", "Category"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [1, 25, 45000, "Bachelor", 78.5, "A"],
                  [2, 34, 62000, "Master", 85.2, "B"],
                  [3, 29, 51000, "PhD", 92.1, "A"],
                ].map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
