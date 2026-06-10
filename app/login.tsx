import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Animated,
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
import {
  type AuthCredential,
  clearAuthCredential,
  clearCurrentEmail,
  clearCurrentName,
  clearGuestSession,
  ensureUserProfile,
  setAuthCredential,
  setCurrentEmail,
  setCurrentName,
  setGuestSession,
} from "../constants/auth";

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

const Feature = {
  thirdPartySignin: {
    enabled: false,
  },
} as const;

type AuthResponsePayload = {
  success?: boolean;
  name?: string;
  token?: string;
  accessToken?: string;
  access_token?: string;
  authToken?: string;
  bearerToken?: string;
  jwt?: string;
  sessionToken?: string;
  credentialType?: string;
  expiresAt?: string;
  expires_at?: string;
  refreshToken?: string;
  refresh_token?: string;
  refreshTokenExpiresAt?: string;
  refresh_token_expires_at?: string;
  auth?: AuthResponsePayload;
  data?: AuthResponsePayload;
  session?: AuthResponsePayload;
  user?: AuthResponsePayload;
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

const firstStringValue = (
  payload: AuthResponsePayload,
  keys: (keyof AuthResponsePayload)[],
): string | null => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const key of ["auth", "data", "session", "user"] as const) {
    const nested = payload[key];
    if (nested && typeof nested === "object") {
      const value = firstStringValue(nested, keys);
      if (value) return value;
    }
  }

  return null;
};

const tokenFromAuthorizationHeader = (headers: Headers): string | null => {
  const authorization =
    headers.get("authorization") ??
    headers.get("Authorization") ??
    headers.get("x-auth-token") ??
    headers.get("X-Auth-Token");
  const value = authorization?.trim() ?? "";
  if (!value) return null;

  const bearerMatch = value.match(/^Bearer\s+(.+)$/i);
  return (bearerMatch?.[1] ?? value).trim() || null;
};

const getObjectKeys = (payload: unknown): string[] =>
  payload && typeof payload === "object" && !Array.isArray(payload)
    ? Object.keys(payload as Record<string, unknown>)
    : [];

const credentialFromAuthPayload = (
  payload: AuthResponsePayload,
  responseHeaders?: Headers,
): AuthCredential | null => {
  const token =
    firstStringValue(payload, [
      "token",
      "accessToken",
      "access_token",
      "authToken",
      "bearerToken",
      "jwt",
      "sessionToken",
    ]) ??
    (responseHeaders ? tokenFromAuthorizationHeader(responseHeaders) : null);

  if (!token) {
    return null;
  }

  return {
    token,
    type: "Bearer",
    expiresAt: firstStringValue(payload, ["expiresAt", "expires_at"]),
    refreshToken: firstStringValue(payload, ["refreshToken", "refresh_token"]),
    refreshTokenExpiresAt: firstStringValue(payload, [
      "refreshTokenExpiresAt",
      "refresh_token_expires_at",
    ]),
  };
};

