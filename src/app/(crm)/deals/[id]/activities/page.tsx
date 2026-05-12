import { prisma } from "@/lib/prisma";
import { DealNotesEditor } from "@/components/DealNotesEditor";
import { ActivityLog } from "@/components/ActivityLog";
import { QuickActivityButton } from "@/components/QuickActivityButton";
import { notFound } from "next/navigation";
import { Phone, CalendarDays, CheckSquare } from "lucide-react";

async function getDealWithActivities(id: string) {
  return prisma.deal.findUnique({
    where: { id },
    select: {
      id: true,
      notes: true,
      activities: {
        include: { createdByUser: { select: { name: true } } },
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      },
    },
  });
}

export default async function ActivitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealWithActivities(id);
  if (!deal) notFound();

  return (
    <div className="space-y-5">
      {/* Quick opvolgacties */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Opvolgactie toevoegen
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <QuickActivityButton
            dealId={id}
            type="CALL"
            label="Bellen"
            icon={<Phone className="w-3.5 h-3.5" />}
            colorClass="border-brand-blue/20 bg-brand-blue-light text-brand-blue hover:bg-brand-blue-light"
          />
          <QuickActivityButton
            dealId={id}
            type="MEETING"
            label="Afspraak"
            icon={<CalendarDays className="w-3.5 h-3.5" />}
            colorClass="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
          />
          <QuickActivityButton
            dealId={id}
            type="TASK"
            label="Taak"
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            colorClass="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          />
        </div>
      </div>

      {/* Main content: log + notes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: activity log (2/3 width) */}
        <div className="lg:col-span-2">
          <ActivityLog dealId={id} activities={deal.activities} />
        </div>

        {/* Right: deal notes (1/3 width) */}
        <div>
          <DealNotesEditor dealId={id} initialNotes={deal.notes ?? ""} />
        </div>
      </div>
    </div>
  );
}
