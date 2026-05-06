import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Bug, 
  RefreshCw, 
  Mail, 
  DollarSign, 
  XCircle, 
  Gift, 
  Eye, 
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  ExternalLink,
  Loader2,
  Send,
  Archive,
  Sparkles
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface BugReport {
  id: string;
  user_id: string | null;
  user_email: string;
  details: string | null;
  context: string | null;
  current_page: string | null;
  current_url: string | null;
  user_agent: string | null;
  conversation_context: string | null;
  screenshot_url: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'waiting_for_user', label: 'Waiting for User', color: 'bg-purple-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const EMAIL_TEMPLATES = [
  { value: 'fixed', label: '✅ Issue Fixed', description: 'Let user know the bug has been resolved' },
  { value: 'working_on_it', label: '🔧 Working On It', description: 'Acknowledge and explain we\'re investigating' },
  { value: 'need_more_info', label: '❓ Need More Info', description: 'Request additional details from user' },
  { value: 'cannot_reproduce', label: '🔍 Cannot Reproduce', description: 'Ask for more steps to reproduce' },
  { value: 'refund_issued', label: '💰 Refund Issued', description: 'Confirm a refund has been processed' },
  { value: 'credit_applied', label: '🎁 Credit Applied', description: 'Confirm free month credit' },
];

