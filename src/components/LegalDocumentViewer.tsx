import { useState, useEffect, useCallback, memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

interface LegalDocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "terms" | "privacy";
}

export const LegalDocumentViewer = memo(({ open, onOpenChange, documentType }: LegalDocumentViewerProps) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    try {
      const filename = documentType === "terms" ? "TERMS_OF_SERVICE.md" : "PRIVACY_POLICY.md";
      const response = await fetch(`/${filename}`);
      const text = await response.text();
      setContent(text);
    } catch (error) {
      console.error("Error loading document:", error);
      setContent("Error loading document. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    if (open) {
      loadDocument();
    }
  }, [open, loadDocument]);

  const title = documentType === "terms" ? "Terms of Service" : "Privacy Policy";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <DialogTitle>{title}</DialogTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {content.split('\n').map((line, index) => {
                // Headers
                if (line.startsWith('# ')) {
                  return <h1 key={index} className="text-3xl font-bold mt-6 mb-4">{line.substring(2)}</h1>;
                }
                if (line.startsWith('## ')) {
                  return <h2 key={index} className="text-2xl font-semibold mt-6 mb-3">{line.substring(3)}</h2>;
                }
                if (line.startsWith('### ')) {
                  return <h3 key={index} className="text-xl font-semibold mt-4 mb-2">{line.substring(4)}</h3>;
                }

                // Bold text
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={index} className="font-bold mt-3 mb-2">{line.replace(/\*\*/g, '')}</p>;
                }

                // List items
                if (line.startsWith('- ')) {
                  return <li key={index} className="ml-6 my-1">{line.substring(2)}</li>;
                }

                // Links
                if (line.includes('[') && line.includes('](')) {
                  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                  const parts = [];
                  let lastIndex = 0;
                  let match;

                  while ((match = linkRegex.exec(line)) !== null) {
                    if (match.index > lastIndex) {
                      parts.push(line.substring(lastIndex, match.index));
                    }
                    parts.push(
                      <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {match[1]}
                      </a>
                    );
                    lastIndex = match.index + match[0].length;
                  }

                  if (lastIndex < line.length) {
                    parts.push(line.substring(lastIndex));
                  }

                  return <p key={index} className="my-2">{parts}</p>;
                }

                // Empty line
                if (line.trim() === '') {
                  return <div key={index} className="h-2" />;
                }

                // Regular paragraph
                return <p key={index} className="my-2">{line}</p>;
              })}
            </div>
          )}
        </ScrollArea>
        <div className="px-6 py-4 border-t bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">
            For questions or concerns, contact us at{" "}
            <a href="mailto:admin@cosmiq.quest" className="text-primary underline">
              admin@cosmiq.quest
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});
LegalDocumentViewer.displayName = 'LegalDocumentViewer';
