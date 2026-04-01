
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Check, X, Edit2, ExternalLink, Instagram, Mail, Globe, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Review {
  id: string;
  created_at: string;
  reviewer_name: string;
  business_name: string;
  instagram_handle: string | null;
  website_url: string | null;
  email: string;
  review_text: string;
  rating: number;
  status: string;
  approved_quote: string | null;
  admin_notes: string | null;
}

const AdminReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [editReview, setEditReview] = useState<Review | null>(null);
  const [editQuote, setEditQuote] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    let query = supabase.from("user_reviews" as any).select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) { toast.error("Failed to load reviews"); console.error(error); }
    else setReviews((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, [filter]);

  const updateStatus = async (id: string, status: string, quote?: string, notes?: string) => {
    setSaving(true);
    const update: any = { status, updated_at: new Date().toISOString() };
    if (status === "approved") update.approved_at = new Date().toISOString();
    if (quote !== undefined) update.approved_quote = quote;
    if (notes !== undefined) update.admin_notes = notes;

    const { error } = await supabase.from("user_reviews" as any).update(update).eq("id", id);
    if (error) toast.error("Failed to update");
    else {
      toast.success(status === "approved" ? "Review approved!" : status === "rejected" ? "Review rejected" : "Updated");
      fetchReviews();
      setEditReview(null);
    }
    setSaving(false);
  };

  const openEdit = (review: Review) => {
    setEditReview(review);
    setEditQuote(review.approved_quote || review.review_text);
    setEditNotes(review.admin_notes || "");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminTabs />
        <div className="mt-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Review Management</h1>
          <p className="text-sm text-muted-foreground mb-6">Approve, edit, and manage user testimonials</p>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No {filter === "all" ? "" : filter} reviews yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="border border-border">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-foreground">{review.reviewer_name}</span>
                          <Badge variant={review.status === "approved" ? "default" : review.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                            {review.status}
                          </Badge>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= review.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{review.business_name}</span>
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{review.email}</span>
                          {review.instagram_handle && <span className="flex items-center gap-1"><Instagram className="h-3 w-3" />{review.instagram_handle}</span>}
                          {review.website_url && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{review.website_url}</span>}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{review.review_text}</p>
                        {review.approved_quote && review.approved_quote !== review.review_text && (
                          <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                            <p className="text-xs text-muted-foreground mb-1">Approved Quote:</p>
                            <p className="text-sm text-foreground italic">"{review.approved_quote}"</p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {review.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => openEdit(review)} className="gap-1">
                              <Check className="h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => updateStatus(review.id, "rejected")} className="gap-1">
                              <X className="h-3 w-3" /> Reject
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(review)} className="gap-1">
                          <Edit2 className="h-3 w-3" /> Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit/Approve Dialog */}
      <Dialog open={!!editReview} onOpenChange={() => setEditReview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit & Approve Review</DialogTitle>
          </DialogHeader>
          {editReview && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Original Review</Label>
                <p className="text-sm text-foreground mt-1 p-3 bg-muted rounded-lg">{editReview.review_text}</p>
              </div>
              <div>
                <Label htmlFor="quote">Featured Quote (edit for clarity / pull best parts)</Label>
                <Textarea
                  id="quote"
                  value={editQuote}
                  onChange={(e) => setEditQuote(e.target.value)}
                  className="mt-1"
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="notes">Internal Notes</Label>
                <Input
                  id="notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional internal notes"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditReview(null)}>Cancel</Button>
            <Button
              disabled={saving}
              onClick={() => editReview && updateStatus(editReview.id, "approved", editQuote, editNotes)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Approve & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviews;
