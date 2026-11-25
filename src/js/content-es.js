/* Inhalt Spanisch. Zeile: [Ziel, Deutsch, Distraktoren, Cloze-Index, {alt, strict}] */
(function (root) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Lib = isNode ? require('./content-lib.js') : root.LF.Lib;

  var data = Lib.build('es', [
    { title: 'Begrüßung', rows: [
      ["Hola", "Hallo"],
      ["Adiós", "Auf Wiedersehen"],
      ["Gracias", "Danke"],
      ["Buenos días", "Guten Morgen", "noches tardes", 1, { alt: ["Buen día"] }],
      ["Por favor", "Bitte", "Para Con", 0],
      ["Me llamo Ana", "Ich heiße Ana", "llamas llama", 1],
      ["Mucho gusto", "Freut mich", "Poco Muy", 0, { alt: ["Encantado", "Encantada"] }],
      ["¿Cómo estás?", "Wie geht es dir?", "estoy estamos", 1, { alt: ["¿Qué tal?"] }],
      ["Estoy bien, gracias", "Mir geht es gut, danke", "mal cansado", 1],
      ["Hasta mañana", "Bis morgen", "ayer luego", 1],
      ["¿De dónde eres?", "Woher kommst du?", "estás soy", 2, { alt: ["¿De dónde vienes?"] }],
      ["Soy de Alemania", "Ich komme aus Deutschland", "Estoy Eres", 0]
    ] },
    { title: 'Alltag & Essen', rows: [
      ["el agua", "das Wasser", "la los"],
      ["el pan", "das Brot", "la los"],
      ["la leche", "die Milch", "el los"],
      ["Quiero un café", "Ich möchte einen Kaffee", "Quieres Quiere", 0, { alt: ["Me gustaría un café"] }],
      ["Como una manzana", "Ich esse einen Apfel", "Comes Come", 0],
      ["Ella bebe té", "Sie trinkt Tee", "bebes bebo", 1],
      ["¿Te gusta la pizza?", "Magst du Pizza?", "Me Nos", 0],
      ["La sopa está caliente", "Die Suppe ist heiß", "fría frío", 3],
      ["Tengo hambre", "Ich habe Hunger", "sed sueño", 1],
      ["La cuenta, por favor", "Die Rechnung, bitte", "carta mesa", 1],
      ["Cenamos en casa", "Wir essen zu Hause zu Abend", "Cenan Ceno", 0],
      ["¿Dónde está el supermercado?", "Wo ist der Supermarkt?", "es son", 1]
    ] },
    { title: 'Zahlen & Zeit', rows: [
      ["uno", "eins"],
      ["cinco", "fünf"],
      ["diez", "zehn"],
      ["Tengo dos hermanos", "Ich habe zwei Brüder", "tres cuatro", 1],
      ["Son las siete", "Es ist sieben Uhr", "seis ocho", 2],
      ["¿Qué hora es?", "Wie spät ist es?", "día año", 1],
      ["Hoy es lunes", "Heute ist Montag", "martes domingo", 2],
      ["La tienda abre a las nueve", "Das Geschäft öffnet um neun", "cierra abren", 2],
      ["Me despierto a las seis", "Ich wache um sechs auf", "siete diez", 4],
      ["Mañana es sábado", "Morgen ist Samstag", "viernes domingo", 2],
      ["Son las dos y media", "Es ist halb drei", "cuarto menos", 4],
      ["Tengo veinte años", "Ich bin zwanzig Jahre alt", "treinta diez", 1]
    ] },
    { title: 'Reisen', rows: [
      ["el billete", "die Fahrkarte", "la los", undefined, { alt: ["el boleto"] }],
      ["el aeropuerto", "der Flughafen", "la los"],
      ["el pasaporte", "der Reisepass", "la los"],
      ["¿Dónde está la estación de tren?", "Wo ist der Bahnhof?", "es son", 1],
      ["Necesito un billete para Londres", "Ich brauche eine Fahrkarte nach London", "por de", 3, { alt: ["Necesito un boleto para Londres"] }],
      ["El tren sale a las doce", "Der Zug fährt um zwölf Uhr ab", "llega vive", 2],
      ["Gire a la izquierda en la esquina", "Biegen Sie an der Ecke links ab", "derecha derecho", 3],
      ["¿Cuánto cuesta la habitación?", "Wie viel kostet das Zimmer?", "Cuántos Cuántas", 0],
      ["Tengo una reserva", "Ich habe eine Reservierung", "un el", 1],
      ["El autobús llega tarde", "Der Bus hat Verspätung", "temprano ahora", 3],
      ["¿Puede ayudarme, por favor?", "Können Sie mir bitte helfen?", "Puedo Pueden", 0, { alt: ["¿Me puede ayudar, por favor?"] }],
      ["Vamos a la playa", "Wir fahren zum Strand", "Voy Van", 0]
    ] },
    { title: 'Familie & Menschen', rows: [
      ["la madre", "die Mutter", "el los"],
      ["el hermano", "der Bruder", "la los"],
      ["él", "er", "", undefined, { strict: true }],
      ["Este es mi padre", "Das ist mein Vater", "Esta Estos", 0],
      ["Ella es mi hermana", "Sie ist meine Schwester", "hermano hermanas", 3],
      ["Él tiene una familia grande", "Er hat eine große Familie", "pequeña grandes", 4],
      ["Mis padres viven en Berlín", "Meine Eltern wohnen in Berlin", "vive vivo", 2],
      ["¿Tienes hijos?", "Hast du Kinder?"],
      ["Mi abuela es muy simpática", "Meine Großmutter ist sehr nett", "simpático simpáticas", 4],
      ["Son mis vecinos", "Sie sind meine Nachbarn", "Es Está", 0, { alt: ["Ellos son mis vecinos", "Son mis vecinas"] }],
      ["Mi tío es médico", "Mein Onkel ist Arzt", "tía abuelo", 1, { alt: ["Mi tío es doctor"] }],
      ["El bebé duerme", "Das Baby schläft", "duermen dormir", 2, { alt: ["El bebé está durmiendo"] }]
    ] },
    { title: 'Arbeit & Verben', rows: [
      ["el trabajo", "die Arbeit", "la los"],
      ["la oficina", "das Büro", "el los"],
      ["la reunión", "die Besprechung", "el las"],
      ["Trabajo en una oficina", "Ich arbeite in einem Büro", "Trabajas Trabaja", 0],
      ["Ella es profesora", "Sie ist Lehrerin", "profesor médica", 2],
      ["Él trabaja desde casa", "Er arbeitet von zu Hause aus", "trabajo trabajan", 1],
      ["Tenemos una reunión a las diez", "Wir haben um zehn eine Besprechung", "Tienen Tengo", 0],
      ["Puedo hablar inglés", "Ich kann Englisch sprechen", "francés alemán", 2],
      ["Por favor, envíame el correo", "Bitte schicke mir die E-Mail", "llámame escríbeme", 2, { alt: ["Por favor, mándame el correo", "Por favor, envíame el email"] }],
      ["No entiendo", "Ich verstehe nicht", "Sí Nunca", 0],
      ["¿A qué te dedicas?", "Was machst du beruflich?", "dedicamos dedico", 3, { alt: ["¿En qué trabajas?"] }],
      ["El jefe está muy ocupado hoy", "Der Chef ist heute sehr beschäftigt", "es son", 2]
    ] }
  ]);

  if (isNode) module.exports = data; else { root.LF.content = root.LF.content || {}; root.LF.content.es = data; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
