export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface BankQuestion {
  category: string;
  text: string;
  /** The first entry is the correct answer; choices are shuffled when a game is dealt. */
  choices: [string, string, string, string];
}

export const CATEGORIES: Category[] = [
  { id: 'geography', name: 'Geography', icon: '🌍', color: '#2dd4bf' },
  { id: 'history', name: 'History', icon: '🏛️', color: '#f59e0b' },
  { id: 'sports', name: 'Sports', icon: '⚽', color: '#4ade80' },
  { id: 'math', name: 'Math', icon: '🧮', color: '#60a5fa' },
  { id: 'general', name: 'General Knowledge', icon: '💡', color: '#facc15' },
  { id: 'music', name: 'Music', icon: '🎵', color: '#f472b6' },
  { id: 'movies', name: 'Movies', icon: '🎬', color: '#a78bfa' },
];

const bank: BankQuestion[] = [];

function add(category: string, rows: [string, string, string, string, string][]) {
  for (const [text, correct, w1, w2, w3] of rows) {
    bank.push({ category, text, choices: [correct, w1, w2, w3] });
  }
}

// Each row: question, correct answer, then three wrong answers.

add('geography', [
  ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
  ['Which is the longest river in Africa?', 'Nile', 'Congo', 'Niger', 'Zambezi'],
  ['Which is the largest hot desert in the world?', 'Sahara', 'Arabian', 'Gobi', 'Kalahari'],
  ['Which is the smallest country in the world by area?', 'Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'],
  ['Mount Everest sits on the border between Nepal and which country?', 'China', 'India', 'Bhutan', 'Pakistan'],
  ['What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
  ['Which is the largest ocean on Earth?', 'Pacific', 'Atlantic', 'Indian', 'Arctic'],
  ['Which European country is shaped like a boot?', 'Italy', 'Greece', 'Portugal', 'Croatia'],
  ['The Great Barrier Reef lies off the coast of which country?', 'Australia', 'Indonesia', 'Philippines', 'New Zealand'],
  ['Which river flows through Paris?', 'Seine', 'Loire', 'Rhône', 'Thames'],
  ['Which is the largest country in the world by area?', 'Russia', 'Canada', 'China', 'United States'],
  ['Which African country was formerly known as Abyssinia?', 'Ethiopia', 'Ghana', 'Sudan', 'Zimbabwe'],
  ['What is the capital of Japan?', 'Tokyo', 'Kyoto', 'Osaka', 'Seoul'],
  ['Which continent has the most countries?', 'Africa', 'Asia', 'Europe', 'South America'],
  ['The Strait of Gibraltar separates Spain from which country?', 'Morocco', 'Algeria', 'Tunisia', 'Portugal'],
  ['What is the capital of Brazil?', 'Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'],
  ['Which is the deepest lake in the world?', 'Lake Baikal', 'Lake Tanganyika', 'Lake Superior', 'Lake Victoria'],
  ['In which country is the city of Marrakech?', 'Morocco', 'Egypt', 'Tunisia', 'Turkey'],
  ['Which is the largest US state by area?', 'Alaska', 'Texas', 'California', 'Montana'],
  ['Which is the tallest waterfall in the world?', 'Angel Falls', 'Niagara Falls', 'Victoria Falls', 'Iguazu Falls'],
]);

add('history', [
  ['In which year did World War II end?', '1945', '1939', '1918', '1950'],
  ['Who was the first President of the United States?', 'George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'John Adams'],
  ['In which year did the Berlin Wall fall?', '1989', '1991', '1985', '1979'],
  ['Who was the first emperor of Rome?', 'Augustus', 'Julius Caesar', 'Nero', 'Constantine'],
  ['Which civilization built Machu Picchu?', 'Inca', 'Aztec', 'Maya', 'Olmec'],
  ['In which year did the French Revolution begin?', '1789', '1776', '1804', '1815'],
  ['Who painted the ceiling of the Sistine Chapel?', 'Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'],
  ['In which year did the Titanic sink?', '1912', '1905', '1918', '1923'],
  ['Who was the first human in space?', 'Yuri Gagarin', 'Neil Armstrong', 'Buzz Aldrin', 'John Glenn'],
  ['Genghis Khan founded which empire?', 'Mongol Empire', 'Ottoman Empire', 'Persian Empire', 'Roman Empire'],
  ['Who discovered penicillin?', 'Alexander Fleming', 'Louis Pasteur', 'Marie Curie', 'Edward Jenner'],
  ['In which year did humans first land on the Moon?', '1969', '1965', '1972', '1959'],
  ['Which ancient wonder stood in Alexandria?', 'The Lighthouse', 'The Colossus', 'The Hanging Gardens', 'The Temple of Artemis'],
  ['Who was British Prime Minister for most of World War II?', 'Winston Churchill', 'Neville Chamberlain', 'Clement Attlee', 'Anthony Eden'],
  ['In which year was the Magna Carta sealed?', '1215', '1066', '1415', '1492'],
  ['Which war was fought in the United States from 1861 to 1865?', 'The Civil War', 'The Revolutionary War', 'The War of 1812', 'The Mexican–American War'],
  ['Which Egyptian queen allied herself with Mark Antony?', 'Cleopatra', 'Nefertiti', 'Hatshepsut', 'Nefertari'],
  ['In which year did Columbus first reach the Americas?', '1492', '1453', '1519', '1607'],
  ['Nelson Mandela was president of which country?', 'South Africa', 'Kenya', 'Nigeria', 'Zimbabwe'],
  ['Which Roman city was buried by Mount Vesuvius in 79 AD?', 'Pompeii', 'Athens', 'Carthage', 'Troy'],
]);

add('sports', [
  ['How many players does a football (soccer) team have on the pitch?', '11', '9', '10', '12'],
  ['How often are the Summer Olympic Games normally held?', 'Every 4 years', 'Every 2 years', 'Every 3 years', 'Every 5 years'],
  ['Which country won the 2018 FIFA World Cup?', 'France', 'Croatia', 'Brazil', 'Germany'],
  ['In tennis, what is a score of zero called?', 'Love', 'Nil', 'Deuce', 'Ace'],
  ['Which sport uses a shuttlecock?', 'Badminton', 'Squash', 'Table tennis', 'Cricket'],
  ['How high is a regulation basketball hoop?', '10 feet', '9 feet', '11 feet', '12 feet'],
  ['How long is a marathon?', '42.195 km', '40 km', '45 km', '38.5 km'],
  ['In which country did judo originate?', 'Japan', 'China', 'South Korea', 'Thailand'],
  ['How many rings are on the Olympic flag?', '5', '4', '6', '7'],
  ['Which sport is the Tour de France?', 'Cycling', 'Motor racing', 'Running', 'Sailing'],
  ['In which sport can you score a slam dunk?', 'Basketball', 'Volleyball', 'Handball', 'Tennis'],
  ['What is the maximum break in snooker (without fouls)?', '147', '155', '180', '100'],
  ['Which country hosted the 2016 Summer Olympics?', 'Brazil', 'United Kingdom', 'China', 'Japan'],
  ['How many players does a volleyball team have on court?', '6', '5', '7', '8'],
  ["What is Usain Bolt's 100 m world record time?", '9.58 s', '9.69 s', '9.72 s', '9.49 s'],
  ['Which tennis Grand Slam is played on clay?', 'French Open', 'Wimbledon', 'US Open', 'Australian Open'],
  ['In golf, what is one stroke under par called?', 'Birdie', 'Eagle', 'Bogey', 'Albatross'],
  ["Which nation has won the most men's FIFA World Cups?", 'Brazil', 'Germany', 'Italy', 'Argentina'],
  ['How long is an Olympic swimming pool?', '50 m', '25 m', '100 m', '75 m'],
  ['In which sport is the Stanley Cup awarded?', 'Ice hockey', 'Baseball', 'American football', 'Basketball'],
]);

add('math', [
  ['What is 7 × 8?', '56', '54', '48', '64'],
  ['What is the square root of 144?', '12', '14', '11', '13'],
  ['What is π rounded to two decimal places?', '3.14', '3.41', '3.16', '3.12'],
  ['How many sides does a hexagon have?', '6', '5', '7', '8'],
  ['What is 15% of 200?', '30', '15', '20', '35'],
  ['What is the next prime number after 7?', '11', '9', '10', '13'],
  ['What is 2 to the power of 10?', '1024', '512', '2048', '1000'],
  ['What do the interior angles of a triangle add up to?', '180°', '90°', '360°', '270°'],
  ['If 3x + 5 = 20, what is x?', '5', '3', '15', '8'],
  ['What number does the Roman numeral L represent?', '50', '100', '500', '5'],
  ['What is the area of a 6 × 9 rectangle?', '54', '30', '15', '45'],
  ['What is 0.75 as a fraction?', '3/4', '2/3', '7/5', '3/5'],
  ['What is 12 squared?', '144', '124', '122', '132'],
  ['What is a polygon with 8 sides called?', 'Octagon', 'Hexagon', 'Heptagon', 'Nonagon'],
  ['What is 1000 ÷ 8?', '125', '120', '80', '150'],
  ['What is the smallest prime number?', '2', '0', '1', '3'],
  ['A right triangle has legs of 3 and 4. How long is the hypotenuse?', '5', '6', '7', '12'],
  ['What is 5 factorial (5!)?', '120', '25', '60', '720'],
  ['How many degrees are in a right angle?', '90', '45', '180', '60'],
  ['What is the average of 4, 8 and 12?', '8', '6', '10', '12'],
]);

add('general', [
  ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Go', 'Gd'],
  ['How many colours are traditionally in a rainbow?', '7', '6', '8', '5'],
  ['Which is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'],
  ['Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain'],
  ['What is the hardest natural substance?', 'Diamond', 'Quartz', 'Granite', 'Iron'],
  ['How many bones are in the adult human body?', '206', '186', '212', '256'],
  ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Mercury', 'Jupiter'],
  ['Which is the largest animal on Earth?', 'Blue whale', 'African elephant', 'Giraffe', 'Great white shark'],
  ['Which gas do plants absorb from the air for photosynthesis?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'],
  ['Which language has the most native speakers?', 'Mandarin Chinese', 'English', 'Spanish', 'Hindi'],
  ['Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Michelangelo', 'Vincent van Gogh', 'Pablo Picasso'],
  ['How many days are in a leap year?', '366', '365', '364', '367'],
  ['What is the common name for H₂O?', 'Water', 'Salt', 'Oxygen', 'Hydrogen peroxide'],
  ['What is the currency of Japan?', 'Yen', 'Won', 'Yuan', 'Ringgit'],
  ['Which is the fastest land animal?', 'Cheetah', 'Lion', 'Pronghorn', 'Greyhound'],
  ['How many continents are there?', '7', '5', '6', '8'],
  ['What do bees collect from flowers to make honey?', 'Nectar', 'Sap', 'Dew', 'Resin'],
  ['Which organ pumps blood around the body?', 'Heart', 'Lungs', 'Liver', 'Kidneys'],
  ['Who developed the theory of general relativity?', 'Albert Einstein', 'Isaac Newton', 'Galileo Galilei', 'Stephen Hawking'],
  ['At sea level, at what temperature does water boil?', '100 °C', '90 °C', '120 °C', '80 °C'],
]);

add('music', [
  ['Which artist is known as the "King of Pop"?', 'Michael Jackson', 'Elvis Presley', 'Prince', 'Stevie Wonder'],
  ['How many strings does a standard guitar have?', '6', '4', '5', '7'],
  ['Which city are The Beatles from?', 'Liverpool', 'London', 'Manchester', 'Dublin'],
  ['Who composed "The Four Seasons"?', 'Antonio Vivaldi', 'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven'],
  ['Who was the lead singer of Queen?', 'Freddie Mercury', 'David Bowie', 'Mick Jagger', 'Elton John'],
  ['Which instrument has 88 keys?', 'Piano', 'Organ', 'Accordion', 'Harpsichord'],
  ['Who sang "Rolling in the Deep"?', 'Adele', 'Beyoncé', 'Rihanna', 'Amy Winehouse'],
  ['Which composer kept writing music after losing his hearing?', 'Beethoven', 'Mozart', 'Chopin', 'Haydn'],
  ['Which band released "The Dark Side of the Moon"?', 'Pink Floyd', 'Led Zeppelin', 'The Rolling Stones', 'The Who'],
  ['Reggae legend Bob Marley came from which country?', 'Jamaica', 'Cuba', 'Trinidad and Tobago', 'Barbados'],
  ['In music, what does "forte" mean?', 'Loud', 'Soft', 'Fast', 'Slow'],
  ['In which year was Michael Jackson\'s album "Thriller" released?', '1982', '1979', '1985', '1987'],
  ['Who is known as the "Queen of Soul"?', 'Aretha Franklin', 'Tina Turner', 'Whitney Houston', 'Diana Ross'],
  ['Which K-pop group released the hit "Dynamite"?', 'BTS', 'Blackpink', 'EXO', 'Twice'],
  ['Which family of instruments does the trumpet belong to?', 'Brass', 'Woodwind', 'Percussion', 'Strings'],
  ['Who composed the opera "The Magic Flute"?', 'Mozart', 'Wagner', 'Verdi', 'Handel'],
  ['Who sang "Shape of You"?', 'Ed Sheeran', 'Justin Bieber', 'Shawn Mendes', 'Sam Smith'],
  ['Who was the frontman of Nirvana?', 'Kurt Cobain', 'Eddie Vedder', 'Chris Cornell', 'Dave Grohl'],
  ['How many musicians play in a quartet?', '4', '3', '5', '6'],
  ['Which country is ABBA from?', 'Sweden', 'Norway', 'Denmark', 'Finland'],
]);

add('movies', [
  ['Who directed "Titanic" (1997)?', 'James Cameron', 'Steven Spielberg', 'Martin Scorsese', 'Ridley Scott'],
  ['Which film features a lion cub named Simba?', 'The Lion King', 'The Jungle Book', 'Madagascar', 'Bambi'],
  ['In "The Matrix", which colour pill does Neo take?', 'Red', 'Blue', 'Green', 'Yellow'],
  ["What was Pixar's first feature-length film?", 'Toy Story', "A Bug's Life", 'Finding Nemo', 'Monsters, Inc.'],
  ['Who plays Captain Jack Sparrow?', 'Johnny Depp', 'Orlando Bloom', 'Brad Pitt', 'Keanu Reeves'],
  ['Which fictional metal comes from Wakanda in "Black Panther"?', 'Vibranium', 'Adamantium', 'Unobtainium', 'Kryptonite'],
  ['Which was the first non-English-language film to win the Best Picture Oscar?', 'Parasite', 'Roma', 'Amélie', 'Crouching Tiger, Hidden Dragon'],
  ['What is the name of the school Harry Potter attends?', 'Hogwarts', 'Durmstrang', 'Beauxbatons', 'Ilvermorny'],
  ['Who directed "Jurassic Park"?', 'Steven Spielberg', 'George Lucas', 'James Cameron', 'Robert Zemeckis'],
  ['"May the Force be with you" is a line from which franchise?', 'Star Wars', 'Star Trek', 'Dune', 'Avatar'],
  ['Who played the Joker in "The Dark Knight" (2008)?', 'Heath Ledger', 'Joaquin Phoenix', 'Jared Leto', 'Jack Nicholson'],
  ['In "The Lord of the Rings", which hobbit carries the One Ring to Mordor?', 'Frodo', 'Sam', 'Bilbo', 'Pippin'],
  ['Which animated film features the song "Let It Go"?', 'Frozen', 'Moana', 'Tangled', 'Encanto'],
  ['Who directed "The Godfather"?', 'Francis Ford Coppola', 'Martin Scorsese', 'Brian De Palma', 'Stanley Kubrick'],
  ['In which film is the spaceship called the Nostromo?', 'Alien', 'Event Horizon', 'Interstellar', '2001: A Space Odyssey'],
  ['Who directed "Inception"?', 'Christopher Nolan', 'Denis Villeneuve', 'David Fincher', 'Quentin Tarantino'],
  ['In "Forrest Gump", life is like a box of what?', 'Chocolates', 'Candies', 'Surprises', 'Cookies'],
  ['In which country is Studio Ghibli based?', 'Japan', 'South Korea', 'China', 'United States'],
  ['Which actor plays Iron Man in the Marvel films?', 'Robert Downey Jr.', 'Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo'],
  ['Which 1975 thriller is about a great white shark?', 'Jaws', 'Deep Blue Sea', 'The Meg', 'Piranha'],
]);

export const QUESTION_BANK: readonly BankQuestion[] = bank;
