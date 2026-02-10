import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Shield, ShieldCheck, UserPlus, Trash2, Loader2, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { format } from "date-fns";

interface TeamMember {
  user_id: string;
  role: string;
  email: string;
  full_name: string | null;
}

export default function AdminTeam() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<string>("moderator");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }

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
    fetchTeamMembers();
  };

  const fetchTeamMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "list_users",
          filters: {},
        },
      });
      if (error) throw error;

      // Filter to only users with admin or moderator roles
      const elevated = (data.users || []).filter(
        (u: any) => u.roles && u.roles.length > 0 && u.roles.some((r: string) => r === "admin" || r === "moderator")
      );

      const members: TeamMember[] = [];
      for (const u of elevated) {
        for (const role of u.roles) {
          if (role === "admin" || role === "moderator") {
            members.push({
              user_id: u.id,
              role,
              email: u.email,
              full_name: u.full_name,
            });
          }
        }
      }

      setTeamMembers(members);
    } catch (error) {
      toast.error("Failed to load team members");
      console.error(error);
    }
    setLoading(false);
  };

  const handleAddMember = async () => {
    if (!addEmail.trim()) return;
    setActionLoading(true);

    try {
      // First find user by email via list_users
      const { data: usersData, error: usersError } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list_users", filters: {} },
      });
      if (usersError) throw usersError;

      const user = (usersData.users || []).find(
        (u: any) => u.email.toLowerCase() === addEmail.trim().toLowerCase()
      );

      if (!user) {
        toast.error("No account found with that email. The user must sign up first.");
        setActionLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "manage_role",
          userId: user.id,
          userEmail: user.email,
          role: addRole,
          roleAction: "add",
        },
      });
      if (error) throw error;
      toast.success(data.message);
      setAddEmail("");
      fetchTeamMembers();
    } catch (error: any) {
      toast.error(error.message || "Failed to add team member");
    }
    setActionLoading(false);
  };

  const handleRemoveRole = async (userId: string, role: string, email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "manage_role",
          userId,
          userEmail: email,
          role,
          roleAction: "remove",
        },
      });
      if (error) throw error;
      toast.success(data.message);
      fetchTeamMembers();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove role");
    }
  };

  if (!isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />
        <div>
          <h1 className="text-3xl font-display text-foreground">Team Management</h1>
          <p className="text-muted-foreground mt-1">Manage admin and moderator access for your team</p>
        </div>

        {/* Add Team Member */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Team Member
            </CardTitle>
            <CardDescription>
              Grant admin or moderator access to an existing user by email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="user@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddMember} disabled={actionLoading || !addEmail.trim()}>
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Add
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Admin</span>
                </div>
                <p className="text-xs text-muted-foreground">Full access: users, billing, roles, deletions, knowledge base, settings</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Moderator</span>
                </div>
                <p className="text-xs text-muted-foreground">View users, add notes, send emails, view billing (no refunds, deletions, or role changes)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Members List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Team Members
            </CardTitle>
            <CardDescription>
              {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""} with elevated access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading team...
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No team members with elevated roles yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member, idx) => (
                    <TableRow key={`${member.user_id}-${member.role}-${idx}`}>
                      <TableCell className="font-medium">{member.email}</TableCell>
                      <TableCell>{member.full_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === "admin" ? "default" : "secondary"} className="gap-1">
                          {member.role === "admin" ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveRole(member.user_id, member.role, member.email)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
