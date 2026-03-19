import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X, AlertCircle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  action_url: string | null;
  action_label: string | null;
  brand_id: string | null;
  created_at: string;
}

export function AlertsBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAlerts();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('user-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_alerts'
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching alerts:', error);
      return;
    }

    setAlerts(data || []);
  };

  const dismissAlert = async (alertId: string) => {
    setDismissing(alertId);
    
    const { error } = await supabase
      .from('user_alerts')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) {
      console.error('Error dismissing alert:', error);
    }
    
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setDismissing(null);
  };

  const handleAction = (alert: Alert) => {
    if (alert.action_url) {
      navigate(alert.action_url);
    }
  };

  if (alerts.length === 0) return null;

  // Returns 'error' for invalid/expired token alerts so they render as destructive/red
  const getEffectiveSeverity = (alert: Alert): string => {
    if (
      alert.type?.includes('invalid') ||
      alert.type?.includes('token') ||
      alert.type === 'meta_token_invalid' ||
      alert.type === 'meta_token_expired'
    ) {
      return 'error';
    }
    return alert.severity;
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'error':
        return {
          container: 'bg-destructive/10 border-destructive/30',
          icon: 'text-destructive',
          title: 'text-destructive',
        };
      case 'warning':
        return {
          container: 'bg-amber-500/10 border-amber-500/30',
          icon: 'text-amber-500',
          title: 'text-amber-600 dark:text-amber-400',
        };
      default:
        return {
          container: 'bg-blue-500/10 border-blue-500/30',
          icon: 'text-blue-500',
          title: 'text-blue-600 dark:text-blue-400',
        };
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      default:
        return Info;
    }
  };

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert) => {
        const effectiveSeverity = getEffectiveSeverity(alert);
        const styles = getSeverityStyles(effectiveSeverity);
        const Icon = getIcon(effectiveSeverity);
        // Override action label for token-related alerts to say "Reconnect now"
        const isTokenAlert =
          alert.type?.includes('invalid') ||
          alert.type?.includes('token') ||
          alert.type === 'meta_token_invalid' ||
          alert.type === 'meta_token_expired';
        const actionLabel = isTokenAlert && alert.action_url
          ? 'Reconnect now'
          : alert.action_label;
        
        return (
          <div
            key={alert.id}
            className={cn(
              "relative flex items-start gap-3 p-4 rounded-lg border transition-all",
              styles.container,
              dismissing === alert.id && "opacity-50"
            )}
          >
            <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", styles.icon)} />
            
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium text-sm", styles.title)}>
                {alert.title}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {alert.message}
              </p>
              
              {alert.action_url && actionLabel && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-2 text-sm font-medium"
                  onClick={() => handleAction(alert)}
                >
                  {actionLabel}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 opacity-60 hover:opacity-100"
              onClick={() => dismissAlert(alert.id)}
              disabled={dismissing === alert.id}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
