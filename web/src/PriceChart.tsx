import { Box, Center, Flex, Group, Paper, Skeleton, Text } from "@mantine/core";
import {
  LineChart,
  ScatterChart,
  type LineSeriesOption,
  type ScatterSeriesOption,
} from "echarts/charts";
import {
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef, type CSSProperties } from "react";
import type { PriceReading } from "./api.ts";
import { formatTime, formatUsd, formatUsdShort } from "./format.ts";

echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

type ChartOption = echarts.ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>;

type Props = {
  readings: PriceReading[];
  notified: PriceReading[];
  suppressed: PriceReading[];
  value: number;
};

const FONT = "Inter Variable, system-ui, sans-serif";
const DAY_MS = 24 * 60 * 60 * 1000;

const COLORS = {
  text: "#292b31",
  muted: "rgba(41, 43, 49, 0.72)",
  grid: "rgba(41, 43, 49, 0.07)",
  axis: "rgba(41, 43, 49, 0.18)",
  border: "#cfd3e5",
  surface: "#fff",
  spp: "#595d6c",
  value: "#9397ab",
  notified: "#796cbf",
  suppressed: "#c26e12",
};

const LEGEND: { label: string; swatch: CSSProperties }[] = [
  {
    label: "SPP",
    swatch: { width: 14, borderTop: `1.5px solid ${COLORS.spp}` },
  },
  {
    label: "Value",
    swatch: { width: 14, borderTop: `1px dashed ${COLORS.value}` },
  },
  {
    label: "Notified",
    swatch: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: COLORS.notified,
    },
  },
  {
    label: "Suppressed",
    swatch: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      border: `1.5px solid ${COLORS.suppressed}`,
    },
  },
];

// x values are CT clock times stored as UTC (see ctClockTime)
const dayLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

export function PriceChart({
  loading,
  ...props
}: Props & { loading: boolean }) {
  return (
    <Paper withBorder pt="sm" pb={6} px={{ base: "xs", sm: "md" }}>
      <Flex wrap="wrap" columnGap="lg" rowGap={4}>
        {LEGEND.map(({ label, swatch }) => (
          <Group key={label} gap={6}>
            <Box style={swatch} />
            <Text fz="xs" c="dimmed">
              {label}
            </Text>
          </Group>
        ))}
      </Flex>
      <Box pos="relative" h="clamp(220px, 34vw, 300px)" mt={6}>
        {loading ? (
          <Skeleton h="100%" />
        ) : props.readings.length === 0 ? (
          <Center h="100%">
            <Text fz="sm" c="dimmed">
              No prices for this range yet.
            </Text>
          </Center>
        ) : (
          <Chart {...props} />
        )}
      </Box>
    </Paper>
  );
}

function Chart({ readings, notified, suppressed, value }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts>(null);

  useEffect(() => {
    const instance = echarts.init(container.current!);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current!);
    chart.current = instance;
    return () => {
      observer.disconnect();
      instance.dispose();
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(
      chartOption(readings, notified, suppressed, value),
      true,
    );
  }, [readings, notified, suppressed, value]);

  return <Box ref={container} pos="absolute" inset={0} />;
}

// CT wall-clock time read as UTC (with useUTC), so day ticks land on CT
// midnight for any viewer
function ctClockTime(reading: PriceReading): number {
  return Date.parse(reading.interval_start_local.slice(0, 19) + "Z");
}

function point(reading: PriceReading): [number, number] {
  return [ctClockTime(reading), reading.spp];
}

function chartOption(
  readings: PriceReading[],
  notified: PriceReading[],
  suppressed: PriceReading[],
  value: number,
): ChartOption {
  const isNotified = new Set(notified);

  return {
    useUTC: true,
    animation: false,
    textStyle: { fontFamily: FONT },
    grid: { left: 62, right: 12, top: 14, bottom: 24 },
    xAxis: {
      type: "time",
      min: ctClockTime(readings[0]),
      max: ctClockTime(readings[readings.length - 1]),
      minInterval: DAY_MS,
      // Longer steps restart at each new month and leave uneven gaps
      maxInterval: 2 * DAY_MS,
      splitNumber: 8,
      axisLine: { lineStyle: { color: COLORS.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: COLORS.muted,
        fontSize: 11,
        hideOverlap: true,
        formatter: (time: number) => dayLabel.format(time),
      },
      splitLine: { show: true, lineStyle: { color: COLORS.grid } },
    },
    yAxis: {
      type: "value",
      splitNumber: 5,
      min: ({ min }) => Math.min(0, Math.floor(min / 50) * 50),
      max: ({ max }) =>
        Math.max(100, Math.ceil((Math.max(max, value) * 1.04) / 100) * 100),
      axisLabel: {
        color: COLORS.muted,
        fontSize: 11,
        formatter: (price: number) => formatUsdShort(price),
      },
      splitLine: { lineStyle: { color: COLORS.grid } },
    },
    tooltip: {
      trigger: "axis",
      confine: true,
      transitionDuration: 0,
      axisPointer: {
        type: "line",
        lineStyle: { color: COLORS.value, width: 1 },
      },
      backgroundColor: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: COLORS.text, fontSize: 12, fontFamily: FONT },
      extraCssText: "box-shadow:none;border-radius:8px;",
      formatter: (params) => {
        // Points can share an x (the repeated hour when daylight saving
        // ends), so the reading comes from the SPP line's index
        const spp = [params].flat().find((p) => p.seriesId === "spp");
        if (!spp) {
          return "";
        }
        const reading = readings[spp.dataIndex];
        const status = isNotified.has(reading)
          ? dot(COLORS.notified, COLORS.notified) + "Notified"
          : reading.spp >= value
            ? dot("transparent", COLORS.suppressed) + "Suppressed"
            : "Below value";
        return (
          `<div style="font-weight:500;margin-bottom:6px">${formatTime(reading.interval_start_utc)} CT</div>` +
          `<div style="display:grid;grid-template-columns:auto auto;column-gap:18px;row-gap:3px">` +
          `<span style="color:${COLORS.muted}">SPP</span><span style="text-align:right">${formatUsd(reading.spp)}/MWh</span>` +
          `<span style="color:${COLORS.muted}">Status</span><span style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">${status}</span>` +
          `</div>`
        );
      },
    },
    series: [
      {
        id: "spp",
        type: "line",
        data: readings.map(point),
        showSymbol: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 1.25, color: COLORS.spp },
        itemStyle: { color: COLORS.spp },
        z: 2,
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: [4, 4], width: 1, color: COLORS.value },
          label: {
            position: "start",
            distance: 6,
            color: COLORS.text,
            fontSize: 11,
            fontWeight: 500,
            backgroundColor: COLORS.surface,
            borderColor: COLORS.value,
            borderWidth: 1,
            padding: [2, 4],
            borderRadius: 3,
            formatter: formatUsdShort(value),
          },
          data: [{ yAxis: value }],
        },
      },
      {
        id: "suppressed",
        type: "scatter",
        data: suppressed.map(point),
        symbolSize: 6,
        itemStyle: {
          color: COLORS.surface,
          borderColor: COLORS.suppressed,
          borderWidth: 1.5,
        },
        z: 3,
      },
      {
        id: "notified",
        type: "scatter",
        data: notified.map(point),
        symbolSize: 8,
        itemStyle: {
          color: COLORS.notified,
          borderColor: COLORS.surface,
          borderWidth: 1,
        },
        z: 4,
      },
    ],
  };
}

function dot(fill: string, border: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;box-sizing:border-box;background:${fill};border:1.5px solid ${border}"></span>`;
}
