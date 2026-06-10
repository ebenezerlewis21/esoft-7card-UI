package com.example.game.shop;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {
  public static final String AUTH_USER_ID_ATTR = "auth.userId";
  public static final String AUTH_EMAIL_ATTR = "auth.email";

  private final AuthService authService;

  public AuthInterceptor(AuthService authService) {
    this.authService = authService;
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
      throws Exception {
    String authorizationHeader = request.getHeader("Authorization");
    return authService.authenticateAuthorizationHeader(authorizationHeader)
        .map(principal -> {
          request.setAttribute(AUTH_USER_ID_ATTR, principal.userId());
          request.setAttribute(AUTH_EMAIL_ATTR, principal.email());
          return true;
        })
        .orElseGet(() -> rejectUnauthorized(response));
  }

  private static boolean rejectUnauthorized(HttpServletResponse response) {
    try {
      response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      response.setContentType("application/json");
      response.getWriter().write("{\"success\":false,\"message\":\"Unauthorized\"}");
      response.getWriter().flush();
    } catch (IOException ignored) {
      // If writing fails, keep response as unauthorized.
    }
    return false;
  }
}
