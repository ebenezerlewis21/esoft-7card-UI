package com.example.game.shop;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ShopService {
  private final ShopItemRepository shopItemRepository;
  private final UserShopItemRepository userShopItemRepository;
  private final ShopPurchaseTransactionRepository transactionRepository;
  private final UserStatsGateway userStatsGateway;

  public ShopService(
      ShopItemRepository shopItemRepository,
      UserShopItemRepository userShopItemRepository,
      ShopPurchaseTransactionRepository transactionRepository,
      UserStatsGateway userStatsGateway
  ) {
    this.shopItemRepository = shopItemRepository;
    this.userShopItemRepository = userShopItemRepository;
    this.transactionRepository = transactionRepository;
    this.userStatsGateway = userStatsGateway;
  }

  public List<ShopItem> listActiveItems() {
    return shopItemRepository.findByActiveTrueOrderByPriceCoinsAsc();
  }

  public List<UserShopItem> getInventory(Long userId) {
    return userShopItemRepository.findByUserId(userId);
  }

  @Transactional
  public PurchaseResult purchaseItem(Long userId, String sku) {
    ShopItem item = shopItemRepository.findBySkuAndActiveTrue(sku)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (userShopItemRepository.existsByUserIdAndShopItem_Id(userId, item.getId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Item already owned");
    }

    int balance = userStatsGateway.getBalance(userId);
    if (balance < item.getPriceCoins()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient coins");
    }

    userStatsGateway.spendCoins(userId, item.getPriceCoins());

    UserShopItem owned = new UserShopItem();
    owned.setUserId(userId);
    owned.setShopItem(item);
    userShopItemRepository.save(owned);

    ShopPurchaseTransaction tx = new ShopPurchaseTransaction();
    tx.setUserId(userId);
    tx.setShopItem(item);
    tx.setPriceCoins(item.getPriceCoins());
    transactionRepository.save(tx);

    int updatedBalance = userStatsGateway.getBalance(userId);
    return new PurchaseResult(item.getSku(), item.getName(), updatedBalance);
  }

  @Transactional
  public void equipItem(Long userId, String sku) {
    ShopItem item = shopItemRepository.findBySkuAndActiveTrue(sku)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (!userShopItemRepository.existsByUserIdAndShopItem_Id(userId, item.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item not owned");
    }

    List<UserShopItem> sameType = userShopItemRepository
        .findByUserIdAndShopItem_ItemType(userId, item.getItemType());

    for (UserShopItem userItem : sameType) {
      userItem.setEquipped(userItem.getShopItem().getId().equals(item.getId()));
    }
    userShopItemRepository.saveAll(sameType);
  }

  public record PurchaseResult(String sku, String name, int balance) {}
}

interface UserStatsGateway {
  int getBalance(Long userId);
  void spendCoins(Long userId, int amount);
}
