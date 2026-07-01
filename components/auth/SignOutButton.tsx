"use client";

import { signOut } from "next-auth/react";
import { Icon } from "@/components/Icon";

export function SignOutButton() {
  return (
    <button
      className="btn btn-s"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <Icon name="external" /> Sign out
    </button>
  );
}
