import {
  Box,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useState } from "react";
import type { PriceReading } from "./api.ts";
import { formatTime, formatUsd } from "./format.ts";

const FIRST_ROWS = 10;

type Props = {
  readings: PriceReading[];
  notified: PriceReading[];
  loading: boolean;
};

export function AlertHistory({ readings, notified, loading }: Props) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? notified : notified.slice(0, FIRST_ROWS);
  const empty = !loading && notified.length === 0;

  return (
    <Stack gap="xs" maw={560} mt={6}>
      <Group justify="space-between" align="baseline">
        <Title order={2} fz={16} lh={1.3}>
          Alert History{" "}
          <Text span inherit fw={400} c="dimmed">
            (preview)
          </Text>
        </Title>
        {!loading && notified.length > 0 && (
          <Text fz="xs" c="dimmed">
            {notified.length === 1
              ? "1 notification"
              : `${notified.length} notifications`}
          </Text>
        )}
      </Group>
      <Paper withBorder style={{ overflow: "hidden" }}>
        {empty ? (
          <Stack gap={2} px="md" py="lg">
            <Text fz="sm">No notifications in this range</Text>
            {readings.length > 0 && <HighestPrice readings={readings} />}
          </Stack>
        ) : (
          <>
            <Table
              horizontalSpacing="md"
              highlightOnHover
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th fz="xs" fw={400} c="dimmed">
                    Time (CT)
                  </Table.Th>
                  <Table.Th fz="xs" fw={400} c="dimmed" ta="right">
                    SPP ($/MWh)
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>
                          <Skeleton h={12} w={i % 2 ? 104 : 118} />
                        </Table.Td>
                        <Table.Td>
                          <Skeleton h={12} w={56} ml="auto" />
                        </Table.Td>
                      </Table.Tr>
                    ))
                  : rows.map((reading) => (
                      <Table.Tr key={reading.interval_start_utc}>
                        <Table.Td>
                          {formatTime(reading.interval_start_utc)}
                        </Table.Td>
                        <Table.Td ta="right">{formatUsd(reading.spp)}</Table.Td>
                      </Table.Tr>
                    ))}
              </Table.Tbody>
            </Table>
            {!loading && notified.length > FIRST_ROWS && (
              <Box px="xs" py={6}>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll
                    ? `Show first ${FIRST_ROWS}`
                    : `Show all ${notified.length}`}
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Stack>
  );
}

function HighestPrice({ readings }: { readings: PriceReading[] }) {
  const highest = readings.reduce((max, r) => (r.spp > max.spp ? r : max));
  return (
    <Text fz="xs" c="dimmed">
      {`Highest SPP in this range was ${formatUsd(highest.spp)} (${formatTime(highest.interval_start_utc)} CT).`}
    </Text>
  );
}