export default function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "";
  const isTestEnvironment = appEnv === "test";
  const isBackendAuthEnvironment =
    appEnv === "local" || appEnv === "production";
  const backendEnvLabel = appEnv === "production" ? "production" : "local";
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  const devLoginPath =
    process.env.EXPO_PUBLIC_DEV_LOGIN_PATH ?? "api/auth/login";
  const devSignupPath =
    process.env.EXPO_PUBLIC_DEV_SIGNUP_PATH ?? "api/auth/signup";

  const [authMode, setAuthMode] = React.useState<AuthMode>("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] =
    React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [thirdPartyLoading, setThirdPartyLoading] =
    React.useState<ThirdPartyProvider | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const cardIntroY = React.useRef(new Animated.Value(22)).current;
  const cardIntroOpacity = React.useRef(new Animated.Value(0)).current;
  const glowDrift = React.useRef(new Animated.Value(0)).current;

  const destination = "/lobby";
  const isThirdPartyAuthEnabled = Feature.thirdPartySignin.enabled;

  const submitLabel = authMode === "signup" ? "Create Account" : "Sign In";

  React.useEffect(() => {
    let cancelled = false;

    const loadSavedLogin = async (): Promise<void> => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_LOGIN_KEY);
        if (!raw || cancelled) return;

        const parsed = JSON.parse(raw) as {
          email?: string;
          name?: string;
          username?: string;
          rememberMe?: boolean;
        };

        if (parsed.rememberMe) {
          setRememberMe(true);
          setEmail(parsed.email ?? "");
          debugAuth("loaded saved login", {
            email: parsed.email ?? "",
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

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(cardIntroY, {
        toValue: 0,
        friction: 8,
        tension: 56,
        useNativeDriver: true,
      }),
      Animated.timing(cardIntroOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowDrift, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(glowDrift, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [cardIntroOpacity, cardIntroY, glowDrift]);

  const handleSubmit = React.useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    debugAuth("submit started", {
      authMode,
      name: trimmedName,
      email: trimmedEmail,
      env: process.env.EXPO_PUBLIC_APP_ENV ?? "unknown",
    });

    if (!trimmedEmail) {
      setErrorMessage("Enter an email to continue.");
      debugAuth("validation failed: missing email");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage("Enter a valid email address.");
      debugAuth("validation failed: invalid email", {
        email: trimmedEmail,
      });
      return;
    }

    if (authMode === "signup" && !trimmedName) {
      setErrorMessage("Enter a name to create account.");
      debugAuth("validation failed: missing name");
      return;
    }

    if (!password) {
      setErrorMessage("Enter a password to continue.");
      debugAuth("validation failed: missing password", {
        name: trimmedName,
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

    if (isBackendAuthEnvironment && authMode === "signin") {
      if (!apiBaseUrl) {
        setErrorMessage(
          `API base URL is not configured for ${backendEnvLabel} login.`,
        );
        return;
      }

      const loginUrl = `${apiBaseUrl.replace(/\/+$/, "")}/${devLoginPath.replace(/^\/+/, "")}`;
      debugAuth("calling dev login endpoint", {
        loginUrl,
        email: trimmedEmail,
        mode: "json",
      });

      let loginResponseName = trimmedName;

      try {
        await clearAuthCredential();
        await clearGuestSession();

        const response = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
          }),
        });

        if (!response.ok) {
          debugAuth("dev login rejected", {
            status: response.status,
            email: trimmedEmail,
          });
          if (response.status === 401) {
            setErrorMessage("Incorrect email or password.");
          } else if (response.status === 400) {
            setErrorMessage(
              "Invalid login request. Check your email and password.",
            );
          } else if (response.status === 403) {
            setErrorMessage(
              "Login blocked by server security. Please try again.",
            );
          } else if (response.status >= 500) {
            setErrorMessage("Server error during sign-in. Please try again.");
          } else {
            setErrorMessage("Unable to sign in right now.");
          }
          return;
        }

        debugAuth("dev login accepted", {
          status: response.status,
          email: trimmedEmail,
        });

        try {
          const payload = (await response.json()) as AuthResponsePayload;
          if (payload.success === false) {
            setErrorMessage("Incorrect email or password.");
            return;
          }

          const credential = credentialFromAuthPayload(
            payload,
            response.headers,
          );
          if (!credential) {
            debugAuth("login accepted without bearer token", {
              topLevelKeys: getObjectKeys(payload),
              authKeys: getObjectKeys(payload.auth),
              dataKeys: getObjectKeys(payload.data),
              sessionKeys: getObjectKeys(payload.session),
              userKeys: getObjectKeys(payload.user),
              hasAuthorizationHeader: Boolean(
                response.headers.get("authorization") ??
                  response.headers.get("Authorization"),
              ),
              hasXAuthTokenHeader: Boolean(
                response.headers.get("x-auth-token") ??
                  response.headers.get("X-Auth-Token"),
              ),
            });
            setErrorMessage("Sign-in response did not include an auth token.");
            return;
          }

          await setAuthCredential(credential);

          const responseName = firstStringValue(payload, ["name"]);
          if (responseName) {
            loginResponseName = responseName;
          }
        } catch {
          // Backend auth must return JSON token data.
          debugAuth("login response was not valid token JSON");
          setErrorMessage("Sign-in response was not valid token data.");
          return;
        }

        const resolvedName =
          loginResponseName || trimmedEmail.split("@")[0] || trimmedEmail;

        try {
          if (rememberMe) {
            await AsyncStorage.setItem(
              SAVED_LOGIN_KEY,
              JSON.stringify({
                email: trimmedEmail,
                name: resolvedName,
                rememberMe: true,
              }),
            );
          } else {
            await AsyncStorage.removeItem(SAVED_LOGIN_KEY);
          }

          await ensureUserProfile(resolvedName);
          await setCurrentEmail(trimmedEmail);
          await setCurrentName(resolvedName);
        } catch {
          // Ignore storage write errors and continue auth flow.
        }

        debugAuth("navigating after login", {
          name: resolvedName,
          destination,
        });
        router.replace(destination);
        return;
      } catch {
        debugAuth("dev login request failed", {
          loginUrl,
          email: trimmedEmail,
        });
        setErrorMessage(`Unable to reach ${backendEnvLabel} login server.`);
        return;
      }
    }

    if (isBackendAuthEnvironment && authMode === "signup") {
      if (!apiBaseUrl) {
        setErrorMessage(
          `API base URL is not configured for ${backendEnvLabel} signup.`,
        );
        return;
      }

      const signupUrl = `${apiBaseUrl.replace(/\/+$/, "")}/${devSignupPath.replace(/^\/+/, "")}`;
      debugAuth("calling dev signup endpoint", {
        signupUrl,
        name: trimmedName,
        email: trimmedEmail,
      });

      try {
        const response = await fetch(signupUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            password,
          }),
        });

        if (!response.ok) {
          debugAuth("dev signup rejected", {
            status: response.status,
            name: trimmedName,
          });
          if (response.status === 409) {
            setErrorMessage("This email is already registered.");
          } else if (response.status === 400) {
            setErrorMessage(
              "Invalid sign-up details. Check name, email, and password.",
            );
          } else if (response.status === 403) {
            setErrorMessage(
              "Sign-up blocked by server security. Please try again.",
            );
          } else if (response.status >= 500) {
            setErrorMessage("Server error during sign-up. Please try again.");
          } else {
            setErrorMessage("Unable to create account right now.");
          }
          return;
        }

        debugAuth("dev signup accepted", {
          status: response.status,
          name: trimmedName,
        });

        try {
          const payload = (await response.json()) as { success?: boolean };
          if (payload.success === false) {
            setErrorMessage("Unable to create account right now.");
            return;
          }
        } catch {
          // If backend does not return JSON, rely on HTTP status.
        }
      } catch {
        debugAuth("dev signup request failed", {
          signupUrl,
          name: trimmedName,
        });
        setErrorMessage(`Unable to reach ${backendEnvLabel} signup server.`);
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
      testAccounts[trimmedEmail] !== password
    ) {
      debugAuth("test login rejected", { email: trimmedEmail });
      setErrorMessage(
        "Invalid login for test environment. Please sign up first.",
      );
      return;
    }

    if (isTestEnvironment && authMode === "signup") {
      if (testAccounts[trimmedEmail]) {
        setErrorMessage("Email already exists in test environment.");
        return;
      }

      try {
        const nextAccounts = {
          ...testAccounts,
          [trimmedEmail]: password,
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
      name: trimmedName,
      rememberMe,
    });

    try {
      await clearAuthCredential();
      await clearGuestSession();

      if (rememberMe) {
        await AsyncStorage.setItem(
          SAVED_LOGIN_KEY,
          JSON.stringify({
            email: trimmedEmail,
            name: trimmedName,
            rememberMe: true,
          }),
        );
      } else {
        await AsyncStorage.removeItem(SAVED_LOGIN_KEY);
      }

      await ensureUserProfile(trimmedName);

      if (!isSignup) {
        await setCurrentEmail(trimmedEmail);
        await setCurrentName(trimmedName);
      }
    } catch {
      // Ignore storage write errors and continue auth flow.
    }

    if (isSignup) {
      debugAuth("signup completed, returning to sign-in", {
        name: trimmedName,
      });
      setAuthMode("signin");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRememberMe(false);
      return;
    }

    debugAuth("navigating after login", {
      name: trimmedName,
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
    isBackendAuthEnvironment,
    isTestEnvironment,
    backendEnvLabel,
    name,
    password,
    rememberMe,
    router,
  ]);

  const handleContinueAsGuest = React.useCallback(async () => {
    debugAuth("continue as guest", { destination });
    setErrorMessage(null);

    try {
      await clearAuthCredential();
      await clearCurrentEmail();
      await clearCurrentName();
      await setGuestSession();
    } catch {
      // Continue guest flow even if local cleanup fails.
    }

    router.replace(destination);
  }, [destination, router]);

  const handleSubmitPress = React.useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await handleSubmit();
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSubmit, isSubmitting]);

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

  const isBusy = thirdPartyLoading != null || isSubmitting;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <Animated.View
          style={[
            styles.glowOrbLarge,
            {
              transform: [
                {
                  translateY: glowDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -18],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.glowOrbSmall,
            {
              transform: [
                {
                  translateY: glowDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 14],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.wrapper}
      >
        <Animated.View
          style={[
            styles.brandBlock,
            {
              opacity: cardIntroOpacity,
              transform: [
                {
                  translateY: cardIntroY.interpolate({
                    inputRange: [0, 22],
                    outputRange: [0, 12],
                  }),
                },
              ],
            },
          ]}
        >
          <Text3D style={styles.kicker} animate={false}>
            {authMode === "signup" ? "Create Profile" : "Welcome Back"}
          </Text3D>
          <Text3D style={styles.title}>7-Card Lowball</Text3D>
          <Text3D style={styles.subtitle} animate={false}>
            {authMode === "signup"
              ? "Create your account to save stats and start your climb."
              : "Sign in to track progress and jump into your next hand."}
          </Text3D>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardIntroOpacity,
              transform: [{ translateY: cardIntroY }],
            },
          ]}
        >
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

          {authMode === "signup" ? (
            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Name
              </Text3D>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#8f8f9d"
                autoCapitalize="none"
                autoCorrect={false}
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
              void handleSubmitPress();
            }}
            disabled={isBusy}
          >
            <View style={styles.primaryButtonContent}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : null}
              <Text3D style={styles.primaryButtonText} animate={false}>
                {isSubmitting ? "Please wait..." : submitLabel}
              </Text3D>
            </View>
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
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0d1320",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  glowOrbLarge: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    right: -110,
    top: -70,
    backgroundColor: "rgba(64, 120, 255, 0.22)",
  },
  glowOrbSmall: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    left: -100,
    bottom: 120,
    backgroundColor: "rgba(52, 221, 206, 0.14)",
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
    paddingHorizontal: 4,
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
    backgroundColor: "#171f2f",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#35527a",
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 9,
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
    borderColor: "#3d5e8d",
    backgroundColor: "#101a2a",
    color: "#f3f6ff",
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3d5e8d",
    borderRadius: 12,
    backgroundColor: "#101a2a",
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
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
