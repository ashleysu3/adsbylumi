import { forwardRef } from "react";
import { CreativeAngle } from "./AngleSelector";
import { CreativeCellData } from "./CreativeCell";
import { Separator } from "@/components/ui/separator";

interface CreativeBriefDocumentProps {
  brandName: string;
  offerData: {
    name?: string;
    description?: string;
    price?: string;
    url?: string;
  };
  productPsychology?: any;
  audiencePsychology?: any;
  angles: CreativeAngle[];
  selectedAngleIds: string[];
  gridData: CreativeCellData[];
  angleCopy: Record<string, any>;
  generatedDate?: string;
}

export const CreativeBriefDocument = forwardRef<HTMLDivElement, CreativeBriefDocumentProps>(
  ({ brandName, offerData, productPsychology, audiencePsychology, angles, selectedAngleIds, gridData, angleCopy, generatedDate }, ref) => {
    const selectedAngles = angles.filter(a => selectedAngleIds.includes(a.id));
    const date = generatedDate || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const renderPsychologySection = (psych: any, title: string) => {
      if (!psych) return null;
      const entries = typeof psych === "string" ? [psych] : Object.entries(psych);
      if (!entries.length) return null;

      return (
        <div className="brief-section">
          <h3 className="brief-h3">{title}</h3>
          {typeof psych === "string" ? (
            <p className="brief-body">{psych}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(psych).map(([key, value]: [string, any]) => {
                if (!value) return null;
                const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <div key={key} className="brief-card">
                    <h4 className="text-sm font-semibold text-foreground mb-1">{label}</h4>
                    {Array.isArray(value) ? (
                      <ul className="brief-list">
                        {value.map((v: string, i: number) => <li key={i}>{v}</li>)}
                      </ul>
                    ) : typeof value === "object" ? (
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">{String(value)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    };

    return (
      <div ref={ref} className="creative-brief-document bg-background text-foreground max-w-4xl mx-auto">
        {/* Print-only styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .creative-brief-document, .creative-brief-document * { visibility: visible; }
            .creative-brief-document { 
              position: absolute; left: 0; top: 0; width: 100%; 
              font-size: 11pt; line-height: 1.5;
            }
            .brief-section { page-break-inside: avoid; }
            .no-print { display: none !important; }
          }
          .brief-section { margin-bottom: 2rem; }
          .brief-h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; border-bottom: 2px solid hsl(var(--primary) / 0.2); padding-bottom: 0.5rem; }
          .brief-h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
          .brief-body { font-size: 0.9rem; color: hsl(var(--muted-foreground)); line-height: 1.6; }
          .brief-card { padding: 0.75rem; border-radius: 0.5rem; background: hsl(var(--muted) / 0.3); border: 1px solid hsl(var(--border)); }
          .brief-list { list-style: disc; padding-left: 1.25rem; font-size: 0.875rem; color: hsl(var(--muted-foreground)); }
          .brief-list li { margin-bottom: 0.25rem; }
        `}</style>

        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-primary/20">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">Creative Brief</h1>
          <p className="text-lg text-muted-foreground">{brandName}</p>
          <p className="text-sm text-muted-foreground mt-2">{date}</p>
        </div>

        {/* Offer Overview */}
        <div className="brief-section">
          <h2 className="brief-h2">Offer Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offerData.name && (
              <div className="brief-card">
                <h4 className="text-sm font-semibold mb-1">Offer Name</h4>
                <p className="text-sm text-muted-foreground">{offerData.name}</p>
              </div>
            )}
            {offerData.price && (
              <div className="brief-card">
                <h4 className="text-sm font-semibold mb-1">Price</h4>
                <p className="text-sm text-muted-foreground">{offerData.price}</p>
              </div>
            )}
            {offerData.url && (
              <div className="brief-card col-span-full">
                <h4 className="text-sm font-semibold mb-1">URL</h4>
                <a href={offerData.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">{offerData.url}</a>
              </div>
            )}
            {offerData.description && (
              <div className="brief-card col-span-full">
                <h4 className="text-sm font-semibold mb-1">Description</h4>
                <p className="brief-body">{offerData.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Psychology */}
        {renderPsychologySection(productPsychology, "Product Psychology")}
        {renderPsychologySection(audiencePsychology, "Audience Psychology")}

        <Separator className="my-6" />

        {/* Creative Angles */}
        <div className="brief-section">
          <h2 className="brief-h2">Creative Angles ({selectedAngles.length})</h2>
          <div className="space-y-3">
            {selectedAngles.map((angle, i) => (
              <div key={angle.id} className="brief-card">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <h4 className="font-semibold text-sm">{angle.name}</h4>
                    <p className="text-sm text-muted-foreground">{angle.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Creative Concepts by Angle */}
        {selectedAngles.map(angle => {
          const concepts = gridData.filter(c => c.angleId === angle.id);
          if (!concepts.length) return null;
          const formatLabels: Record<string, string> = { talking_head: "Talking Head", broll: "B-Roll", graphic: "Graphic" };

          return (
            <div key={angle.id} className="brief-section">
              <h2 className="brief-h2">Concepts — {angle.name}</h2>
              <div className="space-y-4">
                {concepts.map((concept, i) => (
                  <div key={concept.id} className="brief-card space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{formatLabels[concept.format] || concept.format}</span>
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    </div>
                    <p className="font-semibold text-sm">{concept.hook}</p>
                    <p className="text-sm text-muted-foreground">{concept.guidance}</p>
                    {concept.why_this_works && (
                      <p className="text-xs text-primary/80 italic">💡 {concept.why_this_works}</p>
                    )}
                    {concept.script_lines && Array.isArray(concept.script_lines) && concept.script_lines.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold mb-1">Script</h5>
                        <ol className="brief-list list-decimal">
                          {concept.script_lines.map((line: string, li: number) => <li key={li}>{line}</li>)}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <Separator className="my-6" />

        {/* Ad Copy by Angle */}
        {selectedAngles.map(angle => {
          const copy = angleCopy[angle.id];
          if (!copy || (!copy.headlines?.length && !copy.descriptions?.length && !copy.primary_copy?.length)) return null;

          return (
            <div key={`copy-${angle.id}`} className="brief-section">
              <h2 className="brief-h2">Ad Copy — {angle.name}</h2>
              <div className="space-y-4">
                {copy.headlines?.length > 0 && (
                  <div className="brief-card">
                    <h4 className="text-sm font-semibold mb-2">Headlines</h4>
                    <ul className="brief-list">
                      {copy.headlines.map((h: string, i: number) => <li key={i}>{h}</li>)}
                    </ul>
                  </div>
                )}
                {copy.descriptions?.length > 0 && (
                  <div className="brief-card">
                    <h4 className="text-sm font-semibold mb-2">Descriptions</h4>
                    <ul className="brief-list">
                      {copy.descriptions.map((d: string, i: number) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}
                {copy.primary_copy?.length > 0 && (
                  <div className="brief-card">
                    <h4 className="text-sm font-semibold mb-2">Primary Copy</h4>
                    {copy.primary_copy.map((pc: any, i: number) => (
                      <div key={i} className="mb-3 last:mb-0">
                        {pc.label && <p className="text-xs font-medium text-primary mb-1">{pc.label}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{typeof pc === "string" ? pc : pc.text || pc.content || JSON.stringify(pc)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="text-center py-6 mt-8 border-t border-border">
          <p className="text-xs text-muted-foreground">Generated by Your Ad Assistant • {date}</p>
        </div>
      </div>
    );
  }
);

CreativeBriefDocument.displayName = "CreativeBriefDocument";
