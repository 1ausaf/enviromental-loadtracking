import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NewTruckForm } from "./NewTruckForm";

export const dynamic = "force-dynamic";

export default async function NewTruckPage() {
  await requireUser("ADMIN");
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link
          href="/admin/trucks"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to trucks
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Add a truck
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Operators are assigned on the truck&apos;s detail page after it&apos;s
          created.
        </p>
        <div className="mt-6">
          <NewTruckForm />
        </div>
      </div>
    </div>
  );
}
