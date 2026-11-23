"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { LazyMotion, domAnimation } from "motion/react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        <LazyMotion features={domAnimation}>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" richColors />
          </TooltipProvider>
        </LazyMotion>
      </QueryClientProvider>
    </NextThemesProvider>
  );
}
