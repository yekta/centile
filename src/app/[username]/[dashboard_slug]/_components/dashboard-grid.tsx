import DndProvider from "@/app/[username]/[dashboard_slug]/_components/dnd-provider";

export default function DashboardGrid({
  children,
  centerItems,
  initialIds,
}: Readonly<{
  children: React.ReactNode;
  centerItems?: boolean;
  initialIds: string[];
}>) {
  return (
    <DndProvider initialIds={initialIds}>
      <div
        data-center-items={centerItems === true || undefined}
        className="w-full group/wrapper flex flex-col flex-1 items-center data-[center-items]:justify-center"
      >
        <div
          className="w-full grid grid-cols-12 max-w-7xl px-1 pb-16 md:pb-20 md:px-5 md:pt-5
          group-data-[center-items]/wrapper:flex-1 group-data-[center-items]/wrapper:justify-center group-data-[center-items]/wrapper:flex group-data-[center-items]/wrapper:flex-col group-data-[center-items]/wrapper:items-center"
        >
          {children}
        </div>
      </div>
    </DndProvider>
  );
}
