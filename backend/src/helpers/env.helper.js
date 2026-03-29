export const getEnvConfig = async (state, c) => {
    // Solo expone las credenciales públicas del cliente Supabase.
    // SUPABASE_ANON_KEY es la clave pública (anon) — seguro exponerla.
    state.data = {
        SUPABASE_URL: process.env.SUPABASE_URL || null,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || null
    };
};