-- Shop catalog + ownership schema
-- Compatible with PostgreSQL; easy to adapt for MySQL.

create table if not exists shop_items (
  id bigserial primary key,
  sku varchar(80) not null unique,
  item_type varchar(30) not null,
  name varchar(120) not null,
  description varchar(500),
  price_coins integer not null check (price_coins >= 0),
  rarity varchar(30) not null default 'COMMON',
  metadata_json text,
  active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists user_shop_items (
  id bigserial primary key,
  user_id bigint not null,
  shop_item_id bigint not null,
  equipped boolean not null default false,
  acquired_at timestamp not null default now(),
  unique (user_id, shop_item_id),
  constraint fk_user_shop_item_catalog
    foreign key (shop_item_id) references shop_items(id)
      on delete cascade
);

create table if not exists shop_purchase_transactions (
  id bigserial primary key,
  user_id bigint not null,
  shop_item_id bigint not null,
  price_coins integer not null,
  created_at timestamp not null default now(),
  constraint fk_purchase_catalog
    foreign key (shop_item_id) references shop_items(id)
      on delete restrict
);

create index if not exists idx_user_shop_items_user_id
  on user_shop_items(user_id);

create index if not exists idx_shop_items_type_active
  on shop_items(item_type, active);

-- Example seed rows
insert into shop_items (sku, item_type, name, description, price_coins, rarity, metadata_json)
values
  ('bg_neon_city', 'BACKGROUND', 'Neon City', 'Blue/pink cityscape board', 1200, 'RARE', '{"background":"#0b1530","accent":"#14d9ff"}'),
  ('card_obsidian', 'CARD_BACK', 'Obsidian Back', 'Dark metallic card back', 900, 'UNCOMMON', '{"color":"#1d1d1f","accent":"#f2c94c"}')
on conflict (sku) do nothing;
