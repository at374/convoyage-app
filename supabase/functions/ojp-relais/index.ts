// Convoyage Ultra — relais OJP Suisse (fonction Supabase Edge, Deno).
//
// Rôle : garder le jeton opentransportdata.swiss côté serveur. L'application envoie une requête OJP (XML) ;
// la fonction la transmet telle quelle à l'adresse officielle OJP Fare et renvoie la réponse XML.
// - Ne lit et n'écrit AUCUNE table ; ne touche ni à l'authentification ni à la synchronisation des missions.
// - Réservée aux utilisateurs connectés (session vérifiée dans le code, en lecture seule).
// - Une seule destination possible, trois types de requêtes acceptés, taille limitée, rien n'est journalisé.
// Secret à définir sur le projet : OJP_FARE_API_KEY (jamais dans le code de l'application).
const CIBLE = "https://api.opentransportdata.swiss/ojpfare";
const TYPES = /<(?:ojp:)?(OJPLocationInformationRequest|OJPTripRequest|OJPFareRequest)[\s>]/;
const TAILLE_MAX = 400_000;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const texte = (message: string, status: number) =>
  new Response(message, { status, headers: { ...cors, "content-type": "text/plain; charset=utf-8" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return texte("Méthode non autorisée", 405);
  // Utilisateur connecté obligatoire : la session reçue est vérifiée auprès du service d'authentification du
  // projet (lecture seule), que l'option « Verify JWT » de la plateforme soit active ou non.
  const session = req.headers.get("authorization") ?? "";
  const cle = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  if (!/^Bearer\s+\S+/.test(session) || !cle || !base) return texte("Connexion requise", 401);
  try {
    const qui = await fetch(base + "/auth/v1/user", { headers: { authorization: session, apikey: cle }, signal: AbortSignal.timeout(8_000) });
    if (!qui.ok) return texte("Connexion requise", 401);
  } catch (_) {
    return texte("Vérification de la connexion impossible", 502);
  }
  const jeton = Deno.env.get("OJP_FARE_API_KEY");
  if (!jeton) return texte("Relais OJP non configuré (secret OJP_FARE_API_KEY absent)", 503);
  const corps = await req.text();
  if (!corps || corps.length > TAILLE_MAX) return texte("Requête vide ou trop volumineuse", 413);
  if (!/^\s*<\?xml[^>]*\?>\s*<OJP[\s>]/.test(corps) || !TYPES.test(corps)) return texte("Requête OJP non reconnue", 400);
  try {
    const reponse = await fetch(CIBLE, {
      method: "POST",
      headers: { "content-type": "application/xml", authorization: "Bearer " + jeton },
      body: corps,
      signal: AbortSignal.timeout(20_000),
    });
    return new Response(await reponse.text(), {
      status: reponse.status,
      headers: { ...cors, "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (_) {
    return texte("Service OJP injoignable", 502);
  }
});
