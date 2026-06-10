package com.example.game.shop;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface ShopItemRepository extends JpaRepository<ShopItem, Long> {
  List<ShopItem> findByActiveTrueOrderByPriceCoinsAsc();
  Optional<ShopItem> findBySkuAndActiveTrue(String sku);
}

interface UserShopItemRepository extends JpaRepository<UserShopItem, Long> {
  boolean existsByUserIdAndShopItem_Id(Long userId, Long shopItemId);
  List<UserShopItem> findByUserId(Long userId);
  List<UserShopItem> findByUserIdAndShopItem_ItemType(Long userId, String itemType);
}

interface ShopPurchaseTransactionRepository extends JpaRepository<ShopPurchaseTransaction, Long> {
}
