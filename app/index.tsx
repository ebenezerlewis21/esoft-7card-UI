import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Animated,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GoogleAdMobBanner from "../components/GoogleAdMobBanner";
import Text3D from "../components/Text3D";
import {
    type AuthCredential,
    clearAuthCredential,
    clearCurrentEmail,
    clearCurrentName,
    clearGuestSession,
    ensureUserProfile,
    isGuestSession,
    resolveApiUrl,
    setAuthCredential,
    setCurrentEmail,
    setCurrentName,
    setGuestSession,
} from "../constants/auth";
import { Feature } from "../constants/features";

type ThirdPartyProvider = "google" | "apple" | "facebook";

const THIRD_PARTY_AUTH_URLS: Record<ThirdPartyProvider, string> = {
  google: "https://accounts.google.com/signin",
  apple: "https://appleid.apple.com/sign-in",
  facebook: "https://www.facebook.com/login",
};

const SAVED_LOGIN_KEY = "@auth/savedLogin";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{7,}$/;
type CardIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

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

const CARD_VARIANTS: { name: CardIconName; color: string }[] = [
  { name: "cards-heart", color: "rgba(255, 120, 120, 0.34)" },
  { name: "cards-diamond", color: "rgba(255, 140, 140, 0.34)" },
  { name: "cards-spade", color: "rgba(215, 228, 255, 0.3)" },
  { name: "cards-club", color: "rgba(190, 214, 255, 0.3)" },
  { name: "cards-playing", color: "rgba(191, 214, 255, 0.24)" },
  { name: "cards-playing-outline", color: "rgba(180, 206, 255, 0.22)" },
];

