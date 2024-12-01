import { siteTitle } from "@/lib/constants";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: `Home | ${siteTitle}`,
  description: "Home.",
};

export default async function Home() {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-5 pb-[calc(8vh+1.5rem)] text-center">
      Home
    </div>
  );
}
