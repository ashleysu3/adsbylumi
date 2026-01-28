import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Users, RefreshCw, Search, User, Bug, CreditCard, FileText, 
  MessageSquare, Send, DollarSign, XCircle, Gift, Mail, 
  Building2, Calendar as CalendarIcon, Globe, Loader2, Plus, Trash2,
  Filter, History, X, Activity, Rocket, Package, UserPlus, AlertCircle,
  Eye, AlertTriangle, UserX
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useImpersonation } from "@/contexts/ImpersonationContext";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  subscription?: {
    tier: string;
    status: string;
    stripe_subscription_id?: string;
    current_period_end?: string;
  } | null;
}

interface UserDetails {
  profile: Profile | null;
  brand: any;
  subscription: any;
  bugReports: any[];
  adminNotes: any[];
  campaigns: any[];
  stripeInfo: {
    customer: any;
    subscriptions: any[];
    payments: any[];
    invoices: any[];
  } | null;
}

interface UserActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface AuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string | null;
  target_user_email: string | null;
  action: string;
  action_category: string;
  details: Record<string, any>;
  created_at: string;
}

interface Filters {
  subscriptionStatus: string;
  planTier: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

const tierDisplayNames: Record<string, string> = {
  starter: "Solo",
  growth: "Creator",
  agency_pro: "Agency",
};

const EMAIL_TEMPLATES = [
  { value: "welcome", label: "👋 Welcome", description: "Welcome new user" },
  { value: "credit_applied", label: "🎁 Credit Applied", description: "Confirm credit added" },
  { value: "refund_processed", label: "💰 Refund Processed", description: "Confirm refund" },
  { value: "subscription_cancelled", label: "❌ Subscription Cancelled", description: "Confirm cancellation" },
  { value: "follow_up", label: "💬 Follow Up", description: "General follow up" },
  { value: "custom", label: "✍️ Custom", description: "Write custom message" },
];

const CATEGORY_COLORS: Record<string, string> = {
  billing: "bg-green-500/10 text-green-600 border-green-500/20",
  subscription: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  communication: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const ACTIVITY_ICONS: Record<string, { icon: any; color: string }> = {
  signup: { icon: UserPlus, color: "text-green-500 bg-green-500/10" },
  brand: { icon: Building2, color: "text-blue-500 bg-blue-500/10" },
  campaign: { icon: Rocket, color: "text-purple-500 bg-purple-500/10" },
  campaign_published: { icon: Send, color: "text-primary bg-primary/10" },
  offer: { icon: Package, color: "text-orange-500 bg-orange-500/10" },
  subscription: { icon: CreditCard, color: "text-emerald-500 bg-emerald-500/10" },
  bug_report: { icon: AlertCircle, color: "text-red-500 bg-red-500/10" },
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { startImpersonation, isImpersonating, impersonatedUser } = useImpersonation();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<Filters>({
    subscriptionStatus: "",
    planTier: "",
    dateFrom: undefined,
    dateTo: undefined,
  });
  
  // Form states
  const [refundAmount, setRefundAmount] = useState("");
  const [newNote, setNewNote] = useState("");
  const [noteCategory, setNoteCategory] = useState("general");
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("");
  const [customEmailMessage, setCustomEmailMessage] = useState("");
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

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

    setIsAdmin(true);
    fetchUsers();
  };

  const fetchUsers = async () => {
    setLoading(true);
    
    // Build filter object
    const filterObj: Record<string, string> = {};
    if (filters.subscriptionStatus) filterObj.subscriptionStatus = filters.subscriptionStatus;
    if (filters.planTier) filterObj.planTier = filters.planTier;
    if (filters.dateFrom) filterObj.dateFrom = filters.dateFrom.toISOString();
    if (filters.dateTo) filterObj.dateTo = filters.dateTo.toISOString();
    
    const hasFilters = Object.keys(filterObj).length > 0;
    
    if (hasFilters) {
      // Use edge function for filtered queries
      try {
        const { data, error } = await supabase.functions.invoke("admin-user-management", {
          body: { action: "list_users", filters: filterObj },
        });
        if (error) throw error;
        setUsers(data.users || []);
      } catch (error) {
        toast.error("Failed to load users");
        console.error(error);
      }
    } else {
      // Simple query for unfiltered
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load users");
        console.error(error);
      } else {
        setUsers(data || []);
      }
    }
    setLoading(false);
  };
  
  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "get_audit_logs" },
      });
      if (error) throw error;
      setAuditLogs(data.logs || []);
    } catch (error) {
      toast.error("Failed to load audit logs");
      console.error(error);
    }
    setAuditLogsLoading(false);
  };
  
  useEffect(() => {
    if (activeTab === "audit" && auditLogs.length === 0) {
      fetchAuditLogs();
    }
  }, [activeTab]);
  
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [filters]);
  
  const clearFilters = () => {
    setFilters({
      subscriptionStatus: "",
      planTier: "",
      dateFrom: undefined,
      dateTo: undefined,
    });
  };
  
  const hasActiveFilters = filters.subscriptionStatus || filters.planTier || filters.dateFrom || filters.dateTo;

  const fetchUserDetails = async (user: Profile) => {
    setSelectedUser(user);
    setDetailOpen(true);
    setDetailsLoading(true);
    setUserDetails(null);
    setUserActivity([]);

    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "get_user_details", userId: user.id },
      });

      if (error) throw error;
      setUserDetails(data);
      
      // Fetch activity in parallel
      fetchUserActivity(user.id);
    } catch (error: any) {
      toast.error("Failed to load user details");
      console.error(error);
    }
    setDetailsLoading(false);
  };
  
  const fetchUserActivity = async (userId: string) => {
    setActivityLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "get_user_activity", userId },
      });
      if (error) throw error;
      setUserActivity(data.activities || []);
    } catch (error: any) {
      console.error("Failed to load activity:", error);
    }
    setActivityLoading(false);
  };

  const handleRefund = async () => {
    if (!selectedUser || !userDetails?.profile?.email) return;
    
    setActionLoading("refund");
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { 
          action: "refund", 
          userId: selectedUser.id,
          userEmail: userDetails.profile.email,
          refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
        },
      });
      if (error) throw error;
      toast.success(data.message);
      setRefundAmount("");
      fetchUserDetails(selectedUser);
    } catch (error: any) {
      toast.error(error.message || "Failed to process refund");
    }
    setActionLoading(null);
  };

  const handleCancelSubscription = async () => {
    if (!selectedUser || !userDetails?.profile?.email) return;
    
    setActionLoading("cancel");
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { 
          action: "cancel_subscription", 
          userId: selectedUser.id,
          userEmail: userDetails.profile.email,
        },
      });
      if (error) throw error;
      toast.success(data.message);
      fetchUserDetails(selectedUser);
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel subscription");
    }
    setActionLoading(null);
  };

  const handleGiveCredit = async (months: number) => {
    if (!selectedUser || !userDetails?.profile?.email) return;
    
    setActionLoading("credit");
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { 
          action: "give_credit", 
          userId: selectedUser.id,
          userEmail: userDetails.profile.email,
          creditMonths: months,
        },
      });
      if (error) throw error;
      toast.success(data.message);
      fetchUserDetails(selectedUser);
    } catch (error: any) {
      toast.error(error.message || "Failed to apply credit");
    }
    setActionLoading(null);
  };

  const handleSendEmail = async () => {
    if (!selectedUser || !userDetails?.profile?.email || !selectedEmailTemplate) return;
    
    setActionLoading("email");
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { 
          action: "send_email", 
          userEmail: userDetails.profile.email,
          emailTemplate: selectedEmailTemplate,
          customMessage: customEmailMessage,
        },
      });
      if (error) throw error;
      toast.success(data.message);
      setSelectedEmailTemplate("");
      setCustomEmailMessage("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
    }
    setActionLoading(null);
  };

  const handleAddNote = async () => {
    if (!selectedUser || !newNote.trim()) return;
    
    setActionLoading("note");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("admin_notes")
        .insert({
          user_id: selectedUser.id,
          admin_id: user?.id,
          note: newNote.trim(),
          category: noteCategory,
        });

      if (error) throw error;
      toast.success("Note added");
      setNewNote("");
      fetchUserDetails(selectedUser);
    } catch (error: any) {
      toast.error(error.message || "Failed to add note");
    }
    setActionLoading(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("admin_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Note deleted");
      if (selectedUser) fetchUserDetails(selectedUser);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete note");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || !userDetails?.profile?.email) return;
    
    // Require typing the exact email to confirm
    if (deleteConfirmEmail !== userDetails.profile.email) {
      toast.error("Please type the exact email to confirm deletion");
      return;
    }
    
    setActionLoading("delete");
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { 
          action: "delete_user", 
          userId: selectedUser.id,
          userEmail: userDetails.profile.email,
        },
      });
      if (error) throw error;
      toast.success(data.message);
      setDetailOpen(false);
      setSelectedUser(null);
      setUserDetails(null);
      setDeleteConfirmEmail("");
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    }
    setActionLoading(null);
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-1">
              View and manage user accounts, subscriptions, and support history
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveTab(activeTab === "users" ? "audit" : "users")}>
              {activeTab === "users" ? (
                <><History className="w-4 h-4 mr-2" />Audit Log</>
              ) : (
                <><Users className="w-4 h-4 mr-2" />Users</>
              )}
            </Button>
            <Button variant="outline" onClick={activeTab === "users" ? fetchUsers : fetchAuditLogs} disabled={loading || auditLogsLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${(loading || auditLogsLoading) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {activeTab === "users" ? (
          <>
            {/* Filters */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-1">Active</Badge>
                    )}
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardHeader>
              {showFilters && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Subscription Status Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subscription Status</label>
                      <Select
                        value={filters.subscriptionStatus}
                        onValueChange={(value) => setFilters(f => ({ ...f, subscriptionStatus: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="none">No subscription</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Plan Tier Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Plan Tier</label>
                      <Select
                        value={filters.planTier}
                        onValueChange={(value) => setFilters(f => ({ ...f, planTier: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any tier</SelectItem>
                          <SelectItem value="starter">Solo</SelectItem>
                          <SelectItem value="growth">Creator</SelectItem>
                          <SelectItem value="agency_pro">Agency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date From Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Joined From</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !filters.dateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateFrom ? format(filters.dateFrom, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateFrom}
                            onSelect={(date) => setFilters(f => ({ ...f, dateFrom: date }))}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Date To Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Joined To</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !filters.dateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateTo ? format(filters.dateTo, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateTo}
                            onSelect={(date) => setFilters(f => ({ ...f, dateTo: date }))}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Users Table */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      All Users
                    </CardTitle>
                    <CardDescription>
                      {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} {hasActiveFilters ? "matching filters" : "total"}
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchUserDetails(user)}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>{user.full_name || "—"}</TableCell>
                            <TableCell>
                              {user.subscription ? (
                                <Badge variant="outline">
                                  {tierDisplayNames[user.subscription.tier] || user.subscription.tier}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.subscription ? (
                                <Badge variant={user.subscription.status === "active" ? "default" : "secondary"}>
                                  {user.subscription.status}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">None</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(user.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fetchUserDetails(user); }}>
                                <User className="w-4 h-4 mr-2" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          /* Audit Logs Tab */
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Admin Audit Log
              </CardTitle>
              <CardDescription>
                Track all admin actions for accountability
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading audit logs...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No audit logs yet
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 border border-border rounded-lg bg-muted/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={CATEGORY_COLORS[log.action_category] || ""}
                            >
                              {log.action_category}
                            </Badge>
                            <span className="font-medium">{log.action}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">{log.admin_email}</span>
                            {log.target_user_email && (
                              <> → <span className="font-medium">{log.target_user_email}</span></>
                            )}
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
                              {Object.entries(log.details).map(([key, value]) => (
                                <div key={key}>
                                  {key}: {JSON.stringify(value)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Details Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">{selectedUser?.email}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {selectedUser?.full_name || "No name"} — Joined {selectedUser && format(new Date(selectedUser.created_at), "PPP")}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : userDetails && (
            <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
              {/* Mobile: scrollable horizontal tabs, Desktop: grid */}
              <TabsList className="flex sm:grid sm:grid-cols-6 w-full overflow-x-auto gap-1 h-auto p-1">
                <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">Overview</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">Activity</TabsTrigger>
                <TabsTrigger value="bugs" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">Bugs ({userDetails.bugReports.length})</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">Notes ({userDetails.adminNotes.length})</TabsTrigger>
                <TabsTrigger value="billing" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">Billing</TabsTrigger>
                <TabsTrigger value="actions" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">Actions</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-3 sm:mt-4">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {/* Profile Card */}
                    <Card>
                      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <User className="w-4 h-4" /> Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Email</span>
                          <span className="truncate text-right max-w-[180px]">{userDetails.profile?.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span>{userDetails.profile?.full_name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">User ID</span>
                          <span className="font-mono text-xs">{userDetails.profile?.id?.slice(0, 8)}...</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Brand Card */}
                    <Card>
                      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> Brand
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                        {userDetails.brand ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Name</span>
                              <span className="truncate max-w-[120px]">{userDetails.brand.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Industry</span>
                              <span>{userDetails.brand.industry || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Website</span>
                              <span className="truncate max-w-[120px]">{userDetails.brand.website_url || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Meta Connected</span>
                              <Badge variant={userDetails.brand.meta_account_id ? "default" : "secondary"} className="text-xs">
                                {userDetails.brand.meta_account_id ? "Yes" : "No"}
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <p className="text-muted-foreground">No brand created</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Subscription Card */}
                    <Card>
                      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> Subscription
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                        {userDetails.subscription ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Plan</span>
                              <Badge className="text-xs">{tierDisplayNames[userDetails.subscription.tier] || userDetails.subscription.tier}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status</span>
                              <Badge variant={userDetails.subscription.status === "active" ? "default" : "secondary"} className="text-xs">
                                {userDetails.subscription.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Type</span>
                              <Badge variant="outline" className="text-xs">
                                {userDetails.subscription.stripe_subscription_id ? "Stripe" : "Code-Based"}
                              </Badge>
                            </div>
                            {userDetails.subscription.current_period_end && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Renews</span>
                                <span>{format(new Date(userDetails.subscription.current_period_end), "MMM d, yyyy")}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-muted-foreground">No subscription</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Campaigns Card */}
                    <Card>
                      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Recent Campaigns
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                        {userDetails.campaigns.length > 0 ? (
                          userDetails.campaigns.slice(0, 5).map((campaign: any) => (
                            <div key={campaign.id} className="flex justify-between items-center gap-2">
                              <span className="truncate max-w-[120px]">{campaign.name}</span>
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {campaign.progress_status}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground">No campaigns</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Activity Timeline Tab */}
                <TabsContent value="activity" className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  {activityLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading activity...
                    </div>
                  ) : userActivity.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No activity recorded for this user
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-4 sm:left-5 top-0 bottom-0 w-px bg-border" />
                      
                      <div className="space-y-3 sm:space-y-4">
                        {userActivity.map((activity, index) => {
                          const activityConfig = ACTIVITY_ICONS[activity.type] || { 
                            icon: Activity, 
                            color: "text-muted-foreground bg-muted" 
                          };
                          const IconComponent = activityConfig.icon;
                          
                          return (
                            <div key={activity.id} className="relative flex gap-2 sm:gap-4 pb-2">
                              {/* Icon */}
                              <div className={cn(
                                "relative z-10 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0",
                                activityConfig.color
                              )}>
                                <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 pt-0.5 sm:pt-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
                                  <div className="min-w-0">
                                    <p className="font-medium text-xs sm:text-sm truncate">{activity.title}</p>
                                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
                                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                      <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                                        {Object.entries(activity.metadata).map(([key, value]) => (
                                          <Badge key={key} variant="outline" className="text-xs">
                                            {key}: {String(value)}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                    {format(new Date(activity.timestamp), "MMM d, yyyy")}
                                    <span className="hidden sm:inline">
                                      <br />
                                      <span className="text-xs opacity-70">
                                        {format(new Date(activity.timestamp), "h:mm a")}
                                      </span>
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Bug Reports Tab */}
                <TabsContent value="bugs" className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  {userDetails.bugReports.length === 0 ? (
                    <Card>
                      <CardContent className="py-6 sm:py-8 text-center text-muted-foreground">
                        <Bug className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                        No bug reports from this user
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {userDetails.bugReports.map((bug: any) => (
                        <Card key={bug.id}>
                          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-4">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <Badge variant={
                                  bug.status === "resolved" ? "default" :
                                  bug.status === "in_progress" ? "secondary" : "outline"
                                } className="text-xs">
                                  {bug.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">{bug.priority}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(bug.created_at), "MMM d, yyyy")}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm">{bug.details}</p>
                              {bug.current_page && (
                                <p className="text-xs text-muted-foreground">
                                  Page: {bug.current_page}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-sm">Add Note</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select value={noteCategory} onValueChange={setNoteCategory}>
                          <SelectTrigger className="w-full sm:w-32 h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="feedback">Feedback</SelectItem>
                            <SelectItem value="technical">Technical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea 
                          placeholder="Add a note about this user..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="flex-1 min-h-[80px] text-sm"
                        />
                      </div>
                      <Button 
                        onClick={handleAddNote} 
                        disabled={!newNote.trim() || actionLoading === "note"}
                        className="w-full h-10 sm:h-11"
                      >
                        {actionLoading === "note" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Add Note
                      </Button>
                    </CardContent>
                  </Card>

                  {userDetails.adminNotes.length === 0 ? (
                    <Card>
                      <CardContent className="py-6 sm:py-8 text-center text-muted-foreground">
                        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                        No notes yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {userDetails.adminNotes.map((note: any) => (
                        <Card key={note.id}>
                          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">{note.category}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(note.created_at), "MMM d, yyyy")}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm whitespace-pre-wrap">{note.note}</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing" className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  {userDetails.stripeInfo?.customer ? (
                    <>
                      {/* Stripe Customer Info */}
                      <Card>
                        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CreditCard className="w-4 h-4" /> Stripe Customer
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Customer ID</span>
                            <span className="font-mono text-xs truncate max-w-[140px]">{userDetails.stripeInfo.customer.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Balance</span>
                            <span className={userDetails.stripeInfo.customer.balance < 0 ? "text-green-600" : ""}>
                              ${(Math.abs(userDetails.stripeInfo.customer.balance) / 100).toFixed(2)}
                              {userDetails.stripeInfo.customer.balance < 0 ? " credit" : ""}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{format(new Date(userDetails.stripeInfo.customer.created * 1000), "MMM d, yyyy")}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Stripe Subscriptions */}
                      <Card>
                        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-sm">Stripe Subscriptions</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                          {userDetails.stripeInfo.subscriptions.length === 0 ? (
                            <p className="text-muted-foreground text-xs sm:text-sm">No subscriptions</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.stripeInfo.subscriptions.map((sub: any) => (
                                <div key={sub.id} className="p-2 sm:p-3 bg-muted/50 rounded-lg text-xs sm:text-sm">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-mono text-xs truncate max-w-[120px]">{sub.id}</span>
                                    <Badge variant={sub.status === "active" ? "default" : "secondary"} className="text-xs">
                                      {sub.status}
                                    </Badge>
                                  </div>
                                  {sub.plan && (
                                    <div className="text-muted-foreground">
                                      ${(sub.plan.amount / 100).toFixed(2)}/{sub.plan.interval}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(sub.current_period_start * 1000), "MMM d")} - {format(new Date(sub.current_period_end * 1000), "MMM d, yyyy")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Recent Payments */}
                      <Card>
                        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-sm">Recent Payments</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                          {userDetails.stripeInfo.payments.length === 0 ? (
                            <p className="text-muted-foreground text-xs sm:text-sm">No payments</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.stripeInfo.payments.slice(0, 5).map((payment: any) => (
                                <div key={payment.id} className="flex items-center justify-between text-xs sm:text-sm p-2 bg-muted/30 rounded gap-2">
                                  <div className="min-w-0">
                                    <span className="font-medium">${(payment.amount / 100).toFixed(2)}</span>
                                    <span className="text-muted-foreground ml-1 sm:ml-2 text-xs">
                                      {format(new Date(payment.created * 1000), "MMM d")}
                                    </span>
                                  </div>
                                  <Badge variant={payment.status === "succeeded" ? "default" : "secondary"} className="text-xs">
                                    {payment.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Recent Invoices */}
                      <Card>
                        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-sm">Recent Invoices</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                          {userDetails.stripeInfo.invoices.length === 0 ? (
                            <p className="text-muted-foreground text-xs sm:text-sm">No invoices</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.stripeInfo.invoices.slice(0, 5).map((invoice: any) => (
                                <div key={invoice.id} className="flex items-center justify-between text-xs sm:text-sm p-2 bg-muted/30 rounded gap-2">
                                  <div className="min-w-0 truncate">
                                    <span className="font-medium">{invoice.number || "Draft"}</span>
                                    <span className="text-muted-foreground ml-1 sm:ml-2">
                                      ${(invoice.amount_due / 100).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                    <Badge variant={invoice.status === "paid" ? "default" : "secondary"} className="text-xs">
                                      {invoice.status}
                                    </Badge>
                                    {invoice.hosted_invoice_url && (
                                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                          <Globe className="w-3 h-3" />
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="py-6 sm:py-8 text-center text-muted-foreground">
                        <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                        No Stripe customer found for this user
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Actions Tab */}
                <TabsContent value="actions" className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  {/* Impersonation */}
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4" /> View As User
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                        Impersonate this user to see the app from their perspective. Useful for debugging issues they report.
                      </p>
                      {isImpersonating && impersonatedUser?.id === selectedUser?.id ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                          Currently impersonating this user
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10 h-10 sm:h-11"
                          onClick={() => {
                            if (selectedUser && userDetails?.profile) {
                              startImpersonation({
                                id: selectedUser.id,
                                email: userDetails.profile.email,
                                fullName: userDetails.profile.full_name,
                              });
                              setDetailOpen(false);
                              toast.success(`Now viewing as ${userDetails.profile.email}`);
                              navigate("/dashboard");
                            }
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Start Impersonating
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Email Actions */}
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Send Email
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
                      <Select value={selectedEmailTemplate} onValueChange={setSelectedEmailTemplate}>
                        <SelectTrigger className="h-10 sm:h-11 text-sm">
                          <SelectValue placeholder="Select email template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {EMAIL_TEMPLATES.map((template) => (
                            <SelectItem key={template.value} value={template.value}>
                              {template.label} — {template.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedEmailTemplate === "custom" && (
                        <Textarea
                          placeholder="Enter your custom message..."
                          value={customEmailMessage}
                          onChange={(e) => setCustomEmailMessage(e.target.value)}
                          className="min-h-[100px] text-sm"
                        />
                      )}

                      <Button 
                        onClick={handleSendEmail}
                        disabled={!selectedEmailTemplate || actionLoading === "email"}
                        className="w-full h-10 sm:h-11"
                      >
                        {actionLoading === "email" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Send Email
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Billing Actions */}
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Billing Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                      {/* Give Credit */}
                      <div className="space-y-2">
                        <p className="text-xs sm:text-sm font-medium">Give Credit</p>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3].map((months) => (
                            <Button
                              key={months}
                              variant="outline"
                              size="sm"
                              onClick={() => handleGiveCredit(months)}
                              disabled={actionLoading === "credit"}
                              className="h-9 sm:h-10 text-xs sm:text-sm flex-1 min-w-[80px]"
                            >
                              <Gift className="w-3 h-3 mr-1" />
                              {months} month{months > 1 ? "s" : ""}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Process Refund */}
                      <div className="space-y-2">
                        <p className="text-xs sm:text-sm font-medium">Process Refund</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            type="number"
                            placeholder="Amount (leave empty for full)"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="flex-1 h-10 sm:h-11 text-sm"
                          />
                          <Button
                            variant="outline"
                            onClick={handleRefund}
                            disabled={actionLoading === "refund"}
                            className="h-10 sm:h-11 w-full sm:w-auto"
                          >
                            {actionLoading === "refund" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                            Refund
                          </Button>
                        </div>
                      </div>

                      {/* Cancel Subscription */}
                      <div className="space-y-2">
                        <p className="text-xs sm:text-sm font-medium">Subscription Management</p>
                        <Button
                          variant="destructive"
                          onClick={handleCancelSubscription}
                          disabled={actionLoading === "cancel"}
                          className="w-full h-10 sm:h-11"
                        >
                          {actionLoading === "cancel" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                          Cancel Subscription
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Danger Zone - Delete Account */}
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4" /> Danger Zone
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                      <div className="space-y-3">
                        <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                          <p className="text-xs sm:text-sm font-medium text-destructive mb-1">
                            Delete User Account
                          </p>
                          <p className="text-xs text-muted-foreground mb-3">
                            This will permanently delete the user's account, cancel any active Stripe subscriptions, and remove all associated data (brands, campaigns, etc.). This action cannot be undone.
                          </p>
                          <div className="space-y-2">
                            <Input
                              type="text"
                              placeholder={`Type "${userDetails?.profile?.email}" to confirm`}
                              value={deleteConfirmEmail}
                              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                              className="h-10 text-sm bg-background"
                            />
                            <Button
                              variant="destructive"
                              onClick={handleDeleteUser}
                              disabled={actionLoading === "delete" || deleteConfirmEmail !== userDetails?.profile?.email}
                              className="w-full h-10 sm:h-11"
                            >
                              {actionLoading === "delete" ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <UserX className="w-4 h-4 mr-2" />
                              )}
                              Permanently Delete Account
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
