#pragma once
// Copiar este archivo a credenciales.h y colocar los datos del resultado del SQL.
// NO subir credenciales.h a GitHub.
#define MELLIFERA_MOTHER_UID "MOTHER-TEST-123"
#define MELLIFERA_DEVICE_KEY "PEGAR_DEVICE_KEY_GENERADA_EN_SUPABASE"
// Normalmente dejar vacío: el modem intentará usar APN ya provisionado por la SIM/red.
// Algunas operadoras requieren un APN explícito: completarlo con la información del proveedor.
#define MELLIFERA_APN ""
// Si tu SIM tiene PIN, configurarlo aquí (no publicarlo en GitHub).
#define MELLIFERA_SIM_PIN ""

// Nombre del certificado CA raíz cargado en el módem con AT+CCERTDOWN.
// Para producción, no dejar vacío: activa verificación del certificado de Supabase.
#define MELLIFERA_CA_FILE ""
