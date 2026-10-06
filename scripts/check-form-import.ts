// Comprobación rápida de la importación del formulario: npx tsx scripts/check-form-import.ts
// Todos los usuarios y correos de aquí son inventados.
import assert from "node:assert";
import { matchTemplate, normalizeHandle, parseContact, parseCsv, parseResponses, parseTimestamp } from "../src/lib/formImport";

// CSV de Google: comillas, comillas escapadas y saltos de línea dentro de una celda
assert.deepStrictEqual(parseCsv('"a","b ""x"" c","line\n2"\n"d","e","f"\n'), [
  ["a", 'b "x" c', "line\n2"],
  ["d", "e", "f"],
]);
assert.deepStrictEqual(parseCsv("﻿a;b\r\nc;d"), [["a", "b"], ["c", "d"]]); // Excel en español: ; y BOM

// Fechas: la de Google en español (año primero y "p. m."), día primero, ISO
const local = (iso: string | null) => (iso ? new Date(iso).getHours() * 100 + new Date(iso).getMinutes() : null);
assert.strictEqual(local(parseTimestamp("2026/10/04 4:59:22 p. m. CET")), 1659);
assert.strictEqual(local(parseTimestamp("2026/10/04 12:05:00 a. m. CET")), 5); // 12 a. m. = 00:05
assert.strictEqual(local(parseTimestamp("2026/10/04 12:05:00 p. m. CET")), 1205);
assert.strictEqual(local(parseTimestamp("04/10/2026 16:59:22")), 1659);
assert.strictEqual(new Date(parseTimestamp("04/10/2026 16:59:22")!).getMonth(), 9); // 4 de octubre, no 10 de abril
assert.strictEqual(local(parseTimestamp("2026-10-04 16:59")), 1659);
assert.strictEqual(parseTimestamp("ayer"), null);

// Contactos tal como los escribe la gente
const cases: [string, { platform: string; handle: string }][] = [
  ["Telegram @fox_demo", { platform: "Telegram", handle: "@fox_demo" }],
  ["bsky -> @demo.bsky.social", { platform: "Bluesky", handle: "@demo.bsky.social" }],
  ["twitter -> demohandle", { platform: "Twitter / X", handle: "@demohandle" }],
  ["Twitter - @demo_two", { platform: "Twitter / X", handle: "@demo_two" }],
  ["x: demo3", { platform: "Twitter / X", handle: "@demo3" }],
  ["discord: demo#1234", { platform: "Discord", handle: "demo#1234" }],
  ["mail me at demo@example.com", { platform: "Email", handle: "demo@example.com" }],
  ["@onlyhandle", { platform: "Other", handle: "@onlyhandle" }],
  ["tg_fan", { platform: "Other", handle: "tg_fan" }], // "tg_fan" no es la palabra "tg"
  ["???", { platform: "Other", handle: "???" }],
];
for (const [text, expected] of cases) {
  assert.deepStrictEqual(parseContact(text), expected, text);
}
assert.strictEqual(normalizeHandle("@Fox_Demo"), normalizeHandle("fox_demo"));

// Tipos: "Render" encaja con "Rendered", y las mayúsculas no importan
const templates = [
  { id: 1, name: "Rendered Full Body + Simple Background" },
  { id: 2, name: "Reference Sheet" },
  { id: 3, name: "Full Colour" },
];
assert.strictEqual(matchTemplate("Render Full Body + Simple Background", templates)?.id, 1);
assert.strictEqual(matchTemplate("Reference sheet", templates)?.id, 2);
assert.strictEqual(matchTemplate("Something new", templates), null);

// Un CSV completo con el formato real del formulario (columna de correo opcional)
const header =
  '"Marca temporal","Which type of commission are you interested in?","Type your preferred method of communication and your handle on that site (Twitter - Telegram)"';
const withoutEmail = parseResponses(`${header}\n"2026/10/04 4:59:22 p. m. CET","Render Full Body + Simple Background","Telegram @fox_demo"\n`, templates);
assert.strictEqual(withoutEmail.error, null);
assert.strictEqual(withoutEmail.requests.length, 1);
assert.deepStrictEqual(
  [withoutEmail.requests[0].name, withoutEmail.requests[0].platform, withoutEmail.requests[0].contact, withoutEmail.requests[0].template_id, withoutEmail.requests[0].email],
  ["fox_demo", "Telegram", "@fox_demo", 1, null],
);

const withEmail = parseResponses(
  `${header},"Email for the PayPal invoice"\n"2026/10/05 9:00:00 a. m. CET","Something new","twitter -> demohandle","demo@example.com"\n"2026/10/05 9:10:00 a. m. CET","Full Colour","",""\n`,
  templates,
);
assert.strictEqual(withEmail.requests.length, 1, "una fila sin contacto no es una solicitud");
assert.deepStrictEqual(
  [withEmail.requests[0].email, withEmail.requests[0].template_id, withEmail.requests[0].details],
  ["demo@example.com", null, "Type in the form: Something new"],
);
assert.notStrictEqual(withEmail.requests[0].externalId, withoutEmail.requests[0].externalId);

// El título real de la pregunta del correo, y correos que no lo parecen
const realEmailTitle = "Type the paypal email you want to use for the invoice.";
const real = parseResponses(
  `${header},"${realEmailTitle}"
"2026/10/06 10:00:00 a. m. CET","Full Colour","bsky -> @demo","Demo.Person@Example.com"
"2026/10/06 10:05:00 a. m. CET","Full Colour","tg demo2","no tengo"
`,
  templates,
);
assert.strictEqual(real.error, null);
assert.deepStrictEqual(
  real.requests.map((request) => [request.contact, request.email, request.details]),
  [["@demo", "demo.person@example.com", null], ["@demo2", null, "Email in the form: no tengo"]],
);

// Un archivo que no es el formulario
assert.ok(parseResponses('"a","b"\n"1","2"', templates).error);
assert.ok(parseResponses("", templates).error);

console.log("form import ok");
