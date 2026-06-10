Backend Shop Storage Mechanism (Spring + SQL)

This folder contains a complete baseline mechanism to persist shop items and player ownership in your backend database.

Files
- db/V1__shop_catalog.sql
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
    - GET /api/shop/inventory?userId=...
    - POST /api/shop/purchase
    - POST /api/shop/equip

How to integrate in your backend
1. Run migration file db/V1__shop_catalog.sql in your backend DB migration tool (Flyway/Liquibase/manual).
2. Copy java/shop classes into your backend package tree.
3. Implement UserStatsGateway in ShopService.java using your existing user stats/balance service.
4. Add DTO mapping if you do not want to return entity models directly.
5. Add auth guard so userId comes from authenticated principal, not request body.

Important production notes
- For race safety under high concurrency, use row-level locking around balance updates.
- Keep purchase and balance deduction in one DB transaction.
- Validate SKU input strictly.
- Consider soft delete and visibility windows for shop items.
