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
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Users, RefreshCw, Search, User, Bug, CreditCard, FileText, 
  MessageSquare, Send, DollarSign, XCircle, Gift, Mail, 
  Building2, Calendar, Globe, Loader2, Plus, Trash2
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { format } from "date-fns";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
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

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Form states
  const [refundAmount, setRefundAmount] = useState("");
  const [newNote, setNewNote] = useState("");
  const [noteCategory, setNoteCategory] = useState("general");
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("");
  const [customEmailMessage, setCustomEmailMessage] = useState("");

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
    setLoading(false);
  };

  const fetchUserDetails = async (user: Profile) => {
    setSelectedUser(user);
    setDetailOpen(true);
    setDetailsLoading(true);
    setUserDetails(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "get_user_details", userId: user.id },
      });

      if (error) throw error;
      setUserDetails(data);
    } catch (error: any) {
      toast.error("Failed to load user details");
      console.error(error);
    }
    setDetailsLoading(false);
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
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  All Users
                </CardTitle>
                <CardDescription>
                  {users.length} user{users.length !== 1 ? "s" : ""} total
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
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
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
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchUserDetails(user)}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.full_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(user.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fetchUserDetails(user); }}>
                            <User className="w-4 h-4 mr-2" />
                            View Details
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
      </div>

      {/* User Details Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name || "No name"} — Joined {selectedUser && format(new Date(selectedUser.created_at), "PPP")}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : userDetails && (
            <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="bugs">Bugs ({userDetails.bugReports.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes ({userDetails.adminNotes.length})</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Profile Card */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <User className="w-4 h-4" /> Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span>{userDetails.profile?.email}</span>
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
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> Brand
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {userDetails.brand ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Name</span>
                              <span>{userDetails.brand.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Industry</span>
                              <span>{userDetails.brand.industry || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Website</span>
                              <span className="truncate max-w-[150px]">{userDetails.brand.website_url || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Meta Connected</span>
                              <Badge variant={userDetails.brand.meta_account_id ? "default" : "secondary"}>
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
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> Subscription
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {userDetails.subscription ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Plan</span>
                              <Badge>{tierDisplayNames[userDetails.subscription.tier] || userDetails.subscription.tier}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status</span>
                              <Badge variant={userDetails.subscription.status === "active" ? "default" : "secondary"}>
                                {userDetails.subscription.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Type</span>
                              <Badge variant="outline">
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
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Recent Campaigns
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {userDetails.campaigns.length > 0 ? (
                          userDetails.campaigns.slice(0, 5).map((campaign: any) => (
                            <div key={campaign.id} className="flex justify-between items-center">
                              <span className="truncate max-w-[150px]">{campaign.name}</span>
                              <Badge variant="outline" className="text-xs">
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

                {/* Bug Reports Tab */}
                <TabsContent value="bugs" className="space-y-4 pr-4">
                  {userDetails.bugReports.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Bug className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No bug reports from this user
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {userDetails.bugReports.map((bug: any) => (
                        <Card key={bug.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={
                                    bug.status === "resolved" ? "default" :
                                    bug.status === "in_progress" ? "secondary" : "outline"
                                  }>
                                    {bug.status}
                                  </Badge>
                                  <Badge variant="outline">{bug.priority}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(bug.created_at), "MMM d, yyyy h:mm a")}
                                  </span>
                                </div>
                                <p className="text-sm">{bug.details}</p>
                                {bug.current_page && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Page: {bug.current_page}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4 pr-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Add Note</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Select value={noteCategory} onValueChange={setNoteCategory}>
                          <SelectTrigger className="w-32">
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
                          className="flex-1 min-h-[80px]"
                        />
                      </div>
                      <Button 
                        onClick={handleAddNote} 
                        disabled={!newNote.trim() || actionLoading === "note"}
                        className="w-full"
                      >
                        {actionLoading === "note" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Add Note
                      </Button>
                    </CardContent>
                  </Card>

                  {userDetails.adminNotes.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No notes yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {userDetails.adminNotes.map((note: any) => (
                        <Card key={note.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">{note.category}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
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
                <TabsContent value="billing" className="space-y-4 pr-4">
                  {userDetails.stripeInfo?.customer ? (
                    <>
                      {/* Stripe Customer Info */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CreditCard className="w-4 h-4" /> Stripe Customer
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Customer ID</span>
                            <span className="font-mono text-xs">{userDetails.stripeInfo.customer.id}</span>
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
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Stripe Subscriptions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {userDetails.stripeInfo.subscriptions.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No subscriptions</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.stripeInfo.subscriptions.map((sub: any) => (
                                <div key={sub.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-mono text-xs">{sub.id}</span>
                                    <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                                      {sub.status}
                                    </Badge>
                                  </div>
                                  {sub.plan && (
                                    <div className="text-muted-foreground">
                                      ${(sub.plan.amount / 100).toFixed(2)}/{sub.plan.interval}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Current period: {format(new Date(sub.current_period_start * 1000), "MMM d")} - {format(new Date(sub.current_period_end * 1000), "MMM d, yyyy")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Recent Payments */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Recent Payments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {userDetails.stripeInfo.payments.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No payments</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.stripeInfo.payments.slice(0, 5).map((payment: any) => (
                                <div key={payment.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                                  <div>
                                    <span className="font-medium">${(payment.amount / 100).toFixed(2)}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {format(new Date(payment.created * 1000), "MMM d, yyyy")}
                                    </span>
                                  </div>
                                  <Badge variant={payment.status === "succeeded" ? "default" : "secondary"}>
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
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Recent Invoices</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {userDetails.stripeInfo.invoices.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No invoices</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.stripeInfo.invoices.slice(0, 5).map((invoice: any) => (
                                <div key={invoice.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                                  <div>
                                    <span className="font-medium">{invoice.number || "Draft"}</span>
                                    <span className="text-muted-foreground ml-2">
                                      ${(invoice.amount_due / 100).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                                      {invoice.status}
                                    </Badge>
                                    {invoice.hosted_invoice_url && (
                                      <Button variant="ghost" size="sm" asChild>
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
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No Stripe customer found for this user
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Actions Tab */}
                <TabsContent value="actions" className="space-y-4 pr-4">
                  {/* Email Actions */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Send Email
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Select value={selectedEmailTemplate} onValueChange={setSelectedEmailTemplate}>
                        <SelectTrigger>
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
                          className="min-h-[100px]"
                        />
                      )}

                      <Button 
                        onClick={handleSendEmail}
                        disabled={!selectedEmailTemplate || actionLoading === "email"}
                        className="w-full"
                      >
                        {actionLoading === "email" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Send Email
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Billing Actions */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Billing Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Give Credit */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Give Credit</p>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((months) => (
                            <Button
                              key={months}
                              variant="outline"
                              size="sm"
                              onClick={() => handleGiveCredit(months)}
                              disabled={actionLoading === "credit"}
                            >
                              <Gift className="w-3 h-3 mr-1" />
                              {months} month{months > 1 ? "s" : ""}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Process Refund */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Process Refund</p>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Amount (leave empty for full)"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            onClick={handleRefund}
                            disabled={actionLoading === "refund"}
                          >
                            {actionLoading === "refund" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                            Refund
                          </Button>
                        </div>
                      </div>

                      {/* Cancel Subscription */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Subscription Management</p>
                        <Button
                          variant="destructive"
                          onClick={handleCancelSubscription}
                          disabled={actionLoading === "cancel"}
                          className="w-full"
                        >
                          {actionLoading === "cancel" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                          Cancel Subscription
                        </Button>
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
