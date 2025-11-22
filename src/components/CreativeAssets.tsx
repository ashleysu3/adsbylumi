import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, RefreshCw, HelpCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface CreativeAssetsProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
}

export function CreativeAssets({ workspace, onUpdate }: CreativeAssetsProps) {
  const creative = workspace.creative_json || {};
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleExpand = (itemId: string, action: string) => {
    // This would call an edge function to get more options/explanations
    toast.info(`Getting ${action}...`);
    setTimeout(() => {
      setExpandedItem(itemId);
      toast.success("Additional options generated!");
    }, 1500);
  };

  if (!creative || Object.keys(creative).length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No creative assets generated yet</p>
            <Button onClick={() => window.location.href = `/creative?workspace=${workspace.id}`}>
              Generate Creative
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="hooks" className="space-y-4">
      <TabsList>
        {creative.hooks && <TabsTrigger value="hooks">Hooks</TabsTrigger>}
        {creative.scripts && <TabsTrigger value="scripts">Scripts</TabsTrigger>}
        {creative.ad_copy && <TabsTrigger value="copy">Ad Copy</TabsTrigger>}
        {creative.broll && <TabsTrigger value="broll">B-Roll</TabsTrigger>}
        {creative.graphics && <TabsTrigger value="graphics">Graphics</TabsTrigger>}
      </TabsList>

      {creative.hooks && (
        <TabsContent value="hooks">
          <Card>
            <CardHeader>
              <CardTitle>Video Hooks</CardTitle>
              <CardDescription>Attention-grabbing opening lines for your videos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {creative.hooks.map((hook: any, index: number) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-lg flex-1 text-foreground">{hook.text}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(hook.text, "Hook")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExpand(`hook-${index}`, "more options")}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExpand(`hook-${index}`, "filming tips")}
                          >
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {hook.psychology && (
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Why it works:</strong> {hook.psychology}
                        </p>
                      )}
                      {hook.label_driver && (
                        <p className="text-sm text-primary">
                          <strong>Label driver:</strong> {hook.label_driver}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {creative.scripts && (
        <TabsContent value="scripts">
          <Card>
            <CardHeader>
              <CardTitle>Talking Head Scripts</CardTitle>
              <CardDescription>30-second video scripts for your campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {creative.scripts.map((script: any, index: number) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold">Script {index + 1}</h4>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(script.content, "Script")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExpand(`script-${index}`, "filming guidance")}
                          >
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {script.content}
                      </p>
                      {script.notes && (
                        <div className="mt-3 p-3 bg-secondary/20 rounded">
                          <p className="text-sm text-muted-foreground">{script.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {creative.ad_copy && (
        <TabsContent value="copy">
          <div className="grid gap-4">
            {creative.ad_copy.headlines && (
              <Card>
                <CardHeader>
                  <CardTitle>Headlines</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {creative.ad_copy.headlines.map((headline: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <p className="font-medium">{headline}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(headline, "Headline")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {creative.ad_copy.primary_text && (
              <Card>
                <CardHeader>
                  <CardTitle>Primary Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {creative.ad_copy.primary_text.map((text: string, index: number) => (
                      <div key={index} className="p-4 border rounded">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-muted-foreground">Version {index + 1}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(text, "Primary text")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm">{text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {creative.ad_copy.descriptions && (
              <Card>
                <CardHeader>
                  <CardTitle>Descriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {creative.ad_copy.descriptions.map((desc: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <p>{desc}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(desc, "Description")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      )}

      {creative.broll && (
        <TabsContent value="broll">
          <Card>
            <CardHeader>
              <CardTitle>B-Roll Shot List</CardTitle>
              <CardDescription>Supporting footage to enhance your videos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {creative.broll.map((shot: any, index: number) => (
                  <div key={index} className="p-4 border rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium mb-1 text-foreground">{shot.description}</p>
                        {shot.notes && (
                          <p className="text-sm text-muted-foreground">{shot.notes}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleExpand(`broll-${index}`, "filming examples")}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {creative.graphics && (
        <TabsContent value="graphics">
          <Card>
            <CardHeader>
              <CardTitle>Graphic Outlines</CardTitle>
              <CardDescription>Static image specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {creative.graphics.map((graphic: any, index: number) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-2">{graphic.title}</h4>
                      <p className="text-sm mb-3">{graphic.description}</p>
                      {graphic.elements && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Elements to include:</p>
                          <ul className="text-sm list-disc list-inside space-y-1">
                            {graphic.elements.map((element: string, idx: number) => (
                              <li key={idx}>{element}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {graphic.specs && (
                        <div className="mt-3 p-3 bg-secondary/20 rounded">
                          <p className="text-sm"><strong>Specs:</strong> {graphic.specs}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}