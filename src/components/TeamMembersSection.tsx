import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Copy, Trash2, UserPlus, Link2, Users } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string | null;
  role: string;
  invite_status: string;
  invite_token: string | null;
  user_id: string | null;
  created_at: string;
}

interface TeamMembersSectionProps {
  brandId?: string;
}

export function TeamMembersSection({ brandId }: TeamMembersSectionProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState<string>('viewer');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (brandId) fetchMembers();
    else setLoading(false);
  }, [brandId]);

  const fetchMembers = async () => {
    if (!brandId) return;
    try {
      const { data, error } = await supabase
        .from('brand_team_members')
        .select('*')
        .eq('brand_id', brandId)
        .neq('invite_status', 'revoked')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!brandId) {
      toast.error('No brand found. Please complete onboarding first.');
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('brand_team_members')
        .insert({
          brand_id: brandId,
          role: newRole,
          email: newEmail || null,
          invited_by: user.id,
        });

      if (error) throw error;

      toast.success('Invite link created!');
      setNewEmail('');
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied to clipboard!');
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('brand_team_members')
        .update({ invite_status: 'revoked' })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Team member removed');
      fetchMembers();
    } catch (error: any) {
      toast.error('Failed to remove member');
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('brand_team_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Role updated');
      fetchMembers();
    } catch (error: any) {
      toast.error('Failed to update role');
    }
  };

  if (!brandId) {
    return (
      <p className="text-sm text-muted-foreground">
        Complete onboarding to add team members.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'editor': return 'Editor';
      case 'viewer': return 'Viewer';
      default: return role;
    }
  };

  const roleDescription = (role: string) => {
    switch (role) {
      case 'admin': return 'Full access — edit brand, campaigns, creative, and data';
      case 'editor': return 'Can edit campaigns and creative, but can\'t change brand settings';
      case 'viewer': return 'View-only access to all dashboards';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Members */}
      {members.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Current Team</Label>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.email || 'Invite link'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={member.invite_status === 'accepted' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {member.invite_status === 'accepted' ? 'Active' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={member.role}
                    onValueChange={(value) => handleUpdateRole(member.id, value)}
                  >
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  {member.invite_status === 'pending' && member.invite_token && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopyLink(member.invite_token!)}
                      title="Copy invite link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                    title="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite New Member */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Invite a Teammate</Label>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            variant="glow"
            placeholder="Email (optional — for your reference)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1"
          />
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="lumi"
            onClick={handleCreateInvite}
            disabled={creating}
            className="gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Generate Link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Generate a shareable invite link. Anyone with the link can join your brand with the selected role.
        </p>
        {/* Role descriptions */}
        <div className="grid gap-2 mt-2">
          {['admin', 'editor', 'viewer'].map((role) => (
            <div key={role} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs shrink-0">{roleLabel(role)}</Badge>
              <span>{roleDescription(role)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
