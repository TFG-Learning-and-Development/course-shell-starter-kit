export type ProductCard = { customerNeed: string; option: string; cue: string; image: string; alt: string };
export type TechnologyItem = { feature: string; benefit: string; phrase: string; hotspot: number };
export type ScenarioBranch = { ask: string; match: string; recommend: string; image: string; alt: string };
export type AssessmentQuestion = { scenario: string; question: string; options: string[]; correctIndex: number; feedback: string };

export const courseData = {
  meta: {
    title: "Adidas Adistar",
    description: "This course helps Totalsports store employees recommend Adidas Adistar running shoes for maximum cushioning, comfort, and support over longer distances.",
  },
  nav: [
    { id: "overview", label: "Overview" },
    { id: "customer-moment", label: "Customer Moment" },
    { id: "product-basics", label: "Product Basics" },
    { id: "product-range", label: "Product Range" },
    { id: "how-to-sell", label: "How to Sell" },
    { id: "activity", label: "Activity" },
  ],
  welcome: {
    title: "Adidas Adistar",
    text: "The Adidas Adistar range is designed for Customers who want maximum cushioning for longer distance running. This course will help you identify what the Customer needs, choose the right Adistar shoe, and explain the recommendation with confidence.",
    image: "/images/adistar/hero-adistar.png",
    imageAlt: "A white and green Adidas Adistar running shoe shown with its outsole.",
  },
  customerMoment: {
    title: "Customer Moment",
    text: "A Customer walks in and says, “I am building up to longer runs, but I need a shoe that feels cushioned and comfortable at an easy pace.”",
    clue: "This is a clue that Adidas Adistar may be the right range to recommend.",
    takeaway: "Adistar is for Customers who want maximum cushioning, comfort, and support for longer easy-paced running.",
  },
  basics: {
    title: "Product Basics",
    intro: "Adistar is an Adidas running range for Customers who want maximum cushioning, reliable comfort, and support for longer distance running. It is a strong option when a Customer runs further, prefers an easy pace, or asks for a soft and stable feel underfoot.",
    recommendationLead: "Recommend Adidas Adistar when Customers say they want to:",
    recommendations: [
      "Run longer distances",
      "Feel more cushioning during easy-paced runs",
      "Get support when they run further",
      "Feel stable while running longer distances",
      "Have reliable grip for regular running",
    ],
    runnerImage: "/images/adistar/product-basics-runner.png",
    runnerAlt: "A runner in blue and white sportswear posed over blue geometric stripes.",
    benefitsImage: "/images/adistar/on-foot.jpg",
    benefitsAlt: "A runner wearing dark Adidas Adistar shoes with turquoise and green cushioning.",
    benefitsTitle: "Key Benefits",
    benefits: "Repetitor cushioning, Guidance Rail (Stability Frame) support, Lighttraxion grip, and Adiwear durability help Customers feel cushioned, supported, and secure during longer easy-paced runs.",
  },
  range: {
    title: "Adidas Adistar range overview",
    intro: "Start with the Customer’s cushioning, support, and running distance need. Click on each card to reveal the most suitable Adidas Adistar option and when to recommend it.",
    cards: [
      {
        customerNeed: "Adistar Charge",
        option: "Adistar Charge",
        cue: "Recommend when the Customer wants maximum cushioning with a more stable, supported feel for distance running.",
        image: "/images/adistar/adistar-charge.png",
        alt: "A black Adidas Adistar Charge running shoe with orange and red cushioning.",
      },
      {
        customerNeed: "Adistar 4",
        option: "Adistar 4",
        cue: "Recommend when the Customer wants a cushioned, comfortable shoe for longer easy-paced runs.",
        image: "/images/adistar/adistar-4.png",
        alt: "A white Adidas Adistar 4 running shoe with navy stripes and green cushioning.",
      },
    ] as ProductCard[],
    needs: {
      "Adistar Charge": "Maximum cushioning for longer runs with added stability",
      "Adistar 4": "Maximum cushioning for longer easy-paced runs",
    } as Record<string, string>,
  },
  technology: {
    title: "How to explain the Technology",
    intro: "Keep technology explanations short. Start with the feature, explain the Customer benefit, and then use a simple selling phrase. Click each number to learn more.",
    image: "/images/adistar/technology-exploded.png",
    imageAlt: "An exploded view of the layered sole technology inside an Adidas Adistar running shoe.",
    items: [
      { feature: "Repetitor midsole", benefit: "Provides maximum cushioning for distance running.", phrase: "“This gives you a cushioned feel for longer easy-paced runs.”", hotspot: 1 },
      { feature: "Guidance rail", benefit: "Helps the midfoot feel more stable and supported.", phrase: "“This helps your foot feel more stable while you run further.”", hotspot: 2 },
      { feature: "Lighttraxion outsole on Adistar 4", benefit: "Provides lightweight grip across surfaces.", phrase: "“This gives you reliable grip without adding unnecessary weight.”", hotspot: 3 },
      { feature: "Adiwear rubber outsole on Adistar Charge", benefit: "Provides durable grip and traction.", phrase: "“This gives you durable grip for regular runs.”", hotspot: 4 },
    ] as TechnologyItem[],
  },
  selling: {
    title: "Key Selling Message",
    intro: "Use a simple flow: ask one question, listen for the Customer’s cushioning, support, and distance need, then recommend one Adidas Adistar option with one clear benefit.",
    steps: [
      { title: "Ask:", text: "“What distance are you running, and do you want the shoe to feel more cushioned, stable, or both?”" },
      { title: "Listen:", text: "Is the Customer talking about longer runs, easy-paced running, maximum cushioning, stability, support, or grip?" },
      { title: "Recommend:", text: "Match the shoe to the Customer’s need and explain one clear benefit." },
    ],
    example: "“Because you are running longer distances and want a more stable cushioned feel, I would show you the Adistar Charge. It gives you maximum cushioning with added stability and grip for distance running.”",
  },
  scenario: {
    title: "Customer Scenario",
    intro: "Use this example to see how a store employee can move from Customer need to product recommendation.",
    customer: "Customer says: “I am running longer distances at an easy pace. I want maximum cushioning, but I also want the shoe to feel stable when I get tired.”",
    employee: "Store employee says: “Based on what you need, I would show you the Adistar Charge. It gives you stable maximum cushioning, so your run can feel more supported over distance.”",
    branches: [
      { ask: "“Are you running longer distances?”", match: "Distance running", recommend: "Show Adistar Charge or Adistar 4, depending on support need.", image: "/images/adistar/hero-adistar.png", alt: "Adistar Charge and Adistar 4 options for distance running." },
      { ask: "“Do you want the shoe to feel more cushioned?”", match: "Maximum cushioning", recommend: "Show Adistar 4 for longer easy-paced runs.", image: "/images/adistar/adistar-neutral.png", alt: "A neutral-coloured Adidas Adistar 4 running shoe." },
      { ask: "“Do you also need the shoe to feel stable and supportive?”", match: "Stable maximum cushioning", recommend: "Show Adistar Charge.", image: "/images/adistar/adistar-charge-white.png", alt: "A white Adidas Adistar Charge running shoe with yellow cushioning." },
    ] as ScenarioBranch[],
  },
  assessment: {
    title: "Practice knowledge check",
    intro: "Read each Customer scenario and choose the best response.",
    instruction: "Complete the questions at the end of the course. Choose the best Customer question or product recommendation based on the Customer’s running need.",
    questions: [
      {
        scenario: "A Customer says, “I am running longer distances now, and I want a shoe that feels soft and cushioned for easy-paced runs.”",
        question: "What is the best response?",
        options: ["Recommend a racing shoe because the Customer is running longer distances.", "Recommend Adistar 4 because the Customer wants maximum cushioning for longer easy-paced runs.", "Recommend a lifestyle sneaker because the Customer wants comfort.", "Recommend any Adidas shoe because all running shoes feel the same."],
        correctIndex: 1,
        feedback: "The best answer is B. The Customer wants a cushioned shoe for longer easy-paced runs, so Adistar 4 is the best match.",
      },
      {
        scenario: "A Customer says, “I want maximum cushioning, but I also need a shoe that feels stable when I run further.”",
        question: "What is the best response?",
        options: ["Recommend Adistar Charge because it gives maximum cushioning with added stability and support.", "Recommend the lightest racing shoe in the range.", "Recommend a shoe based only on colour.", "Recommend a casual sneaker because comfort is the main need."],
        correctIndex: 0,
        feedback: "The best answer is A. The Customer asked for both maximum cushioning and stability, so Adistar Charge is the best match.",
      },
      {
        scenario: "A Customer says, “I want a shoe with reliable grip for my regular runs.”",
        question: "What is the best response?",
        options: ["“Grip does not matter for running shoes.”", "“Choose the shoe with the brightest colour.”", "“Let’s look at the outsole. Adistar options include grip features such as Lighttraxion or Adiwear to support regular running.”", "“You should only use racing shoes for grip.”"],
        correctIndex: 2,
        feedback: "The best answer is C. The Customer is asking about grip, so the store employee should explain the outsole benefit in simple language.",
      },
      {
        scenario: "A Customer says, “I want to run further, but I am not sure if I need more cushioning or more support.”",
        question: "What is the best response?",
        options: ["“Do you want the cheapest shoe?”", "“When you run further, do you want the shoe to feel more cushioned, more stable, or both?”", "“Do you only want Adidas?”", "“What colour do you like most?”"],
        correctIndex: 1,
        feedback: "The best answer is B. This question helps the store employee understand the Customer’s cushioning and support need before recommending Adistar 4 or Adistar Charge.",
      },
    ] as AssessmentQuestion[],
  },
  footer: { button: "Return to People Connect", url: "#top" },
};
