import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/DashboardLayout";

import HomePage from "./pages/HomePage";
import UploadDataset from "./pages/UploadDataset";
import DatasetExplorer from "./pages/DatasetExplorer";
import SqlLab from "./pages/SqlLab";
import DataViz from "./pages/DataViz";
import ModelLab from "./pages/ModelLab";
import TrainingResults from "./pages/TrainingResults";
import CodeViewer from "./pages/CodeViewer";
import ExperimentComparison from "./pages/ExperimentComparison";
import DataPrep from "./pages/DataPrep";
import AdminDatasets from "./pages/AdminDatasets";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadDataset />} />

            {/* Explorer legacy */}
            <Route path="/explorer" element={<DatasetExplorer />} />

            {/* Explorer dinámico */}
            <Route path="/datasets/:id" element={<DatasetExplorer />} />

            <Route path="/sql-lab" element={<SqlLab />} />
            <Route path="/data-viz" element={<DataViz />} />
            <Route path="/model-lab" element={<ModelLab />} />
            <Route path="/results" element={<TrainingResults />} />
            <Route path="/code-viewer" element={<CodeViewer />} />
            <Route path="/comparison" element={<ExperimentComparison />} />
            <Route path="/admin" element={<AdminDatasets />} />
            <Route path="/data-prep" element={<DataPrep />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;