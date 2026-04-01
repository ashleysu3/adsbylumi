import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Search, Filter, RefreshCw, Eye, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

const EMAIL_TYPES = [
  { value: "all", label: "All Types" },
  { value: "welcome", label: "Welcome" },
  { value: "weekly_digest", label: "Weekly Digest" },
  { value: "critical_alert", label: "Critical Alert" },
  { value: "cancellation", label: "Cancellation" },
  { value: "partner_approval", label: "Partner Approval" },
  { value: "partner_welcome", label: "Partner Welcome" },
  { value: "beta_feedback_request", label: "Founder Feedback" },
  { value: "onboarding_drip", label: "Onboarding Drip" },
  { value: "bug_report", label: "Bug Report" },
  { value: "client_report", label: "Client Report" },
  { value: "portal_notification", label: "Portal Notification" },
  { value: "optimization_digest", label: "Optimization Digest" },
];

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  sent: { icon: CheckCircle2, color: "text-green-600", label: "Sent" },
  failed: { icon: AlertCircle, color: "text-destructive", label: "Failed" },
  pending: { icon: Clock, color: "text-yellow-600", label: "Pending" },
};

export default function AdminEmailLogs() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-email-logs", search, typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (search) {
        query = query.or(`recipient_email.ilike.%${search}%,subject.ilike.%${search}%,recipient_name.ilike.%${search}%`);
      }
      if (typeFilter !== "all") {
        query = query.eq("email_type", typeFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const sentCount = logs?.filter(l => l.status === "sent").length || 0;
  const failedCount = logs?.filter(l => l.status === "failed").length || 0;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <AdminTabs />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track every email sent to users and partners.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Emails</p>
                  <p className="text-2xl font-bold">{logs?.length || 0}</p>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold text-green-600">{sentCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-destructive">{failedCount}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        Loading email logs...
                      </TableCell>
                    </TableRow>
                  ) : !logs?.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <Mail className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground">No email logs yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Emails will be logged as they are sent.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any) => {
                      const config = statusConfig[log.status] || statusConfig.sent;
                      const StatusIcon = config.icon;
                      return (
                        <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "MMM d, h:mm a")}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{log.recipient_email}</p>
                              {log.recipient_name && (
                                <p className="text-xs text-muted-foreground">{log.recipient_name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {log.email_type?.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {log.subject}
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 ${config.color}`}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              <span className="text-xs">{config.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.edge_function?.replace(/-/g, " ")}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Email Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Sent</p>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedLog.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className={`flex items-center gap-1 ${(statusConfig[selectedLog.status] || statusConfig.sent).color}`}>
                      <span className="text-sm font-medium capitalize">{selectedLog.status}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Recipient</p>
                  <p className="text-sm font-medium">{selectedLog.recipient_email}</p>
                  {selectedLog.recipient_name && (
                    <p className="text-xs text-muted-foreground">{selectedLog.recipient_name}</p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium">{selectedLog.subject}</p>
                </div>

                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <Badge variant="outline" className="capitalize">
                      {selectedLog.email_type?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {selectedLog.edge_function && (
                    <div>
                      <p className="text-xs text-muted-foreground">Source Function</p>
                      <p className="text-sm">{selectedLog.edge_function}</p>
                    </div>
                  )}
                </div>

                {selectedLog.error_message && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Error</p>
                    <p className="text-sm text-destructive">{selectedLog.error_message}</p>
                  </div>
                )}

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
