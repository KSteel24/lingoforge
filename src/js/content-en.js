/* Inhalt Englisch. Zeile: [Ziel, Deutsch, Distraktoren, Cloze-Index, {alt, strict}] */
(function (root) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Lib = isNode ? require('./content-lib.js') : root.LF.Lib;

  var data = Lib.build('en', [
    { title: 'Begrüßung', rows: [
      ["Hello", "Hallo"],
      ["Goodbye", "Auf Wiedersehen"],
      ["Please", "Bitte (höfliche Bitte)"],
      ["Good morning", "Guten Morgen", "night evening", 1],
      ["Thank you very much", "Vielen Dank", "many little", 3, { alt: ["Thanks a lot", "Thank you so much"] }],
      ["My name is Anna", "Ich heiße Anna", "am are", 1, { alt: ["My name's Anna"] }],
      ["Nice to meet you", "Freut mich, dich kennenzulernen", "see know", 2, { alt: ["Pleased to meet you"] }],
      ["How are you?", "Wie geht es dir?", "is do", 1, { alt: ["How are you doing?"] }],
      ["I am fine, thank you", "Mir geht es gut, danke", "tired hungry", 2, { alt: ["I'm fine, thank you", "I am fine, thanks", "I'm fine, thanks"] }],
      ["See you tomorrow", "Bis morgen", "yesterday today", 2],
      ["Where are you from?", "Woher kommst du?", "to at", 3],
      ["I am from Germany", "Ich komme aus Deutschland", "to in", 2, { alt: ["I'm from Germany"] }]
    ] },
    { title: 'Alltag & Essen', rows: [
      ["water", "Wasser"],
      ["bread", "Brot"],
      ["coffee", "Kaffee"],
      ["I would like a coffee", "Ich möchte einen Kaffee", "bread cake", 4, { alt: ["I'd like a coffee"] }],
      ["I eat an apple", "Ich esse einen Apfel", "drink read", 1],
      ["She drinks tea", "Sie trinkt Tee", "drink drinking", 1],
      ["Do you like pizza?", "Magst du Pizza?", "Are Does", 0],
      ["The soup is hot", "Die Suppe ist heiß", "cold big", 3],
      ["I am hungry", "Ich habe Hunger", "thirsty tired", 2, { alt: ["I'm hungry"] }],
      ["The bill, please", "Die Rechnung, bitte", "menu table", 1, { alt: ["The check, please"] }],
      ["We eat dinner at home", "Wir essen zu Hause zu Abend", "in on", 3, { alt: ["We have dinner at home"] }],
      ["Where is the supermarket?", "Wo ist der Supermarkt?", "are am", 1]
    ] },
    { title: 'Zahlen & Zeit', rows: [
      ["one", "eins"],
      ["five", "fünf"],
      ["ten", "zehn"],
      ["I have two brothers", "Ich habe zwei Brüder", "three five", 2],
      ["It is seven o'clock", "Es ist sieben Uhr", "six eight", 2, { alt: ["It's seven o'clock", "It is seven"] }],
      ["What time is it?", "Wie spät ist es?", "weather name", 1],
      ["Today is Monday", "Heute ist Montag", "Tuesday Sunday", 2],
      ["The shop opens at nine", "Das Geschäft öffnet um neun", "closes open", 2, { alt: ["The store opens at nine"] }],
      ["I wake up at six", "Ich wache um sechs auf", "seven ten", 4],
      ["Tomorrow is Saturday", "Morgen ist Samstag", "Friday Sunday", 2],
      ["It is half past two", "Es ist halb drei", "quarter twenty", 2, { alt: ["It's half past two"] }],
      ["I am twenty years old", "Ich bin zwanzig Jahre alt", "thirty ten", 2, { alt: ["I'm twenty years old"] }]
    ] },
    { title: 'Reisen', rows: [
      ["ticket", "Fahrkarte"],
      ["airport", "Flughafen"],
      ["passport", "Reisepass"],
      ["Where is the train station?", "Wo ist der Bahnhof?", "are what", 1],
      ["I need a ticket to London", "Ich brauche eine Fahrkarte nach London", "from at", 4],
      ["The train leaves at noon", "Der Zug fährt mittags ab", "arrives stays", 2, { alt: ["The train departs at noon"] }],
      ["Turn left at the corner", "Biegen Sie an der Ecke links ab", "right straight", 2],
      ["How much is the room?", "Wie viel kostet das Zimmer?", "many long", 1],
      ["I have a reservation", "Ich habe eine Reservierung", "has am", 1],
      ["The bus is late", "Der Bus hat Verspätung", "early empty", 3],
      ["Can you help me, please?", "Können Sie mir bitte helfen?", "tell find", 2],
      ["We are going to the beach", "Wir fahren zum Strand", "at from", 3, { alt: ["We are going to the seaside"] }]
    ] },
    { title: 'Familie & Menschen', rows: [
      ["mother", "Mutter"],
      ["brother", "Bruder"],
      ["friend", "Freund / Freundin"],
      ["This is my father", "Das ist mein Vater", "your her", 2],
      ["She is my sister", "Sie ist meine Schwester", "brother cousin", 3],
      ["He has a big family", "Er hat eine große Familie", "small old", 3],
      ["My parents live in Berlin", "Meine Eltern wohnen in Berlin", "lives living", 2],
      ["Do you have any children?", "Hast du Kinder?", "a one", 3, { alt: ["Do you have children?"] }],
      ["My grandmother is very kind", "Meine Großmutter ist sehr nett", "tall young", 4, { alt: ["My grandma is very kind"] }],
      ["They are my neighbours", "Sie sind meine Nachbarn", "is am", 1, { alt: ["They are my neighbors"] }],
      ["My uncle is a doctor", "Mein Onkel ist Arzt", "aunt cousin", 1],
      ["The baby is sleeping", "Das Baby schläft", "sleeps sleep", 3]
    ] },
    { title: 'Arbeit & Verben', rows: [
      ["job", "Beruf / Arbeit"],
      ["office", "Büro"],
      ["meeting", "Besprechung"],
      ["I work in an office", "Ich arbeite in einem Büro", "play sleep", 1],
      ["She is a teacher", "Sie ist Lehrerin", "doctor driver", 3],
      ["He works from home", "Er arbeitet von zu Hause aus", "work working", 1],
      ["We have a meeting at ten", "Wir haben um zehn eine Besprechung", "nine eleven", 5],
      ["I can speak English", "Ich kann Englisch sprechen", "French Spanish", 3],
      ["Please send me the email", "Bitte schicke mir die E-Mail", "call read", 1],
      ["I do not understand", "Ich verstehe nicht", "does am", 1, { alt: ["I don't understand"] }],
      ["What do you do for work?", "Was machst du beruflich?", "does are", 1, { alt: ["What do you do?"] }],
      ["The boss is very busy today", "Der Chef ist heute sehr beschäftigt", "free late", 4]
    ] }
  ]);

  if (isNode) module.exports = data; else { root.LF.content = root.LF.content || {}; root.LF.content.en = data; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
