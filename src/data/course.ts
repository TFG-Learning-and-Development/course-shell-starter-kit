export interface HeritageMilestone {
  id: string;
  year?: string;
  title: string;
  detail: string;
  customerMeaning: string;
  image: string;
  imageAlt: string;
}

export interface BrandValue {
  id: string;
  label: string;
  message: string;
}

export interface ConversationExample {
  number: number;
  customer: string;
  response: string;
}

export const courseData = {
  meta: {
    title: "Champion at TFG: The Brand Worth Talking About",
    description: "Meet Champion, The Original Sportswear Brand™, and learn how to connect its heritage, values, and everyday style to Customer needs.",
  },
  nav: [
    { id: "overview", label: "Overview" },
    { id: "meet-champion", label: "Meet Champion" },
    { id: "why-champion", label: "Why Champion at TFG" },
    { id: "champion-heritage", label: "Champion Heritage" },
    { id: "brand-dna", label: "Brand DNA" },
    { id: "champion-knowledge", label: "Champion Knowledge" },
  ],
  overview: {
    title: "Welcome to Champion",
    paragraphs: [
      "Welcome to Champion at TFG: The Brand Worth Talking About. Champion is an iconic sportswear brand with a strong history, a bold style, and everyday comfort that Customers can enjoy in store.",
      "This course gives you a simple first look at Champion. You will learn what the brand stands for, why it is exciting for TFG, and how to use short, helpful messages when Customers ask about Champion.",
      "The Champion learning series will cover the brand first, then move into product and range learning for each retail brand. This helps you build your Champion knowledge step by step.",
    ],
    journey: ["Meet Champion", "Learn the products in your store"],
  },
  meet: {
    title: "Meet Champion",
    statement: "Champion is The Original Sportswear Brand™.",
    history: "The brand started in 1919 and has grown into a well-known sports and lifestyle brand.",
    lead: "Champion is known for:",
    points: [
      "sport-inspired style",
      "comfortable everyday wear",
      "a real brand story and heritage",
      "relaxed lifestyle pieces",
    ],
  },
  why: {
    title: "Why Champion at TFG",
    text: "Champion gives TFG stores a strong sportswear name that Customers may already know and recognise. It brings together sport, comfort, heritage, and lifestyle style in a way that can support different Customer needs.",
    videoLabel: "Watch the video",
  },
  heritage: {
    title: "Champion Heritage",
    intro: "Champion’s heritage can help you explain why the brand has credibility. Keep this simple by focusing on a short heritage timeline that you can remember and use in Customer conversations.",
    timelineLabel: "Short heritage timeline:",
    milestones: [
      {
        id: "1919",
        year: "1919",
        title: "Champion begins",
        detail: "Champion was founded as Knickerbocker Knitting Mills in Rochester, New York.",
        customerMeaning: "This helps Customers see Champion as an established sportswear brand with a long history.",
        image: "/assets/champion/champion-heritage-1919.png",
        imageAlt: "Archive photograph of an early Champion athlete holding a ball.",
      },
      {
        id: "1926",
        year: "1926",
        title: "Champion supports collegiate teams",
        detail: "Champion began supplying school uniforms to Wentworth Military Academy, which helped build its link to school and college sport.",
        customerMeaning: "This shows Customers that Champion has strong roots in sport and team culture.",
        image: "/assets/champion/champion-heritage-1926.png",
        imageAlt: "Archive image of a collegiate team sweater.",
      },
      {
        id: "1938",
        year: "1938",
        title: "Reverse Weave is introduced",
        detail: "Champion’s Reverse Weave sweatshirt was created to reduce shrinkage and support movement during sport.",
        customerMeaning: "This helps Customers understand that Champion is known for practical, comfortable sportswear innovation.",
        image: "/assets/champion/champion-heritage-1938.png",
        imageAlt: "Archive Reverse Weave patent illustration.",
      },
      {
        id: "recognition",
        title: "Sport and lifestyle recognition",
        detail: "Champion grew from sportswear into a brand recognised across sport, fashion, culture, and everyday style.",
        customerMeaning: "This shows Customers that Champion works beyond sport and can fit daily outfits and relaxed lifestyle looks.",
        image: "/assets/champion/champion-lifestyle-archive.png",
        imageAlt: "Three people wearing colourful Champion sport-inspired lifestyle outfits.",
      },
    ] satisfies HeritageMilestone[],
  },
  brandDna: {
    title: "Champion Brand DNA and Customer Needs",
    intro: "Let’s look at the Champion values that are easiest to use when speaking to Customers. You do not need to explain every brand value. Focus on the values that are simple, useful, and easy to connect to a Customer’s need.",
    activityTitle: "Champion Values and Customer Messages",
    values: [
      { id: "heritage", label: "Heritage", message: "Champion has a long sportswear history that gives the brand credibility." },
      { id: "authenticity", label: "Authenticity", message: "Champion has a real brand story linked to sport and lifestyle." },
      { id: "comfort", label: "Comfort", message: "Champion can suit Customers who want easy, everyday wear." },
      { id: "sport", label: "Sport", message: "Champion has strong sport roots and a sport-inspired look." },
      { id: "everyday-style", label: "Everyday style", message: "Champion can fit relaxed outfits and daily lifestyle looks." },
    ] satisfies BrandValue[],
  },
  knowledge: {
    title: "Using Champion Knowledge Every Day",
    intro: "You can use Champion knowledge during normal daily activities. The aim is not to give a long brand history. The aim is to share a short, helpful message that connects Champion to what the Customer needs.",
    examplesLabel: "Practical Customer conversation examples:",
    examples: [
      {
        number: 1,
        customer: "I want something comfortable that I can wear every day.",
        response: "Champion is a good option because it is known for comfort and everyday style. It gives you a relaxed look with a strong sportswear story.",
      },
      {
        number: 2,
        customer: "I like brands that have a bit of history.",
        response: "Champion has been around since 1919, so it has a real sportswear heritage. It is known as The Original Sportswear Brand™.",
      },
      {
        number: 3,
        customer: "I want a sport-inspired outfit, but not something too technical.",
        response: "Champion works well for that. It has sport roots, but the look is relaxed enough for everyday wear.",
      },
      {
        number: 4,
        customer: "I have seen Champion before, but I do not know much about it.",
        response: "Champion is The Original Sportswear Brand™. It brings together sport-inspired style, comfort, and a long brand story.",
      },
      {
        number: 5,
        customer: "I want something casual that still feels like a known brand.",
        response: "Champion is a recognised sportswear brand with relaxed lifestyle pieces. It is a good choice if you want everyday comfort with a brand story behind it.",
      },
    ] satisfies ConversationExample[],
  },
  closing: {
    title: "Closing",
    paragraphs: [
      "Well done. You have completed Champion at TFG: The Brand Worth Talking About.",
      "You can now identify Champion as The Original Sportswear Brand™, recall key heritage points, recognise simple Champion values, match Customer needs to Champion messages, and choose a useful talking point during a Customer conversation.",
      "Champion is more than a logo. It is a sportswear brand with heritage, comfort, style, and cultural relevance that store employees can bring to life with Customers every day.",
    ],
  },
  footer: { button: "Return to People Connect", url: "#top" },
};
