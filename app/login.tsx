import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text3D from "../components/Text3D";
import { ensureUserProfile, setCurrentUsername } from "../constants/auth";
import { Feature } from "../constants/feature";

type AuthMode = "signin" | "signup";
type ThirdPartyProvider = "google" | "apple" | "facebook";

const SAVED_LOGIN_KEY = "@auth/savedLogin";
const TEST_ACCOUNTS_KEY = "@auth/testAccounts";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THIRD_PARTY_AUTH_URLS: Record<ThirdPartyProvider, string> = {
  google: "https://accounts.google.com/signin",
  apple: "https://appleid.apple.com/sign-in",
  facebook: "https://www.facebook.com/login",
};

const debugAuth = (
  message: string,
  payload?: Record<string, unknown>,
): void => {
  if (!__DEV__) return;
  if (payload) {
    console.log(`[login] ${message}`, payload);
    return;
  }

  console.log(`[login] ${message}`);
};

export default function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const isDevEnvironment = process.env.EXPO_PUBLIC_APP_ENV === "local";
  const isTestEnvironment = process.env.EXPO_PUBLIC_APP_ENV === "test";
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  const devLoginPath = process.env.EXPO_PUBLIC_DEV_LOGIN_PATH ?? "dev/login";
  const devSignupPath = process.env.EXPO_PUBLIC_DEV_SIGNUP_PATH ?? "dev/signup";

  const [authMode, setAuthMode] = React.useState<AuthMode>("signin");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] =
    React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [thirdPartyLoading, setThirdPartyLoading] =
    React.useState<ThirdPartyProvider | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const destination = Feature.lobbyScreen.enabled() ? "/lobby" : "/game";
  const isThirdPartyAuthEnabled =
    Feature.authenticate.enabled() && Feature.thirdPartyAuth.enabled();

  const submitLabel = authMode === "signup" ? "Create Account" : "Sign In";

  React.useEffect(() => {
    let cancelled = false;

    const loadSavedLogin = async (): Promise<void> => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_LOGIN_KEY);
        if (!raw || cancelled) return;

        const parsed = JSON.parse(raw) as {
          username?: string;
          password?: string;
          rememberMe?: boolean;
        };

        if (parsed.rememberMe) {
          setRememberMe(true);
          setUsername(parsed.username ?? "");
          setPassword(parsed.password ?? "");
          debugAuth("loaded saved login", {
            username: parsed.username ?? "",
            rememberMe: true,
          });
        }
      } catch {
        debugAuth("failed to read saved login from storage");
        // Ignore storage parse/read errors.
      }
    };

    void loadSavedLogin();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = React.useCallback(async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    debugAuth("submit started", {
      authMode,
      username: trimmedUsername,
      hasEmail: Boolean(trimmedEmail),
      env: process.env.EXPO_PUBLIC_APP_ENV ?? "unknown",
    });

    if (!trimmedUsername) {
      setErrorMessage("Enter a username to continue.");
      debugAuth("validation failed: missing username");
      return;
    }

    if (!password) {
      setErrorMessage("Enter a password to continue.");
      debugAuth("validation failed: missing password", {
        username: trimmedUsername,
      });
      return;
    }

    if (authMode === "signup") {
      if (!trimmedEmail) {
        setErrorMessage("Enter an email to create account.");
        return;
      }

      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        setErrorMessage("Enter a valid email address.");
        return;
      }

      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }

      if (!confirmPassword) {
        setErrorMessage("Confirm your password to create account.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
    }

    if (isDevEnvironment && authMode === "signin") {
      if (!apiBaseUrl) {
        setErrorMessage("API base URL is not configured for local login.");
        return;
      }

      const loginUrl = `${apiBaseUrl.replace(/\/+$/, "")}/${devLoginPath.replace(/^\/+/, "")}`;
      debugAuth("calling dev login endpoint", {
        loginUrl,
        username: trimmedUsername,
      });

      try {
        const response = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: trimmedUsername,
            password,
          }),
        });

        if (!response.ok) {
          debugAuth("dev login rejected", {
            status: response.status,
            username: trimmedUsername,
          });
          setErrorMessage("Invalid login credentials.");
          return;
        }

        debugAuth("dev login accepted", {
          status: response.status,
          username: trimmedUsername,
        });

        try {
          const payload = (await response.json()) as { success?: boolean };
          if (payload.success === false) {
            setErrorMessage("Invalid login credentials.");
            return;
          }
        } catch {
          // If backend does not return JSON, rely on HTTP status.
        }
      } catch {
        debugAuth("dev login request failed", {
          loginUrl,
          username: trimmedUsername,
        });
        setErrorMessage("Unable to reach local login server.");
        return;
      }
    }

    if (isDevEnvironment && authMode === "signup") {
      if (!apiBaseUrl) {
        setErrorMessage("API base URL is not configured for local signup.");
        return;
      }

      const signupUrl = `${apiBaseUrl.replace(/\/+$/, "")}/${devSignupPath.replace(/^\/+/, "")}`;
      debugAuth("calling dev signup endpoint", {
        signupUrl,
        username: trimmedUsername,
        email: trimmedEmail,
      });

      try {
        const response = await fetch(signupUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: trimmedUsername,
            email: trimmedEmail,
            password,
          }),
        });

        if (!response.ok) {
          debugAuth("dev signup rejected", {
            status: response.status,
            username: trimmedUsername,
          });
          setErrorMessage("Unable to create account.");
          return;
        }

        debugAuth("dev signup accepted", {
          status: response.status,
          username: trimmedUsername,
        });

        try {
          const payload = (await response.json()) as { success?: boolean };
          if (payload.success === false) {
            setErrorMessage("Unable to create account.");
            return;
          }
        } catch {
          // If backend does not return JSON, rely on HTTP status.
        }
      } catch {
        debugAuth("dev signup request failed", {
          signupUrl,
          username: trimmedUsername,
        });
        setErrorMessage("Unable to reach local signup server.");
        return;
      }
    }

    let testAccounts: Record<string, string> = {};

    if (isTestEnvironment) {
      try {
        const raw = await AsyncStorage.getItem(TEST_ACCOUNTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, string>;
          testAccounts = {
            ...testAccounts,
            ...parsed,
          };
        }
      } catch {
        setErrorMessage("Unable to load test accounts.");
        return;
      }
    }

    if (
      isTestEnvironment &&
      authMode === "signin" &&
      testAccounts[trimmedUsername] !== password
    ) {
      debugAuth("test login rejected", { username: trimmedUsername });
      setErrorMessage(
        "Invalid login for test environment. Please sign up first.",
      );
      return;
    }

    if (isTestEnvironment && authMode === "signup") {
      if (testAccounts[trimmedUsername]) {
        setErrorMessage("Username already exists in test environment.");
        return;
      }

      try {
        const nextAccounts = {
          ...testAccounts,
          [trimmedUsername]: password,
        };
        await AsyncStorage.setItem(
          TEST_ACCOUNTS_KEY,
          JSON.stringify(nextAccounts),
        );
      } catch {
        setErrorMessage("Unable to create test account.");
        return;
      }
    }

    const isSignup = authMode === "signup";

    setErrorMessage(null);
    debugAuth("login accepted, persisting user", {
      username: trimmedUsername,
      rememberMe,
    });

    try {
      if (rememberMe) {
        await AsyncStorage.setItem(
          SAVED_LOGIN_KEY,
          JSON.stringify({
            username: trimmedUsername,
            password,
            rememberMe: true,
          }),
        );
      } else {
        await AsyncStorage.removeItem(SAVED_LOGIN_KEY);
      }

      await ensureUserProfile(trimmedUsername);

      if (!isSignup) {
        await setCurrentUsername(trimmedUsername);
      }
    } catch {
      // Ignore storage write errors and continue auth flow.
    }

    if (isSignup) {
      debugAuth("signup completed, returning to sign-in", {
        username: trimmedUsername,
      });
      setAuthMode("signin");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRememberMe(false);
      return;
    }

    debugAuth("navigating after login", {
      username: trimmedUsername,
      destination,
    });
    router.replace(destination);
  }, [
    authMode,
    apiBaseUrl,
    confirmPassword,
    devLoginPath,
    devSignupPath,
    destination,
    email,
    isDevEnvironment,
    isTestEnvironment,
    password,
    rememberMe,
    router,
    username,
  ]);

  const handleContinueAsGuest = React.useCallback(() => {
    debugAuth("continue as guest", { destination });
    setErrorMessage(null);
    router.replace(destination);
  }, [destination, router]);

  const handleForgotPassword = React.useCallback(() => {
    setErrorMessage(null);
    router.push("/under-construction");
  }, [router]);

  const handleThirdPartyAuth = React.useCallback(
    async (provider: ThirdPartyProvider) => {
      if (!isThirdPartyAuthEnabled) {
        setErrorMessage("Third-party authentication is disabled.");
        return;
      }

      setErrorMessage(null);
      setThirdPartyLoading(provider);
      debugAuth("third-party auth started", { provider });

      try {
        const targetUrl = THIRD_PARTY_AUTH_URLS[provider];
        const canOpen = await Linking.canOpenURL(targetUrl);
        if (!canOpen) {
          debugAuth("third-party auth cannot open url", {
            provider,
            targetUrl,
          });
          setErrorMessage("Unable to open provider authentication page.");
          return;
        }

        debugAuth("opening third-party auth url", { provider, targetUrl });
        await Linking.openURL(targetUrl);
      } catch {
        debugAuth("third-party auth failed", { provider });
        setErrorMessage("Unable to complete third-party authentication.");
      } finally {
        setThirdPartyLoading(null);
      }
    },
    [isThirdPartyAuthEnabled],
  );

  const isBusy = thirdPartyLoading != null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.wrapper}
      >
        <View style={styles.brandBlock}>
          <Text3D style={styles.kicker} animate={false}>
            {authMode === "signup" ? "Create Profile" : "Welcome Back"}
          </Text3D>
          <Text3D style={styles.title}>7-Card Lowball</Text3D>
          <Text3D style={styles.subtitle} animate={false}>
            {authMode === "signup"
              ? "Create your account to save stats and start your climb."
              : "Sign in to track progress and jump into your next hand."}
          </Text3D>
        </View>

        <View style={styles.card}>
          <View style={styles.modeSwitch}>
            <Pressable
              style={[
                styles.modeOption,
                authMode === "signin" ? styles.modeOptionActive : null,
              ]}
              onPress={() => {
                setAuthMode("signin");
                setErrorMessage(null);
              }}
            >
              <Text3D style={styles.modeOptionText} animate={false}>
                Sign In
              </Text3D>
            </Pressable>

            <Pressable
              style={[
                styles.modeOption,
                authMode === "signup" ? styles.modeOptionActive : null,
              ]}
              onPress={() => {
                setAuthMode("signup");
                setErrorMessage(null);
              }}
            >
              <Text3D style={styles.modeOptionText} animate={false}>
                Sign Up
              </Text3D>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text3D style={styles.fieldLabel} animate={false}>
              Username
            </Text3D>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#8f8f9d"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          {authMode === "signup" ? (
            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Email
              </Text3D>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#8f8f9d"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text3D style={styles.fieldLabel} animate={false}>
              Password
            </Text3D>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#8f8f9d"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.passwordInput}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setPasswordVisible((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={
                  passwordVisible ? "Hide password" : "Show password"
                }
              >
                <MaterialCommunityIcons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#dde5ff"
                />
              </Pressable>
            </View>
          </View>

          {authMode === "signup" ? (
            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Confirm Password
              </Text3D>
              <View style={styles.passwordRow}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor="#8f8f9d"
                  secureTextEntry={!confirmPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.passwordInput}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setConfirmPasswordVisible((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    confirmPasswordVisible
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  <MaterialCommunityIcons
                    name={
                      confirmPasswordVisible ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color="#dde5ff"
                  />
                </Pressable>
              </View>
            </View>
          ) : null}

          {authMode === "signin" ? (
            <View style={styles.signInAssistRow}>
              <Pressable
                style={styles.rememberMeButton}
                onPress={() => setRememberMe((value) => !value)}
                disabled={isBusy}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                accessibilityLabel="Save login info"
              >
                <MaterialCommunityIcons
                  name={
                    rememberMe
                      ? "checkbox-marked-outline"
                      : "checkbox-blank-outline"
                  }
                  size={18}
                  color={rememberMe ? "#8fb7ff" : "#7a88a8"}
                />
                <Text3D style={styles.rememberMeText} animate={false}>
                  Save login info
                </Text3D>
              </Pressable>

              <Pressable
                onPress={handleForgotPassword}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
              >
                <Text3D style={styles.forgotPasswordText} animate={false}>
                  Forgot password?
                </Text3D>
              </Pressable>
            </View>
          ) : null}

          {errorMessage ? (
            <Text3D style={styles.errorText} animate={false}>
              {errorMessage}
            </Text3D>
          ) : null}

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              void handleSubmit();
            }}
          >
            <Text3D style={styles.primaryButtonText} animate={false}>
              {submitLabel}
            </Text3D>
          </Pressable>

          {isThirdPartyAuthEnabled ? (
            <View style={styles.socialSection}>
              <Text3D style={styles.socialLabel} animate={false}>
                {authMode === "signup" ? "Or sign up with" : "Or continue with"}
              </Text3D>

              <View style={styles.socialRow}>
                <Pressable
                  style={[
                    styles.socialIconButton,
                    styles.googleButton,
                    thirdPartyLoading === "google"
                      ? styles.socialButtonBusy
                      : null,
                  ]}
                  onPress={() => {
                    void handleThirdPartyAuth("google");
                  }}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                >
                  <MaterialCommunityIcons
                    name="google"
                    size={18}
                    color="#ffffff"
                  />
                </Pressable>

                <Pressable
                  style={[
                    styles.socialIconButton,
                    styles.appleButton,
                    thirdPartyLoading === "apple"
                      ? styles.socialButtonBusy
                      : null,
                  ]}
                  onPress={() => {
                    void handleThirdPartyAuth("apple");
                  }}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Apple"
                >
                  <MaterialCommunityIcons
                    name="apple"
                    size={18}
                    color="#ffffff"
                  />
                </Pressable>

                <Pressable
                  style={[
                    styles.socialIconButton,
                    styles.facebookButton,
                    thirdPartyLoading === "facebook"
                      ? styles.socialButtonBusy
                      : null,
                  ]}
                  onPress={() => {
                    void handleThirdPartyAuth("facebook");
                  }}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Facebook"
                >
                  <MaterialCommunityIcons
                    name="facebook"
                    size={18}
                    color="#ffffff"
                  />
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            style={styles.secondaryButton}
            onPress={handleContinueAsGuest}
            disabled={isBusy}
          >
            <Text3D style={styles.secondaryButtonText} animate={false}>
              Continue as Guest
            </Text3D>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#12161f",
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 28,
    justifyContent: "space-between",
    backgroundColor: "#12161f",
  },
  brandBlock: {
    gap: 10,
  },
  kicker: {
    color: "#79d0ff",
    fontSize: 16,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  title: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "#b9c4de",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#1a2130",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2b3952",
    padding: 20,
    gap: 16,
  },
  modeSwitch: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#324560",
    backgroundColor: "#111827",
    padding: 4,
    gap: 6,
  },
  modeOption: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeOptionActive: {
    backgroundColor: "#30589a",
  },
  modeOptionText: {
    color: "#e7eeff",
    fontSize: 14,
    fontWeight: "800",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#e8eeff",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334462",
    backgroundColor: "#0f1420",
    color: "#f3f6ff",
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334462",
    borderRadius: 12,
    backgroundColor: "#0f1420",
    height: 48,
    paddingRight: 6,
  },
  passwordInput: {
    flex: 1,
    color: "#f3f6ff",
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
    height: "100%",
  },
  eyeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#ff9f9f",
    fontSize: 13,
    fontWeight: "700",
  },
  signInAssistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -4,
    marginBottom: -2,
  },
  rememberMeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rememberMeText: {
    color: "#c6d3ef",
    fontSize: 13,
    fontWeight: "700",
  },
  forgotPasswordText: {
    color: "#8fb7ff",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#4a8dff",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  socialSection: {
    gap: 10,
    marginTop: 2,
  },
  socialLabel: {
    color: "#b8c6e4",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  socialIconButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  socialButtonBusy: {
    opacity: 0.6,
  },
  googleButton: {
    backgroundColor: "#d14c3c",
  },
  appleButton: {
    backgroundColor: "#1c1c21",
  },
  facebookButton: {
    backgroundColor: "#2454bf",
  },
  secondaryButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#466089",
    backgroundColor: "#152034",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#d9e7ff",
    fontSize: 15,
    fontWeight: "700",
  },
});
