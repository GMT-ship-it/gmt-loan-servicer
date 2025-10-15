import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

type AppRole = "admin" | "analyst" | "borrower";

export function Guard({ 
  need, 
  children 
}: { 
  need: AppRole[]; 
  children: React.ReactNode 
}) {
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

        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        const role = data?.role as AppRole;
        
        if (mounted) {
          if (role && need.includes(role)) {
            setStatus("ok");
          } else {
            setStatus("denied");
            navigate("/login", { replace: true });
          }
        }
      } catch (err) {
        console.error("Guard error:", err);
        if (mounted) {
          setStatus("denied");
          navigate("/login", { replace: true });
        }
      }
    })();

    return () => { mounted = false; };
  }, [need, navigate]);

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking access...</span>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return null;
  }

  return <>{children}</>;
}
