import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !publicKey) {
      return Response.json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' }, { status: 500 })
    }

    const serverSupabase = createClient(supabaseUrl, publicKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data, error } = await serverSupabase
      .from('app_settings')
      .select('*')
      .eq('id', 'system_config')
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ settings: data })
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'ไม่สามารถดึงการตั้งค่าระบบได้'
    }, { status: 500 })
  }
}
