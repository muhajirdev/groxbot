import {
  BILLING_INTERVAL_MONTH,
  BILLING_INTERVAL_YEAR,
  type BillingInterval,
  PRO_TRIAL_INTERVAL_COUNT,
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_PRICE_USD,
  WORKSPACE_PLAN_PRO,
  type WorkspacePlan,
} from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { planGateCopy } from "../lib/plan-gate";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Billing">;

function planLabel(plan: WorkspacePlan): string {
  if (plan === WORKSPACE_PLAN_BELIEVERS) return "Believers";
  if (plan === WORKSPACE_PLAN_PLUS) return "Pro Plus";
  if (plan === WORKSPACE_PLAN_PRO) return "Pro";
  return "Free";
}

export function BillingScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const billingQuery = useQuery(orpc.billing.status.queryOptions());
  const [interval, setInterval] = useState<BillingInterval>(
    BILLING_INTERVAL_MONTH,
  );
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState("");
  const billing = billingQuery.data;
  const gate = planGateCopy(Boolean(meQuery.data?.trialAvailable));

  async function checkout(plan: Exclude<WorkspacePlan, "none">) {
    setBusy("checkout");
    setError("");
    try {
      const result = await client.billing.checkout({ plan, interval });
      await Linking.openURL(result.url);
      await queryClient.invalidateQueries({ queryKey: orpc.billing.status.key() });
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not start checkout"));
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError("");
    try {
      const result = await client.billing.portal();
      await Linking.openURL(result.url);
    } catch (caught) {
      setError(userFacingError(caught, "Could not open billing portal"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll>
      <Header title="Usage & Billing" onBack={() => navigation.goBack()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
          {meQuery.data?.needsHostedPlan ? (
            <View style={styles.card}>
              <Text style={styles.title}>{gate.title}</Text>
              <Text style={styles.body}>{gate.body}</Text>
            </View>
          ) : null}
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
          {billing.portalAvailable && billing.plan !== "none" ? (
            <Button
              label="Manage subscription"
              tone="ghost"
              onPress={() => void openPortal()}
              busy={busy === "portal"}
            />
          ) : null}
          {billing.checkoutAvailable ? (
            <>
              <Text style={styles.section}>Subscribe</Text>
              <Text style={styles.body}>
                Pro starts with a {PRO_TRIAL_INTERVAL_COUNT}-day trial. Your own
                keys still need a plan; they are not counted against hosted
                usage.
              </Text>
              <View style={styles.row}>
                <Button
                  label="Monthly"
                  tone={interval === BILLING_INTERVAL_MONTH ? "accent" : "ghost"}
                  onPress={() => setInterval(BILLING_INTERVAL_MONTH)}
                />
                <Button
                  label="Yearly"
                  tone={interval === BILLING_INTERVAL_YEAR ? "accent" : "ghost"}
                  onPress={() => setInterval(BILLING_INTERVAL_YEAR)}
                />
              </View>
              {(
                [
                  WORKSPACE_PLAN_PRO,
                  WORKSPACE_PLAN_PLUS,
                  WORKSPACE_PLAN_BELIEVERS,
                ] as const
              ).map((plan) => (
                <Button
                  key={plan}
                  label={`${planLabel(plan)} · $${WORKSPACE_PLAN_PRICE_USD[plan][interval]}`}
                  tone="ghost"
                  onPress={() => void checkout(plan)}
                  busy={busy === "checkout"}
                />
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  section: { color: colors.text, fontWeight: "700", marginTop: 16 },
  title: { color: colors.text, fontSize: 20, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.faint },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  row: { flexDirection: "row", gap: 8 },
});
