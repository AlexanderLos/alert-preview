import {
  Alert,
  Anchor,
  Button,
  Container,
  Divider,
  Flex,
  Group,
  Input,
  NativeSelect,
  NumberInput,
  Paper,
  SimpleGrid,
  Skeleton,
  Slider,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertHistory } from "./AlertHistory.tsx";
import { fetchPrices, TooManyRequestsError } from "./api.ts";
import { presets, rangeError, todayCT } from "./dates.ts";
import { formatUsdShort } from "./format.ts";
import { PriceChart } from "./PriceChart.tsx";
import { previewAlerts } from "./previewAlerts.ts";

const LOCATIONS = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST"];

export default function App() {
  const today = todayCT();
  const ranges = presets(today);

  const [location, setLocation] = useState("HB_HOUSTON");
  // NumberInput passes a string while empty or mid-edit ("", ".", "100."),
  // which the math reads as a number, or as 0 when it isn't one
  const [valueInput, setValueInput] = useState<number | string>(100);
  const [timeoutInput, setTimeoutInput] = useState<number | string>(30);
  const [start, setStart] = useState(ranges[0].start);
  const [end, setEnd] = useState(ranges[0].end);

  const value = Number(valueInput) || 0;
  const timeout = Number(timeoutInput) || 0;
  const dateError = rangeError(start, end);

  const { data, error, isFetching, isError, refetch } = useQuery({
    queryKey: ["prices", location, start, end],
    queryFn: () => fetchPrices(location, start, end),
    enabled: !dateError,
    placeholderData: keepPreviousData,
  });

  const readings = data ?? [];
  const notified = previewAlerts(readings, value, timeout);
  const isNotified = new Set(notified);
  const above = readings.filter((r) => r.spp >= value);
  const suppressed = above.filter((r) => !isNotified.has(r));

  // An invalid range leaves the previous results on screen, dimmed
  const showResults = !isError && (!dateError || data !== undefined);

  return (
    <Container
      size={1200}
      px={{ base: "md", md: 40 }}
      py={{ base: "lg", md: 36 }}
    >
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={1} fz={25} lh={1.12}>
            Alert Preview
          </Title>
          <Text fz="sm" c="dimmed">
            See how often an alert would have fired on past data.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          <Input.Wrapper label="Series" labelElement="div">
            <Text fz="sm" lh="36px">
              ERCOT SPP Real Time 15 Min
            </Text>
          </Input.Wrapper>

          <NativeSelect
            label="Location"
            data={LOCATIONS}
            value={location}
            onChange={(event) => setLocation(event.currentTarget.value)}
          />

          <Input.Wrapper label="Operation" labelElement="div">
            <Text fz="sm" lh="36px">
              is greater than or equal to
            </Text>
          </Input.Wrapper>

          <Input.Wrapper label="Value" labelElement="div">
            <Group gap="md" wrap="nowrap">
              <NumberInput
                aria-label="Value in $/MWh"
                w={118}
                leftSection="$"
                leftSectionWidth={24}
                rightSection={<Text fz="xs">/MWh</Text>}
                rightSectionWidth={46}
                hideControls
                min={0}
                max={5000} // ERCOT's offer cap
                allowNegative={false}
                value={valueInput}
                onChange={setValueInput}
              />
              <Slider
                thumbLabel="Value slider"
                flex={1}
                min={0}
                max={500}
                label={null}
                value={Math.min(value, 500)}
                onChange={setValueInput}
              />
            </Group>
          </Input.Wrapper>

          <Input.Wrapper
            label="Notification Timeout"
            labelElement="div"
            description="0 = notify on every reading at or above the value"
            inputWrapperOrder={["label", "input", "description"]}
          >
            <Group gap="md" wrap="nowrap">
              <NumberInput
                aria-label="Notification Timeout in minutes"
                w={118}
                rightSection={<Text fz="xs">min</Text>}
                hideControls
                min={0}
                max={360}
                allowNegative={false}
                allowDecimal={false}
                value={timeoutInput}
                onChange={setTimeoutInput}
              />
              <Slider
                thumbLabel="Notification Timeout in minutes"
                flex={1}
                min={0}
                max={360}
                step={15}
                label={null}
                value={timeout}
                onChange={setTimeoutInput}
              />
            </Group>
          </Input.Wrapper>

          <Stack gap={6}>
            <Input.Wrapper
              label="Date range"
              labelElement="div"
              error={dateError}
              errorProps={{ role: "alert" }}
            >
              <Group gap={6} wrap="nowrap">
                <DatePickerInput
                  aria-label="Start date"
                  flex={1}
                  valueFormat="MMM D, YYYY"
                  maxDate={today}
                  firstDayOfWeek={0}
                  value={start}
                  onChange={(date) => date && setStart(date)}
                />
                <Text c="dimmed" aria-hidden>
                  –
                </Text>
                <DatePickerInput
                  aria-label="End date"
                  flex={1}
                  valueFormat="MMM D, YYYY"
                  maxDate={today}
                  firstDayOfWeek={0}
                  value={end}
                  onChange={(date) => date && setEnd(date)}
                  error={Boolean(dateError)}
                />
              </Group>
            </Input.Wrapper>
            <Group gap={6}>
              {ranges.map((range) => {
                const active = range.start === start && range.end === end;
                return (
                  <Button
                    key={range.label}
                    size="compact-xs"
                    radius={6}
                    fw={400}
                    variant={active ? "outline" : "default"}
                    aria-pressed={active}
                    onClick={() => {
                      setStart(range.start);
                      setEnd(range.end);
                    }}
                  >
                    {range.label}
                  </Button>
                );
              })}
            </Group>
          </Stack>
        </SimpleGrid>

        <Stack
          component="section"
          aria-label="Preview results"
          gap="sm"
          mt="sm"
        >
          <Text fz={15}>
            {`Alert when ${location} SPP is greater than or equal to ${formatUsdShort(value)}/MWh · Notification Timeout ${timeout} min`}
          </Text>
          {isError && (
            <Alert
              color="red"
              bg="red.0"
              bd="1px solid var(--mantine-color-red-3)"
              py="sm"
              icon={warningIcon}
            >
              {error instanceof TooManyRequestsError ? (
                "Too many requests. Try again in a minute."
              ) : (
                <>
                  Couldn't load prices from Grid Status.{" "}
                  <Anchor
                    component="button"
                    inherit
                    c="blurple.7"
                    underline="always"
                    onClick={() => refetch()}
                  >
                    Try again.
                  </Anchor>
                </>
              )}
            </Alert>
          )}
          {showResults && (
            <Stack gap="md" opacity={dateError ? 0.45 : 1}>
              <Paper withBorder>
                <Flex>
                  <Stat
                    label="Notifications"
                    value={notified.length}
                    loading={isFetching}
                    accent
                  />
                  <Divider orientation="vertical" />
                  <Stat
                    label="Suppressed by timeout"
                    value={suppressed.length}
                    loading={isFetching}
                  />
                  <Divider orientation="vertical" />
                  <Stat
                    label="Readings at or above value"
                    value={above.length}
                    loading={isFetching}
                  />
                </Flex>
              </Paper>
              <PriceChart
                readings={readings}
                notified={notified}
                suppressed={suppressed}
                value={value}
                loading={isFetching}
              />
              <AlertHistory
                // A new location or range shows the first 10 rows again
                key={`${location} ${start} ${end}`}
                readings={readings}
                notified={notified}
                loading={isFetching}
              />
            </Stack>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

function Stat({
  label,
  value,
  loading,
  accent = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Stack
      flex={1}
      miw={0}
      gap={4}
      justify="space-between"
      px={{ base: "xs", sm: "md" }}
      py="sm"
    >
      <Text fz="xs" c="dimmed">
        {label}
      </Text>
      {loading ? (
        <Skeleton h={{ base: 24, sm: 31 }} w={44} />
      ) : (
        <Text
          fz={{ base: 22, sm: 28 }}
          fw={500}
          lh={1.1}
          c={accent ? "blurple.7" : undefined}
        >
          {value}
        </Text>
      )}
    </Stack>
  );
}

const warningIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 256 256"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" />
  </svg>
);
