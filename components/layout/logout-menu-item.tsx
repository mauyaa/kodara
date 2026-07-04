"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { logout } from "@/app/(auth)/actions";

export function LogoutMenuItem() {
  return (
    <DropdownMenuItem
      className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
      onClick={() => logout()}
    >
      Log out
    </DropdownMenuItem>
  );
}
