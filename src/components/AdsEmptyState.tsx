import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Sparkles, PenTool, Rocket, Layout } from 'lucide-react';
import { motion } from 'framer-motion';

export function AdsEmptyState() {
  const navigate = useNavigate();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[50vh] px-4"
    >
      {/* Hero Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Megaphone className="w-12 h-12 text-primary" />
        </div>
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5] 
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center"
        >
          <Sparkles className="w-4 h-4 text-accent" />
        </motion.div>
      </div>

      {/* Headline */}
      <h2 className="text-2xl sm:text-3xl font-display tracking-tight text-center mb-3">
        Ready to Create Your First Ad?
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Our AI-powered wizard will guide you through creating scroll-stopping ads in minutes — no design skills required.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-8">
        <Card className="p-4 text-center bg-muted/30 border-dashed">
          <PenTool className="w-8 h-8 mx-auto mb-2 text-primary/70" />
          <p className="text-sm font-medium">AI Copywriting</p>
          <p className="text-xs text-muted-foreground">Headlines & scripts</p>
        </Card>
        <Card className="p-4 text-center bg-muted/30 border-dashed">
          <Layout className="w-8 h-8 mx-auto mb-2 text-primary/70" />
          <p className="text-sm font-medium">Smart Templates</p>
          <p className="text-xs text-muted-foreground">Proven formats</p>
        </Card>
        <Card className="p-4 text-center bg-muted/30 border-dashed">
          <Rocket className="w-8 h-8 mx-auto mb-2 text-primary/70" />
          <p className="text-sm font-medium">One-Click Launch</p>
          <p className="text-xs text-muted-foreground">Publish to Meta</p>
        </Card>
      </div>

      {/* CTA */}
      <Button 
        size="lg" 
        className="gap-2 h-12 px-8"
        onClick={() => navigate('/create')}
      >
        <Sparkles className="w-5 h-5" />
        Create Your First Ad
      </Button>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-6 text-center max-w-sm">
        Takes about 5 minutes. You'll have ad copy, creative direction, and a launch-ready campaign.
      </p>
    </motion.div>
  );
}
