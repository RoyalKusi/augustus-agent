/**
 * Intent Detection Engine for Augustus Conversation Engine
 * Classifies customer messages into intents before calling Claude.
 * Covers 1000+ scenarios across 8 intent categories.
 */

export type Intent =
  | 'greeting'
  | 'product_inquiry'
  | 'price_question'
  | 'availability_check'
  | 'complaint'
  | 'ready_to_buy'
  | 'negotiation'
  | 'off_topic';

export interface IntentResult {
  intent: Intent;
  confidence: 'high' | 'medium' | 'low';
  instruction: string;
}

// ── Pattern banks ─────────────────────────────────────────────────────────────

const GREETING_PATTERNS = [
  /^(hi|hey|hello|hie|howdy|sup|yo|hola|salut|ciao|ola|helo|hellow|heya|heyy|hihi|hii|hiii)\b/i,
  /^(good\s*(morning|afternoon|evening|day|night))/i,
  /^(greetings|salutations|what'?s\s*up|wassup|wazzup|whaddup)/i,
  /^(how\s*(are\s*you|r\s*u|are\s*u|is\s*it\s*going|goes\s*it|do\s*you\s*do))/i,
  /^(morning|afternoon|evening|night)\b/i,
  /^(peace|blessed|shalom|namaste|sawubona|dumela|mhoro|mangwanani|masikati|manheru)/i,
  /^(howzit|howsit|howdy|g'day|ello|ello\s*there)/i,
  /^(anyone\s*(there|here|home|around|available|online))/i,
  /^(is\s*(anyone|somebody|someone)\s*(there|here|available|online|around))/i,
  /^(hello\s*(there|guys|team|shop|store|people|friend|sir|ma'?am|madam))/i,
];

const PRODUCT_INQUIRY_PATTERNS = [
  /\b(what\s*(do\s*you|products?|items?|stuff|things?|goods?|merch|merchandise)\s*(sell|have|got|offer|carry|stock))\b/i,
  /\b(show\s*(me|us)\s*(your|the|some|all)?\s*(products?|items?|catalogue|catalog|collection|range|stock|inventory))\b/i,
  /\b(what('?s|\s*is)\s*(available|in\s*stock|on\s*offer|for\s*sale|selling))\b/i,
  /\b(do\s*you\s*(have|sell|carry|stock|offer)\s*(any|some)?\s*\w+)\b/i,
  /\b(looking\s*(for|to\s*buy|to\s*get|to\s*purchase)\s*(a|an|some|the)?\s*\w+)\b/i,
  /\b(i\s*(want|need|would\s*like|am\s*looking\s*for|am\s*interested\s*in)\s*(a|an|some|the)?\s*\w+)\b/i,
  /\b(tell\s*me\s*(about|more\s*about)\s*(your|the)?\s*(products?|items?|collection|range))\b/i,
  /\b(can\s*i\s*(see|view|browse|check)\s*(your|the)?\s*(products?|catalogue|catalog|items?|collection))\b/i,
  /\b(what\s*(brands?|types?|kinds?|styles?|models?|sizes?|colors?|colours?)\s*(do\s*you\s*(have|carry|sell|offer)))\b/i,
  /\b(any\s*(new|latest|recent|fresh|hot|trending|popular|best\s*selling)\s*(products?|items?|arrivals?|stock))\b/i,
  /\b(product\s*(list|catalogue|catalog|range|selection|inventory|details?|info|information))\b/i,
  /\b(what\s*(are\s*your|is\s*your)\s*(best|top|most\s*popular|featured|recommended)\s*(products?|items?|sellers?))\b/i,
  /\b(shoes?|sneakers?|trainers?|boots?|sandals?|heels?|flats?|loafers?|pumps?)\b/i,
  /\b(clothes?|clothing|shirts?|t-?shirts?|tops?|pants?|trousers?|jeans?|shorts?|dresses?|skirts?|jackets?|coats?|hoodies?|sweaters?|jumpers?)\b/i,
  /\b(electronics?|phones?|laptops?|tablets?|gadgets?|accessories?|earphones?|headphones?|chargers?|cables?)\b/i,
  /\b(food|drinks?|beverages?|snacks?|groceries?|fresh\s*produce|organic)\b/i,
  /\b(furniture|sofas?|chairs?|tables?|beds?|wardrobes?|shelves?|desks?)\b/i,
  /\b(beauty|skincare|makeup|cosmetics?|perfume|fragrance|lotion|cream|serum)\b/i,
  /\b(jewellery|jewelry|rings?|necklaces?|bracelets?|earrings?|watches?|accessories?)\b/i,
  /\b(bags?|handbags?|backpacks?|wallets?|purses?|luggage|suitcases?)\b/i,
];

const PRICE_QUESTION_PATTERNS = [
  /\b(how\s*much\s*(does?\s*it|do\s*they|is\s*it|are\s*they|for|cost|is\s*the\s*price))\b/i,
  /\b(what('?s|\s*is)\s*(the\s*)?(price|cost|rate|charge|fee|amount|value|worth))\b/i,
  /\b(price\s*(list|range|tag|check|please|for|of))\b/i,
  /\b(how\s*much\s*(will\s*it|would\s*it|does\s*it|do\s*you)\s*(cost|be|charge))\b/i,
  /\b(what\s*(will\s*it|would\s*it|does\s*it)\s*(cost|be|run\s*me))\b/i,
  /\b(cost\s*(of|for|per|each|a\s*piece|one))\b/i,
  /\b(pricing|prices?|rates?|tariff|quote|quotation|estimate)\b/i,
  /\b(how\s*much\s*(are|is|for|per|each|one|a\s*pair|a\s*set|a\s*piece))\b/i,
  /\b(what\s*(do\s*you|does\s*it)\s*(go\s*for|sell\s*for|retail\s*for|cost))\b/i,
  /\b(any\s*(discounts?|deals?|offers?|promotions?|sales?|specials?|reductions?))\b/i,
  /\b(is\s*(it|there)\s*(on\s*sale|discounted|reduced|cheaper|affordable|budget))\b/i,
  /\b(budget|affordable|cheap|inexpensive|economical|value\s*for\s*money)\b/i,
  /\b(expensive|pricey|costly|high\s*end|premium|luxury)\b/i,
  /\b(\$|usd|zwd|zwl|rand|zar|kes|ngn|ghs|tzs|ugx|mwk|zmw|bwp|mzn|aoa)\s*\d+|\d+\s*(\$|usd|zwd|zwl|rand|zar|kes|ngn|ghs))\b/i,
];

const AVAILABILITY_PATTERNS = [
  /\b(in\s*stock|out\s*of\s*stock|available|unavailable|sold\s*out)\b/i,
  /\b(do\s*you\s*(have|got|carry|stock)\s*(it|them|any|some|the))\b/i,
  /\b(is\s*(it|this|that|the\s*\w+)\s*(available|in\s*stock|ready|there))\b/i,
  /\b(when\s*(will\s*(it|they|you)|is\s*(it|the\s*\w+))\s*(be\s*)?(back|available|in\s*stock|restocked))\b/i,
  /\b(can\s*i\s*(get|order|buy|purchase)\s*(it|one|some|the\s*\w+)\s*(now|today|immediately))\b/i,
  /\b(how\s*many\s*(do\s*you\s*(have|got)|are\s*(left|available|in\s*stock)))\b/i,
  /\b(stock|inventory|quantity|units?\s*(left|available|remaining))\b/i,
  /\b(size\s*(available|in\s*stock|do\s*you\s*have)|available\s*sizes?)\b/i,
  /\b(color|colour)\s*(available|options?|choices?|do\s*you\s*have)\b/i,
  /\b(delivery|shipping|dispatch)\s*(available|to|time|date|when)\b/i,
];

const COMPLAINT_PATTERNS = [
  /\b(not\s*(working|good|right|correct|what\s*i\s*(ordered|expected|wanted)))\b/i,
  /\b(broken|damaged|defective|faulty|torn|ripped|cracked|scratched|dented)\b/i,
  /\b(wrong\s*(item|product|size|color|colour|order|delivery))\b/i,
  /\b(never\s*(arrived|came|received|delivered|got\s*it))\b/i,
  /\b(still\s*(waiting|haven'?t\s*(received|got|gotten)|not\s*(here|arrived|delivered)))\b/i,
  /\b(refund|return|exchange|replace|replacement|money\s*back|compensation)\b/i,
  /\b(terrible|horrible|awful|disgusting|pathetic|rubbish|trash|garbage|useless|waste)\b/i,
  /\b(disappointed|unhappy|unsatisfied|dissatisfied|frustrated|angry|upset|annoyed|furious|livid)\b/i,
  /\b(scam|fraud|fake|counterfeit|not\s*genuine|not\s*authentic|rip\s*off|ripoff)\b/i,
  /\b(complaint|complain|issue|problem|trouble|concern|dispute|grievance)\b/i,
  /\b(poor\s*(quality|service|product|packaging|condition))\b/i,
  /\b(late|delayed|overdue|taking\s*too\s*long|slow\s*(delivery|service|response))\b/i,
  /\b(you\s*(are|r)\s*(useless|stupid|terrible|awful|bad|rubbish|trash|a\s*scam|lying|cheating))\b/i,
  /\b(this\s*is\s*(unacceptable|ridiculous|outrageous|a\s*joke|terrible|awful|bad))\b/i,
  /\b(i\s*(want|need|demand|require)\s*(a\s*)?(refund|return|exchange|replacement|my\s*money\s*back))\b/i,
  /\b(where\s*is\s*(my|the)\s*(order|package|delivery|parcel|item|product))\b/i,
  /\b(not\s*(happy|satisfied|pleased|impressed)\s*(with|about|at))\b/i,
  /\b(charged\s*(me|us)\s*(wrong|twice|extra|too\s*much|incorrectly))\b/i,
  /\b(never\s*(again|buying|ordering|using|coming\s*back))\b/i,
  /\b(worst\s*(experience|service|product|shop|store|company|brand))\b/i,
];

const READY_TO_BUY_PATTERNS = [
  /\b(i\s*(want|would\s*like|will\s*take|am\s*taking|am\s*buying|am\s*getting)\s*(to\s*(buy|order|purchase|get))?\s*(it|one|two|three|\d+|a\s*pair|a\s*set|some|the\s*\w+))\b/i,
  /\b(i'?ll\s*(take|buy|get|order|have|go\s*with)\s*(it|one|two|three|\d+|a\s*pair|the\s*\w+))\b/i,
  /\b(add\s*(it|them|one|two|\d+)\s*(to\s*(my\s*)?(cart|bag|order|basket)))\b/i,
  /\b(place\s*(an?\s*)?(order|purchase))\b/i,
  /\b(how\s*(do\s*i|can\s*i|to)\s*(buy|order|purchase|pay|checkout|complete\s*(the\s*)?order))\b/i,
  /\b(ready\s*(to\s*(buy|order|pay|checkout|purchase)))\b/i,
  /\b(let'?s\s*(do\s*it|go|proceed|checkout|order|buy|get\s*it))\b/i,
  /\b(yes\s*(please|i\s*(want|will|do)|let'?s\s*(do\s*it|go|proceed)))\b/i,
  /\b(confirm\s*(my\s*)?(order|purchase|payment|checkout))\b/i,
  /\b(proceed\s*(to\s*(checkout|payment|pay|order)))\b/i,
  /\b(send\s*(me\s*)?(the\s*)?(payment|pay|link|invoice|bill|receipt))\b/i,
  /\b(i\s*(am\s*)?interested\s*(in\s*(buying|purchasing|ordering|getting)))\b/i,
  /\b(can\s*i\s*(order|buy|purchase|get|have)\s*(it|one|two|\d+|the\s*\w+))\b/i,
  /\b(i\s*(choose|pick|select|want)\s*(this|that|the\s*\w+|option\s*\d+|number\s*\d+))\b/i,
  /\b(checkout|pay\s*now|buy\s*now|order\s*now|purchase\s*now|get\s*it\s*now)\b/i,
  /\b(how\s*(much\s*(is\s*the\s*total|do\s*i\s*(owe|pay)|is\s*it\s*all\s*together)|to\s*pay))\b/i,
  /\b(what\s*(payment\s*methods?|ways?\s*to\s*pay|can\s*i\s*pay\s*with|do\s*you\s*accept))\b/i,
  /\b(do\s*you\s*(accept|take|use)\s*(card|cash|mobile\s*money|ecocash|paynow|paypal|visa|mastercard|crypto))\b/i,
  /\b(i\s*(have\s*decided|made\s*up\s*my\s*mind|am\s*sure|definitely\s*want))\b/i,
  /\b(give\s*me\s*(one|two|three|\d+|a\s*pair|the\s*\w+))\b/i,
  /\b(i\s*(need|want)\s*(to\s*(complete|finish|finalise|finalize)\s*(my\s*)?(order|purchase|checkout)))\b/i,
  /\b(wrap\s*it\s*up|let'?s\s*(wrap|close|seal)\s*(the\s*)?(deal|order|purchase))\b/i,
  /\b(sold|deal|done|agreed|perfect|that'?s\s*(the\s*one|it|perfect|great|exactly\s*what\s*i\s*(want|need)))\b/i,
];

const NEGOTIATION_PATTERNS = [
  /\b(can\s*you\s*(do|give|offer|make)\s*(it|me|us)\s*(cheaper|better|lower|a\s*discount|a\s*deal|a\s*better\s*price))\b/i,
  /\b(any\s*(chance\s*of\s*a?\s*)?(discount|deal|reduction|lower\s*price|better\s*price|negotiation))\b/i,
  /\b(too\s*(expensive|pricey|costly|much|high)\s*(for\s*me|for\s*my\s*budget)?)\b/i,
  /\b(can\s*(the\s*price\s*be|you)\s*(reduced|lowered|negotiated|adjusted|come\s*down))\b/i,
  /\b(i\s*(only\s*have|can\s*(only\s*)?afford|have\s*a\s*budget\s*of)\s*[\$\d])\b/i,
  /\b(what'?s\s*(your\s*)?(best|lowest|final|bottom)\s*(price|offer|deal))\b/i,
  /\b(i\s*(found|saw|seen)\s*(it|the\s*same\s*(thing|product|item))\s*(cheaper|for\s*less|at\s*a\s*lower\s*price)\s*(elsewhere|somewhere\s*else|online|at\s*\w+))\b/i,
  /\b(match\s*(the\s*)?(price|offer|deal)|price\s*match)\b/i,
  /\b(bulk\s*(discount|deal|price|order|buy|purchase))\b/i,
  /\b(if\s*i\s*(buy|order|take|get)\s*(more|multiple|\d+|a\s*lot))\b/i,
  /\b(wholesale|bulk|trade\s*price|reseller|distributor)\b/i,
  /\b(throw\s*in|include|add|bundle)\s*(something|anything|a\s*freebie|for\s*free)\b/i,
  /\b(free\s*(delivery|shipping|gift|sample|extra))\b/i,
  /\b(last\s*(price|offer)|final\s*(price|offer)|take\s*it\s*or\s*leave\s*it)\b/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(weather|temperature|forecast|rain|sunny|cloudy|hot|cold|wind)\b/i,
  /\b(news|politics|government|election|president|prime\s*minister|parliament)\b/i,
  /\b(sports?|football|soccer|cricket|rugby|basketball|tennis|golf|olympics?)\b/i,
  /\b(movie|film|series|show|netflix|youtube|tiktok|instagram|facebook|twitter|social\s*media)\b/i,
  /\b(joke|funny|laugh|humor|humour|meme|lol|haha|lmao|rofl)\b/i,
  /\b(relationship|love|dating|marriage|boyfriend|girlfriend|husband|wife|partner)\b/i,
  /\b(school|university|college|homework|assignment|exam|study|education)\b/i,
  /\b(health|doctor|hospital|medicine|sick|ill|disease|covid|vaccine)\b/i,
  /\b(religion|church|mosque|temple|god|prayer|faith|spiritual)\b/i,
  /\b(who\s*(are\s*you|made\s*you|created\s*you|built\s*you|is\s*your\s*(creator|developer|owner)))\b/i,
  /\b(are\s*you\s*(a\s*)?(robot|bot|ai|human|real|machine|computer|chatbot))\b/i,
  /\b(what\s*(is\s*your\s*name|are\s*you|can\s*you\s*do|is\s*ai))\b/i,
  /\b(tell\s*me\s*(a\s*joke|something\s*funny|about\s*yourself|your\s*name))\b/i,
];

// ── Scoring engine ────────────────────────────────────────────────────────────

function score(text: string, patterns: RegExp[]): number {
  const lower = text.toLowerCase();
  return patterns.reduce((acc, p) => acc + (p.test(lower) ? 1 : 0), 0);
}


// ── Intent instructions (action-oriented, no confirmation questions) ──────────

const INTENT_INSTRUCTIONS: Record<Intent, string> = {
  greeting:
    'Customer is greeting. Reply in one warm sentence and immediately ask what they are looking for — do not wait.',
  product_inquiry:
    'Customer wants products. Immediately use CAROUSEL_TRIGGER with ALL product IDs. One sentence intro only.',
  price_question:
    'Customer asked about price. State the price in one sentence, then say "Want me to place the order?" — nothing else.',
  availability_check:
    'Item is in stock. Confirm in one sentence and immediately ask "How many would you like?" to move to order.',
  complaint:
    'Customer is unhappy. One sentence apology, then immediately offer a solution. Do not ask questions.',
  ready_to_buy:
    'CLOSE THE SALE NOW. Do not ask any questions. Do not confirm. Immediately use PAYMENT_TRIGGER with the product and quantity. If quantity is unclear, assume 1.',
  negotiation:
    'Acknowledge briefly, offer best price or free delivery in one sentence, then immediately ask "Shall I place the order at that price?"',
  off_topic:
    'One sentence redirect: "I can help you with our products — want to see what we have?" Then use CAROUSEL_TRIGGER.',
};

// ── Buying signal keywords (any match = ready_to_buy override) ────────────────

const BUYING_SIGNAL_WORDS = [
  /\b(want|need|take|buy|order|get|purchase|grab|pick|choose|select|have|give\s*me)\b/i,
  /\b(yes|yep|yeah|yah|sure|ok|okay|alright|fine|deal|done|sold|perfect|great)\b/i,
  /\b(send|pay|payment|link|invoice|checkout|proceed|confirm|place)\b/i,
  /\b(one|two|three|four|five|\d+)\s*(pair|piece|unit|item|set|of\s*them)?\b/i,
  /\b(i'?ll|i\s*will|let'?s|go\s*ahead|do\s*it|make\s*it\s*happen)\b/i,
];

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectIntent(message: string): IntentResult {
  const text = message.trim();
  const lower = text.toLowerCase();

  // PRIORITY 1: Complaints always win — never push a sale on an angry customer
  const complaintScore = score(text, COMPLAINT_PATTERNS);
  if (complaintScore >= 1) {
    return { intent: 'complaint', confidence: 'high', instruction: INTENT_INSTRUCTIONS.complaint };
  }

  // PRIORITY 2: Explicit ready_to_buy patterns
  const readyScore = score(text, READY_TO_BUY_PATTERNS);
  if (readyScore >= 1) {
    return { intent: 'ready_to_buy', confidence: 'high', instruction: INTENT_INSTRUCTIONS.ready_to_buy };
  }

  // PRIORITY 3: Any buying signal word = treat as ready_to_buy
  // This is the aggressive close — pick up the slightest hint
  const hasBuyingSignal = BUYING_SIGNAL_WORDS.some((p) => p.test(lower));
  if (hasBuyingSignal) {
    // But not if it's clearly a question about price or availability
    const isPriceQ = score(text, PRICE_QUESTION_PATTERNS) >= 1;
    const isAvailQ = score(text, AVAILABILITY_PATTERNS) >= 1;
    const isNegotiation = score(text, NEGOTIATION_PATTERNS) >= 1;
    if (!isPriceQ && !isAvailQ && !isNegotiation) {
      return { intent: 'ready_to_buy', confidence: 'medium', instruction: INTENT_INSTRUCTIONS.ready_to_buy };
    }
  }

  // PRIORITY 4: Score remaining intents
  const scores: Record<Intent, number> = {
    greeting: score(text, GREETING_PATTERNS),
    product_inquiry: score(text, PRODUCT_INQUIRY_PATTERNS),
    price_question: score(text, PRICE_QUESTION_PATTERNS),
    availability_check: score(text, AVAILABILITY_PATTERNS),
    complaint: 0, // already handled
    ready_to_buy: 0, // already handled
    negotiation: score(text, NEGOTIATION_PATTERNS),
    off_topic: score(text, OFF_TOPIC_PATTERNS),
  };

  let topIntent: Intent = 'product_inquiry';
  let topScore = 0;

  for (const [intent, s] of Object.entries(scores) as [Intent, number][]) {
    if (s > topScore) {
      topScore = s;
      topIntent = intent;
    }
  }

  // Short messages with no matches
  if (topScore === 0) {
    topIntent = text.length <= 12 ? 'greeting' : 'product_inquiry';
  }

  const confidence: IntentResult['confidence'] =
    topScore >= 3 ? 'high' : topScore >= 1 ? 'medium' : 'low';

  return {
    intent: topIntent,
    confidence,
    instruction: INTENT_INSTRUCTIONS[topIntent],
  };
}
