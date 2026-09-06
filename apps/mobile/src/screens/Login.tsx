import { MAIL_LOG } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Mascot } from "../components/Mascot";
import { Screen } from "../components/Screen";
import { authClient } from "../lib/auth";
import { userFacingError } from "../lib/errors";
import { apiOrigin } from "../lib/host";
import { invitationIdFromInput, rememberInvite } from "../lib/invite";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { colors, radius, type } from "../theme";

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
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const emailSend = useRef(0);
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
    const sendId = ++emailSend.current;
    setError("");
    rememberInvite(inviteId);
    setSentTo(address);
    try {
      const result = await authClient.signIn.magicLink({
        email: address,
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      if (sendId !== emailSend.current) return;
      if (result.error) {
        setSentTo("");
        setError(result.error.message ?? "Could not send a sign-in link");
      } else {
        setOtp("");
      }
    } catch (caught) {
      if (sendId !== emailSend.current) return;
      setSentTo("");
      setError(userFacingError(caught, "Could not send a sign-in link"));
    }
  }

  async function continueWithCode() {
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.emailOtp({
        email: sentTo,
        otp: code,
      });
      setBusy(false);
      if (result.error) {
        setError(result.error.message ?? "That code did not work");
        return;
      }
      onAuthed();
    } catch (caught) {
      setBusy(false);
      setError(userFacingError(caught, "That code did not work"));
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
          <View style={styles.sent}>
            <Text style={styles.body}>
              Check {sentTo}. Tap Open Groxbot, or enter the 6-digit code.
              Expires in 15 minutes.
            </Text>
            {mailLogged ? (
              <Text style={styles.body}>
                Locally, that link and code are printed in the API terminal
                instead of an inbox.
              </Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Field
              label="Code"
              value={otp}
              onChangeText={(next) =>
                setOtp(next.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
            />
            <Button
              label="Enter code"
              onPress={() => void continueWithCode()}
              busy={busy}
              disabled={otp.length !== 6}
            />
          </View>
          <Button
            label="Use a different email"
            tone="ghost"
            onPress={() => {
              emailSend.current += 1;
              setSentTo("");
              setOtp("");
              setError("");
            }}
          />
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={type.kicker}>Welcome to Groxbot</Text>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.body}>Like Grok Bot, for the whole team.</Text>
          <Text selectable style={styles.host}>
            {apiOrigin()}
          </Text>
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
  block: { gap: 14, paddingTop: 24 },
  title: { ...type.title },
  body: { ...type.lede },
  host: { color: colors.faint, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  sent: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
});
