import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { SocketProvider } from "../../shared/socket";
import { queryClient } from "./queryClient";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>{children}</SocketProvider>
    </QueryClientProvider>
  );
}
