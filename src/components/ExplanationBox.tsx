import { BookOpen, Lightbulb } from "lucide-react";

interface ExplanationBoxProps {
  technicalTitle: string;
  technicalContent: string;
  didacticTitle: string;
  didacticContent: string;
}

export function ExplanationBox({ technicalTitle, technicalContent, didacticTitle, didacticContent }: ExplanationBoxProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="technical-box">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-accent" />
          <h4 className="font-heading font-semibold text-sm text-accent">{technicalTitle}</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{technicalContent}</p>
      </div>
      <div className="didactic-box">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h4 className="font-heading font-semibold text-sm text-primary">{didacticTitle}</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{didacticContent}</p>
      </div>
    </div>
  );
}