const generateRandomCardVariants = (
  count: number,
): { name: CardIconName; color: string }[] => {
  const pool = [...CARD_VARIANTS];
  const picked: { name: CardIconName; color: string }[] = [];

  for (let index = 0; index < count; index += 1) {
    if (pool.length === 0) {
      pool.push(...CARD_VARIANTS);
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const [variant] = pool.splice(randomIndex, 1);
    picked.push(variant);
  }

  return picked;
};

const FALLING_CARD_CONFIG = [
  { left: "8%", duration: 5600, delay: 0, rotate: "-10deg", size: 30 },
  { left: "24%", duration: 7000, delay: 900, rotate: "8deg", size: 26 },
  { left: "42%", duration: 6200, delay: 1800, rotate: "-14deg", size: 32 },
  { left: "61%", duration: 7600, delay: 400, rotate: "12deg", size: 28 },
  { left: "79%", duration: 6700, delay: 1500, rotate: "-7deg", size: 30 },
] as const;

const TITLE_CARD_GRAPHIC: CardIconName[] = [
  "cards-heart",
  "cards-spade",
  "cards-diamond",
  "cards-club",
  "cards-playing",
  "cards-heart",
  "cards-spade",
];

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const { height: viewportHeight } = useWindowDimensions();
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV?.trim() ?? "";
  const isBackendAuthEnvironment = Feature.enableAuth.enabled;
  const backendEnvLabel = appEnv || "current";
  const devLoginPath =
    process.env.EXPO_PUBLIC_DEV_LOGIN_PATH ?? "api/auth/login";
  const devSignupPath =
    process.env.EXPO_PUBLIC_DEV_SIGNUP_PATH ?? "api/auth/signup";
  const devForgotPasswordPath =
    process.env.EXPO_PUBLIC_DEV_FORGOT_PASSWORD_PATH ??
    "api/auth/forgot-password";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [thirdPartyLoading, setThirdPartyLoading] =
    React.useState<ThirdPartyProvider | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [loginEmailError, setLoginEmailError] = React.useState<string | null>(
    null,
  );
  const [loginPasswordError, setLoginPasswordError] = React.useState<
    string | null
  >(null);
  const [showForgotPasswordModal, setShowForgotPasswordModal] =
    React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState("");
  const [isForgotPasswordSubmitting, setIsForgotPasswordSubmitting] =
    React.useState(false);
  const [forgotPasswordEmailError, setForgotPasswordEmailError] =
    React.useState<string | null>(null);
  const [forgotPasswordErrorMessage, setForgotPasswordErrorMessage] =
    React.useState<string | null>(null);
  const [showSignupModal, setShowSignupModal] = React.useState(false);
  const [signupName, setSignupName] = React.useState("");
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupPassword, setSignupPassword] = React.useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = React.useState("");
  const [signupPasswordVisible, setSignupPasswordVisible] =
    React.useState(false);
  const [signupConfirmPasswordVisible, setSignupConfirmPasswordVisible] =
    React.useState(false);
  const [isSignupSubmitting, setIsSignupSubmitting] = React.useState(false);
  const [signupNameError, setSignupNameError] = React.useState<string | null>(
    null,
  );
  const [signupEmailError, setSignupEmailError] = React.useState<string | null>(
    null,
  );
  const [signupPasswordError, setSignupPasswordError] = React.useState<
    string | null
  >(null);
  const [signupConfirmPasswordError, setSignupConfirmPasswordError] =
    React.useState<string | null>(null);
  const [signupErrorMessage, setSignupErrorMessage] = React.useState<
    string | null
  >(null);
  const [fallingCardVariants, setFallingCardVariants] = React.useState(() =>
    generateRandomCardVariants(FALLING_CARD_CONFIG.length),
  );

  const fallingCardAnimations = React.useRef(
    FALLING_CARD_CONFIG.map(() => new Animated.Value(0)),
  ).current;

  React.useEffect(() => {
    const loops = fallingCardAnimations.map((animation, index) => {
      animation.setValue(0);

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(FALLING_CARD_CONFIG[index].delay),
          Animated.timing(animation, {
            toValue: 1,
            duration: FALLING_CARD_CONFIG[index].duration,
            useNativeDriver: true,
          }),
        ]),
      );

      loop.start();
      return loop;
    });

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [fallingCardAnimations]);

  React.useEffect(() => {
    const reshuffleInterval = setInterval(() => {
      setFallingCardVariants(
        generateRandomCardVariants(FALLING_CARD_CONFIG.length),
      );
    }, 2200);

    return () => {
      clearInterval(reshuffleInterval);
    };
  }, []);

  const handleContinueAsGuest = React.useCallback(async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      try {
        await clearAuthCredential();
        await clearCurrentEmail();
        await clearCurrentName();
      } catch {
        // Continue guest flow even if local cleanup fails.
      }

      await setGuestSession();
      const guestSessionStarted = await isGuestSession();

      if (!guestSessionStarted) {
        setErrorMessage("Unable to start guest session.");
        return;
      }

      router.replace("/lobby");
    } catch {
      setErrorMessage("Unable to start guest session.");
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, router]);

  const handleThirdPartyAuth = React.useCallback(
    async (provider: ThirdPartyProvider) => {
      if (isBusy || thirdPartyLoading !== null) {
        return;
      }

      setErrorMessage(null);
      setThirdPartyLoading(provider);

      try {
        const targetUrl = THIRD_PARTY_AUTH_URLS[provider];
        const canOpen = await Linking.canOpenURL(targetUrl);

        if (!canOpen) {
          setErrorMessage("Unable to open provider authentication page.");
          return;
        }

        await Linking.openURL(targetUrl);
      } catch {
        setErrorMessage("Unable to complete third-party authentication.");
      } finally {
        setThirdPartyLoading(null);
      }
    },
    [isBusy, thirdPartyLoading],
  );

  const isActionBusy = isBusy || thirdPartyLoading !== null;

  const handleLoginSubmit = React.useCallback(async () => {
    if (isActionBusy) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    setLoginEmailError(null);
    setLoginPasswordError(null);

    if (!trimmedEmail) {
      setLoginEmailError("Enter your email to sign in.");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setLoginEmailError("Enter a valid email address.");
      return;
    }

    if (!password) {
      setLoginPasswordError("Enter your password to sign in.");
      return;
    }

    setErrorMessage(null);
    setIsBusy(true);

    try {
      if (isBackendAuthEnvironment) {
        const loginUrl = resolveApiUrl(devLoginPath);

        if (!loginUrl) {
          setErrorMessage(
            `API base URL is not configured for ${backendEnvLabel} login.`,
          );
          return;
        }

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
            if (response.status === 401) {
              setLoginPasswordError("Incorrect email or password.");
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

          let resolvedName = trimmedEmail.split("@")[0] || trimmedEmail;

          try {
            const payload = (await response.json()) as AuthResponsePayload;
            if (payload.success === false) {
              setLoginPasswordError("Incorrect email or password.");
              return;
            }

            const credential = credentialFromAuthPayload(payload, response.headers);
            if (!credential) {
              setErrorMessage("Sign-in response did not include an auth token.");
              return;
            }

            await setAuthCredential(credential);

            const responseName = firstStringValue(payload, ["name"]);
            if (responseName) {
              resolvedName = responseName;
            }
          } catch {
            setErrorMessage("Sign-in response was not valid token data.");
            return;
          }

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
            // Ignore local storage errors and continue auth flow.
          }

          router.replace("/lobby");
          return;
        } catch {
          setErrorMessage(`Unable to reach ${backendEnvLabel} login server.`);
          return;
        }
      }

      setErrorMessage("Authentication is unavailable in this environment.");
    } finally {
      setIsBusy(false);
    }
  }, [
    backendEnvLabel,
    devLoginPath,
    email,
    isActionBusy,
    isBackendAuthEnvironment,
    password,
    rememberMe,
    router,
  ]);

  const handleForgotPassword = React.useCallback(() => {
    setErrorMessage(null);
    setForgotPasswordEmailError(null);
    setForgotPasswordErrorMessage(null);
    setForgotPasswordEmail(email.trim().toLowerCase());
    setShowForgotPasswordModal(true);
  }, [email]);

  const handleCloseForgotPasswordModal = React.useCallback(() => {
    if (isForgotPasswordSubmitting) {
      return;
    }

    setShowForgotPasswordModal(false);
  }, [isForgotPasswordSubmitting]);

  const handleForgotPasswordSubmit = React.useCallback(async () => {
    if (isForgotPasswordSubmitting) {
      return;
    }

    const trimmedEmail = forgotPasswordEmail.trim().toLowerCase();
    setForgotPasswordEmailError(null);

    if (!trimmedEmail) {
      setForgotPasswordEmailError("Enter your email to reset password.");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setForgotPasswordEmailError("Enter a valid email address.");
      return;
    }

    setForgotPasswordErrorMessage(null);
    setIsForgotPasswordSubmitting(true);

    try {
      const forgotPasswordUrl = resolveApiUrl(devForgotPasswordPath);

      if (!forgotPasswordUrl) {
        setForgotPasswordErrorMessage(
          `API base URL is not configured for ${backendEnvLabel} password reset.`,
        );
        return;
      }

      try {
        const response = await fetch(forgotPasswordUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: trimmedEmail }),
        });

        if (!response.ok) {
          if (response.status === 400) {
            setForgotPasswordErrorMessage(
              "Invalid email format for password reset.",
            );
          } else if (response.status === 404) {
            setForgotPasswordErrorMessage(
              "Password reset endpoint is unavailable on the server.",
            );
          } else if (response.status === 429) {
            setForgotPasswordErrorMessage(
              "Too many reset attempts. Please try again later.",
            );
          } else if (response.status >= 500) {
            setForgotPasswordErrorMessage(
              "Server error while sending reset link. Please try again.",
            );
          } else {
            setForgotPasswordErrorMessage(
              "Unable to send reset link right now.",
            );
          }
          return;
        }
      } catch {
        setForgotPasswordErrorMessage(
          `Unable to reach ${backendEnvLabel} password reset server.`,
        );
        return;
      }

      setShowForgotPasswordModal(false);
      setForgotPasswordEmail("");
      setForgotPasswordErrorMessage(null);
      setErrorMessage(
        "If an account exists for that email, a password reset link has been sent.",
      );
    } finally {
      setIsForgotPasswordSubmitting(false);
    }
  }, [
    backendEnvLabel,
    devForgotPasswordPath,
    forgotPasswordEmail,
    isForgotPasswordSubmitting,
  ]);

  const handleOpenSignupModal = React.useCallback(() => {
    setSignupNameError(null);
    setSignupEmailError(null);
    setSignupPasswordError(null);
    setSignupConfirmPasswordError(null);
    setSignupErrorMessage(null);
    setShowSignupModal(true);
  }, []);

  const handleCloseSignupModal = React.useCallback(() => {
    if (isSignupSubmitting) {
      return;
    }

    setShowSignupModal(false);
  }, [isSignupSubmitting]);

  const handleSignupSubmit = React.useCallback(async () => {
    if (isSignupSubmitting) {
      return;
    }

    const trimmedName = signupName.trim();
    const trimmedEmail = signupEmail.trim();
    setSignupNameError(null);
    setSignupEmailError(null);
    setSignupPasswordError(null);
    setSignupConfirmPasswordError(null);

    if (!trimmedName) {
      setSignupNameError("Enter a name to create account.");
      return;
    }

    if (!trimmedEmail) {
      setSignupEmailError("Enter an email to create account.");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setSignupEmailError("Enter a valid email address.");
      return;
    }

    if (!signupPassword) {
      setSignupPasswordError("Enter a password to create account.");
      return;
    }

    if (!SIGNUP_PASSWORD_PATTERN.test(signupPassword)) {
      setSignupPasswordError(
        "Password must be at least 7 characters and include 1 uppercase letter, 1 number, and 1 special character.",
      );
      return;
    }

    if (!signupConfirmPassword) {
      setSignupConfirmPasswordError("Confirm your password to create account.");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupConfirmPasswordError("Passwords do not match.");
      return;
    }

    setSignupErrorMessage(null);
    setIsSignupSubmitting(true);

    try {
      if (isBackendAuthEnvironment) {
        const signupUrl = resolveApiUrl(devSignupPath);

        if (!signupUrl) {
          setSignupErrorMessage(
            `API base URL is not configured for ${backendEnvLabel} signup.`,
          );
          return;
        }

        try {
          const response = await fetch(signupUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: trimmedName,
              email: trimmedEmail,
              password: signupPassword,
            }),
          });

          if (!response.ok) {
            if (response.status === 409) {
              setSignupEmailError("This email is already registered.");
            } else if (response.status === 400) {
              setSignupErrorMessage(
                "Invalid sign-up details. Check name, email, and password.",
              );
            } else if (response.status === 403) {
              setSignupErrorMessage(
                "Sign-up blocked by server security. Please try again.",
              );
            } else if (response.status >= 500) {
              setSignupErrorMessage(
                "Server error during sign-up. Please try again.",
              );
            } else {
              setSignupErrorMessage("Unable to create account right now.");
            }
            return;
          }

          try {
            const payload = (await response.json()) as { success?: boolean };
            if (payload.success === false) {
              setSignupErrorMessage("Unable to create account right now.");
              return;
            }
          } catch {
            // If backend does not return JSON, rely on HTTP status.
          }
        } catch {
          setSignupErrorMessage(
            `Unable to reach ${backendEnvLabel} signup server.`,
          );
          return;
        }
      }

      setShowSignupModal(false);
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupConfirmPassword("");
      setSignupNameError(null);
      setSignupEmailError(null);
      setSignupPasswordError(null);
      setSignupConfirmPasswordError(null);
      setSignupErrorMessage(null);
      setErrorMessage("Account created. You can log in now.");
    } finally {
      setIsSignupSubmitting(false);
    }
  }, [
    backendEnvLabel,
    devSignupPath,
    isBackendAuthEnvironment,
    isSignupSubmitting,
    signupConfirmPassword,
    signupEmail,
    signupName,
    signupPassword,
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View
        pointerEvents="none"
        style={styles.fallingCardsLayer}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {fallingCardAnimations.map((animation, index) => {
          const config = FALLING_CARD_CONFIG[index];
          const variant =
            fallingCardVariants[index % fallingCardVariants.length] ??
            CARD_VARIANTS[index % CARD_VARIANTS.length];
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [-140, viewportHeight + 140],
          });

          return (
            <Animated.View
              key={`falling-card-${index}`}
              style={[
                styles.fallingCard,
                {
                  left: config.left,
                  transform: [{ translateY }, { rotate: config.rotate }],
                },
              ]}
            >
              <MaterialCommunityIcons
                name={variant.name}
                size={config.size}
                color={variant.color}
              />
            </Animated.View>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.hero}>
              <View
                style={styles.heroTitleRow}
                accessibilityRole="header"
                accessibilityLabel="7 Card Rummy"
              >
                <Text3D style={styles.titleWord} animate={false}>
                  7
                </Text3D>
                <View
                  style={styles.sevenCardsGraphic}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {TITLE_CARD_GRAPHIC.map((iconName, index) => (
                    <View
                      key={`title-card-${index}`}
                      style={[
                        styles.titleCardTile,
                        {
                          marginLeft: index === 0 ? 0 : -8,
                          zIndex: TITLE_CARD_GRAPHIC.length - index,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={iconName}
                        size={12}
                        color={index % 2 === 0 ? "#f06f78" : "#4f6286"}
                      />
                    </View>
                  ))}
                </View>
                <Text3D style={styles.titleWord} animate={false}>
                  Rummy
                </Text3D>
              </View>
            </View>

            <View style={styles.actions}>
              <View style={styles.card}>
                {Feature.enableAuth.enabled ? (
                  <>
                    <Text3D style={styles.loginFormTitle} animate={false}>
                      Login
                    </Text3D>

                    <View style={styles.fieldGroup}>
                      <Text3D style={styles.fieldLabel} animate={false}>
                        Email
                      </Text3D>
                      <TextInput
                        value={email}
                        onChangeText={(value) => {
                          setEmail(value);
                          setLoginEmailError(null);
                        }}
                        placeholder="Enter your email"
                        placeholderTextColor="#8f8f9d"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="next"
                        accessibilityLabel="Email"
                        accessibilityHint="Enter your email address"
                        style={styles.input}
                      />
                      {loginEmailError ? (
                        <Text3D style={styles.fieldErrorText} animate={false}>
                          {loginEmailError}
                        </Text3D>
                      ) : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text3D style={styles.fieldLabel} animate={false}>
                        Password
                      </Text3D>
                      <View style={styles.passwordRow}>
                        <TextInput
                          value={password}
                          onChangeText={(value) => {
                            setPassword(value);
                            setLoginPasswordError(null);
                          }}
                          placeholder="Enter your password"
                          placeholderTextColor="#8f8f9d"
                          secureTextEntry={!passwordVisible}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="current-password"
                          textContentType="password"
                          returnKeyType="done"
                          accessibilityLabel="Password"
                          accessibilityHint="Enter your password"
                          style={styles.passwordInput}
                        />
                        <Pressable
                          style={styles.eyeButton}
                          onPress={() => setPasswordVisible((value) => !value)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            passwordVisible ? "Hide password" : "Show password"
                          }
                          accessibilityHint="Toggles password visibility"
                        >
                          <MaterialCommunityIcons
                            name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#dde5ff"
                          />
                        </Pressable>
                      </View>
                      {loginPasswordError ? (
                        <Text3D style={styles.fieldErrorText} animate={false}>
                          {loginPasswordError}
                        </Text3D>
                      ) : null}
                    </View>

                    <View style={styles.signInAssistRow}>
                      <Pressable
                        style={styles.rememberMeButton}
                        onPress={() => setRememberMe((value) => !value)}
                        disabled={isActionBusy}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: rememberMe, disabled: isActionBusy }}
                        accessibilityLabel="Remember me"
                        accessibilityHint="Saves your login on this device"
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
                          Remember me
                        </Text3D>
                      </Pressable>

                      <Pressable
                        onPress={handleForgotPassword}
                        disabled={isActionBusy}
                        accessibilityRole="button"
                        accessibilityLabel="Forgot password"
                        accessibilityHint="Opens password recovery information"
                        accessibilityState={{ disabled: isActionBusy }}
                      >
                        <Text3D style={styles.forgotPasswordText} animate={false}>
                          Forgot password?
                        </Text3D>
                      </Pressable>
                    </View>

                    <Pressable
                      style={[
                        styles.primaryButton,
                        isActionBusy ? styles.buttonDisabled : null,
                      ]}
                      onPress={() => {
                        void handleLoginSubmit();
                      }}
                      disabled={isActionBusy}
                      accessibilityRole="button"
                      accessibilityLabel="Login"
                      accessibilityHint="Authenticates and opens the lobby"
                      accessibilityState={{ disabled: isActionBusy }}
                    >
                      <Text3D style={styles.primaryButtonText} animate={false}>
                        Login
                      </Text3D>
                    </Pressable>

                    {Feature.thirdPartyAuth.enabled ? (
                      <View style={styles.socialSection}>
                        <View style={styles.socialInlineRow}>
                          <Text3D style={styles.socialLabel} animate={false}>
                            Or sign in with
                          </Text3D>

                          <View style={styles.socialRow}>
                            <Pressable
                              style={[
                                styles.socialIconButton,
                                thirdPartyLoading === "google" ? styles.socialButtonBusy : null,
                              ]}
                              onPress={() => {
                                void handleThirdPartyAuth("google");
                              }}
                              disabled={isActionBusy}
                              accessibilityRole="button"
                              accessibilityLabel="Continue with Google"
                              accessibilityHint="Opens Google sign in"
                              accessibilityState={{ disabled: isActionBusy }}
                            >
                              <MaterialCommunityIcons name="google" size={22} color="#d14c3c" />
                            </Pressable>

                            <Pressable
                              style={[
                                styles.socialIconButton,
                                thirdPartyLoading === "apple" ? styles.socialButtonBusy : null,
                              ]}
                              onPress={() => {
                                void handleThirdPartyAuth("apple");
                              }}
                              disabled={isActionBusy}
                              accessibilityRole="button"
                              accessibilityLabel="Continue with Apple"
                              accessibilityHint="Opens Apple sign in"
                              accessibilityState={{ disabled: isActionBusy }}
                            >
                              <MaterialCommunityIcons name="apple" size={22} color="#ffffff" />
                            </Pressable>

                            <Pressable
                              style={[
                                styles.socialIconButton,
                                thirdPartyLoading === "facebook" ? styles.socialButtonBusy : null,
                              ]}
                              onPress={() => {
                                void handleThirdPartyAuth("facebook");
                              }}
                              disabled={isActionBusy}
                              accessibilityRole="button"
                              accessibilityLabel="Continue with Facebook"
                              accessibilityHint="Opens Facebook sign in"
                              accessibilityState={{ disabled: isActionBusy }}
                            >
                              <MaterialCommunityIcons
                                name="facebook"
                                size={22}
                                color="#2454bf"
                              />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.registerRow}>
                      <Text3D style={styles.registerPromptText} animate={false}>
                        Don&apos;t have an account?
                      </Text3D>
                      <Pressable
                        onPress={handleOpenSignupModal}
                        disabled={isActionBusy}
                        accessibilityRole="link"
                        accessibilityLabel="Register"
                        accessibilityHint="Opens create account form"
                        accessibilityState={{ disabled: isActionBusy }}
                      >
                        <Text3D style={styles.registerLinkText} animate={false}>
                          Register
                        </Text3D>
                      </Pressable>
                    </View>
                  </>
                ) : null}

            <Pressable
              style={[
                styles.secondaryButton,
                isActionBusy ? styles.buttonDisabled : null,
              ]}
              onPress={() => {
                void handleContinueAsGuest();
              }}
              disabled={isActionBusy}
              accessibilityRole="button"
              accessibilityLabel="Continue as guest"
              accessibilityHint="Enters the game without creating an account"
              accessibilityState={{ disabled: isActionBusy }}
            >
              <Text3D style={styles.secondaryButtonText} animate={false}>
                Continue as Guest
              </Text3D>
            </Pressable>
          </View>

              {errorMessage ? (
                <Text3D style={styles.errorText} animate={false}>
                  {errorMessage}
                </Text3D>
              ) : null}

              <View style={styles.adBannerContainer}>
                <GoogleAdMobBanner />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseForgotPasswordModal}
        accessibilityViewIsModal
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text3D style={styles.modalTitle} animate={false}>
              Reset Password
            </Text3D>

            <Text3D style={styles.modalDescription} animate={false}>
              {"Enter your email and we will send a reset password link."}
            </Text3D>

            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Email
              </Text3D>
              <TextInput
                value={forgotPasswordEmail}
                onChangeText={(value) => {
                  setForgotPasswordEmail(value);
                  setForgotPasswordEmailError(null);
                }}
                placeholder="Enter your email"
                placeholderTextColor="#8f8f9d"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                accessibilityLabel="Reset password email"
                accessibilityHint="Enter your account email address"
                style={styles.input}
              />
              {forgotPasswordEmailError ? (
                <Text3D style={styles.fieldErrorText} animate={false}>
                  {forgotPasswordEmailError}
                </Text3D>
              ) : null}
            </View>

            {forgotPasswordErrorMessage ? (
              <Text3D style={styles.errorText} animate={false}>
                {forgotPasswordErrorMessage}
              </Text3D>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                isForgotPasswordSubmitting ? styles.buttonDisabled : null,
              ]}
              onPress={() => {
                void handleForgotPasswordSubmit();
              }}
              disabled={isForgotPasswordSubmitting}
              accessibilityRole="button"
              accessibilityLabel={
                isForgotPasswordSubmitting
                  ? "Sending reset link"
                  : "Send reset link"
              }
              accessibilityHint="Sends a password reset link to your email"
              accessibilityState={{
                disabled: isForgotPasswordSubmitting,
                busy: isForgotPasswordSubmitting,
              }}
            >
              <View style={styles.modalButtonContent}>
                {isForgotPasswordSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : null}
                <Text3D style={styles.primaryButtonText} animate={false}>
                  {isForgotPasswordSubmitting ? "Please wait..." : "Send Reset Link"}
                </Text3D>
              </View>
            </Pressable>

            <Pressable
              onPress={handleCloseForgotPasswordModal}
              disabled={isForgotPasswordSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Close reset password"
              accessibilityHint="Closes the reset password form"
              accessibilityState={{ disabled: isForgotPasswordSubmitting }}
            >
              <Text3D style={styles.modalCloseText} animate={false}>
                Cancel
              </Text3D>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSignupModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSignupModal}
        accessibilityViewIsModal
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text3D style={styles.modalTitle} animate={false}>
              Create Account
            </Text3D>

            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Name
              </Text3D>
              <TextInput
                value={signupName}
                onChangeText={(value) => {
                  setSignupName(value);
                  setSignupNameError(null);
                }}
                placeholder="Enter your name"
                placeholderTextColor="#8f8f9d"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                accessibilityLabel="Name"
                accessibilityHint="Enter your full name"
                style={styles.input}
              />
              {signupNameError ? (
                <Text3D style={styles.fieldErrorText} animate={false}>
                  {signupNameError}
                </Text3D>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Email
              </Text3D>
              <TextInput
                value={signupEmail}
                onChangeText={(value) => {
                  setSignupEmail(value);
                  setSignupEmailError(null);
                }}
                placeholder="Enter your email"
                placeholderTextColor="#8f8f9d"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                accessibilityLabel="Email"
                accessibilityHint="Enter your email address"
                style={styles.input}
              />
              {signupEmailError ? (
                <Text3D style={styles.fieldErrorText} animate={false}>
                  {signupEmailError}
                </Text3D>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Password
              </Text3D>
              <View style={styles.passwordRow}>
                <TextInput
                  value={signupPassword}
                  onChangeText={(value) => {
                    setSignupPassword(value);
                    setSignupPasswordError(null);
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#8f8f9d"
                  secureTextEntry={!signupPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  accessibilityLabel="Password"
                  accessibilityHint="Enter a new account password"
                  style={styles.passwordInput}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setSignupPasswordVisible((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    signupPasswordVisible ? "Hide password" : "Show password"
                  }
                  accessibilityHint="Toggles password visibility"
                >
                  <MaterialCommunityIcons
                    name={signupPasswordVisible ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#dde5ff"
                  />
                </Pressable>
              </View>
              {signupPasswordError ? (
                <Text3D style={styles.fieldErrorText} animate={false}>
                  {signupPasswordError}
                </Text3D>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text3D style={styles.fieldLabel} animate={false}>
                Confirm Password
              </Text3D>
              <View style={styles.passwordRow}>
                <TextInput
                  value={signupConfirmPassword}
                  onChangeText={(value) => {
                    setSignupConfirmPassword(value);
                    setSignupConfirmPasswordError(null);
                  }}
                  placeholder="Confirm your password"
                  placeholderTextColor="#8f8f9d"
                  secureTextEntry={!signupConfirmPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  accessibilityLabel="Confirm password"
                  accessibilityHint="Re-enter your password to confirm"
                  style={styles.passwordInput}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() =>
                    setSignupConfirmPasswordVisible((value) => !value)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    signupConfirmPasswordVisible
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  accessibilityHint="Toggles confirm password visibility"
                >
                  <MaterialCommunityIcons
                    name={
                      signupConfirmPasswordVisible ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color="#dde5ff"
                  />
                </Pressable>
              </View>
              {signupConfirmPasswordError ? (
                <Text3D style={styles.fieldErrorText} animate={false}>
                  {signupConfirmPasswordError}
                </Text3D>
              ) : null}
            </View>

            {signupErrorMessage ? (
              <Text3D style={styles.errorText} animate={false}>
                {signupErrorMessage}
              </Text3D>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                isSignupSubmitting ? styles.buttonDisabled : null,
              ]}
              onPress={() => {
                void handleSignupSubmit();
              }}
              disabled={isSignupSubmitting}
              accessibilityRole="button"
              accessibilityLabel={
                isSignupSubmitting ? "Creating account" : "Register"
              }
              accessibilityHint="Submits the sign up form"
              accessibilityState={{ disabled: isSignupSubmitting, busy: isSignupSubmitting }}
            >
              <View style={styles.modalButtonContent}>
                {isSignupSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : null}
                <Text3D style={styles.primaryButtonText} animate={false}>
                  {isSignupSubmitting ? "Please wait..." : "Register"}
                </Text3D>
              </View>
            </Pressable>

            <Pressable
              onPress={handleCloseSignupModal}
              disabled={isSignupSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Close sign up"
              accessibilityHint="Closes the sign up form"
              accessibilityState={{ disabled: isSignupSubmitting }}
            >
              <Text3D style={styles.modalCloseText} animate={false}>
                Cancel
              </Text3D>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#040812",
  },
  fallingCardsLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fallingCard: {
    position: "absolute",
    top: -120,
  },
  wrapper: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: "flex-start",
  },
  hero: {
    gap: 10,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  titleWord: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0.4,
    textShadowColor: "rgba(8, 15, 30, 0.85)",
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 7,
  },
  sevenCardsGraphic: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleCardTile: {
    width: 18,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cadbff",
    backgroundColor: "#f9fbff",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    gap: 12,
    marginTop: 12,
  },
  card: {
    backgroundColor: "rgba(10, 16, 30, 0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2b4265",
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 9,
    position: "relative",
  },
  loginFormTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#e8eeff",
    fontSize: 14,
    fontWeight: "700",
  },
  fieldErrorText: {
    color: "#ff9f9f",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
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
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  registerPromptText: {
    color: "#c6d3ef",
    fontSize: 14,
    fontWeight: "700",
  },
  registerLinkText: {
    color: "#8fb7ff",
    fontSize: 14,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  socialSection: {
    marginTop: 2,
  },
  socialInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  socialLabel: {
    color: "#b8c6e4",
    fontSize: 13,
    fontWeight: "700",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  socialIconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  socialButtonBusy: {
    opacity: 0.6,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  errorText: {
    color: "#ff9f9f",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  adBannerContainer: {
    marginTop: 22,
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 12, 20, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#171f2f",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#35527a",
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  modalDescription: {
    color: "#c7d4ed",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  modalButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalCloseText: {
    color: "#8fb7ff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
