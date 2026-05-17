import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ProjectForm } from "../ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requireUser("ADMIN");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          href="/admin/projects"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to projects
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          New project
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Operators, trucks, and the document vault are managed on the
          project&apos;s detail page after creation.
        </p>
        <div className="mt-6">
          <ProjectForm mode="create" />
        </div>
      </div>
    </div>
  );
}
