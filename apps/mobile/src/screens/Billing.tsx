import {
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_PRO,
  type WorkspacePlan,
} from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { StyleSheet, Text } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { webOrigin } from "../lib/host";
import { orpc } from "../lib/orpc";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Billing">;

function planLabel(plan: WorkspacePlan): string {
  if (plan === WORKSPACE_PLAN_BELIEVERS) return "Believers";
  if (plan === WORKSPACE_PLAN_PLUS) return "Pro Plus";
  if (plan === WORKSPACE_PLAN_PRO) return "Pro";
  return "Free";
}

export function BillingScreen(_props: Props) {
  const billingQuery = useQuery(orpc.billing.status.queryOptions());
  const billing = billingQuery.data;

  return (
    <Screen scroll>
      {!billing ? (
        <Text style={styles.body}>
          {billingQuery.error ? "Could not load billing." : "Loading…"}
        </Text>
      ) : !billing.enabled ? (
        <Text style={styles.body}>
          Billing is off on this host. Self-host uses your own keys.
        </Text>
      ) : (
        <>
          <Text style={styles.section}>Workspace plan</Text>
          <Text style={styles.title}>{planLabel(billing.plan)}</Text>
          <Text style={styles.meta}>{billing.status || "No hosted plan yet"}</Text>
          {billing.includedUsagePercent !== null ? (
            <Text style={styles.body}>
              Included usage {billing.includedUsagePercent}% this period.
            </Text>
          ) : null}
          <Text style={styles.body}>
            Tokens {billing.usage.includedTokens.toLocaleString()} · Computer{" "}
            {billing.usage.computerMinutes} min
          </Text>
          <Text style={styles.body}>
            Change the plan in the web office. This app is read-only for
            billing.
          </Text>
          <Button
            label="Open web office"
            tone="ghost"
            onPress={() => void Linking.openURL(webOrigin())}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontWeight: "700", marginTop: 16 },
  title: { color: colors.text, fontSize: 20, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.faint },
});
