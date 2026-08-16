-- =========================================================
-- Kingsawang ERP - Full base schema for the current app
-- Run this in Supabase SQL Editor
-- =========================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  username TEXT,
  password TEXT,
  pin TEXT,
  phone TEXT,
  base_salary NUMERIC(12,2) DEFAULT 0,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_isactive ON public.employees(isActive);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  image TEXT,
  icon TEXT,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(isActive);

CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  totalAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  subTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  receiveAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  changeAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payMethod TEXT NOT NULL DEFAULT 'cash',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  by TEXT,
  deliveryEmployee TEXT,
  deliverySacks INTEGER NOT NULL DEFAULT 0,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_createdat ON public.sales(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_sales_by ON public.sales(by);
CREATE INDEX IF NOT EXISTS idx_sales_paymethod ON public.sales(payMethod);

CREATE TABLE IF NOT EXISTS public.drawer_logs (
  id TEXT PRIMARY KEY,
  employee_name TEXT,
  role TEXT,
  reason TEXT,
  print_status TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drawer_logs_employee ON public.drawer_logs(employee_name);
CREATE INDEX IF NOT EXISTS idx_drawer_logs_createdat ON public.drawer_logs(createdAt DESC);

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id TEXT PRIMARY KEY,
  product_id UUID,
  product_name TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  by TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON public.inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_date ON public.inventory_logs(date DESC);

CREATE TABLE IF NOT EXISTS public.truck_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  driver_name TEXT,
  license_plate TEXT,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_truck_routes_active ON public.truck_routes(isActive);

CREATE TABLE IF NOT EXISTS public.route_settlements (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  routeName TEXT,
  driverName TEXT,
  expectedAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cashAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  transferAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  creditAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenseAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  diffAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  details JSONB,
  by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_settlements_date ON public.route_settlements(date DESC);
CREATE INDEX IF NOT EXISTS idx_route_settlements_route ON public.route_settlements(routeName);
CREATE INDEX IF NOT EXISTS idx_route_settlements_status ON public.route_settlements(status);

CREATE TABLE IF NOT EXISTS public.debtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  outstanding NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debtors_name ON public.debtors(name);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id TEXT PRIMARY KEY,
  supplier_id UUID,
  supplier_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  totalAmount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_createdat ON public.purchase_orders(createdAt DESC);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  app_logo TEXT,
  app_name TEXT,
  system_config JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.cooler_transactions (
  id TEXT PRIMARY KEY,
  cooler_name TEXT,
  borrower_name TEXT,
  borrow_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  return_date TIMESTAMPTZ,
  qty INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cooler_transactions_borrower ON public.cooler_transactions(borrower_name);

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id TEXT PRIMARY KEY,
  truck_name TEXT,
  maintenance_type TEXT,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Optional seed row for app settings if needed
INSERT INTO public.app_settings (id, app_name, app_logo)
VALUES ('system_config', 'คิงส์สว่าง ERP', NULL)
ON CONFLICT (id) DO NOTHING;

-- Optional default roles for menus
INSERT INTO public.role_permissions (role, menu_admin, menu_accounting, menu_hr, menu_inventory, menu_sales, menu_purchasing)
VALUES
  ('ผู้จัดการ / เจ้าของ', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
  ('แคชเชียร์', FALSE, FALSE, FALSE, FALSE, TRUE, FALSE),
  ('พนักงานหน้าลาน', FALSE, FALSE, FALSE, TRUE, TRUE, FALSE),
  ('บัญชี', FALSE, TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role) DO NOTHING;
