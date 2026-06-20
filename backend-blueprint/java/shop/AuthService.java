package com.example.game.shop;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private static final String JWT_ALG = "HS256";
  private static final long ACCESS_TOKEN_TTL_MINUTES = 15;
  private static final long REFRESH_TOKEN_TTL_DAYS = 14;
  private static final long PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
  private static final String DEFAULT_DEV_SECRET = "replace-this-dev-secret-with-long-random-string";

  private final AtomicLong nextUserId = new AtomicLong(1000);
  private final Map<String, UserRecord> usersByEmail = new ConcurrentHashMap<>();
  private final Map<String, RefreshTokenRecord> refreshTokensByToken = new ConcurrentHashMap<>();
  private final Map<String, PasswordResetTokenRecord> passwordResetTokensByToken =
      new ConcurrentHashMap<>();
  private final Map<String, Instant> revokedTokenIds = new ConcurrentHashMap<>();
  private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final byte[] jwtSecret;

  public AuthService() {
    String configuredSecret = readEnv("AUTH_JWT_SECRET");
    boolean productionMode = isProductionEnvironment();

    if (productionMode && (configuredSecret == null || configuredSecret.equals(DEFAULT_DEV_SECRET))) {
      throw new IllegalStateException("AUTH_JWT_SECRET must be set to a secure random value in production");
    }

    this.jwtSecret = (configuredSecret == null ? DEFAULT_DEV_SECRET : configuredSecret)
        .getBytes(StandardCharsets.UTF_8);
  }

  public SignupResult signup(String name, String email, String password) {
    String normalizedEmail = normalizeEmail(email);
    String normalizedName = normalizeName(name, normalizedEmail);
    validatePassword(password);

    String passwordHash = passwordEncoder.encode(password);
    UserRecord nextUser = new UserRecord(
        nextUserId.incrementAndGet(),
        normalizedName,
        normalizedEmail,
        passwordHash
    );

    UserRecord existing = usersByEmail.putIfAbsent(normalizedEmail, nextUser);
    if (existing != null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
    }

    return new SignupResult(nextUser.userId(), nextUser.name(), nextUser.email());
  }

  public LoginResult login(String email, String password) {
    String normalizedEmail = normalizeEmail(email);
    validatePassword(password);

    UserRecord user = usersByEmail.get(normalizedEmail);
    if (user == null || !passwordEncoder.matches(password, user.passwordHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    TokenPair tokenPair = issueTokenPair(user);
    return new LoginResult(
        user.userId(),
        user.name(),
        user.email(),
        tokenPair.accessToken(),
        "Bearer",
        tokenPair.accessTokenExpiresAt(),
        tokenPair.refreshToken(),
        tokenPair.refreshTokenExpiresAt()
    );
  }

  public RefreshResult refresh(String refreshToken) {
    String normalizedRefreshToken = normalizeToken(refreshToken);
    pruneExpiredRevocations();

    RefreshTokenRecord record = refreshTokensByToken.get(normalizedRefreshToken);
    if (record == null || record.expiresAt().isBefore(Instant.now())) {
      refreshTokensByToken.remove(normalizedRefreshToken);
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is invalid or expired");
    }

    UserRecord user = usersByEmail.values().stream()
        .filter(entry -> entry.userId().equals(record.userId()))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

    refreshTokensByToken.remove(normalizedRefreshToken);
    TokenPair tokenPair = issueTokenPair(user);
    return new RefreshResult(
        tokenPair.accessToken(),
        "Bearer",
        tokenPair.accessTokenExpiresAt(),
        tokenPair.refreshToken(),
        tokenPair.refreshTokenExpiresAt()
    );
  }

  public ForgotPasswordResult forgotPassword(String email) {
    String normalizedEmail = normalizeEmail(email);
    UserRecord user = usersByEmail.get(normalizedEmail);

    if (user == null) {
      return new ForgotPasswordResult(true);
    }

    Instant expiresAt = Instant.now().plus(PASSWORD_RESET_TOKEN_TTL_MINUTES, ChronoUnit.MINUTES);
    String token = UUID.randomUUID().toString().replace("-", "")
        + UUID.randomUUID().toString().replace("-", "");

    pruneExpiredPasswordResetTokens();
    passwordResetTokensByToken.put(
        token,
        new PasswordResetTokenRecord(token, user.userId(), user.email(), expiresAt)
    );

    return new ForgotPasswordResult(true);
  }

  public Optional<AuthPrincipal> authenticateAuthorizationHeader(String authorizationHeader) {
    String token = extractBearerToken(authorizationHeader);
    if (token == null) {
      return Optional.empty();
    }

    return parseAndValidateAccessJwt(token);
  }

  public void logout(String authorizationHeader, String refreshToken) {
    String accessToken = extractBearerToken(authorizationHeader);
    if (accessToken != null) {
      parseJwtClaims(accessToken).ifPresent(claims -> {
        String jti = String.valueOf(claims.get("jti"));
        long exp = extractLongClaim(claims.get("exp"));
        if (!jti.isBlank()) {
          revokedTokenIds.put(jti, Instant.ofEpochSecond(exp));
        }
      });
    }

    if (refreshToken != null && !refreshToken.trim().isEmpty()) {
      refreshTokensByToken.remove(refreshToken.trim());
    }

    pruneExpiredRevocations();
  }

  private TokenPair issueTokenPair(UserRecord user) {
    Instant accessExpiry = Instant.now().plus(ACCESS_TOKEN_TTL_MINUTES, ChronoUnit.MINUTES);
    String accessJti = UUID.randomUUID().toString();
    String accessToken = createJwt(user, accessExpiry, accessJti, "access");

    Instant refreshExpiry = Instant.now().plus(REFRESH_TOKEN_TTL_DAYS, ChronoUnit.DAYS);
    String refreshToken = UUID.randomUUID().toString().replace("-", "")
        + UUID.randomUUID().toString().replace("-", "");

    refreshTokensByToken.put(
        refreshToken,
        new RefreshTokenRecord(refreshToken, user.userId(), refreshExpiry)
    );

    return new TokenPair(
        accessToken,
        accessExpiry.toString(),
        refreshToken,
        refreshExpiry.toString()
    );
  }

  private Optional<AuthPrincipal> parseAndValidateAccessJwt(String token) {
    Optional<Map<String, Object>> maybeClaims = parseJwtClaims(token);
    if (maybeClaims.isEmpty()) {
      return Optional.empty();
    }

    Map<String, Object> claims = maybeClaims.get();
    String tokenType = String.valueOf(claims.get("typ"));
    if (!"access".equals(tokenType)) {
      return Optional.empty();
    }

    long exp = extractLongClaim(claims.get("exp"));
    Instant expiresAt = Instant.ofEpochSecond(exp);
    if (expiresAt.isBefore(Instant.now())) {
      return Optional.empty();
    }

    String jti = String.valueOf(claims.get("jti"));
    Instant revokedUntil = revokedTokenIds.get(jti);
    if (revokedUntil != null && !revokedUntil.isBefore(Instant.now())) {
      return Optional.empty();
    }

    long userId = Long.parseLong(String.valueOf(claims.get("sub")));
    String email = String.valueOf(claims.get("email"));
    String name = String.valueOf(claims.get("name"));
    return Optional.of(new AuthPrincipal(userId, email, name));
  }

  private Optional<Map<String, Object>> parseJwtClaims(String token) {
    try {
      String[] parts = token.split("\\.");
      if (parts.length != 3) {
        return Optional.empty();
      }

      String encodedHeader = parts[0];
      String encodedPayload = parts[1];
      String encodedSignature = parts[2];

      String signingInput = encodedHeader + "." + encodedPayload;
      String expectedSignature = sign(signingInput);
      if (!MessageDigest.isEqual(
          expectedSignature.getBytes(StandardCharsets.UTF_8),
          encodedSignature.getBytes(StandardCharsets.UTF_8)
      )) {
        return Optional.empty();
      }

      byte[] payloadBytes = Base64.getUrlDecoder().decode(encodedPayload);
      Map<String, Object> claims = objectMapper.readValue(
          payloadBytes,
          new TypeReference<Map<String, Object>>() {}
      );

      return Optional.of(claims);
    } catch (Exception ignored) {
      return Optional.empty();
    }
  }

  private String createJwt(UserRecord user, Instant expiresAt, String jti, String tokenType) {
    try {
      String headerJson = objectMapper.writeValueAsString(Map.of("alg", JWT_ALG, "typ", "JWT"));

      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("sub", String.valueOf(user.userId()));
      payload.put("email", user.email());
      payload.put("name", user.name());
      payload.put("jti", jti);
      payload.put("typ", tokenType);
      payload.put("iat", Instant.now().getEpochSecond());
      payload.put("exp", expiresAt.getEpochSecond());

      String payloadJson = objectMapper.writeValueAsString(payload);
      String encodedHeader = base64UrlEncode(headerJson.getBytes(StandardCharsets.UTF_8));
      String encodedPayload = base64UrlEncode(payloadJson.getBytes(StandardCharsets.UTF_8));
      String signingInput = encodedHeader + "." + encodedPayload;
      String signature = sign(signingInput);
      return signingInput + "." + signature;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate JWT");
    }
  }

  private long extractLongClaim(Object value) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    return Long.parseLong(String.valueOf(value));
  }

  private String sign(String input) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(jwtSecret, "HmacSHA256"));
      byte[] signature = mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
      return base64UrlEncode(signature);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to sign JWT");
    }
  }

  private String base64UrlEncode(byte[] data) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
  }

  private void pruneExpiredRevocations() {
    Instant now = Instant.now();
    revokedTokenIds.entrySet().removeIf(entry -> entry.getValue().isBefore(now));
  }

  private void pruneExpiredPasswordResetTokens() {
    Instant now = Instant.now();
    passwordResetTokensByToken.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
  }

  private String extractBearerToken(String authorizationHeader) {
    if (authorizationHeader == null || authorizationHeader.trim().isEmpty()) {
      return null;
    }

    String[] parts = authorizationHeader.trim().split("\\s+", 2);
    if (parts.length != 2) {
      return null;
    }

    String scheme = parts[0].trim().toLowerCase(Locale.ROOT);
    if (!"bearer".equals(scheme)) {
      return null;
    }

    String token = parts[1].trim();
    return token.isEmpty() ? null : token;
  }

  private static String normalizeEmail(String email) {
    if (email == null || email.trim().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
    }
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private static String normalizeName(String name, String email) {
    String trimmedName = name == null ? "" : name.trim();
    if (!trimmedName.isEmpty()) {
      return trimmedName;
    }

    int atIndex = email.indexOf('@');
    if (atIndex > 0) {
      return email.substring(0, atIndex);
    }
    return email;
  }

  private static void validatePassword(String password) {
    if (password == null || password.length() < 8) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
    }
  }

  private static String normalizeToken(String token) {
    if (token == null || token.trim().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refresh token is required");
    }
    return token.trim();
  }

  private boolean isProductionEnvironment() {
    String appEnv = readEnv("APP_ENV");
    String springProfiles = readEnv("SPRING_PROFILES_ACTIVE");

    return "production".equalsIgnoreCase(appEnv)
        || "prod".equalsIgnoreCase(appEnv)
        || (springProfiles != null && springProfiles.toLowerCase(Locale.ROOT).contains("prod"));
  }

  private String readEnv(String name) {
    String value = System.getenv(name);
    if (value == null) {
      return null;
    }

    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private record UserRecord(Long userId, String name, String email, String passwordHash) {}

  private record RefreshTokenRecord(String token, Long userId, Instant expiresAt) {}

  private record PasswordResetTokenRecord(String token, Long userId, String email, Instant expiresAt) {}

  private record TokenPair(
      String accessToken,
      String accessTokenExpiresAt,
      String refreshToken,
      String refreshTokenExpiresAt
  ) {}

  public record AuthPrincipal(Long userId, String email, String name) {}

  public record SignupResult(Long userId, String name, String email) {}

  public record LoginResult(
      Long userId,
      String name,
      String email,
      String token,
      String credentialType,
      String expiresAt,
      String refreshToken,
      String refreshTokenExpiresAt
  ) {}

  public record RefreshResult(
      String token,
      String credentialType,
      String expiresAt,
      String refreshToken,
      String refreshTokenExpiresAt
  ) {}

  public record ForgotPasswordResult(Boolean success) {}
}
