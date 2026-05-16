import Link from "next/link";

// Placeholder. Phase 1 replaces this with the real email + password + 2FA flow
// per proposal Section 2.1.
export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            HK ENV.
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Sign in to the operations platform
          </p>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong className="font-semibold">Phase 0 placeholder.</strong>{" "}
          Real email + password + 2FA login lands in Phase 1.
        </div>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Continue to app
        </Link>
      </div>
    </div>
  );
}
