import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Palette, Upload, Building2, Eye, FileText, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBrand } from '@/contexts/BrandContext';
import { toast } from 'sonner';

interface AgencyBranding {
  id?: string;
  brand_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  accent_color: string | null;
  company_name: string | null;
  white_label_reports: boolean;
  white_label_portal: boolean;
  custom_footer_text: string | null;
}

export default function AgencySettings() {
  const { activeBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [branding, setBranding] = useState<AgencyBranding>({
    brand_id: '',
    logo_url: null,
    primary_color: '#6366f1',
    secondary_color: null,
    accent_color: null,
    company_name: null,
    white_label_reports: false,
    white_label_portal: false,
    custom_footer_text: null,
  });

  useEffect(() => {
    if (!activeBrand?.id) return;
    fetchBranding();
  }, [activeBrand?.id]);

  const fetchBranding = async () => {
    if (!activeBrand?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agency_branding')
        .select('*')
        .eq('brand_id', activeBrand.id)
        .maybeSingle();

      if (data) {
        setBranding(data as unknown as AgencyBranding);
      } else {
        setBranding(prev => ({ ...prev, brand_id: activeBrand.id }));
      }
    } catch (err) {
      console.error('Error fetching agency branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeBrand?.id) return;
    setSaving(true);
    try {
      const payload = {
        brand_id: activeBrand.id,
        logo_url: branding.logo_url,
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        accent_color: branding.accent_color,
        company_name: branding.company_name,
        white_label_reports: branding.white_label_reports,
        white_label_portal: branding.white_label_portal,
        custom_footer_text: branding.custom_footer_text,
        updated_at: new Date().toISOString(),
      };

      if (branding.id) {
        const { error } = await supabase
          .from('agency_branding')
          .update(payload)
          .eq('id', branding.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('agency_branding')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setBranding(data as unknown as AgencyBranding);
      }
      toast.success('Agency branding saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBrand?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `agency-logos/${activeBrand.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('creative-assets')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('creative-assets')
        .getPublicUrl(path);

      setBranding(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo uploaded!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  if (!activeBrand) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Select a brand to configure agency settings.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Agency Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customize your agency branding for client-facing reports and portals.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Branding Identity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Brand Identity
                </CardTitle>
                <CardDescription>Your agency logo and name shown on client materials.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Agency / Company Name</Label>
                  <Input
                    value={branding.company_name || ''}
                    onChange={e => setBranding(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="e.g. After Organic Media"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Agency Logo</Label>
                  <div className="flex items-center gap-4">
                    {branding.logo_url ? (
                      <div className="h-16 w-16 rounded-xl border bg-muted/30 flex items-center justify-center overflow-hidden">
                        <img src={branding.logo_url} alt="Agency logo" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-xl border border-dashed bg-muted/20 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" className="rounded-xl" asChild disabled={uploading}>
                          <span>
                            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                            {branding.logo_url ? 'Replace Logo' : 'Upload Logo'}
                          </span>
                        </Button>
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
                      <p className="text-[10px] text-muted-foreground mt-1">PNG or SVG, max 2MB</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Brand Colors
                </CardTitle>
                <CardDescription>Colors used in client reports and portals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Primary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.primary_color}
                        onChange={e => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                        className="h-10 w-10 rounded-lg border cursor-pointer"
                      />
                      <Input
                        value={branding.primary_color}
                        onChange={e => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                        className="text-xs rounded-xl h-10 font-mono"
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Secondary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.secondary_color || '#64748b'}
                        onChange={e => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                        className="h-10 w-10 rounded-lg border cursor-pointer"
                      />
                      <Input
                        value={branding.secondary_color || ''}
                        onChange={e => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                        className="text-xs rounded-xl h-10 font-mono"
                        placeholder="#64748b"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Accent</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.accent_color || '#f59e0b'}
                        onChange={e => setBranding(prev => ({ ...prev, accent_color: e.target.value }))}
                        className="h-10 w-10 rounded-lg border cursor-pointer"
                      />
                      <Input
                        value={branding.accent_color || ''}
                        onChange={e => setBranding(prev => ({ ...prev, accent_color: e.target.value }))}
                        className="text-xs rounded-xl h-10 font-mono"
                        placeholder="#f59e0b"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview swatch */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">Preview:</span>
                  <div className="flex gap-1">
                    <div className="h-6 w-12 rounded-md" style={{ backgroundColor: branding.primary_color }} />
                    <div className="h-6 w-12 rounded-md" style={{ backgroundColor: branding.secondary_color || '#64748b' }} />
                    <div className="h-6 w-12 rounded-md" style={{ backgroundColor: branding.accent_color || '#f59e0b' }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* White Label Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  White Label Options
                </CardTitle>
                <CardDescription>Control what your clients see.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      White-Label Client Reports
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Replace LUMI branding with your agency logo and colors in generated reports.
                    </p>
                  </div>
                  <Switch
                    checked={branding.white_label_reports}
                    onCheckedChange={v => setBranding(prev => ({ ...prev, white_label_reports: v }))}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      White-Label Client Portal
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Show your agency branding on the client approval portal instead of LUMI.
                    </p>
                  </div>
                  <Switch
                    checked={branding.white_label_portal}
                    onCheckedChange={v => setBranding(prev => ({ ...prev, white_label_portal: v }))}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Custom Report Footer</Label>
                  <Input
                    value={branding.custom_footer_text || ''}
                    onChange={e => setBranding(prev => ({ ...prev, custom_footer_text: e.target.value }))}
                    placeholder="e.g. Prepared by After Organic Media — afterorganic.com"
                    className="rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">Appears at the bottom of client reports and shared links.</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="rounded-xl px-8">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Agency Settings
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
