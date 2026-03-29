// ── Category colors ───────────────────────────────────────────────────────────

export const CATEGORY_COLORS = {
  'Income':         '#1D9E75',
  'Housing':        '#378ADD',
  'Groceries':      '#2a5c45',
  'Dining out':     '#D85A30',
  'Coffee':         '#8B4513',
  'Drinks':         '#9B59B6',
  'Transportation': '#7F77DD',
  'Subscriptions':  '#BA7517',
  'Utilities':      '#D4537E',
  'Healthcare':     '#639922',
  'Entertainment':  '#5DCAA5',
  'Shopping':       '#c0392b',
  'Travel':         '#888780',
  'Pets':           '#E8A838',
  'Education':      '#6B3FA0',
  'Childcare':      '#1A6B8A',
  'Other':          '#B4B2A9',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS);

// ── Rules (Coffee and Drinks BEFORE Dining out) ───────────────────────────────

const RULES = [

  // ── INCOME (positive amounts only) ──
  { category: 'Income', requirePositive: true,
    keywords: ['direct dep', 'payroll', 'gusto', 'adp ', 'paychex', 'intuit payroll',
      'bamboohr', 'rippling', 'zenefits', 'justworks', 'trinet ', 'zelle from',
      'venmo from', 'paypal transfer', 'direct deposit', 'ach credit', 'ach dep',
      'wire credit', 'salary', 'wages', 'commission', 'bonus deposit',
      'reimbursement', 'expense reimb', 'tax refund', 'irs treas', 'state refund'] },

  // ── HOUSING ──
  { category: 'Housing',
    keywords: ['rent', 'mortgage', 'hoa ', 'homeowner', 'apartment', 'zillow',
      'zumper', 'lease payment', 'property management', 'renters ins',
      'homeowners ins', 'state farm home', 'allstate home', 'lemonade ins',
      'property tax', 'real estate tax'] },

  // ── GROCERIES ──
  { category: 'Groceries',
    keywords: ['whole foods', 'trader joe', 'kroger', 'safeway', 'albertsons',
      'publix', 'heb ', 'wegmans', 'sprouts', 'aldi', 'costco', 'sams club',
      'walmart grocery', 'walmart super', 'target grocery', 'instacart', 'shipt',
      'fresh market', 'ralphs', 'vons', 'harris teeter', 'food lion', 'stop shop',
      'giant food', 'market basket', 'hyvee', 'meijer', 'giant eagle', 'food city',
      'winn dixie', 'ingles', 'price chopper', 'shoprite', 'stater bros',
      'natural grocers', 'lucky supermarket', 'cardenas', 'fiesta mart',
      'rancho market', 'h mart', '99 ranch', 'international foods',
      'wholefds', 'grocery', 'supermarket', 'food mart'] },

  // ── COFFEE (must appear before Dining out) ──
  { category: 'Coffee',
    keywords: ['starbucks', 'dunkin', 'dutch bros', 'peets coffee', "peet's coffee",
      'blue bottle', 'philz coffee', 'caribou coffee', 'biggby coffee',
      'scooters coffee', 'coffee beanery', 'panera bread coffee',
      'la madeleine', 'einstein bros', 'coffee', 'espresso', 'cafe',
      'roasters', 'roastery', 'brew bar', 'pour over', 'beanery',
      'coffee house', 'coffeehouse', 'the human bean', '7 brew',
      'black rock coffee', 'portafilter', 'keurig', 'nespresso'] },

  // ── DRINKS (must appear before Dining out) ──
  { category: 'Drinks',
    keywords: ['total wine', 'bevmo', 'wine & spirits', 'total beverage',
      'abc fine wine', 'wine warehouse', "spec's", "binny's", 'hi-time wine',
      'k&l wine', 'liquor barn', 'liquor store', 'liquor depot', 'liquor mart',
      'distillery', 'winery', 'vineyard', 'brewery', 'brewing co', 'brew co',
      'brewhouse', 'brewpub', 'craft beer', 'taproom', 'tap room', 'ale house',
      'alehouse', 'beer bar', 'cocktail bar', 'whiskey bar', 'wine bar',
      'bottle shop', 'bottle club', 'pour house'] },

  // ── DINING OUT (after Coffee and Drinks) ──
  { category: 'Dining out',
    keywords: ['restaurant', 'doordash', 'uber eats', 'grubhub', 'postmates',
      'seamless', 'chipotle', 'mcdonalds', 'subway subs', 'chick fil',
      'taco bell', 'wendys', 'burger king', 'dominos', 'pizza hut',
      'papa johns', 'little caesars', 'panera', 'shake shack', 'five guys',
      'wingstop', 'panda express', 'sonic drive', 'culvers', 'zaxbys',
      'whataburger', 'in n out', 'jack in the box', 'carls jr', 'del taco',
      'popeyes', 'el pollo', 'toast tab', 'toasttab', 'clover food',
      'snooze', 'first watch', 'ihop', 'dennys', 'waffle house',
      'cracker barrel', 'applebees', 'chilis', 'olive garden', 'red lobster',
      'longhorn', 'outback', 'texas roadhouse', 'buffalo wild', 'hooters',
      'sushi', 'ramen', 'noodle', 'diner', 'bistro', 'grill',
      'tavern', 'eatery', 'kitchen', 'bbq', 'steakhouse', 'brasserie',
      'trattoria', 'pizzeria', 'taqueria', 'taco', 'boulangerie', 'creperie'] },

  // ── TRANSPORTATION ──
  { category: 'Transportation',
    keywords: ['uber', 'lyft', 'waymo', 'shell ', 'chevron', 'exxon', 'bp gas',
      'mobil', 'marathon gas', 'sunoco', 'speedway', 'circle k', 'wawa',
      'caseys', 'kwik trip', 'racetrac', 'gate petroleum', 'loves travel',
      'pilot flying', 'flying j', 'gas station', 'fuel stop', 'parking',
      'ez pass', 'ezpass', 'e-zpass', 'fastrak', 'sunpass', 'peach pass',
      'nc quick pass', 'txtag', 'kpass', 'pikepass', 'mta ', 'bart ',
      'cta ', 'septa', 'wmata', 'metro transit', 'amtrak', 'greyhound',
      'car wash', 'jiffy lube', 'valvoline', 'take 5 oil', 'midas', 'meineke',
      'firestone', 'mavis tire', 'discount tire', 'pep boys', 'autozone',
      'advance auto', 'napa auto', 'oreilly auto', 'tesla charging',
      'evgo', 'chargepoint', 'blink charging', 'bird scooter', 'lime scooter'] },

  // ── SUBSCRIPTIONS ──
  { category: 'Subscriptions',
    keywords: ['netflix', 'spotify', 'hulu', 'disney', 'hbo max', 'max.com',
      'apple.com bill', 'apple one', 'apple tv', 'apple music', 'apple arcade',
      'google one', 'youtube premium', 'youtube tv', 'amazon prime',
      'paramount plus', 'peacock', 'showtime', 'starz', 'crunchyroll', 'twitch',
      'adobe', 'microsoft 365', 'dropbox', 'icloud', 'nordvpn', 'expressvpn',
      'surfshark', 'headspace', 'calm app', 'duolingo', 'nytimes', 'wsj.com',
      'medium.com', 'substack', 'patreon', 'chatgpt', 'openai', 'anthropic',
      'notion', 'figma', 'github', 'atlassian', 'slack', 'zoom', 'aws ',
      'google cloud', 'digitalocean', 'heroku', 'netlify', 'vercel',
      'loom ', 'grammarly', 'lastpass', '1password', 'dashlane',
      'canva ', 'squarespace', 'wix.com', 'godaddy', 'namecheap'] },

  // ── UTILITIES ──
  { category: 'Utilities',
    keywords: ['electric', 'pg&e', 'pge ', 'coned', 'consolidated edison',
      'dominion energy', 'duke energy', 'xcel energy', 'national grid',
      'southern company', 'evergy', 'entergy', 'dte energy', 'consumers energy',
      'at&t', 'verizon', 't-mobile', 'sprint', 'comcast', 'xfinity',
      'spectrum', 'cox comm', 'frontier comm', 'centurylink', 'lumen',
      'google fi', 'mint mobile', 'cricket wireless', 'metro pcs',
      'boost mobile', 'visible ', 'us cellular', 'consumer cellular',
      'dish network', 'directv', 'water bill', 'municipal water',
      'city utilities', 'trash pickup', 'recology', 'waste management',
      'republic services', 'city sanitation'] },

  // ── HEALTHCARE ──
  { category: 'Healthcare',
    keywords: ['cvs pharmacy', 'walgreens', 'rite aid', 'pharmacy', 'rx pickup',
      'medical', 'dental', 'orthodont', 'vision', 'optometrist', 'doctor',
      'clinic', 'hospital', 'urgent care', 'labcorp', 'quest diag',
      'health ins', 'blue cross', 'aetna', 'cigna', 'united health', 'humana',
      'oscar health', 'molina', 'therapy', 'counseling', 'psychiatry',
      'chiropractor', 'physical therapy', 'dermatol', 'teladoc', 'hims ',
      'hers ', 'nurx ', 'ro health', 'betterhelp', 'talkspace', 'cerebral',
      'done health', 'zocdoc', 'one medical', 'carbon health', 'city md',
      'concentra', 'any lab test', 'orange theory', 'planet fitness',
      'anytime fitness', 'la fitness', '24 hour fitness', 'equinox',
      'crunch fitness', 'f45 ', 'classpass', 'peloton', 'solidcore'] },

  // ── ENTERTAINMENT ──
  { category: 'Entertainment',
    keywords: ['amc theater', 'regal cinema', 'cinemark', 'movie theater',
      'ticketmaster', 'stubhub', 'eventbrite', 'live nation', 'axs ticket',
      'bowling', 'mini golf', 'arcade', 'escape room', 'museum',
      'zoo ', 'aquarium', 'concert', 'comedy club', 'nba ', 'nfl ',
      'mlb ', 'nhl ', 'steam games', 'playstation', 'xbox', 'nintendo',
      'gamestop', 'best buy games', 'dave buster', 'top golf',
      'main event', 'urban air', 'sky zone'] },

  // ── TRAVEL ──
  { category: 'Travel',
    keywords: ['delta air', 'united air', 'american air', 'southwest air',
      'jetblue', 'spirit air', 'frontier air', 'allegiant', 'alaska air',
      'sun country', 'airline', 'airbnb', 'vrbo', 'marriott', 'hilton',
      'hyatt', 'ihg ', 'holiday inn', 'hampton inn', 'westin', 'sheraton',
      'doubletree', 'best western', 'motel 6', 'expedia', 'hotels.com',
      'booking.com', 'kayak', 'priceline', 'orbitz', 'hertz',
      'enterprise rent', 'avis car', 'budget car', 'national car',
      'thrifty car', 'dollar rental', 'sixt ', 'turo ', 'airport',
      'tsa pre', 'global entry', 'clear me'] },

  // ── SHOPPING ──
  { category: 'Shopping',
    keywords: ['amazon', 'target', 'walmart', 'costco', 'sams club',
      'home depot', 'lowes ', 'ikea', 'wayfair', 'overstock',
      'nordstrom', 'macys', 'bloomingdales', 'tj maxx', 'marshalls',
      'ross stores', 'old navy', 'gap ', 'banana republic', 'h&m ',
      'zara', 'nike', 'adidas', 'foot locker', 'dicks sporting', 'rei ',
      'etsy', 'ebay', 'shein', 'temu ', 'apple store', 'best buy',
      'dollar general', 'dollar tree', 'five below', 'big lots',
      'harbor freight', 'ace hardware', 'true value', 'menards',
      'bath body', 'victoria secret', 'american eagle', 'hollister',
      'abercrombie', 'urban outfitters', 'free people', 'anthropologie',
      'madewell', 'j crew', 'uniqlo', 'forever 21'] },

  // ── PETS ──
  { category: 'Pets',
    keywords: ['petco', 'petsmart', 'pet supplies plus', 'chewy',
      'banfield', 'vca animal', 'bluepearl', 'national vet',
      'healthy paws', 'nationwide pet', 'pet supplies', 'dog grooming',
      'cat grooming', 'pet grooming', 'animal hospital', 'veterinary',
      'vet clinic', 'paws ', 'puppy', 'kitten boarding'] },

  // ── EDUCATION ──
  { category: 'Education',
    keywords: ['tuition', 'student loan', 'navient', 'sallie mae', 'nelnet',
      'great lakes loan', 'mohela', 'fedloan', 'college board', 'common app',
      'coursera', 'udemy', 'skillshare', 'pluralsight', 'masterclass',
      'khan academy', 'rosetta stone', 'chegg', 'quizlet', 'bartleby',
      'university', 'college ', 'school fee', 'school supplies', 'bookstore'] },

  // ── CHILDCARE ──
  { category: 'Childcare',
    keywords: ['daycare', 'child care', 'childcare', 'preschool', 'montessori',
      'bright horizons', 'kindercare', 'learning care', 'learning tree',
      'ymca', 'after school', 'babysitter', 'nanny', 'au pair',
      'summer camp', 'gymnastics', 'swim lessons', 'dance studio',
      'little league', 'soccer club', 'youth sports', 'tutoring'] },
];

