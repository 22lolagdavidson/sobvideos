import type { ExplainerScript } from "../../src/lib/explainer/schema";

/** An approved explainer for the demo Gold PPO, written from seed-data/sbc-gold-ppo.txt. */
export const goldPpoScript: ExplainerScript = {
  plan: {
    name: "Gold PPO 1500",
    carrier: "Bluebird Health",
    type: "PPO",
    deductible: "$1,500 individual",
    deductibleFam: "$3,000 family",
    oop: "$6,000 individual",
    oopFam: "$12,000 family",
    coinsurance: "20% after deductible",
    pcp: "$25 copay",
    specialist: "$50 copay",
    urgent: "$50 copay",
    er: "$250 copay",
    rx: "$10 generic",
  },
  scenes: [
    {
      visual: { kind: "title", title: "Gold PPO 1500", subtitle: "From Bluebird Health, explained by Penny & Patch" },
      lines: [
        { who: "penny", text: "Hi! I'm Penny, and I keep coins safe. But health insurance words make my snout spin!" },
        { who: "patch", text: "And I'm Patch! Let's walk through the Gold PPO 1500 together, one piece at a time." },
      ],
    },
    {
      visual: { kind: "meter", label: "Deductible", amount: "$1,500", note: "per person each year ($3,000 for a family), in-network" },
      lines: [
        { who: "penny", text: "What's a deductible? It sounds like something a detective does." },
        { who: "patch", text: "Ha! A deductible is what you pay for some care before the plan starts sharing costs. Think of filling a jar." },
        { who: "patch", text: "On this plan the jar holds $1,500 for one person, or $3,000 for a family, each year." },
      ],
    },
    {
      visual: {
        kind: "prices",
        title: "Copays for common care",
        items: [
          { label: "Primary care visit", amount: "$25" },
          { label: "Specialist visit", amount: "$50" },
          { label: "Urgent care", amount: "$50" },
          { label: "Emergency room", amount: "$250" },
          { label: "Generic drugs", amount: "$10" },
        ],
      },
      lines: [
        { who: "penny", text: "Do I have to fill the whole jar before I see a doctor?" },
        { who: "patch", text: "Nope! A copay is a set price for a visit. A regular doctor visit is $25, even before the deductible." },
        { who: "patch", text: "A specialist or urgent care is $50, the ER is $250, and generic drugs are $10." },
      ],
    },
    {
      visual: { kind: "split", title: "Coinsurance", you: 20, plan: 80 },
      lines: [
        { who: "penny", text: "What about bigger stuff, like tests or a hospital stay?" },
        { who: "patch", text: "That's coinsurance: you split the bill. After your deductible, you pay 20% and the plan pays the rest." },
      ],
    },
    {
      visual: { kind: "shield", label: "Out-of-pocket max", amount: "$6,000", note: "per person each year ($12,000 for a family), in-network" },
      lines: [
        { who: "penny", text: "Could the bills just keep going up forever? My coins are nervous." },
        { who: "patch", text: "No way! The out-of-pocket max is your shield. Once you pay $6,000 in a year, or $12,000 for a family..." },
        { who: "patch", text: "...the plan pays 100% of covered in-network care for the rest of the year." },
      ],
    },
    {
      visual: {
        kind: "story",
        title: "Peg is Having a Baby",
        rows: [
          { label: "Deductibles", amount: "$1,500" },
          { label: "Copayments", amount: "$10" },
          { label: "Coinsurance", amount: "$2,200" },
          { label: "Limits or exclusions", amount: "$60" },
        ],
        total: "$3,770",
      },
      lines: [
        { who: "penny", text: "Can you show me a real example?" },
        { who: "patch", text: "The SBC has one! Peg is having a baby. The total cost is $12,700, but Peg would pay $3,770." },
      ],
    },
    {
      visual: {
        kind: "list",
        tone: "good",
        title: "Good to know",
        items: ["Preventive care: no charge", "Chiropractic care (up to 20 visits a year)", "Hearing aids", "Infertility treatment"],
      },
      lines: [
        { who: "penny", text: "Is anything free?" },
        { who: "patch", text: "Preventive care, like checkups and shots, is no charge in-network. The plan also covers things like hearing aids." },
      ],
    },
    {
      visual: {
        kind: "list",
        tone: "bad",
        title: "Not covered",
        items: ["Cosmetic surgery", "Adult dental care", "Long-term care", "Adult routine eye care", "Weight loss programs"],
      },
      lines: [
        { who: "penny", text: "And what does the plan NOT cover?" },
        { who: "patch", text: "Things like cosmetic surgery, adult dental and adult routine eye care aren't covered. Check the SBC for the full list." },
      ],
    },
    {
      visual: {
        kind: "list",
        tone: "recap",
        title: "Numbers to remember",
        items: ["Deductible: $1,500 per person", "Doctor visit: $25 copay", "Coinsurance: 20% after deductible", "Out-of-pocket max: $6,000 per person"],
      },
      lines: [
        { who: "penny", text: "Let me count my coins one more time!" },
        { who: "patch", text: "$1,500 deductible, $25 doctor visits, 20% coinsurance, and a $6,000 out-of-pocket max." },
      ],
    },
    {
      visual: {
        kind: "quiz",
        question: "How much is a primary care visit on this plan?",
        options: ["$25 copay", "$50 copay", "20% coinsurance"],
        answer: 0,
      },
      lines: [
        { who: "penny", text: "Quiz time! How much is a regular doctor visit?" },
        { who: "patch", text: "It's a $25 copay! Remember, this video is a summary. Your SBC and plan documents are the official word." },
      ],
    },
  ],
};
