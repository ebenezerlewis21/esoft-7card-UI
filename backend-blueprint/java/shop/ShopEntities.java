package com.example.game.shop;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "shop_items")
class ShopItem {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 80)
  private String sku;

  @Column(name = "item_type", nullable = false, length = 30)
  private String itemType;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(length = 500)
  private String description;

  @Column(name = "price_coins", nullable = false)
  private Integer priceCoins;

  @Column(nullable = false, length = 30)
  private String rarity = "COMMON";

  @Column(name = "metadata_json")
  private String metadataJson;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  public Long getId() { return id; }
  public String getSku() { return sku; }
  public String getItemType() { return itemType; }
  public String getName() { return name; }
  public String getDescription() { return description; }
  public Integer getPriceCoins() { return priceCoins; }
  public String getRarity() { return rarity; }
  public String getMetadataJson() { return metadataJson; }
  public boolean isActive() { return active; }
}

@Entity
@Table(name = "user_shop_items", uniqueConstraints = {
  @UniqueConstraint(name = "uk_user_item", columnNames = {"user_id", "shop_item_id"})
})
class UserShopItem {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "shop_item_id", nullable = false)
  private ShopItem shopItem;

  @Column(nullable = false)
  private boolean equipped = false;

  @Column(name = "acquired_at", nullable = false)
  private Instant acquiredAt = Instant.now();

  public Long getId() { return id; }
  public Long getUserId() { return userId; }
  public ShopItem getShopItem() { return shopItem; }
  public boolean isEquipped() { return equipped; }
  public Instant getAcquiredAt() { return acquiredAt; }

  public void setUserId(Long userId) { this.userId = userId; }
  public void setShopItem(ShopItem shopItem) { this.shopItem = shopItem; }
  public void setEquipped(boolean equipped) { this.equipped = equipped; }
}

@Entity
@Table(name = "shop_purchase_transactions")
class ShopPurchaseTransaction {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "shop_item_id", nullable = false)
  private ShopItem shopItem;

  @Column(name = "price_coins", nullable = false)
  private Integer priceCoins;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public void setUserId(Long userId) { this.userId = userId; }
  public void setShopItem(ShopItem shopItem) { this.shopItem = shopItem; }
  public void setPriceCoins(Integer priceCoins) { this.priceCoins = priceCoins; }
}
