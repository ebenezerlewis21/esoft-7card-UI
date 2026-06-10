Backend Shop Storage Mechanism (Spring + SQL)

This folder contains a complete baseline mechanism to persist shop items and player ownership in your backend database.

Files

- db/V1\_\_shop_catalog.sql
  - Creates catalog table, user inventory table, and purchase transaction table.
  - Includes indexes and sample seed rows.
- java/shop/ShopEntities.java
  - JPA entities: ShopItem, UserShopItem, ShopPurchaseTransaction.
- java/shop/ShopRepositories.java
  - Spring Data repositories for catalog, ownership, and transactions.
- java/shop/ShopService.java
  - Transaction-safe purchase and equip logic.
  - Prevents duplicate purchases, checks balance, deducts coins, writes ownership + audit transaction.
- java/shop/ShopController.java
  - REST endpoints:
    - GET /api/shop/items
    - GET /api/shop/inventory
    - POST /api/shop/purchase
    - POST /api/shop/equip
- java/shop/AuthService.java
  - JWT auth credential issuance and validation (HS256).
- java/shop/AuthController.java
  - REST endpoints:
    - POST /api/auth/signup
    - POST /api/auth/login
    - POST /api/auth/refresh
    - POST /api/auth/logout
- java/shop/AuthInterceptor.java + AuthWebConfig.java
  - Enforces Authorization header on protected API routes.

How to integrate in your backend

1. Run migration file db/V1\_\_shop_catalog.sql in your backend DB migration tool (Flyway/Liquibase/manual).
2. Copy java/shop classes into your backend package tree.
3. Implement UserStatsGateway in ShopService.java using your existing user stats/balance service.
4. Add DTO mapping if you do not want to return entity models directly.
5. Return auth credential from login and require it in each protected request.
6. Resolve userId from auth session in controllers instead of request body/query.
7. Add dependency for password hashing if not already present:
  - org.springframework.security:spring-security-crypto
8. Provide AUTH_JWT_SECRET via secure config (secrets manager / vault / protected env var).

JWT auth request contract

- Login returns token and credentialType:
  - Example: { "success": true, "token": "...", "credentialType": "Bearer", "refreshToken": "..." }
- Refresh rotates refresh token and returns a new access token pair:
  - POST /api/auth/refresh with { "refreshToken": "..." }
- Logout supports revoking the current access token and deleting refresh token:
  - POST /api/auth/logout with optional { "refreshToken": "..." }
- Protected endpoints require header:
  - Authorization: Bearer <token>

Important production notes

- In production, AUTH_JWT_SECRET must be a long random value and must not use defaults.
- Passwords are hashed with BCrypt before storage and verified on login.
- Access tokens are revocable by JWT jti denylist and refresh tokens are rotated on refresh.
- For race safety under high concurrency, use row-level locking around balance updates.
- Keep purchase and balance deduction in one DB transaction.
- Validate SKU input strictly.
- Consider soft delete and visibility windows for shop items.
