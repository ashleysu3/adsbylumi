import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adsGlossary, getTermsByCategory, GlossaryTerm } from "@/lib/ads-glossary";
import { 
  Search, 
  TrendingUp, 
  Layers, 
  Users, 
  Settings, 
  DollarSign,
  BookOpen
} from "lucide-react";

const categories = [
  { id: "all", label: "All Terms", icon: BookOpen },
  { id: "metrics", label: "Metrics", icon: TrendingUp },
  { id: "structure", label: "Campaign Structure", icon: Layers },
  { id: "audience", label: "Audiences", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "budget", label: "Budget", icon: DollarSign },
];

function GlossaryCard({ term }: { term: GlossaryTerm }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {term.term}
          {term.acronym && (
            <Badge variant="secondary" className="text-xs font-normal">
              {term.acronym}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {term.definition}
        </p>
        {term.example && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground/80 italic">
              <span className="font-medium not-italic text-foreground">Example: </span>
              {term.example}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Glossary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const allTerms = Object.values(adsGlossary);
  
  const getFilteredTerms = (): GlossaryTerm[] => {
    let terms: GlossaryTerm[];
    
    if (activeCategory === "all") {
      terms = allTerms;
    } else {
      terms = getTermsByCategory(activeCategory as any);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      terms = terms.filter(
        (term) =>
          term.term.toLowerCase().includes(query) ||
          term.acronym?.toLowerCase().includes(query) ||
          term.definition.toLowerCase().includes(query)
      );
    }

    return terms;
  };

  const filteredTerms = getFilteredTerms();

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display tracking-tight">
            Ads <span className="text-gradient-lumi">Glossary</span>
          </h1>
          <p className="text-muted-foreground">
            Plain-English explanations for common Meta Ads terms. Hover over terms throughout the app for quick definitions.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-2 text-sm"
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Terms Grid */}
        {filteredTerms.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTerms.map((term, index) => (
              <GlossaryCard key={index} term={term} />
            ))}
          </div>
        ) : (
          <Card className="py-12">
            <CardContent className="text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                No terms found matching "{searchQuery}"
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer tip */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">💡 Tip:</span> Look for the{" "}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="underline decoration-dotted">dotted underline</span>
              </span>{" "}
              or help icon on terms throughout the app — hover to see quick definitions!
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}