/* Inhalt Französisch. Zeile: [Ziel, Deutsch, Distraktoren, Cloze-Index, {alt, strict}] */
(function (root) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Lib = isNode ? require('./content-lib.js') : root.LF.Lib;

  var data = Lib.build('fr', [
    { title: 'Begrüßung', rows: [
      ["Bonjour", "Hallo / Guten Tag"],
      ["Merci", "Danke"],
      ["Pardon", "Entschuldigung"],
      ["Enchanté", "Freut mich", "", undefined, { alt: ["Enchantée"] }],
      ["Au revoir", "Auf Wiedersehen", "bonjour merci", 1],
      ["S'il vous plaît", "Bitte (Sie-Form)", "te nous", 1],
      ["Je m'appelle Léa", "Ich heiße Léa", "t'appelles s'appelle", 1],
      ["Comment allez-vous?", "Wie geht es Ihnen?", "vas-tu va-t-il", 1],
      ["Je vais bien, merci", "Mir geht es gut, danke", "mal fatigué", 2, { alt: ["Ça va bien, merci"] }],
      ["À demain", "Bis morgen", "hier soir", 1],
      ["D'où venez-vous?", "Woher kommen Sie?", "allez-vous êtes-vous", 1],
      ["Je viens d'Allemagne", "Ich komme aus Deutschland", "vais vis", 1]
    ] },
    { title: 'Alltag & Essen', rows: [
      ["l'eau", "das Wasser"],
      ["le pain", "das Brot", "la les"],
      ["le café", "der Kaffee", "la les"],
      ["Je voudrais un café", "Ich möchte einen Kaffee", "voulez voulons", 1, { alt: ["Je voudrais un café"] }],
      ["Je mange une pomme", "Ich esse einen Apfel", "manges mangent", 1],
      ["Elle boit du thé", "Sie trinkt Tee", "bois boivent", 1],
      ["Tu aimes la pizza?", "Magst du Pizza?", "aime aimez", 1, { alt: ["Aimes-tu la pizza?", "Est-ce que tu aimes la pizza?"] }],
      ["La soupe est chaude", "Die Suppe ist heiß", "chaud froide", 3],
      ["J'ai faim", "Ich habe Hunger", "soif peur", 1],
      ["L'addition, s'il vous plaît", "Die Rechnung, bitte", "L'eau L'heure", 0],
      ["Nous dînons à la maison", "Wir essen zu Hause zu Abend", "dîne dînez", 1],
      ["Où est le supermarché?", "Wo ist der Supermarkt?", "Quand Qui", 0]
    ] },
    { title: 'Zahlen & Zeit', rows: [
      ["un", "eins"],
      ["cinq", "fünf"],
      ["dix", "zehn"],
      ["J'ai deux frères", "Ich habe zwei Brüder", "trois quatre", 1],
      ["Il est sept heures", "Es ist sieben Uhr", "six huit", 2],
      ["Quelle heure est-il?", "Wie spät ist es?", "jour date", 1],
      ["Aujourd'hui, c'est lundi", "Heute ist Montag", "mardi dimanche", 2, { alt: ["Aujourd'hui c'est lundi", "Nous sommes lundi"] }],
      ["Le magasin ouvre à neuf heures", "Das Geschäft öffnet um neun Uhr", "ferme ouvrent", 2],
      ["Je me réveille à six heures", "Ich wache um sechs Uhr auf", "sept dix", 4],
      ["Demain, c'est samedi", "Morgen ist Samstag", "vendredi dimanche", 2],
      ["Il est deux heures et demie", "Es ist halb drei", "quart moins", 5],
      ["J'ai vingt ans", "Ich bin zwanzig Jahre alt", "trente dix", 1]
    ] },
    { title: 'Reisen', rows: [
      ["le billet", "die Fahrkarte", "la les"],
      ["l'aéroport", "der Flughafen"],
      ["où", "wo", "", undefined, { strict: true }],
      ["Où est la gare?", "Wo ist der Bahnhof?", "carte plage", 3],
      ["J'ai besoin d'un billet pour Londres", "Ich brauche eine Fahrkarte nach London", "sans avec", 4, { alt: ["Il me faut un billet pour Londres"] }],
      ["Le train part à midi", "Der Zug fährt mittags ab", "arrive reste", 2],
      ["Tournez à gauche au coin", "Biegen Sie an der Ecke links ab", "droite devant", 2],
      ["Combien coûte la chambre?", "Wie viel kostet das Zimmer?", "Comment Quand", 0],
      ["J'ai une réservation", "Ich habe eine Reservierung", "un le", 1],
      ["Le bus est en retard", "Der Bus hat Verspätung", "avance panne", 4],
      ["Pouvez-vous m'aider, s'il vous plaît?", "Können Sie mir bitte helfen?", "Peux-tu Veux-tu", 0, { alt: ["Pouvez-vous m'aider?"] }],
      ["Nous allons à la plage", "Wir fahren zum Strand", "vais vont", 1]
    ] },
    { title: 'Familie & Menschen', rows: [
      ["la mère", "die Mutter", "le les"],
      ["le frère", "der Bruder", "la les"],
      ["l'ami", "der Freund"],
      ["C'est mon père", "Das ist mein Vater", "ma mes", 1],
      ["Elle est ma sœur", "Sie ist meine Schwester", "mon mes", 2],
      ["Il a une grande famille", "Er hat eine große Familie", "grand petit", 3],
      ["Mes parents habitent à Berlin", "Meine Eltern wohnen in Berlin", "habite habitons", 2],
      ["As-tu des enfants?", "Hast du Kinder?", "Avez-vous A-t-il", 0, { alt: ["Tu as des enfants?", "Est-ce que tu as des enfants?"] }],
      ["Ma grand-mère est très gentille", "Meine Großmutter ist sehr nett", "gentil gentils", 4, { alt: ["Ma mamie est très gentille"] }],
      ["Ce sont mes voisins", "Sie sind meine Nachbarn", "mon ma", 2],
      ["Mon oncle est médecin", "Mein Onkel ist Arzt", "tante cousin", 1],
      ["Le bébé dort", "Das Baby schläft", "dors dorment", 2]
    ] },
    { title: 'Arbeit & Verben', rows: [
      ["le travail", "die Arbeit", "la les"],
      ["le bureau", "das Büro", "la les"],
      ["la réunion", "die Besprechung", "le les"],
      ["Je travaille dans un bureau", "Ich arbeite in einem Büro", "travailles travaillons", 1],
      ["Elle est infirmière", "Sie ist Krankenschwester", "infirmier boulanger", 2],
      ["Il travaille à la maison", "Er arbeitet zu Hause", "bureau gare", 4],
      ["Nous avons une réunion à dix heures", "Wir haben um zehn Uhr eine Besprechung", "ont avez", 1],
      ["Je peux parler anglais", "Ich kann Englisch sprechen", "peut pouvez", 1],
      ["Envoie-moi le courriel, s'il te plaît", "Schick mir bitte die E-Mail", "Appelle-moi Lis-moi", 0, { alt: ["Envoie-moi l'e-mail, s'il te plaît", "Envoie-moi le mail, s'il te plaît"] }],
      ["Je ne comprends pas", "Ich verstehe nicht", "me te", 1],
      ["Que fais-tu comme travail?", "Was machst du beruflich?", "Qui Où", 0, { alt: ["Tu fais quoi dans la vie?", "Quel est ton métier?"] }],
      ["Le patron est très occupé aujourd'hui", "Der Chef ist heute sehr beschäftigt", "libre fatigué", 4]
    ] }
  ]);

  if (isNode) module.exports = data; else { root.LF.content = root.LF.content || {}; root.LF.content.fr = data; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
