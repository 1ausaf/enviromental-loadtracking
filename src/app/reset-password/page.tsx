import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          After this, you&apos;ll set up 2FA again on next sign-in.
        </p>
        <div className="mt-6">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Missing reset token. Open the link from your email again, or{" "}
              <Link href="/forgot-password" className="underline">
                request a new one
              </Link>
              .
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
