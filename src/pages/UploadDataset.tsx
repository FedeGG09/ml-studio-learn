import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Upload, FileText, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type ImportResult = {
  ok: boolean;
  dataset_id: number;
  dataset: {
    id: number;
    name: string;
    description: string;
    source_type: string;
    storage_key: string;
    preview_key: string;
    row_count: number;
    column_count: number;
    target_column: string;
    problem_type: string;
  };
  columns: Array<{
    column_name: string;
    data_type: string;
    is_target: number;
    has_nulls: number;
    null_count: number;
    unique_count: number;
  }>;
  preview: Record<string, unknown>[];
  stats: Record<string, unknown>;
};

export default function UploadDataset() {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState("");
  const [description, setDescription] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [problemType, setProblemType] = useState<"regression" | "classification">("classification");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!file && !isUploading;
  }, [file, isUploading]);

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setResult(null);
    setError(null);

    if (!selected) {
      setCsvPreview([]);
      return;
    }

    const text = await selected.text();
    const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 12);
    setCsvPreview(lines);

    if (!datasetName) {
      setDatasetName(selected.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Seleccioná un CSV primero");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", datasetName || file.name.replace(/\.[^.]+$/, ""));
      form.append("description", description);
      form.append("targetColumn", targetColumn);
      form.append("problemType", problemType);

      const response = await fetch("/api/datasets/import", {
        method: "POST",
        body: form,
      });

      const data = (await response.json()) as ImportResult & { error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo importar el dataset");
      }

      setResult(data);
      toast.success("Dataset importado correctamente");
    } catch (err: any) {
      const message = err?.message ?? "Error importando CSV";
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="section-title">Upload Dataset</h1>
        <p className="section-subtitle mt-1">
          Sube un CSV real para convertirlo en un dataset de entrenamiento.
        </p>
      </div>

      <ExplanationBox
        technicalTitle="Técnico: Ingesta de CSV"
        technicalContent="El archivo se envía al Worker, se parsea en el edge, se crean metadata y columnas en D1, y además se genera una tabla física para consulta y entrenamiento."
        didacticTitle="Sencillo: ¿Qué pasa acá?"
        didacticContent="Subís un CSV, el sistema lo entiende, lo ordena y lo deja listo para explorar, consultar con SQL y entrenar modelos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Archivo CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border border-dashed border-border rounded-2xl p-6 bg-muted/20">
                <label className="flex flex-col items-center justify-center gap-3 cursor-pointer">
                  <Upload className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">
                    {file ? file.name : "Haz clic para seleccionar un CSV"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Soporta archivos .csv
                  </span>
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre del dataset</label>
                  <Input
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder="Ej: churn_2026"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Columna objetivo</label>
                  <Input
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    placeholder="Ej: churn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de problema</label>
                  <Select
                    value={problemType}
                    onValueChange={(value) =>
                      setProblemType(value as "regression" | "classification")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regression">Regresión</SelectItem>
                      <SelectItem value="classification">Clasificación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descripción</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción corta del dataset"
                  />
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full h-11 gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Importar dataset
                  </>
                )}
              </Button>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {result && (
                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Dataset importado con éxito</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div>ID: {result.dataset.id}</div>
                    <div>Filas: {result.dataset.row_count}</div>
                    <div>Columnas: {result.dataset.column_count}</div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/datasets/${result.dataset.id}`)}
                      className="gap-2"
                    >
                      Ver dataset
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/model-lab?datasetId=${result.dataset.id}&target=${encodeURIComponent(
                            result.dataset.target_column
                          )}&problemType=${result.dataset.problem_type}`
                        )
                      }
                      className="gap-2"
                    >
                      Ir a Model Lab
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Vista previa local</CardTitle>
            </CardHeader>
            <CardContent>
              {csvPreview.length > 0 ? (
                <div className="space-y-2">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-muted/30 p-3 rounded-xl">
                    {csvPreview.join("\n")}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Seleccioná un CSV para ver las primeras líneas.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Qué hace el import</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Lee el CSV desde el navegador.</p>
              <p>• Lo sube al Worker con FormData.</p>
              <p>• Crea metadata y columnas en D1.</p>
              <p>• Genera una tabla física para SQL y entrenamiento.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}