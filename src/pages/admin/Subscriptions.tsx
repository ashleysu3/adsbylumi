import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Users, RefreshCw, Search, UserPlus, CalendarPlus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { format } from "date-fns";

interface Subscription {
  id: string;
  user_id: string;
  tier: "starter" | "growth" | "agency_pro";
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  user_email?: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

const tierDisplayNames: Record<string, string> = {
  starter: "Solo",
  growth: "Creator",
  agency_pro: "Agency",
};

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [subToRevoke, setSubToRevoke] = useState<Subscription | null>(null);
  const [subToExtend, setSubToExtend] = useState<Subscription | null>(null);
  const [searchEmail, setSearchEmail] = useState("");

  // Form state for granting
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTier, setSelectedTier] = useState<"starter" | "growth" | "agency_pro">("starter");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "trial">("active");
  const [trialEndDate, setTrialEndDate] = useState("");
  const [granting, setGranting] = useState(false);
  
  // Extend trial state
  const [newEndDate, setNewEndDate] = useState("");
  const [extending, setExtending] = useState(false);

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
      toast.error("Access denied. Admin only.");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all subscriptions
    const { data: subs, error: subsError } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subsError) {
      toast.error("Failed to load subscriptions");
      console.error(subsError);
    }

    // Fetch all profiles for mapping
    const { data: profs, error: profsError } = await supabase
      .from("profiles")
      .select("id, email, full_name");

    if (profsError) {
      console.error("Failed to load profiles:", profsError);
    }

    const profileMap = new Map((profs || []).map(p => [p.id, p]));
    
    const enrichedSubs = (subs || []).map(sub => ({
      ...sub,
      user_email: profileMap.get(sub.user_id)?.email || "Unknown",
    }));

    setSubscriptions(enrichedSubs);
    setProfiles(profs || []);
    setLoading(false);
  };

  const handleGrantSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setGranting(true);

    // Check if user already has an active subscription
    const existingSub = subscriptions.find(
      s => s.user_id === selectedUserId && (s.status === "active" || s.status === "trial")
    );

    if (existingSub) {
      // Update existing subscription
      const { error } = await supabase
        .from("subscriptions")
        .update({
          tier: selectedTier,
          status: selectedStatus,
          current_period_end: selectedStatus === "trial" && trialEndDate ? trialEndDate : null,
          cancel_at_period_end: false,
        })
        .eq("id", existingSub.id);

      if (error) {
        toast.error("Failed to update subscription");
        console.error(error);
      } else {
        toast.success("Subscription updated!");
        setGrantDialogOpen(false);
        resetForm();
        fetchData();
      }
    } else {
      // Create new subscription
      const { error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: selectedUserId,
          tier: selectedTier,
          status: selectedStatus,
          current_period_end: selectedStatus === "trial" && trialEndDate ? trialEndDate : null,
          cancel_at_period_end: false,
        });

      if (error) {
        toast.error("Failed to grant subscription");
        console.error(error);
      } else {
        toast.success("Subscription granted!");
        setGrantDialogOpen(false);
        resetForm();
        fetchData();
      }
    }
    setGranting(false);
  };

  const resetForm = () => {
    setSelectedUserId("");
    setSelectedTier("starter");
    setSelectedStatus("active");
    setTrialEndDate("");
  };

  const handleRevokeSubscription = async () => {
    if (!subToRevoke) return;

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancel_at_period_end: true,
      })
      .eq("id", subToRevoke.id);

    if (error) {
      toast.error("Failed to revoke subscription");
    } else {
      toast.success("Subscription revoked");
      fetchData();
    }
    setRevokeDialogOpen(false);
    setSubToRevoke(null);
  };

  const handleDeleteSubscription = async (sub: Subscription) => {
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", sub.id);

    if (error) {
      toast.error("Failed to delete subscription record");
    } else {
      toast.success("Subscription record deleted");
      fetchData();
    }
  };

  const handleExtendTrial = async () => {
    if (!subToExtend || !newEndDate) {
      toast.error("Please select a new end date");
      return;
    }

    setExtending(true);
    const { error } = await supabase
      .from("subscriptions")
      .update({
        current_period_end: newEndDate,
      })
      .eq("id", subToExtend.id);

    if (error) {
      toast.error("Failed to extend trial");
      console.error(error);
    } else {
      toast.success(`Trial extended to ${format(new Date(newEndDate), "MMM d, yyyy")}`);
      fetchData();
    }
    setExtendDialogOpen(false);
    setSubToExtend(null);
    setNewEndDate("");
    setExtending(false);
  };

  const openExtendDialog = (sub: Subscription) => {
    setSubToExtend(sub);
    // Default to 14 days from current end date or today
    const baseDate = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + 14);
    setNewEndDate(newDate.toISOString().split("T")[0]);
    setExtendDialogOpen(true);
  };

  const filteredSubscriptions = subscriptions.filter(sub =>
    sub.user_email?.toLowerCase().includes(searchEmail.toLowerCase())
  );

  const usersWithoutActiveSub = profiles.filter(profile => {
    const hasSub = subscriptions.some(
      s => s.user_id === profile.id && (s.status === "active" || s.status === "trial")
    );
    return !hasSub;
  });

  if (!isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display text-foreground">Subscriptions</h1>
            <p className="text-muted-foreground mt-1">
              Grant or revoke code-based subscriptions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => setGrantDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Grant Access
            </Button>
          </div>
        </div>

        <Card className="border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  All Subscriptions
                </CardTitle>
                <CardDescription>
                  {subscriptions.length} subscription{subscriptions.length !== 1 ? "s" : ""} total
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredSubscriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No subscriptions found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((sub) => {
                      const isCodeBased = !sub.stripe_subscription_id;
                      const isActive = sub.status === "active" || sub.status === "trial";

                      return (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{sub.user_email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {tierDisplayNames[sub.tier] || sub.tier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.status === "active" ? (
                              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                                Active
                              </Badge>
                            ) : sub.status === "trial" ? (
                              <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                                Trial
                              </Badge>
                            ) : sub.status === "cancelled" ? (
                              <Badge variant="destructive">Cancelled</Badge>
                            ) : (
                              <Badge variant="secondary">{sub.status}</Badge>
                            )}
                            {sub.cancel_at_period_end && isActive && (
                              <Badge variant="outline" className="ml-1 text-destructive border-destructive">
                                Cancelling
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isCodeBased ? (
                              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                                Code-Based
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                                Stripe
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {sub.current_period_end
                              ? format(new Date(sub.current_period_end), "MMM d, yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(sub.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Extend Trial - for code-based trials */}
                              {isCodeBased && sub.status === "trial" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => openExtendDialog(sub)}
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                  Extend
                                </Button>
                              )}
                              {isCodeBased && isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setSubToRevoke(sub);
                                    setRevokeDialogOpen(true);
                                  }}
                                >
                                  Revoke
                                </Button>
                              )}
                              {isCodeBased && !isActive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteSubscription(sub)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grant Subscription Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Subscription Access</DialogTitle>
            <DialogDescription>
              Manually grant a code-based subscription to a user.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGrantSubscription} className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {usersWithoutActiveSub.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.email} {profile.full_name ? `(${profile.full_name})` : ""}
                    </SelectItem>
                  ))}
                  {profiles
                    .filter(p => !usersWithoutActiveSub.some(u => u.id === p.id))
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.email} (has subscription)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={selectedTier}
                  onValueChange={(v) => setSelectedTier(v as typeof selectedTier)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Solo</SelectItem>
                    <SelectItem value="growth">Creator</SelectItem>
                    <SelectItem value="agency_pro">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(v) => setSelectedStatus(v as typeof selectedStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Complimentary)</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedStatus === "trial" && (
              <div className="space-y-2">
                <Label>Trial End Date</Label>
                <Input
                  type="date"
                  value={trialEndDate}
                  onChange={(e) => setTrialEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  When the trial ends, the user will need to subscribe to continue access.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGrantDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={granting}>
                {granting ? "Granting..." : "Grant Access"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke access for{" "}
              <strong>{subToRevoke?.user_email}</strong>? Their subscription will be marked as
              cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeSubscription}>
              Revoke Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Trial Period</DialogTitle>
            <DialogDescription>
              Extend the trial for <strong>{subToExtend?.user_email}</strong>.
              {subToExtend?.current_period_end && (
                <span className="block mt-1">
                  Current end date: {format(new Date(subToExtend.current_period_end), "MMM d, yyyy")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New End Date</Label>
              <Input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setNewEndDate(d.toISOString().split("T")[0]);
                }}
              >
                +7 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 14);
                  setNewEndDate(d.toISOString().split("T")[0]);
                }}
              >
                +14 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 30);
                  setNewEndDate(d.toISOString().split("T")[0]);
                }}
              >
                +30 days
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendTrial} disabled={extending || !newEndDate}>
              {extending ? "Extending..." : "Extend Trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
