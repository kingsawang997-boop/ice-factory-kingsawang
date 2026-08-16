-- Create daily summary table for employees assigned to field delivery work
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

-- Optional: if your Supabase project has RLS enabled and you want anonymous client access,
-- uncomment the following block. Most of this app uses the anon key, so this is kept safe.
-- ALTER TABLE public.field_delivery_daily ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public access to field delivery daily summary"
-- ON public.field_delivery_daily
-- FOR ALL
-- USING (true)
-- WITH CHECK (true);
