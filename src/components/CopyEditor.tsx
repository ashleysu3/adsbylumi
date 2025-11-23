import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lightbulb, FileText } from "lucide-react";
import { useState } from "react";

interface CopyEditorProps {
  concept: any;
  initialCopy?: {
    headline: string;
    primary_text: string;
    description: string;
    call_to_action: string;
  };
  onApprove: (copy: any) => void;
  onBack: () => void;
}

export function CopyEditor({ concept, initialCopy, onApprove, onBack }: CopyEditorProps) {
  const [copy, setCopy] = useState({
    headline: initialCopy?.headline || concept.headline || "",
    primary_text: initialCopy?.primary_text || concept.primary_copy || "",
    description: initialCopy?.description || concept.description || "",
    call_to_action: initialCopy?.call_to_action || "LEARN_MORE",
  });

  const handleApprove = () => {
    onApprove(copy);
  };

  const ctaOptions = [
    { value: "LEARN_MORE", label: "Learn More" },
    { value: "SHOP_NOW", label: "Shop Now" },
    { value: "SIGN_UP", label: "Sign Up" },
    { value: "GET_QUOTE", label: "Get Quote" },
    { value: "BOOK_NOW", label: "Book Now" },
    { value: "DOWNLOAD", label: "Download" },
    { value: "WATCH_MORE", label: "Watch More" },
    { value: "APPLY_NOW", label: "Apply Now" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Finalize Your Ad Copy</h2>
          <p className="text-muted-foreground">Edit and approve your ad text</p>
        </div>
      </div>

      {/* Preview */}
      <Card className="p-6 bg-muted/30">
        <h3 className="font-semibold mb-4">Ad Preview</h3>
        <div className="bg-background rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10" />
            <div>
              <div className="font-semibold text-sm">Your Brand Name</div>
              <div className="text-xs text-muted-foreground">Sponsored</div>
            </div>
          </div>
          <p className="text-sm">{copy.primary_text || "Your primary text will appear here..."}</p>
          <div className="bg-muted h-48 rounded flex items-center justify-center text-muted-foreground text-sm">
            [Your Creative Preview]
          </div>
          <div className="text-sm">
            <div className="font-semibold">{copy.headline || "Your headline here"}</div>
            <div className="text-muted-foreground text-xs">{copy.description || "Description..."}</div>
          </div>
          <Button size="sm" variant="outline" className="w-full">
            {ctaOptions.find((opt) => opt.value === copy.call_to_action)?.label || "Learn More"}
          </Button>
        </div>
      </Card>

      {/* Editable Fields */}
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="headline">
            Headline <span className="text-muted-foreground text-xs">(40 characters max)</span>
          </Label>
          <Input
            id="headline"
            value={copy.headline}
            onChange={(e) => setCopy({ ...copy, headline: e.target.value.slice(0, 40) })}
            placeholder="Stop scrolling if you're tired of..."
            maxLength={40}
          />
          <div className="text-xs text-muted-foreground text-right">{copy.headline.length}/40</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_text">
            Primary Text <span className="text-muted-foreground text-xs">(125 characters recommended)</span>
          </Label>
          <Textarea
            id="primary_text"
            value={copy.primary_text}
            onChange={(e) => setCopy({ ...copy, primary_text: e.target.value })}
            placeholder="Have you ever felt like your Meta ads are burning cash without results? You're not alone..."
            rows={4}
          />
          <div className="text-xs text-muted-foreground text-right">
            {copy.primary_text.length} characters
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Description <span className="text-muted-foreground text-xs">(30 characters max)</span>
          </Label>
          <Input
            id="description"
            value={copy.description}
            onChange={(e) => setCopy({ ...copy, description: e.target.value.slice(0, 30) })}
            placeholder="Get started today"
            maxLength={30}
          />
          <div className="text-xs text-muted-foreground text-right">{copy.description.length}/30</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cta">Call-to-Action Button</Label>
          <Select value={copy.call_to_action} onValueChange={(value) => setCopy({ ...copy, call_to_action: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ctaOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* AI Suggestions */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">AI Suggestions</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Try adding urgency: "Limited time only" or "Join 1,000+ others"</li>
              <li>• Lead with the pain point or desired outcome</li>
              <li>• Use "you" language to make it personal</li>
              <li>• End with a clear action: "Tap to learn how"</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleApprove}>Approve & Mark Ready →</Button>
      </div>
    </div>
  );
}