// ── Pass 1: Exact keyword matching ───────────────────────────────────────────

export function categorize(description, amount) {
  if (!description || !description.trim()) return 'Other';

  const desc = description.toLowerCase().replace(/[^a-z0-9 .]/g, ' ');

  for (const rule of RULES) {
    if (rule.requirePositive && amount <= 0) continue;

    for (const keyword of rule.keywords) {
      if (desc.includes(keyword)) {
        return rule.category;
      }
    }
  }
  return 'Other';
}

// ── Pass 2: Fuzzy tokenized matching ─────────────────────────────────────────

export function fuzzyMatch(description) {
  if (!description) return null;
  const tokens = description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter(t => t.length > 3);

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      const kwTokens = keyword.trim().split(' ').filter(t => t.length > 2);
      if (kwTokens.every(kt => tokens.some(t => t.includes(kt)))) {
        return rule.category;
      }
    }
  }
  return null;
}

// ── Categorize all transactions ───────────────────────────────────────────────

export function categorizeAll(transactions) {
  for (const tx of transactions) {
    if (tx.isTransfer || tx.isDuplicate) continue;

    // Pass 1: exact
    tx.category = categorize(tx.description, tx.amount);

    // Pass 2: fuzzy if still Other
    if (tx.category === 'Other') {
      const suggestion = fuzzyMatch(tx.description);
      if (suggestion) tx.category = suggestion;
    }
  }
  return transactions;
}

// ── Compute monthly averages ──────────────────────────────────────────────────

export function computeCategoryMonthlyAverages(spendingTransactions) {
  if (!spendingTransactions.length) return {};

  // Group by category
  const byCategory = {};
  let earliestDate = null, latestDate = null;

  for (const tx of spendingTransactions) {
    if (!byCategory[tx.category]) byCategory[tx.category] = 0;
    byCategory[tx.category] += tx.amount;
    if (!earliestDate || tx.date < earliestDate) earliestDate = tx.date;
    if (!latestDate || tx.date > latestDate) latestDate = tx.date;
  }

  if (!earliestDate || !latestDate) return {};

  // Number of months in the range
  const months = Math.max(1,
    (latestDate.getFullYear() - earliestDate.getFullYear()) * 12
    + (latestDate.getMonth() - earliestDate.getMonth()) + 1
  );

  const averages = {};
  for (const [cat, total] of Object.entries(byCategory)) {
    averages[cat] = total / months;
  }

  return averages;
}
