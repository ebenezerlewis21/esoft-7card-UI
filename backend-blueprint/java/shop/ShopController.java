package com.example.game.shop;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
  public List<UserShopItem> inventory(HttpServletRequest request) {
    Long userId = requireUserId(request);
    return shopService.getInventory(userId);
  }

  @PostMapping("/purchase")
  public ShopService.PurchaseResult purchase(
      @RequestBody PurchaseRequest request,
      HttpServletRequest httpRequest
  ) {
    Long userId = requireUserId(httpRequest);
    return shopService.purchaseItem(userId, request.sku());
  }

  @PostMapping("/equip")
  public void equip(@RequestBody EquipRequest request, HttpServletRequest httpRequest) {
    Long userId = requireUserId(httpRequest);
    shopService.equipItem(userId, request.sku());
  }

  private Long requireUserId(HttpServletRequest request) {
    Object rawUserId = request.getAttribute(AuthInterceptor.AUTH_USER_ID_ATTR);
    if (rawUserId instanceof Long userId) {
      return userId;
    }

    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid auth session");
  }

  public record PurchaseRequest(String sku) {}
  public record EquipRequest(String sku) {}
}
