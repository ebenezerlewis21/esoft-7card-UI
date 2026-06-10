package com.example.game.shop;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/signup")
  public SignupResponse signup(@RequestBody SignupRequest request) {
    AuthService.SignupResult result = authService.signup(request.name(), request.email(), request.password());
    return new SignupResponse(true, result.userId(), result.name(), result.email());
  }

  @PostMapping("/login")
  public LoginResponse login(@RequestBody LoginRequest request) {
    AuthService.LoginResult result = authService.login(request.email(), request.password());
    return new LoginResponse(
        true,
        result.userId(),
        result.name(),
        result.email(),
        result.token(),
        result.credentialType(),
        result.expiresAt(),
        result.refreshToken(),
        result.refreshTokenExpiresAt()
    );
  }

  @PostMapping("/refresh")
  public RefreshResponse refresh(@RequestBody RefreshRequest request) {
    AuthService.RefreshResult result = authService.refresh(request.refreshToken());
    return new RefreshResponse(
        true,
        result.token(),
        result.credentialType(),
        result.expiresAt(),
        result.refreshToken(),
        result.refreshTokenExpiresAt()
    );
  }

  @PostMapping("/logout")
  public void logout(HttpServletRequest request, @RequestBody(required = false) LogoutRequest body) {
    String refreshToken = body == null ? null : body.refreshToken();
    authService.logout(request.getHeader("Authorization"), refreshToken);
  }

  public record SignupRequest(String name, String email, String password) {}

  public record LoginRequest(String email, String password) {}

  public record RefreshRequest(String refreshToken) {}

  public record LogoutRequest(String refreshToken) {}

  public record SignupResponse(Boolean success, Long userId, String name, String email) {}

  public record LoginResponse(
      Boolean success,
      Long userId,
      String name,
      String email,
      String token,
      String credentialType,
      String expiresAt,
      String refreshToken,
      String refreshTokenExpiresAt
    ) {}

    public record RefreshResponse(
      Boolean success,
      String token,
      String credentialType,
      String expiresAt,
      String refreshToken,
      String refreshTokenExpiresAt
  ) {}
}
