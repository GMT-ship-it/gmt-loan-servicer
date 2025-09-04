import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNotify } from "@/lib/notify";

// shadcn/ui command (already part of your project)
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

function useHotkey(metaKey = true) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      // meta+k (⌘K on Mac, Ctrl+K on Windows)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return { open, setOpen };
}

export default function CommandPalette() {
  const { open, setOpen } = useHotkey();
  const navigate = useNavigate();
  const notify = useNotify();

  const go = useCallback(
    (to: string) => {
      setOpen(false);
      navigate(to);
    },
    [navigate, setOpen]
  );

  const toggleCompact = useCallback(() => {
    setOpen(false);
    const root = document.documentElement;
    const on = !root.classList.contains("compact");
    if (on) { root.classList.add("compact"); localStorage.setItem("compact","1"); }
    else { root.classList.remove("compact"); localStorage.removeItem("compact"); }
    notify.info("View updated", on ? "Compact mode on" : "Compact mode off");
  }, [notify, setOpen]);

  // Global actions (safe server calls)
  const approveOldestDraw = useCallback(async () => {
    setOpen(false);
    try {
      const { data, error } = await supabase
        .from("draw_requests")
        .select("id, facility_id, amount, status, created_at, required_docs_ok")
        .eq("status", "submitted")
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      const d = data?.[0];
      if (!d) { notify.info("No pending draws"); return; }

      // attempt approval; DB trigger & RLS/enforced checks will guard correctness
      const { error: updErr } = await supabase
        .from("draw_requests")
        .update({
          status: "approved",
          decided_at: new Date().toISOString(),
        })
        .eq("id", d.id);
      if (updErr) throw updErr;

      notify.success("Approved", "Oldest draw request was approved");
    } catch (e: any) {
      notify.error("Could not approve", e.message);
    }
  }, [notify, setOpen]);

  const postInterestAll = useCallback(async () => {
    setOpen(false);
    try {
      const asOf = new Date().toISOString().slice(0,10);
      const { data, error } = await supabase.rpc("post_interest_all_active", { p_as_of: asOf });
      if (error) throw error;
      notify.success("Interest posted", `Facilities processed: ${data ?? 0}`);
    } catch (e: any) {
      notify.error("Posting failed", e.message);
    }
  }, [notify, setOpen]);

  // Event bus to trigger UI on pages without tight coupling
  const fire = (name: string, detail?: any) => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(name, { detail }));
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/borrower")}>
            Borrower
            <CommandShortcut>G → B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/admin")}>
            Admin
            <CommandShortcut>G → A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/analytics")}>
            Analytics
            <CommandShortcut>G → N</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Borrower Actions">
          <CommandItem onSelect={() => { go("/borrower"); fire("open-request-funds"); }}>
            Open "Request Funds"
          </CommandItem>
          <CommandItem onSelect={() => { go("/borrower"); fire("download-latest-statement"); }}>
            Download last month's statement
          </CommandItem>
          <CommandItem onSelect={() => { go("/borrower"); fire("open-bbc-upload"); }}>
            Open BBC upload
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Lender Actions">
          <CommandItem onSelect={approveOldestDraw}>
            Approve oldest pending draw
            <CommandShortcut>Enter</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { go("/admin"); fire("refresh-exposure"); }}>
            Refresh exposure dashboard
          </CommandItem>
          <CommandItem onSelect={postInterestAll}>
            Post interest for all facilities
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View">
          <CommandItem onSelect={toggleCompact}>
            Toggle compact mode
            <CommandShortcut>⌘/Ctrl K → "compact"</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}