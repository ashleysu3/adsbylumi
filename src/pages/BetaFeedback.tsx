import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SparkleIcon } from "@/components/SparkleIcon";
import lumiLogo from "@/assets/lumi-logo.png";
import { Heart } from "lucide-react";

export default function BetaFeedback() {
  const [favoriteFeature, setFavoriteFeature] = useState("");
  const [confusingPart, setConfusingPart] = useState("");
  const [missingFeature, setMissingFeature] = useState("");
  const [recommendationScore, setRecommendationScore] = useState<number | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate("/auth?returnTo=/beta-feedback");
      } else {
        setUser(data.user);
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("beta_feedback" as any).insert({
        user_id: user.id,
        user_email: user.email,
        favorite_feature: favoriteFeature || null,
        confusing_part: confusingPart || null,
        missing_feature: missingFeature || null,
        recommendation_score: recommendationScore,
        additional_notes: additionalNotes || null,
      } as any);

      if (error) throw error;

      // Send to Slack (fire-and-forget)
      supabase.functions.invoke("slack-notify", {
        body: {
          channel: "lumi-alerts",
          text: `🧪 Beta Feedback from ${user.email}`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "🧪 New Beta Feedback", emoji: true },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*From:*\n${user.email}` },
                { type: "mrkdwn", text: `*NPS Score:*\n${recommendationScore ?? 'Not provided'}/10` },
              ],
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Favorite Feature:*\n${favoriteFeature || '_Not answered_'}` },
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*What Felt Confusing:*\n${confusingPart || '_Not answered_'}` },
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Missing Feature:*\n${missingFeature || '_Not answered_'}` },
            },
            ...(additionalNotes ? [{
              type: "section",
              text: { type: "mrkdwn", text: `*Additional Notes:*\n${additionalNotes}` },
            }] : []),
          ],
        },
      }).catch((err) => console.error("Slack notify failed:", err));

      setSubmitted(true);
      toast.success("Thank you for your feedback! 💜");
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-lumi-purple-1/10 px-4">
        <Card variant="gradient" className="w-full max-w-md shadow-elevated rounded-2xl text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 flex items-center justify-center">
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">You're the best 💜</h2>
            <p className="text-muted-foreground">
              Your feedback has been sent straight to our team. It means the world — seriously.
            </p>
            <Button variant="lumi" onClick={() => navigate("/start")} className="mt-4">
              Back to Lumi →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-lumi-purple-1/10 px-4 py-8">
      <Card variant="gradient" className="w-full max-w-lg shadow-elevated rounded-2xl">
        <CardHeader className="space-y-1 text-center">
          <img src={lumiLogo} alt="Lumi" className="h-12 mx-auto mb-2" />
          <CardTitle className="text-xl">How's your first week? 💭</CardTitle>
          <CardDescription className="text-base">
            4 quick questions — takes about 2 minutes. Your answers go straight to our team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="favorite">What's been your favorite feature so far?</Label>
              <Textarea
                id="favorite"
                variant="glow"
                value={favoriteFeature}
                onChange={(e) => setFavoriteFeature(e.target.value)}
                placeholder="The thing that made you go 'ooh, that's nice'..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confusing">What felt confusing or hard to find?</Label>
              <Textarea
                id="confusing"
                variant="glow"
                value={confusingPart}
                onChange={(e) => setConfusingPart(e.target.value)}
                placeholder="No judgment — be honest!"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="missing">What feature do you wish Lumi had?</Label>
              <Textarea
                id="missing"
                variant="glow"
                value={missingFeature}
                onChange={(e) => setMissingFeature(e.target.value)}
                placeholder="Dream big — what would make this perfect?"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>On a scale of 1–10, how likely are you to recommend Lumi?</Label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRecommendationScore(n)}
                    className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                      recommendationScore === n
                        ? "bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white shadow-md scale-110"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Anything else you want us to know? (optional)</Label>
              <Textarea
                id="notes"
                variant="glow"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Bugs, love notes, feature requests — all welcome"
                className="min-h-[70px]"
              />
            </div>

            <Button type="submit" variant="lumi" className="w-full h-11 text-base" disabled={loading}>
              {loading ? (
                <>
                  <SparkleIcon size="xs" state="loading" className="mr-2" />
                  Sending...
                </>
              ) : (
                "Send My Feedback 💜"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
