import {
  createTheme,
  Input,
  MantineProvider,
  Slider,
  type CSSVariablesResolver,
} from "@mantine/core";
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
        label: {
          fontSize: "var(--mantine-font-size-xs)",
          fontWeight: 400,
          color: "var(--mantine-color-dimmed)",
        },
      },
    }),
    // The mockup's thin slider: 4px track, 16px thumb with a 2px ring
    Slider: Slider.extend({
      defaultProps: { size: "xs", thumbSize: 16 },
      styles: { thumb: { borderWidth: 2 } },
    }),
  },
});

// Darker muted and error text, as in the mockup, for WCAG AA contrast
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-dimmed": "#6b6d73",
    "--mantine-color-error": "var(--mantine-color-red-9)",
  },
  dark: {},
});

// Past prices never change, so every loaded range stays cached. Failed loads,
// offline ones included, go straight to the error state and its Try again.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      networkMode: "always",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      forceColorScheme="light"
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
