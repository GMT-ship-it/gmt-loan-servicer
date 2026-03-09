import { cn } from "@/lib/utils";
import React from "react";

interface MainAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const MainArea = React.forwardRef<HTMLDivElement, MainAreaProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 p-8 overflow-y-auto w-full", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MainArea.displayName = "MainArea";
