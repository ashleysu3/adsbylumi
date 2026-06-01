import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, CalendarPlus, Clock, Users } from "lucide-react";

// ----- Configure your office hours here -----
const OFFICE_HOURS = {
  meetUrl: "https://meet.google.com/your-meet-code", // TODO: replace with real Meet link
  title: "Lumi Office Hours",
  description:
    "Bring your questions about ads, creative, copy, or strategy. Hosted by the Lumi team.",
  // Weekly recurring time (local time)
  dayOfWeek: "Thursday",
  startTime: "11:00 AM PT",
  durationMinutes: 60,
  // ICS recurrence (UTC-anchored — adjust to your real schedule)
  // Next occurrence start (ISO with timezone offset)
  nextOccurrenceISO: "2026-06-04T18:00:00Z", // Thu 11am PT = 18:00 UTC (PDT)
  recurrenceRule: "FREQ=WEEKLY;BYDAY=TH",
};

function buildICS() {
  const start = new Date(OFFICE_HOURS.nextOccurrenceISO);
  const end = new Date(start.getTime() + OFFICE_HOURS.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `office-hours-${start.getTime()}@adsbylumi.com`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lumi//Office Hours//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `RRULE:${OFFICE_HOURS.recurrenceRule}`,
    `SUMMARY:${OFFICE_HOURS.title}`,
    `DESCRIPTION:${OFFICE_HOURS.description}\\n\\nJoin: ${OFFICE_HOURS.meetUrl}`,
    `LOCATION:${OFFICE_HOURS.meetUrl}`,
    `URL:${OFFICE_HOURS.meetUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function downloadICS() {
  const blob = new Blob([buildICS()], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lumi-office-hours.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function OfficeHours() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Office Hours</h1>
          <p className="text-muted-foreground">
            Drop in live with the Lumi team. Get help with your ads, creative, or strategy —
            no question is too small.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {OFFICE_HOURS.title}
            </CardTitle>
            <CardDescription>{OFFICE_HOURS.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Every {OFFICE_HOURS.dayOfWeek}</p>
                  <p className="text-sm text-muted-foreground">
                    {OFFICE_HOURS.startTime} · {OFFICE_HOURS.durationMinutes} min
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <Video className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Google Meet</p>
                  <p className="text-sm text-muted-foreground">Hosted live by the Lumi team</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1"
                onClick={() => window.open(OFFICE_HOURS.meetUrl, "_blank", "noopener,noreferrer")}
              >
                <Video className="h-4 w-4 mr-2" />
                Join on Google Meet
              </Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={downloadICS}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Add to Calendar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              The calendar file works with Google Calendar, Apple Calendar, and Outlook.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
