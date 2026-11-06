-- ========================================================
-- Food Delivery Application (Cravely) - Complete Supabase Setup
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qhcuqjwhdsevdcjlkmgs/sql/new
-- ========================================================

-- 1. Profiles Table
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    username text,
    role text check (role in ('customer', 'manager')) default 'customer',
    created_at timestamptz default now()
);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, username, role)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        'customer'
    )
    on conflict (id) do nothing;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- 2. Food Categories Table
create table if not exists public.food_categories (
    id bigserial primary key,
    name text not null unique,
    description text,
    meal_period text,
    image_url text,
    created_at timestamptz default now()
);

-- 3. Food Items Table
create table if not exists public.food_items (
    id bigserial primary key,
    category_id bigint references public.food_categories(id) on delete set null,
    category text,
    name text not null,
    description text,
    price numeric(10,2) not null default 0,
    preparation_time text default '20 mins',
    is_available boolean default true,
    available_quantity integer default 50,
    low_stock_threshold integer default 10,
    image_url text,
    created_at timestamptz default now()
);

-- 4. Orders Table
create table if not exists public.orders (
    id bigserial primary key,
    customer_id uuid references auth.users(id) on delete set null,
    order_type text default 'delivery',
    status text default 'received',
    payment_status text default 'paid',
    subtotal numeric(10,2) not null default 0,
    created_at timestamptz default now()
);

-- 5. Order Items Table
create table if not exists public.order_items (
    id bigserial primary key,
    order_id bigint references public.orders(id) on delete cascade,
    food_item_id bigint references public.food_items(id) on delete set null,
    item_name text not null,
    quantity integer not null default 1,
    unit_price numeric(10,2) not null default 0,
    line_total numeric(10,2) not null default 0,
    created_at timestamptz default now()
);

-- 6. Tickets Table
create table if not exists public.tickets (
    id bigserial primary key,
    customer_id uuid references auth.users(id) on delete set null,
    order_id bigint references public.orders(id) on delete set null,
    subject text not null,
    description text not null,
    category text default 'general',
    status text default 'open',
    priority text default 'medium',
    manager_notes text,
    created_at timestamptz default now()
);

-- 7. RPC: create_order
create or replace function public.create_order(
    p_order_type text,
    p_items jsonb
)
returns jsonb as $$
declare
    v_customer_id uuid;
    v_order_id bigint;
    v_subtotal numeric(10,2) := 0;
    v_item jsonb;
    v_food record;
    v_line_total numeric(10,2);
begin
    v_customer_id := auth.uid();
    if v_customer_id is null then
        raise exception 'Authentication required to place an order';
    end if;

    -- Create empty order row first
    insert into public.orders (customer_id, order_type, status, payment_status, subtotal)
    values (v_customer_id, p_order_type, 'received', 'paid', 0)
    returning id into v_order_id;

    -- Process each item
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        select * into v_food from public.food_items where id = (v_item->>'food_item_id')::bigint;

        if not found then
            raise exception 'Item not found: %', (v_item->>'food_item_id');
        end if;

        if v_food.is_available = false or v_food.available_quantity < (v_item->>'quantity')::int then
            raise exception 'Item % is out of stock', v_food.name;
        end if;

        v_line_total := v_food.price * (v_item->>'quantity')::int;
        v_subtotal := v_subtotal + v_line_total;

        -- Insert order item
        insert into public.order_items (order_id, food_item_id, item_name, quantity, unit_price, line_total)
        values (
            v_order_id,
            v_food.id,
            v_food.name,
            (v_item->>'quantity')::int,
            v_food.price,
            v_line_total
        );

        -- Decrement stock
        update public.food_items
        set available_quantity = available_quantity - (v_item->>'quantity')::int
        where id = v_food.id;
    end loop;

    -- Update order with total
    update public.orders
    set subtotal = v_subtotal
    where id = v_order_id;

    return jsonb_build_object(
        'order_id', v_order_id,
        'subtotal', v_subtotal,
        'status', 'received',
        'payment_status', 'paid',
        'order_type', p_order_type
    );
end;
$$ language plpgsql security definer;

-- 8. RPC: manage_order_status
create or replace function public.manage_order_status(
    p_order_id bigint,
    p_next_status text
)
returns jsonb as $$
declare
    v_row record;
