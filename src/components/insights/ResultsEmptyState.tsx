import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Link2, BarChart3, Sparkles, TrendingUp, Target, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface ResultsEmptyStateProps {
  onShowDemo?: () => void;
}

export function ResultsEmptyState({ onShowDemo }: ResultsEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4"
    >
      {/* Hero Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <BarChart3 className="w-12 h-12 text-primary" />
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
        See How Your Ads Perform
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Connect your Meta ad account to unlock real-time insights, AI recommendations, and optimization suggestions.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-8">
        <Card className="p-4 text-center bg-muted/30 border-dashed">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-primary/70" />
          <p className="text-sm font-medium">Real-Time Metrics</p>
          <p className="text-xs text-muted-foreground">Live performance data</p>
        </Card>
        <Card className="p-4 text-center bg-muted/30 border-dashed">
          <Target className="w-8 h-8 mx-auto mb-2 text-primary/70" />
          <p className="text-sm font-medium">Smart Benchmarks</p>
          <p className="text-xs text-muted-foreground">Know what's working</p>
        </Card>
        <Card className="p-4 text-center bg-muted/30 border-dashed">
          <Zap className="w-8 h-8 mx-auto mb-2 text-primary/70" />
          <p className="text-sm font-medium">AI Optimization</p>
          <p className="text-xs text-muted-foreground">Actionable suggestions</p>
        </Card>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button 
          size="lg" 
          className="flex-1 gap-2 h-12"
          onClick={() => navigate('/settings')}
        >
          <Link2 className="w-5 h-5" />
          Connect Meta Account
        </Button>
        {onShowDemo && (
          <Button 
            variant="outline" 
            size="lg" 
            className="flex-1 gap-2 h-12"
            onClick={onShowDemo}
          >
            <BarChart3 className="w-5 h-5" />
            View Demo Data
          </Button>
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-6 text-center max-w-sm">
        Your data stays secure. We only read campaign metrics — never your billing or personal info.
      </p>
    </motion.div>
  );
}
