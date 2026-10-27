import { createTheme, Input, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App.tsx";

const fontFamily = "Inter Variable, system-ui, sans-serif";

const theme = createTheme({
  primaryColor: "blurple",
  colors: {
    blurple: [
      "#fbfaff",
      "#f5f4ff",
      "#e7e5fe",
      "#d2cefd",
      "#b5abfc",
      "#968ae0",
      "#796cbf",
      "#5d5294",
      "#423a6a",
      "#2b2741",
    ],
  },
  // Mantine uses black as the light-scheme text color
  black: "#292b31",
  fontFamily,
  headings: { fontFamily, fontWeight: "500" },
  components: {
    InputWrapper: Input.Wrapper.extend({
      styles: {
        label: { fontSize: "var(--mantine-font-size-xs)", fontWeight: 400 },
      },
    }),
  },
});

// Past prices never change, and a failed load has its own Try again
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
