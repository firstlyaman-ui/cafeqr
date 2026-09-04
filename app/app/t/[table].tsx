import { Redirect, useLocalSearchParams } from "expo-router";

import { padTable } from "@/lib/format";
import { Loading } from "@/components/ui";

/** Legacy demo path — redirect to velvet-bean cafe slug. */
export default function LegacyTableRedirect() {
  const params = useLocalSearchParams<{ table?: string; id?: string }>();
  const table = padTable(String(params.table || params.id || "01"));
  if (!table) return <Loading />;
  return <Redirect href={`/c/velvet-bean/t/${table}` as any} />;
}
