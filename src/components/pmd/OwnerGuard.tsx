import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setStatus("denied");
          navigate("/login", { replace: true });
          return;
        }

        // Check if user has owner role
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "owner")
          .eq("status", "active")
          .maybeSingle();

        if (error) {
          console.error("OwnerGuard error:", error);
          if (mounted) {
            setStatus("denied");
            navigate("/login", { replace: true });
          }
          return;
        }

        if (mounted) {
          if (data) {
            setStatus("ok");
          } else {
            setStatus("denied");
            navigate("/login", { replace: true });
          }
        }
      } catch (err) {
        console.error("OwnerGuard error:", err);
        if (mounted) {
          setStatus("denied");
          navigate("/login", { replace: true });
        }
      }
    })();

    return () => { mounted = false; };
  }, [navigate]);

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-lg">Verifying access...</span>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
