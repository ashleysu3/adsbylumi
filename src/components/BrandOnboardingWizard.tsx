 import { useState, useMemo, useEffect } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { Building2, Smile, Brain, Package, ChevronRight, ChevronLeft, X, Check, Sparkles } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import confetti from 'canvas-confetti';
 
 interface WizardStep {
   id: string;
   title: string;
   description: string;
   icon: React.ElementType;
   isComplete: boolean;
 }
 
 interface BrandOnboardingWizardProps {
   brand: any;
   offers: any[];
   onDismiss: () => void;
   onNavigateToTab: (tab: string) => void;
   onEditBrand: () => void;
   onComplete: () => void;
 }
 
 export function BrandOnboardingWizard({
   brand,
   offers,
   onDismiss,
   onNavigateToTab,
   onEditBrand,
   onComplete,
 }: BrandOnboardingWizardProps) {
   const [currentStep, setCurrentStep] = useState(0);
 
   const steps: WizardStep[] = useMemo(() => [
     {
       id: 'overview',
       title: 'Brand Basics',
       description: 'Set up your brand name, website, and positioning',
       icon: Building2,
       isComplete: !!(brand?.name && brand?.website_url && brand?.industry && brand?.value_proposition),
     },
     {
      id: 'brand-brain',
      title: 'Brand Brain',
      description: 'Add content assets and generate audience psychology',
       icon: Brain,
      isComplete: brand?.psychology_status === 'approved' && brand?.use_emojis !== undefined,
     },
     {
       id: 'offers',
       title: 'Your Offers',
       description: 'Add at least one offer to start creating campaigns',
       icon: Package,
       isComplete: offers.length > 0,
     },
   ], [brand, offers]);
 
   const completedSteps = steps.filter(s => s.isComplete).length;
   const progressPercentage = (completedSteps / steps.length) * 100;
 
   // Check if all steps are complete
   useEffect(() => {
     if (completedSteps === steps.length) {
       // Celebrate!
       confetti({
         particleCount: 100,
         spread: 70,
         origin: { y: 0.6 },
       });
       
       setTimeout(() => {
         onComplete();
       }, 2000);
     }
   }, [completedSteps, steps.length, onComplete]);
 
   const currentStepData = steps[currentStep];
   const Icon = currentStepData.icon;
 
   const handleContinue = () => {
     // Navigate to the appropriate tab
     onNavigateToTab(currentStepData.id);
     
     // If current step needs action, trigger it
     if (currentStepData.id === 'overview' && !currentStepData.isComplete) {
       onEditBrand();
     }
     
     // Move to next incomplete step or close
     if (currentStep < steps.length - 1) {
       setCurrentStep(currentStep + 1);
     } else {
       onDismiss();
     }
   };
 
   const handleBack = () => {
     if (currentStep > 0) {
       setCurrentStep(currentStep - 1);
     }
   };
 
   const handleStepClick = (index: number) => {
     setCurrentStep(index);
     onNavigateToTab(steps[index].id);
   };
 
    // Only allow dismissing once brand basics are done
    const canDismiss = steps[0].isComplete;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg"
        >
          <Card className="border-2 shadow-2xl">
            <CardHeader className="relative pb-2">
              {canDismiss && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4"
                  onClick={onDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
             
             <div className="flex items-center gap-2 text-primary">
               <Sparkles className="h-5 w-5" />
               <span className="text-sm font-medium">Setup Wizard</span>
             </div>
             
             <CardTitle className="text-xl">Complete your brand profile</CardTitle>
             <CardDescription>
               Walk through each section to unlock powerful smart campaigns
             </CardDescription>
 
             {/* Progress */}
             <div className="pt-4">
               <div className="flex justify-between text-xs text-muted-foreground mb-2">
                 <span>{completedSteps} of {steps.length} complete</span>
                 <span>{Math.round(progressPercentage)}%</span>
               </div>
               <Progress value={progressPercentage} className="h-2" />
             </div>
           </CardHeader>
 
           <CardContent className="space-y-6">
             {/* Step Indicators */}
             <div className="flex justify-center gap-2">
               {steps.map((step, index) => {
                 const StepIcon = step.icon;
                 return (
                   <button
                     key={step.id}
                     onClick={() => handleStepClick(index)}
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                        index === currentStep && 'border-primary bg-primary text-primary-foreground scale-110',
                        index !== currentStep && step.isComplete && 'border-primary/50 bg-primary/10 text-primary',
                        index !== currentStep && !step.isComplete && 'border-muted-foreground/30 text-muted-foreground'
                      )}
                   >
                     {step.isComplete ? (
                       <Check className="h-4 w-4" />
                     ) : (
                       <StepIcon className="h-4 w-4" />
                     )}
                   </button>
                 );
               })}
             </div>
 
             {/* Current Step Content */}
             <AnimatePresence mode="wait">
               <motion.div
                 key={currentStep}
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 transition={{ duration: 0.2 }}
               >
                  <div className={cn(
                    'rounded-xl p-6 text-center space-y-4',
                    currentStepData.isComplete ? 'bg-primary/10' : 'bg-muted/50'
                  )}>
                    <div className={cn(
                      'mx-auto w-16 h-16 rounded-full flex items-center justify-center',
                      currentStepData.isComplete ? 'bg-primary/20' : 'bg-primary/10'
                    )}>
                     {currentStepData.isComplete ? (
                       <Check className="h-8 w-8 text-primary" />
                     ) : (
                       <Icon className="h-8 w-8 text-primary" />
                     )}
                   </div>
 
                   <div>
                     <h3 className="font-semibold text-lg">
                       Step {currentStep + 1}: {currentStepData.title}
                     </h3>
                     <p className="text-sm text-muted-foreground mt-1">
                       {currentStepData.description}
                     </p>
                   </div>
 
                   {currentStepData.isComplete ? (
                      <Badge variant="outline" className="border-primary/50 text-primary">
                        <Check className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                   ) : (
                     <Badge variant="secondary">Action needed</Badge>
                   )}
                 </div>
               </motion.div>
             </AnimatePresence>
 
             {/* Navigation */}
             <div className="flex items-center justify-between pt-2">
               <Button
                 variant="ghost"
                 onClick={handleBack}
                 disabled={currentStep === 0}
                 className="gap-1"
               >
                 <ChevronLeft className="h-4 w-4" />
                 Back
               </Button>
 
              <div className="flex gap-2">
                  {canDismiss && (
                    <Button variant="outline" onClick={onDismiss}>
                      Skip for now
                    </Button>
                  )}
                  <Button onClick={handleContinue} variant="lumi" className="gap-1">
                    {currentStepData.isComplete ? 'Next' : 'Go to ' + currentStepData.title}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
             </div>
           </CardContent>
         </Card>
       </motion.div>
     </div>
   );
 }