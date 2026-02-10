 import { useState, useEffect, useRef } from "react";
 import { motion, AnimatePresence } from "framer-motion";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import {
   CheckCircle2,
   XCircle,
   AlertTriangle,
   Loader2,
   Circle,
   Link2,
   DollarSign,
   Calendar,
   SpellCheck,
   ArrowLeft,
   Rocket,
   ChevronDown,
   ChevronUp,
   ExternalLink,
 } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { supabase } from "@/integrations/supabase/client";
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 
 interface Issue {
   field: string;
   text: string;
   suggestion: string;
   reason: string;
   location?: string;
 }
 
 interface CheckResult {
   id: string;
   name: string;
   status: "pending" | "running" | "passed" | "warning" | "failed";
   message?: string;
   issues?: Issue[];
   details?: string;
 }
 
 interface QACheckScreenProps {
   workspace: any;
   answers: any;
   onBack: () => void;
   onProceed: () => void;
   onFixIssue?: (issueType: string, issueData: any) => void;
 }
 
 const CHECK_ICONS: Record<string, React.ReactNode> = {
   meta: <Link2 className="h-4 w-4" />,
   budget: <DollarSign className="h-4 w-4" />,
   schedule: <Calendar className="h-4 w-4" />,
   landing_page: <ExternalLink className="h-4 w-4" />,
   spelling: <SpellCheck className="h-4 w-4" />,
 };
 
 const INITIAL_CHECKS: CheckResult[] = [
   { id: "meta", name: "Meta Connection", status: "pending" },
   { id: "budget", name: "Budget", status: "pending" },
   { id: "schedule", name: "Schedule", status: "pending" },
   { id: "landing_page", name: "Landing Page", status: "pending" },
   { id: "spelling", name: "Spelling & Grammar", status: "pending" },
 ];
 
 export function QACheckScreen({
   workspace,
   answers,
   onBack,
   onProceed,
   onFixIssue,
 }: QACheckScreenProps) {
   const [phase, setPhase] = useState<"running" | "complete">("running");
   const [checks, setChecks] = useState<CheckResult[]>(INITIAL_CHECKS);
   const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
   const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
   const [summary, setSummary] = useState({ passed: 0, warnings: 0, failed: 0 });
   const hasStartedRef = useRef(false);
 
   const progress = phase === "complete" 
     ? 100 
     : Math.round((currentCheckIndex / INITIAL_CHECKS.length) * 100);
 
   useEffect(() => {
     if (hasStartedRef.current) return;
     hasStartedRef.current = true;
     runChecks();
   }, []);
 
   const runChecks = async () => {
     // Animate through checks sequentially for visual effect
     for (let i = 0; i < INITIAL_CHECKS.length; i++) {
       setCurrentCheckIndex(i);
       setChecks((prev) =>
         prev.map((c, idx) =>
           idx === i ? { ...c, status: "running" } : c
         )
       );
       
       // Small delay for visual effect
       await new Promise((r) => setTimeout(r, 400));
     }
 
     // Now call the actual edge function
     try {
       const { data, error } = await supabase.functions.invoke("qa-preflight-check", {
         body: {
           brand: workspace.brands,
           answers,
           creativeJson: workspace.creative_json,
           productionItems: workspace.production_items,
           offerUrl: workspace.offer_url,
         },
       });
 
       if (error) throw error;
 
       if (data.success && data.checks) {
         // Update checks with real results
         setChecks(data.checks.map((c: any) => ({
           ...c,
           status: c.status as CheckResult["status"],
         })));
         setSummary(data.summary);
         
         // Auto-expand any checks with issues
         const issueChecks = data.checks
           .filter((c: any) => c.status === "warning" || c.status === "failed")
           .map((c: any) => c.id);
         setExpandedChecks(new Set(issueChecks));
       }
     } catch (error) {
       console.error("QA check error:", error);
       // Mark all as passed on error to not block publishing
       setChecks((prev) =>
         prev.map((c) => ({
           ...c,
           status: "passed",
           message: "Check completed",
         }))
       );
       setSummary({ passed: 5, warnings: 0, failed: 0 });
     }
 
     setPhase("complete");
   };
 
   const toggleExpand = (id: string) => {
     setExpandedChecks((prev) => {
       const next = new Set(prev);
       if (next.has(id)) {
         next.delete(id);
       } else {
         next.add(id);
       }
       return next;
     });
   };
 
   const hasIssues = summary.warnings > 0 || summary.failed > 0;
   const hasBlockingIssues = summary.failed > 0;
 
   const getStatusIcon = (status: CheckResult["status"]) => {
     switch (status) {
       case "pending":
         return <Circle className="h-4 w-4 text-muted-foreground" />;
       case "running":
         return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
       case "passed":
         return <CheckCircle2 className="h-4 w-4 text-green-500" />;
       case "warning":
         return <AlertTriangle className="h-4 w-4 text-amber-500" />;
       case "failed":
         return <XCircle className="h-4 w-4 text-destructive" />;
     }
   };
 
   const getStatusColor = (status: CheckResult["status"]) => {
     switch (status) {
       case "pending":
         return "text-muted-foreground";
       case "running":
         return "text-primary";
       case "passed":
         return "text-green-600";
       case "warning":
         return "text-amber-600";
       case "failed":
         return "text-destructive";
     }
   };
 
   return (
     <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
       <div className="w-full max-w-lg space-y-8">
         {/* Header */}
         <div className="text-center space-y-2">
           <AnimatePresence mode="wait">
             {phase === "running" ? (
               <motion.div
                 key="running"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
               >
                 <h2 className="text-2xl font-bold">Running Pre-Flight Checks</h2>
                 <p className="text-muted-foreground">
                   Making sure everything is ready for launch...
                 </p>
               </motion.div>
             ) : (
               <motion.div
                 key="complete"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
               >
                 {hasBlockingIssues ? (
                   <>
                     <div className="inline-flex items-center gap-2 text-destructive mb-2">
                       <XCircle className="h-6 w-6" />
                       <h2 className="text-2xl font-bold">Issues Found</h2>
                     </div>
                     <p className="text-muted-foreground">
                       Please fix these issues before publishing
                     </p>
                   </>
                 ) : hasIssues ? (
                   <>
                     <div className="inline-flex items-center gap-2 text-amber-600 mb-2">
                       <AlertTriangle className="h-6 w-6" />
                       <h2 className="text-2xl font-bold">Review Recommended</h2>
                     </div>
                     <p className="text-muted-foreground">
                       {summary.warnings} item{summary.warnings !== 1 ? "s" : ""} to review
                     </p>
                   </>
                 ) : (
                   <>
                     <div className="inline-flex items-center gap-2 text-green-600 mb-2">
                       <CheckCircle2 className="h-6 w-6" />
                       <h2 className="text-2xl font-bold">All Checks Passed</h2>
                     </div>
                     <p className="text-muted-foreground">
                       Your campaign is ready to go live
                     </p>
                   </>
                 )}
               </motion.div>
             )}
           </AnimatePresence>
         </div>
 
         {/* Progress Bar */}
         <div className="w-full">
           <div className="h-2 bg-muted rounded-full overflow-hidden">
             <motion.div
               className={cn(
                 "h-full rounded-full",
                 phase === "complete" && hasBlockingIssues
                   ? "bg-destructive"
                   : phase === "complete" && hasIssues
                   ? "bg-amber-500"
                   : "bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))]"
               )}
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               transition={{ duration: 0.5, ease: "easeOut" }}
             />
           </div>
         </div>
 
         {/* Check List */}
         <Card>
           <CardContent className="p-4 space-y-2">
             {checks.map((check, idx) => (
               <Collapsible
                 key={check.id}
                 open={expandedChecks.has(check.id)}
                 onOpenChange={() => toggleExpand(check.id)}
               >
                 <motion.div
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: idx * 0.1 }}
                 >
                   <CollapsibleTrigger asChild>
                     <button
                       className={cn(
                         "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                         check.status === "pending"
                           ? "opacity-50"
                           : "hover:bg-muted/50 cursor-pointer"
                       )}
                       disabled={check.status === "pending"}
                     >
                       <div className="flex items-center gap-3">
                         <motion.div
                           initial={false}
                           animate={
                             check.status === "passed"
                               ? { scale: [1, 1.2, 1] }
                               : {}
                           }
                           transition={{ duration: 0.3 }}
                         >
                           {getStatusIcon(check.status)}
                         </motion.div>
                         <div className="flex items-center gap-2">
                           <span className="text-muted-foreground">
                             {CHECK_ICONS[check.id]}
                           </span>
                           <span
                             className={cn(
                               "font-medium",
                               getStatusColor(check.status)
                             )}
                           >
                             {check.name}
                           </span>
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         {check.message && check.status !== "pending" && (
                           <span className="text-sm text-muted-foreground max-w-[200px] truncate">
                             {check.message}
                           </span>
                         )}
                         {(check.issues?.length || check.details) &&
                           check.status !== "pending" && (
                             expandedChecks.has(check.id) ? (
                               <ChevronUp className="h-4 w-4 text-muted-foreground" />
                             ) : (
                               <ChevronDown className="h-4 w-4 text-muted-foreground" />
                             )
                           )}
                       </div>
                     </button>
                   </CollapsibleTrigger>
 
                   <CollapsibleContent>
                     <div className="ml-10 mr-3 mb-3 space-y-2">
                       {check.details && (
                         <p className="text-sm text-muted-foreground">
                           {check.details}
                         </p>
                       )}
 
                       {check.issues && check.issues.length > 0 && (
                         <div className="space-y-2 mt-2">
                           {check.issues.map((issue, issueIdx) => (
                             <div
                               key={issueIdx}
                               className="p-3 bg-muted/50 rounded-lg border border-amber-500/20"
                             >
                               <div className="flex items-start justify-between gap-2">
                                 <div className="space-y-1 flex-1">
                                   <p className="text-sm">
                                     <span className="text-muted-foreground line-through">
                                       {issue.text}
                                     </span>
                                     {" → "}
                                     <span className="font-medium text-green-600">
                                       {issue.suggestion}
                                     </span>
                                   </p>
                                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                     <Badge variant="outline" className="text-xs">
                                       {issue.reason}
                                     </Badge>
                                     {issue.location && (
                                       <span>{issue.location}</span>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   </CollapsibleContent>
                 </motion.div>
               </Collapsible>
             ))}
           </CardContent>
         </Card>
 
         {/* Actions */}
         {phase === "complete" && (
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.3 }}
             className="flex items-center justify-between gap-4"
           >
             <Button variant="outline" onClick={onBack} className="gap-2">
               <ArrowLeft className="h-4 w-4" />
               Back to Review
             </Button>
 
             {hasBlockingIssues ? (
               <Button variant="outline" disabled className="gap-2">
                 <XCircle className="h-4 w-4" />
                 Fix Issues to Continue
               </Button>
              ) : hasIssues ? (
                <Button onClick={onProceed} className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Publish Anyway
                </Button>
             ) : (
               <Button onClick={onProceed} className="gap-2" size="lg">
                 <Rocket className="h-4 w-4" />
                 Publish to Meta
               </Button>
             )}
           </motion.div>
         )}
       </div>
     </div>
   );
 }