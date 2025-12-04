import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plus, Copy, Trash2, Ticket, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { format } from "date-fns";

interface InviteCode {
  id: string;
  code: string;
  description: string | null;
  max_uses: number;
  current_uses: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function AdminInviteCodes() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<InviteCode | null>(null);
  
  // Form state
  const [newCode, setNewCode] = useState("");
  const [description, setDescription] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

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
    fetchCodes();
  };

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load invite codes");
      console.error(error);
    } else {
      setCodes(data || []);
    }
    setLoading(false);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "LUMI-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(code);
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      toast.error("Please enter or generate a code");
      return;
    }

    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code: newCode.trim().toUpperCase(),
        description: description.trim() || null,
        max_uses: parseInt(maxUses) || 100,
        expires_at: expiresAt || null,
        created_by: user?.id,
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("This code already exists. Try a different one.");
      } else {
        toast.error("Failed to create invite code");
        console.error(error);
      }
    } else {
      toast.success("Invite code created!");
      setCreateDialogOpen(false);
      resetForm();
      fetchCodes();
    }
    setCreating(false);
  };

  const resetForm = () => {
    setNewCode("");
    setDescription("");
    setMaxUses("100");
    setExpiresAt("");
  };

  const toggleCodeActive = async (code: InviteCode) => {
    const { error } = await supabase
      .from("invite_codes")
      .update({ active: !code.active })
      .eq("id", code.id);

    if (error) {
      toast.error("Failed to update code");
    } else {
      toast.success(code.active ? "Code deactivated" : "Code activated");
      fetchCodes();
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard!");
  };

  const handleDeleteCode = async () => {
    if (!codeToDelete) return;

    const { error } = await supabase
      .from("invite_codes")
      .delete()
      .eq("id", codeToDelete.id);

    if (error) {
      toast.error("Failed to delete code");
    } else {
      toast.success("Code deleted");
      fetchCodes();
    }
    setDeleteDialogOpen(false);
    setCodeToDelete(null);
  };

  if (!isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display text-foreground">Invite Codes</h1>
            <p className="text-muted-foreground mt-1">
              Manage signup access with invite codes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchCodes} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => { generateCode(); setCreateDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Code
            </Button>
          </div>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              All Invite Codes
            </CardTitle>
            <CardDescription>
              {codes.length} code{codes.length !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : codes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invite codes yet. Create one to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map((code) => {
                      const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                      const isMaxedOut = code.current_uses >= code.max_uses;
                      
                      return (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono font-semibold">
                            <div className="flex items-center gap-2">
                              {code.code}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => copyCode(code.code)}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {code.description || "—"}
                          </TableCell>
                          <TableCell>
                            <span className={code.current_uses >= code.max_uses ? "text-destructive" : ""}>
                              {code.current_uses} / {code.max_uses}
                            </span>
                          </TableCell>
                          <TableCell>
                            {!code.active ? (
                              <Badge variant="secondary">Inactive</Badge>
                            ) : isExpired ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : isMaxedOut ? (
                              <Badge variant="destructive">Maxed Out</Badge>
                            ) : (
                              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {code.expires_at
                              ? format(new Date(code.expires_at), "MMM d, yyyy")
                              : "Never"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(code.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Switch
                                checked={code.active}
                                onCheckedChange={() => toggleCodeActive(code)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => { setCodeToDelete(code); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

      {/* Create Code Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Invite Code</DialogTitle>
            <DialogDescription>
              Generate a new code for users to sign up with.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="LUMI-XXXXXX"
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  Generate
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Beta Wave 1, VIP Access"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires (optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Code"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Invite Code</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong className="font-mono">{codeToDelete?.code}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCode}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}