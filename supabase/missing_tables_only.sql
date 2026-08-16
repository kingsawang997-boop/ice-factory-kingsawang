-- =========================================================
-- Kingsawang ERP - Final working SQL for missing tables
-- Safe for Supabase. Matches the current app field names.
-- =========================================================

-- employees
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  username TEXT,
  password TEXT,
  pin TEXT,
  phone TEXT,
  "base_salary" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS "base_salary" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_employees_role
  ON public.employees (role);

CREATE INDEX IF NOT EXISTS idx_employees_isactive
  ON public.employees ("isActive");

-- products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  image TEXT,
  icon TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products (category);

CREATE INDEX IF NOT EXISTS idx_products_isactive
  ON public.products ("isActive");

-- sales
CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  "subTotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "receiveAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "changeAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "payMethod" TEXT NOT NULL DEFAULT 'cash',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  by TEXT,
  "deliveryEmployee" TEXT,
  "deliverySacks" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subTotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "receiveAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "changeAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "payMethod" TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS by TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryEmployee" TEXT,
  ADD COLUMN IF NOT EXISTS "deliverySacks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sales_createdat
  ON public.sales ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_sales_by
  ON public.sales (by);

CREATE INDEX IF NOT EXISTS idx_sales_paymethod
  ON public.sales ("payMethod");

-- drawer_logs
CREATE TABLE IF NOT EXISTS public.drawer_logs (
  id TEXT PRIMARY KEY,
  employee_name TEXT,
  role TEXT,
  reason TEXT,
  print_status TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.drawer_logs
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_drawer_logs_employee
  ON public.drawer_logs (employee_name);

CREATE INDEX IF NOT EXISTS idx_drawer_logs_createdat
  ON public.drawer_logs ("createdAt" DESC);

-- inventory_logs
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id TEXT PRIMARY KEY,
  product_id UUID,
  product_name TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  by TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product
  ON public.inventory_logs (product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_date
  ON public.inventory_logs (date DESC);

-- truck_routes
CREATE TABLE IF NOT EXISTS public.truck_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  driver_name TEXT,
  license_plate TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.truck_routes
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_truck_routes_isactive
  ON public.truck_routes ("isActive");

-- route_settlements
CREATE TABLE IF NOT EXISTS public.route_settlements (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  "routeName" TEXT,
  "driverName" TEXT,
  "expectedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "cashAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "transferAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "creditAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "expenseAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "diffAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  details JSONB,
  by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.route_settlements
  ADD COLUMN IF NOT EXISTS "routeName" TEXT,
  ADD COLUMN IF NOT EXISTS "driverName" TEXT,
  ADD COLUMN IF NOT EXISTS "expectedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cashAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "transferAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "expenseAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "diffAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_route_settlements_date
  ON public.route_settlements (date DESC);

CREATE INDEX IF NOT EXISTS idx_route_settlements_route
  ON public.route_settlements ("routeName");

CREATE INDEX IF NOT EXISTS idx_route_settlements_status
  ON public.route_settlements (status);

-- field_delivery_daily
CREATE TABLE IF NOT EXISTS public.field_delivery_daily (
  date DATE NOT NULL,
  employee_name TEXT NOT NULL,
  sacks_sold INTEGER NOT NULL DEFAULT 0,
  cashier_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (date, employee_name)
);

CREATE INDEX IF NOT EXISTS idx_field_delivery_daily_date
  ON public.field_delivery_daily (date DESC);

CREATE INDEX IF NOT EXISTS idx_field_delivery_daily_employee
  ON public.field_delivery_daily (employee_name);

-- app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  app_logo TEXT,
  app_name TEXT,
  system_config JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS app_logo TEXT,
  ADD COLUMN IF NOT EXISTS app_name TEXT,
  ADD COLUMN IF NOT EXISTS system_config JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO public.app_settings (id, app_name, app_logo, updated_at)
VALUES ('system_config', 'คิงส์สว่าง ERP', NULL, NOW())
ON CONFLICT (id) DO UPDATE
SET app_name = EXCLUDED.app_name,
    app_logo = EXCLUDED.app_logo,
    updated_at = NOW();

-- role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role TEXT PRIMARY KEY,
  menu_admin BOOLEAN NOT NULL DEFAULT FALSE,
  menu_accounting BOOLEAN NOT NULL DEFAULT FALSE,
  menu_hr BOOLEAN NOT NULL DEFAULT FALSE,
  menu_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  menu_sales BOOLEAN NOT NULL DEFAULT FALSE,
  menu_purchasing BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS menu_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS menu_accounting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS menu_hr BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS menu_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS menu_sales BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS menu_purchasing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO public.role_permissions (
  role, menu_admin, menu_accounting, menu_hr, menu_inventory, menu_sales, menu_purchasing, updated_at
)
VALUES
  ('ผู้จัดการ / เจ้าของ', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, NOW()),
  ('แคชเชียร์', FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, NOW()),
  ('พนักงานหน้าลาน', FALSE, FALSE, FALSE, TRUE, TRUE, FALSE, NOW()),
  ('บัญชี', FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, NOW())
ON CONFLICT (role) DO UPDATE
SET menu_admin = EXCLUDED.menu_admin,
    menu_accounting = EXCLUDED.menu_accounting,
    menu_hr = EXCLUDED.menu_hr,
    menu_inventory = EXCLUDED.menu_inventory,
    menu_sales = EXCLUDED.menu_sales,
    menu_purchasing = EXCLUDED.menu_purchasing,
    updated_at = NOW();
