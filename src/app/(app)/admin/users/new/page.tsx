import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NewUserForm } from "./NewUserForm";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const actor = await requireUser("ADMIN");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link href="/admin/users" className="text-sm text-zinc-600 underline hover:text-zinc-900">
          ← Back to users
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Add a user
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          They&apos;ll get an employee ID automatically. You&apos;ll see a one-time
          temporary password to share — they should reset it on first sign-in.
        </p>
        <div className="mt-6">
          <NewUserForm actorRole={actor.role} />
        </div>
      </div>
    </div>
  );
}
