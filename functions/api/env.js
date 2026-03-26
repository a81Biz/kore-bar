export async function onRequestGet(context) {
    const { env } = context;
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        return new Response(JSON.stringify({ error: 'Variables no configuradas' }), { status: 500 });
    }
    return new Response(
        JSON.stringify({ supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY }),
        { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } }
    );
}