begin
    update public.orders
    set status = p_next_status
    where id = p_order_id
    returning id, status into v_row;

    if not found then
        raise exception 'Order not found';
    end if;

    return jsonb_build_object(
        'order_id', v_row.id,
        'status', v_row.status
    );
end;
$$ language plpgsql security definer;

-- 9. Disable RLS or grant access for smooth development
alter table public.profiles enable row level security;
alter table public.food_categories enable row level security;
alter table public.food_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;

-- Open policies for development
drop policy if exists "Allow all on profiles" on public.profiles;
create policy "Allow all on profiles" on public.profiles for all using (true) with check (true);

drop policy if exists "Allow all on food_categories" on public.food_categories;
create policy "Allow all on food_categories" on public.food_categories for all using (true) with check (true);

drop policy if exists "Allow all on food_items" on public.food_items;
create policy "Allow all on food_items" on public.food_items for all using (true) with check (true);

drop policy if exists "Allow all on orders" on public.orders;
create policy "Allow all on orders" on public.orders for all using (true) with check (true);

drop policy if exists "Allow all on order_items" on public.order_items;
create policy "Allow all on order_items" on public.order_items for all using (true) with check (true);

drop policy if exists "Allow all on tickets" on public.tickets;
create policy "Allow all on tickets" on public.tickets for all using (true) with check (true);

-- 10. Sample Seed Data
insert into public.food_categories (name, description, meal_period)
values
    ('Burgers & Sandwiches', 'Gourmet burgers and toasted artisan sandwiches', 'All Day'),
    ('Pizzas & Pastas', 'Wood-fired pizzas and fresh handmade Italian pasta', 'Dinner'),
    ('Bowls & Salads', 'Nutrient-rich bowls and crisp fresh seasonal greens', 'Lunch'),
    ('Desserts & Drinks', 'Sweet treats, baked goods, and chilled refreshments', 'All Day')
on conflict (name) do nothing;

insert into public.food_items (category_id, category, name, description, price, preparation_time, is_available, available_quantity)
select
    c.id,
    c.name,
    item.name,
    item.description,
    item.price,
    item.prep,
    true,
    40
from (
    values
        ('Burgers & Sandwiches', 'Classic Cheeseburger', 'Angus beef patty with cheddar, pickles, and house sauce', 12.99, '15 mins'),
        ('Burgers & Sandwiches', 'Crispy Chicken Burger', 'Crispy spiced chicken breast with creamy slaw', 11.49, '15 mins'),
        ('Pizzas & Pastas', 'Margherita Pizza', 'San Marzano tomatoes, fresh mozzarella, and sweet basil', 14.99, '20 mins'),
        ('Pizzas & Pastas', 'Truffle Mushroom Fettuccine', 'Handmade pasta with wild mushrooms and truffle cream', 16.50, '25 mins'),
        ('Bowls & Salads', 'Mediterranean Quinoa Bowl', 'Quinoa, kalamata olives, cucumber, feta, and lemon tahini', 13.25, '10 mins'),
        ('Desserts & Drinks', 'Classic Tiramisu', 'Espresso-soaked ladyfingers with mascarpone cream', 7.50, '5 mins'),
        ('Desserts & Drinks', 'Fresh Berry Lemonade', 'Sparkling lemonade infused with crushed raspberries and mint', 4.50, '3 mins')
) as item(cat_name, name, description, price, prep)
join public.food_categories c on c.name = item.cat_name
where not exists (select 1 from public.food_items f where f.name = item.name);


-- 11. Store Settings Table (Happy Hours & Restaurant Configurations)
create table if not exists public.store_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz default now()
);

alter table public.store_settings enable row level security;

drop policy if exists "Allow all on store_settings" on public.store_settings;
create policy "Allow all on store_settings" on public.store_settings for all using (true) with check (true);

-- Insert default Happy Hours config if not exists
insert into public.store_settings (key, value)
values (
    'happy_hours',
    '{"enabled": false, "discountPercent": 20, "startTime": "16:00", "endTime": "19:00", "title": "⚡ Cravely Happy Hours", "bannerText": "Special limited-time discount applied to all fresh dishes!", "autoSchedule": false}'::jsonb
)
on conflict (key) do nothing;