export default function AdminBugReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hideClosedResolved, setHideClosedResolved] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fixPromptOpen, setFixPromptOpen] = useState(false);
  const [fixPromptText, setFixPromptText] = useState("");
  
  // Email form state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  
  // Resolution notes
  const [resolutionNotes, setResolutionNotes] = useState("");
  
  // Refund amount
  const [refundAmount, setRefundAmount] = useState("");

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      navigate("/");
      toast.error("Admin access required");
      return;
    }

    fetchReports();
  };

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch bug reports");
      console.error(error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (reportId: string, status: string) => {
    setActionLoading(`status-${reportId}`);
    try {
      const { error } = await supabase.functions.invoke("manage-bug-report", {
        body: { action: "update_status", reportId, status, resolutionNotes }
      });
      if (error) throw error;
      toast.success("Status updated");
      fetchReports();
      if (selectedReport?.id === reportId) {
        setSelectedReport({ ...selectedReport, status });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
    setActionLoading(null);
  };

  const handleUpdatePriority = async (reportId: string, priority: string) => {
    setActionLoading(`priority-${reportId}`);
    try {
      const { error } = await supabase.functions.invoke("manage-bug-report", {
        body: { action: "update_status", reportId, priority }
      });
      if (error) throw error;
      toast.success("Priority updated");
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || "Failed to update priority");
    }
    setActionLoading(null);
  };

  const handleSendEmail = async () => {
    if (!selectedReport) return;
    if (!selectedTemplate && !customMessage.trim()) {
      toast.error("Please select a template or write a custom message");
      return;
    }

    setActionLoading("email");
    try {
      const { error } = await supabase.functions.invoke("manage-bug-report", {
        body: { 
          action: "send_email", 
          reportId: selectedReport.id,
          emailTemplate: selectedTemplate || undefined,
          customMessage: customMessage.trim() || undefined
        }
      });
      if (error) throw error;

      // If user was told the issue is fixed, auto-mark resolved & close
      if (selectedTemplate === 'fixed') {
        const { error: statusError } = await supabase.functions.invoke("manage-bug-report", {
          body: {
            action: "update_status",
            reportId: selectedReport.id,
            status: "resolved",
            resolutionNotes: resolutionNotes || "Resolved — fix confirmation email sent to user.",
          },
        });
        if (statusError) throw statusError;
        toast.success("✅ Email sent & bug marked resolved", {
          description: `${selectedReport.user_email} has been notified.`,
        });
        fetchReports();
        setEmailOpen(false);
        setDetailOpen(false);
        setSelectedReport(null);
      } else {
        toast.success("Email sent successfully");
        setEmailOpen(false);
      }
      setSelectedTemplate("");
      setCustomMessage("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
    }
    setActionLoading(null);
  };

  const handleRefund = async () => {
    if (!selectedReport) return;
    
    setActionLoading("refund");
    try {
      const { data, error } = await supabase.functions.invoke("manage-bug-report", {
        body: { 
          action: "refund", 
          reportId: selectedReport.id,
          refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
          resolutionNotes
        }
      });
      if (error) throw error;
      toast.success(data.message || "Refund processed");
      fetchReports();
      setRefundAmount("");
    } catch (error: any) {
      toast.error(error.message || "Failed to process refund");
    }
    setActionLoading(null);
  };

  const handleCancelSubscription = async () => {
    if (!selectedReport) return;
    
    setActionLoading("cancel");
    try {
      const { data, error } = await supabase.functions.invoke("manage-bug-report", {
        body: { 
          action: "cancel_subscription", 
          reportId: selectedReport.id,
          resolutionNotes
        }
      });
      if (error) throw error;
      toast.success(data.message || "Subscription cancelled");
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel subscription");
    }
    setActionLoading(null);
  };

  const handleGiveCredit = async (months: number) => {
    if (!selectedReport) return;
    
    setActionLoading("credit");
    try {
      const { data, error } = await supabase.functions.invoke("manage-bug-report", {
        body: { 
          action: "give_credit", 
          reportId: selectedReport.id,
          creditMonths: months,
          resolutionNotes
        }
      });
      if (error) throw error;
      toast.success(data.message || "Credit applied");
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || "Failed to apply credit");
    }
    setActionLoading(null);
  };

  const buildLovablePrompt = (report: BugReport) => {
    return `Please fix this bug reported by a user:

**User's description:**
${report.details || '(none provided)'}

**Reported by:** ${report.user_email}
**Page:** ${report.current_page || 'unknown'}
**URL:** ${report.current_url || 'unknown'}
**User agent:** ${report.user_agent || 'unknown'}
${report.screenshot_url ? `**Screenshot:** ${report.screenshot_url}` : ''}

**Recent chat / app context:**
${report.conversation_context || '(none captured)'}

**Additional context:**
${report.context || '(none)'}

Please investigate the root cause, propose a fix, and implement it.`;
  };

  const handleFixInCode = (report: BugReport) => {
    setFixPromptText(buildLovablePrompt(report));
    setFixPromptOpen(true);
    if (report.status === 'new') {
      handleUpdateStatus(report.id, 'in_progress');
    }
  };

  const handleCopyFixPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fixPromptText);
      toast.success("Prompt copied — paste it into Lovable");
    } catch {
      toast.error("Couldn't copy automatically. Select the text and copy manually.");
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.current_page?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    
    // Hide closed/resolved reports unless explicitly showing them
    const isClosedOrResolved = report.status === 'closed' || report.status === 'resolved';
    const passesClosedFilter = !hideClosedResolved || !isClosedOrResolved || statusFilter === 'closed' || statusFilter === 'resolved';
    
    return matchesSearch && matchesStatus && passesClosedFilter;
  });
  
  const closedResolvedCount = reports.filter(r => r.status === 'closed' || r.status === 'resolved').length;
  const activeCount = reports.length - closedResolvedCount;

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return (
      <Badge variant="outline" className="gap-1">
        <span className={`w-2 h-2 rounded-full ${option?.color || 'bg-gray-400'}`} />
        {option?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'text-gray-500',
      normal: 'text-blue-500',
      high: 'text-orange-500',
      critical: 'text-red-500',
    };
    return (
      <Badge variant="secondary" className={colors[priority] || ''}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  // Helper to detect if a report has credits or refunds applied
  const getCompensationBadges = (resolutionNotes: string | null) => {
    if (!resolutionNotes) return null;
    
    const badges: React.ReactNode[] = [];
    
    // Check for credit applied
    const creditMatch = resolutionNotes.match(/(\d+)\s*month\(s\)\s*credit\s*applied\s*\(\$([0-9.]+)\)/i);
    if (creditMatch) {
      badges.push(
        <Badge key="credit" variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
          <Gift className="h-3 w-3" />
          ${creditMatch[2]} credit
        </Badge>
      );
    }
    
    // Check for refund issued
    const refundMatch = resolutionNotes.match(/Refund\s*issued:\s*\$([0-9.]+)/i);
    if (refundMatch) {
      badges.push(
        <Badge key="refund" variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
          <DollarSign className="h-3 w-3" />
          ${refundMatch[1]} refund
        </Badge>
      );
    }
    
    // Check for subscription cancellation
    if (resolutionNotes.toLowerCase().includes('subscription set to cancel')) {
      badges.push(
        <Badge key="cancelled" variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    }
    
    return badges.length > 0 ? badges : null;
  };

  const openDetail = (report: BugReport) => {
    setSelectedReport(report);
    setResolutionNotes(report.resolution_notes || "");
    setDetailOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        <AdminTabs />
        
        <div className="mt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bug className="h-6 w-6 text-destructive" />
              <h1 className="text-2xl font-display font-semibold">Bug Reports</h1>
              <Badge variant="secondary">{activeCount} active</Badge>
              {closedResolvedCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Archive className="h-3 w-3 mr-1" />
                  {closedResolvedCount} closed
                </Badge>
              )}
            </div>
            <Button onClick={fetchReports} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, details, or page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background">
              <Switch
                id="hide-closed"
                checked={hideClosedResolved}
                onCheckedChange={setHideClosedResolved}
              />
              <Label htmlFor="hide-closed" className="text-sm whitespace-nowrap cursor-pointer">
                Hide closed
              </Label>
            </div>
          </div>

          {/* Reports List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No bug reports found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredReports.map(report => (
                <Card 
                  key={report.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => openDetail(report)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {getStatusBadge(report.status)}
                          {getPriorityBadge(report.priority)}
                          {getCompensationBadges(report.resolution_notes)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="font-medium truncate">{report.user_email}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {report.current_page || 'Unknown page'} — {report.details?.substring(0, 100) || 'No details provided'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.screenshot_url && (
                          <Badge variant="outline" className="gap-1">
                            <Eye className="h-3 w-3" /> Screenshot
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-4xl h-[90dvh] overflow-hidden flex flex-col min-h-0 p-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Bug Report Details
              </DialogTitle>
              <DialogDescription>
                {selectedReport?.user_email} — {selectedReport?.created_at && format(new Date(selectedReport.created_at), 'PPpp')}
              </DialogDescription>
            </DialogHeader>

            {selectedReport && (
              <Tabs defaultValue="details" className="flex-1 min-h-0 overflow-hidden flex flex-col px-6 pb-6">
                <TabsList className="w-full justify-start shrink-0">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                  <TabsTrigger value="billing">Billing Actions</TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2">
                  <TabsContent value="details" className="space-y-4 pr-4">
                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Status</Label>
                        <Select 
                          value={selectedReport.status} 
                          onValueChange={(v) => handleUpdateStatus(selectedReport.id, v)}
                          disabled={actionLoading?.startsWith('status')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Select 
                          value={selectedReport.priority} 
                          onValueChange={(v) => handleUpdatePriority(selectedReport.id, v)}
                          disabled={actionLoading?.startsWith('priority')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* User Details */}
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">User Email</span>
                        <a href={`mailto:${selectedReport.user_email}`} className="text-sm text-primary hover:underline">
                          {selectedReport.user_email}
                        </a>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Page</span>
                        <code className="text-xs bg-background px-2 py-1 rounded">
                          {selectedReport.current_page || 'Unknown'}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Context</span>
                        <span className="text-sm text-muted-foreground">{selectedReport.context || 'N/A'}</span>
                      </div>
                      {selectedReport.current_url && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Full URL</span>
                          <a 
                            href={selectedReport.current_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {selectedReport.details && (
                      <div>
                        <Label>User's Description</Label>
                        <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                          {selectedReport.details}
                        </div>
                      </div>
                    )}

                    {/* Screenshot */}
                    {selectedReport.screenshot_url && (
                      <div>
                        <Label>Screenshot</Label>
                        <div className="mt-2">
                          <a href={selectedReport.screenshot_url} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={selectedReport.screenshot_url} 
                              alt="Bug screenshot" 
                              className="max-w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                            />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Conversation Context */}
                    {selectedReport.conversation_context && (
                      <div>
                        <Label>Recent Chat Context</Label>
                        <pre className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap text-xs overflow-auto max-h-48">
                          {selectedReport.conversation_context}
                        </pre>
                      </div>
                    )}

                    {/* Resolution Notes */}
                    <div>
                      <Label>Resolution Notes</Label>
                      <Textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Add internal notes about how this was resolved..."
                        rows={3}
                        className="mt-2"
                      />
                      <Button 
                        size="sm" 
                        className="mt-2"
                        onClick={() => handleUpdateStatus(selectedReport.id, selectedReport.status)}
                        disabled={actionLoading !== null}
                      >
                        Save Notes
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="actions" className="space-y-4 pr-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Send Email to User
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Email Template</Label>
                          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select a template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {EMAIL_TEMPLATES.map(template => (
                                <SelectItem key={template.value} value={template.value}>
                                  <div>
                                    <span>{template.label}</span>
                                    <p className="text-xs text-muted-foreground">{template.description}</p>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Custom Message (optional)</Label>
                          <Textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder="Add a personalized message..."
                            rows={4}
                            className="mt-2"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            If a template is selected, this will be added below the template text.
                          </p>
                        </div>

                        <Button 
                          onClick={handleSendEmail}
                          disabled={actionLoading === "email" || (!selectedTemplate && !customMessage.trim())}
                          className="w-full gap-2"
                        >
                          {actionLoading === "email" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Send Email
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Fix in Lovable */}
                    <Card className="border-purple-200">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 text-purple-600">
                          <Sparkles className="h-4 w-4" />
                          Fix it in the Code
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          Opens a pop-up with a fully formatted fix prompt (bug details, page URL, screenshot link, and chat context). Copy it and paste straight into Lovable.
                        </p>
                        <Button
                          onClick={() => handleFixInCode(selectedReport)}
                          disabled={actionLoading === "fix-in-code"}
                          className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {actionLoading === "fix-in-code" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          Fix it in the Code
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Quick Status Actions */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Quick Status Updates</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateStatus(selectedReport.id, 'in_progress')}
                          disabled={actionLoading !== null}
                          className="gap-1"
                        >
                          <Clock className="h-3 w-3" /> Mark In Progress
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateStatus(selectedReport.id, 'waiting_for_user')}
                          disabled={actionLoading !== null}
                          className="gap-1"
                        >
                          <AlertCircle className="h-3 w-3" /> Waiting for User
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                          disabled={actionLoading !== null}
                          className="gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Mark Resolved
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="billing" className="space-y-4 pr-4">
                    <Card className="border-orange-200">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 text-orange-600">
                          <DollarSign className="h-4 w-4" />
                          Issue Refund
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Refund Amount (optional)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Leave empty for full refund"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="mt-2"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter a specific amount or leave empty for a full refund of the last payment.
                          </p>
                        </div>
                        <Button 
                          variant="outline"
                          onClick={handleRefund}
                          disabled={actionLoading === "refund"}
                          className="w-full gap-2 border-orange-300 hover:bg-orange-50"
                        >
                          {actionLoading === "refund" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <DollarSign className="h-4 w-4" />
                          )}
                          Process Refund
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-red-200">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Cancel Subscription
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          This will cancel the user's subscription at the end of their current billing period.
                        </p>
                        <Button 
                          variant="outline"
                          onClick={handleCancelSubscription}
                          disabled={actionLoading === "cancel"}
                          className="w-full gap-2 border-red-300 hover:bg-red-50 text-red-600"
                        >
                          {actionLoading === "cancel" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          Cancel Subscription
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-green-200">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 text-green-600">
                          <Gift className="h-4 w-4" />
                          Give Free Credit
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          Extend the user's subscription by adding free months.
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => handleGiveCredit(1)}
                            disabled={actionLoading === "credit"}
                            className="flex-1 gap-2 border-green-300 hover:bg-green-50"
                          >
                            {actionLoading === "credit" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Gift className="h-4 w-4" />
                            )}
                            +1 Month
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleGiveCredit(2)}
                            disabled={actionLoading === "credit"}
                            className="flex-1 gap-2 border-green-300 hover:bg-green-50"
                          >
                            +2 Months
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleGiveCredit(3)}
                            disabled={actionLoading === "credit"}
                            className="flex-1 gap-2 border-green-300 hover:bg-green-50"
                          >
                            +3 Months
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Fix-in-Code Prompt Dialog */}
        <Dialog open={fixPromptOpen} onOpenChange={setFixPromptOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-purple-600">
                <Sparkles className="h-4 w-4" /> Fix it in the Code
              </DialogTitle>
              <DialogDescription>
                Copy this prompt and paste it into Lovable chat to fix the bug.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={fixPromptText}
              onChange={(e) => setFixPromptText(e.target.value)}
              className="min-h-[360px] font-mono text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFixPromptOpen(false)}>Close</Button>
              <Button onClick={handleCopyFixPrompt} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <Sparkles className="h-4 w-4" /> Copy prompt
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
