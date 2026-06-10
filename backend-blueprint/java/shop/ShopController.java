package com.example.game.shop;

import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/shop")
public class ShopController {
  private final ShopService shopService;

  public ShopController(ShopService shopService) {
    this.shopService = shopService;
  }

  @GetMapping("/items")
  public List<ShopItem> listItems() {
    return shopService.listActiveItems();
  }

  @GetMapping("/inventory")
  public List<UserShopItem> inventory(@RequestParam Long userId) {
    return shopService.getInventory(userId);
  }

  @PostMapping("/purchase")
  public ShopService.PurchaseResult purchase(@RequestBody PurchaseRequest request) {
    return shopService.purchaseItem(request.userId(), request.sku());
  }

  @PostMapping("/equip")
  public void equip(@RequestBody EquipRequest request) {
    shopService.equipItem(request.userId(), request.sku());
  }

  public record PurchaseRequest(Long userId, String sku) {}
  public record EquipRequest(Long userId, String sku) {}
}
