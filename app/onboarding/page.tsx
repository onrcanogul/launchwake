import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Already onboarded → straight to the app.
  const existing = await db.project.findFirst({
    where: { userId: session.user.id },
  });
  if (existing) redirect("/app");

  return (
    <div className="ob">
      <div className="steps">
        <div className="stp on" />
        <div className="stp on" />
        <div className="stp" />
      </div>
      <h1>Connect what you&apos;re building</h1>
      <p className="lead">
        LaunchWake watches for every ship — releases, features, changelogs, blog
        posts — and turns each one into a distribution plan. Tell us about your
        product to get your first one.
      </p>
      <OnboardingForm />
    </div>
  );
}
