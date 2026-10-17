// Datos fijos del tablero (no se modifican durante la partida).
// Grupos: [color, coste por casa, multiplicadores de alquiler con 1..5 casas (5 = hotel)]
const G = {
  m: ["#8b5a2b", 50,  [5, 15, 45, 80, 125]],
  c: ["#6ec6e8", 50,  [5, 15, 45, 66, 92]],
  p: ["#e86ab0", 100, [5, 15, 45, 62, 75]],
  o: ["#f39c34", 100, [5, 14, 39, 49, 58]],
  r: ["#e24b4b", 150, [5, 14, 39, 49, 58]],
  y: ["#f2cf3a", 150, [5, 15, 36, 44, 52]],
  g: ["#3fbf6a", 200, [5, 15, 35, 42, 49]],
  b: ["#3a5bd9", 200, [5, 14, 31, 37, 43]]
};
const MULT = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, v[2]]));
const P = (name, g, price, r) => ({ name, type: "property", g, price, r });
const R = name => ({ name, type: "railroad", price: 200 });
const U = name => ({ name, type: "utility", price: 150 });
const T = (name, type, x) => ({ name, type, ...x });
const C = (name, ic) => ({ name, type: "corner", ic });
const CH = () => T("Noticias Tech", "chance"), CS = () => T("Tendencias Tech", "chest");

const SPACES = [
  C("Ronda de Inversión", "🚀"), P("Bluesky","m",60,2), CS(), P("Mastodon","m",60,4), T("Impuesto Digital","tax",{amount:200}), R("AWS Cloud"), P("Twitch","c",100,6), CH(), P("SoundCloud","c",100,6), P("Spotify","c",120,8),
  C("Sala de Espera", "⏳"), P("Lyft","p",140,10), U("Red 5G"), P("Uber","p",140,10), P("Airbnb","p",160,12), R("Google Cloud"), P("Pinterest","o",180,14), CS(), P("Reddit","o",180,14), P("X","o",200,16),
  C("Paraíso Fiscal", "🏝️"), P("Hulu","r",220,18), CH(), P("Disney+","r",220,18), P("Netflix","r",240,20), R("Azure Cloud"), P("LG","y",260,22), P("Sony","y",260,22), U("Starlink"), P("Samsung","y",280,24),
  C("Auditoría Fiscal", "🕵️"), P("AMD","g",300,26), P("Intel","g",300,26), CS(), P("Nvidia","g",320,28), R("IBM Cloud"), CH(), P("Apple","b",350,35), T("Multa GDPR","tax",{amount:100}), P("Microsoft","b",400,50)
];

// Cartas: m=dinero, g=ir a casilla, b=retroceder, j=Auditoría, f=carta de salida, e=cada jugador
const CHANCE = [
  {t:"Tu startup se hace viral: cobra 150M",m:150}, {t:"Multa por filtración de datos: paga 100M",m:-100},
  {t:"Avanza hasta Microsoft",g:39}, {t:"Avanza hasta la Ronda de Inversión y cobra 200M",g:0},
  {t:"Retrocede 3 casillas",b:3}, {t:"Ve directamente a la Auditoría Fiscal",j:1},
  {t:"Sales libre de la Auditoría (guarda esta carta)",f:1}, {t:"Lanzamiento fallido: paga 25M a cada inversor",e:-25},
  {t:"Avanza hasta Nvidia",g:34}, {t:"Dividendos: cobra 50M",m:50}
];
const CHEST = [
  {t:"Ronda semilla: cobra 200M",m:200}, {t:"Factura de hosting: paga 50M",m:-50},
  {t:"Vendes una patente: cobra 100M",m:100}, {t:"Aniversario de la empresa: cada inversor te paga 20M",e:20},
  {t:"Ganas un hackathon: cobra 25M",m:25}, {t:"Ve directamente a la Auditoría Fiscal",j:1},
  {t:"Sales libre de la Auditoría (guarda esta carta)",f:1}, {t:"Devolución de impuestos: cobra 20M",m:20},
  {t:"Gastos legales: paga 100M",m:-100}, {t:"Avanza hasta la Ronda de Inversión",g:0}
];
