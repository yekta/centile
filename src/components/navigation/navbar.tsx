"use client";

import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  BananaIcon,
  CalculatorIcon,
  LucideLayoutDashboard,
} from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type TRoute = {
  href: string;
  label: string;
  icon: string;
};

export default function Navbar({
  routes,
  isPending,
  isLoadingError,
}: {
  routes: TRoute[];
  isPending: boolean;
  isLoadingError: boolean;
}) {
  const pathname = usePathname();
  const currentIndex = routes.findIndex((route) => route.href === pathname);
  const finalIndex = currentIndex >= 0 ? currentIndex : -1;

  return (
    <div className="shadow-navbar shadow-shadow/[var(--opacity-shadow)] w-full overflow-hidden fixed bottom-0 top-auto md:top-0 md:bottom-auto left-0 z-50">
      <div className="w-full flex bg-background border-t md:border-b border-transparent dark:border-border items-center">
        {isPending && (
          <div className="text-transparent animate-skeleton flex items-center text-sm justify-center flex-1 font-semibold px-3 md:px-4 py-4 text-center gap-2 group relative">
            <div className="shrink-0 size-5 md:size-4 bg-foreground rounded-full" />
            <p className="hidden md:block shrink min-w-0 overflow-hidden overflow-ellipsis transition bg-foreground rounded-md">
              Loading
            </p>
          </div>
        )}
        {isLoadingError && (
          <div className="text-destructive flex items-center text-sm justify-center flex-1 font-semibold px-3 md:px-4 py-4 text-center gap-2 group relative">
            <ExclamationTriangleIcon className="shrink-0 size-5 md:size-4 transition" />
            <p className="hidden md:block shrink min-w-0 overflow-hidden overflow-ellipsis transition">
              Error
            </p>
          </div>
        )}
        {!isPending &&
          !isLoadingError &&
          routes.map((route) => {
            const Icon =
              route.icon === "banana"
                ? BananaIcon
                : route.icon === "calculator"
                  ? CalculatorIcon
                  : LucideLayoutDashboard;
            return (
              <Link
                key={route.href}
                href={route.href}
                data-active={pathname === route.href ? true : undefined}
                className="flex items-center text-sm justify-center flex-1 font-semibold px-3 md:px-4 py-4 text-center gap-2 group active:bg-background-secondary not-touch:hover:bg-background-secondary relative"
              >
                <Icon className="shrink-0 size-5 md:size-4 transition text-muted-foreground group-data-[active]:text-foreground" />
                <p className="hidden md:block shrink min-w-0 overflow-hidden overflow-ellipsis transition text-muted-foreground group-data-[active]:text-foreground">
                  {route.label}
                </p>
              </Link>
            );
          })}
        {/* <div className="p-2">
          <ThemeButton />
        </div> */}
      </div>
      {!isPending && !isLoadingError && (
        <div
          style={{
            width: `${(1 / routes.length) * 100}%`,
            transform: `translateX(${finalIndex * 100}%)`,
          }}
          className="w-full h-[1px] bg-foreground absolute left-0 top-0 bottom-auto md:bottom-0 md:top-auto transition"
        />
      )}
    </div>
  );
}
