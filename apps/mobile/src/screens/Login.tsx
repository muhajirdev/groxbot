import { MAIL_LOG } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Mascot } from "../components/Mascot";
import { Screen } from "../components/Screen";
import { authClient } from "../lib/auth";
import { userFacingError } from "../lib/errors";
import { invitationIdFromInput, rememberInvite } from "../lib/invite";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { colors } from "../theme";

export function LoginScreen({
  invite,
  onAuthed,
}: {
  invite?: string;
  onAuthed: () => void;
}) {
  const health = useQuery(orpc.health.queryOptions());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const inviteId = invitationIdFromInput(invite ?? "");
  const googleReady = health.data?.oauth?.includes("google") ?? false;
  const mailLogged = health.data?.mail === MAIL_LOG;
  const peekQuery = useQuery({
    ...orpc.workspaces.peek.queryOptions({
      input: { invitationId: inviteId || "-" },
    }),
    enabled: Boolean(inviteId),
  });
  const peek = peekQuery.data;

  useEffect(() => {
    if (peek?.email) setEmail(peek.email);
  }, [peek?.email]);

  const callbackURL = Linking.createURL("/");

  async function continueWithGoogle() {
    setBusy(true);
    setError("");
    if (!googleReady) {
      setBusy(false);
      setError("Google sign-in is not configured on this API.");
      return;
    }
    rememberInvite(inviteId);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      setBusy(false);
      if (result.error) setError(result.error.message ?? "Could not continue");
      else onAuthed();
    } catch (caught) {
      setBusy(false);
      setError(userFacingError(caught, "Could not continue"));
    }
  }

  async function continueWithEmail() {
    const address = email.trim().toLowerCase();
    if (!address.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    setError("");
    rememberInvite(inviteId);
    try {
      const result = await authClient.signIn.magicLink({
        email: address,
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      setBusy(false);
      if (result.error) {
        setError(result.error.message ?? "Could not send a sign-in link");
        return;
      }
      setSentTo(address);
    } catch (caught) {
      setBusy(false);
      setError(userFacingError(caught, "Could not send a sign-in link"));
    }
  }

  async function joinInvite() {
    if (!inviteId) return;
    setBusy(true);
    setError("");
    rememberInvite(inviteId);
    try {
      await client.workspaces.join({ invitationId: inviteId });
      onAuthed();
    } catch (caught) {
      setError(userFacingError(caught, "Could not join workspace"));
      setBusy(false);
    }
  }

  const heading = peek
    ? `Join ${peek.organizationName}.`
    : inviteId
      ? "Join a workspace."
      : "Get started";

  return (
    <Screen scroll>
      <Mascot size={64} mood="happy" />
      {sentTo ? (
        <View style={styles.block}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            We sent a sign-in link to {sentTo}. It expires in 15 minutes.
          </Text>
          {mailLogged ? (
            <Text style={styles.body}>
              Locally, that link is printed in the API terminal instead of an
              inbox.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.body}>Like Grok Bot, for the whole team.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {inviteId && peek ? (
            <Button
              label={`Join ${peek.organizationName}`}
              onPress={() => void joinInvite()}
              busy={busy}
            />
          ) : null}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
          />
          <Button
            label="Email me a link"
            onPress={() => void continueWithEmail()}
            busy={busy}
          />
          {googleReady ? (
            <Button
              label="Continue with Google"
              tone="ghost"
              onPress={() => void continueWithGoogle()}
              busy={busy}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12, paddingTop: 24 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  error: { color: colors.danger },
});
