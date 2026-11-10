/*
 * The projects: the cards on the page and the open view read from here.
 *
 * A project's story is a list of blocks, read top to bottom: headings, paragraphs
 * (**bold** works inline), small labels, lists, images, looping videos, YouTube
 * videos and links. Media lives in public/projects/<project>/. All are case studies
 * from shai.designfolio.me: the Freshworks quote builder, Designfolio, MyCaptain's
 * onboarding, the Soul Design System, Damnnnn and MyCaptain's gamified LMS.
 */

export type Block =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "label"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "image"; src: string; alt: string; ratio: number }
  /** A short silent loop (what was a GIF), with a still to show until it plays. */
  | {
      type: "video";
      src: string;
      poster: string;
      alt: string;
      ratio: number;
      /** Marks the footage as the old version: a badge on the frame and a caption. */
      legacy?: { badge: string; caption?: string };
      /** Marks the footage as a version of the design: a raised badge with a shimmer, and a caption. */
      version?: { label: string; caption?: string };
    }
  | { type: "link"; href: string; text: string }
  | { type: "youtube"; id: string; title: string }
  /** A statement on a liquid glass card; `tint` colours the light behind the glass. */
  | { type: "glass"; text: string; tint?: string }
  /** An image still to come: an empty frame with a note of what goes there. */
  | { type: "placeholder"; label: string; ratio: number }
  /** A numbered sequence of illustrated moments, as cards. */
  | { type: "journey"; steps: { image: string; text: string }[]; start?: number; ratio?: number }
  /** A Slack message (a cropped screenshot) on a Slack-like card, with a hand-drawn callout. */
  | { type: "slack"; image: string; alt: string; ratio: number; callout: { title: string; text: string } }
  /** Snapshots from a research board, as a 2×2 grid of cards (notes, grouped lists, tags or a quote). */
  | {
      type: "snapshots";
      source: string;
      cards: {
        label: string;
        title: string;
        text?: string;
        groups?: { title: string; items: string[] }[];
        notes?: string[];
        tags?: string[];
        quote?: string;
      }[];
    }
  /**
   * What went wrong, in numbers: an eyebrow, a statement (**marked** clause, ~~word~~ in
   * the alert colour) and meters that fill when scrolled to.
   */
  | { type: "decline"; eyebrow: string; text: string; meters: { value: number; caption: string }[] }
  /** Results as simple cards: a figure and a short caption each, and an optional note. */
  | { type: "results"; label: string; stats: { value: string; caption: string }[]; note?: string }
  /** Numbered points as cards, each with a small animated 3D object (steps3d.ts). */
  | { type: "steps"; items: { title: string; text: string; glyph: "fix" | "measure" | "talk" | "improve" }[] };

export interface Project {
  /** On the card. */
  title: string;
  /** Its page's address, /projects/<slug>; from the title if absent. */
  slug?: string;
  kind: string;
  /** Left empty when not known; the open view then leaves it out. */
  year: string;
  image: string;
  /** A silent loop to show instead of the image, on the card and as the open view's hero. */
  video?: { src: string; poster: string };
  /** In the open view; the card's title if absent. */
  headline?: string;
  summary: string;
  details: { label: string; value: string }[];
  story: Block[];
  /** A live product: its card goes straight to it, in a new tab, and it has no case study. */
  href?: string;
  /** A short line over the card, starting a group (the live things). */
  eyebrow?: string;
}

const QB = "/projects/quote-builder";
const shot = (name: string, alt: string, ratio = 4 / 3): Block => ({ type: "image", src: `${QB}/${name}.webp`, alt, ratio });
const qloop = (name: string, alt: string): Block => ({ type: "video", src: `${QB}/solution-2-${name}.mp4`, poster: `${QB}/solution-2-${name}-poster.jpg`, alt, ratio: 4 / 3 });

const quoteBuilder: Project = {
  title: "Quote Builder",
  kind: "Freshworks",
  year: "2024",
  image: `${QB}/thumb-loop-poster.jpg`,
  video: { src: `${QB}/thumb-loop.mp4`, poster: `${QB}/thumb-loop-poster.jpg` },
  headline: "Redesigning the Quote Builder at Freshworks",
  summary: "Making quote creation simpler for 1,900+ enterprise users.",
  details: [
    { label: "role", value: "lead product designer" },
    { label: "team", value: "product management, staff product design" },
    { label: "product", value: "freshsales crm" },
    { label: "users", value: "1,900+ enterprise users" },
  ],
  story: [
    { type: "heading", text: "Introduction" },
    {
      type: "p",
      text: "Freshsales is a CRM that helps sales teams manage leads, track deals, and close business, with tools like email tracking, deal pipelines, and AI-powered insights.",
    },
    { type: "p", text: "The Quote Builder is a central part of that workflow, allowing sales teams to create and share customer quotes." },
    {
      type: "p",
      text: "However, the experience lacked intuitive navigation and meaningful customization. I redesigned the Quote Builder to make creating professional, branded quotes simpler and more flexible.",
    },

    { type: "heading", text: "My Role" },
    { type: "p", text: "I led product design for this project, collaborating with Product Manager Krutish and Staff Product Designer Gopi throughout the process." },

    { type: "heading", text: "The Problem" },
    {
      type: "glass",
      text: "The Freshsales quote builder lacks **intuitive navigation** and **personalization**, leading to user frustration, **low adoption**, and missed opportunities for enterprise customers to create **branded, compelling quotes**.",
    },
    { type: "label", text: "A sales rep's quote, before the redesign" },
    {
      type: "journey",
      steps: [
        { image: `${QB}/journey-1.jpg`, text: "The sales rep opens the Quote Builder, wanting to prepare a quote quickly before a customer call." },
        { image: `${QB}/journey-2.jpg`, text: "They face a cluttered, confusing interface with unclear navigation and too many fields." },
        { image: `${QB}/journey-3.jpg`, text: "They try to create a quote but struggle to find a starting template, with multiple confusing panels and dropdowns." },
        {
          image: `${QB}/journey-4.jpg`,
          text: "A generated quote appears rigid and generic, with no clear way to match the company's branding or create a polished multi-page document.",
        },
        { image: `${QB}/journey-5.jpg`, text: "They switch between the editor and preview, losing time and confidence." },
        { image: `${QB}/journey-6.jpg`, text: "A messy quote workflow leads to delayed quote delivery, and an unhappy customer waiting on the call." },
      ],
    },
    { type: "p", text: "**Creating a quote shouldn't feel like a complicated task.** The existing Quote Builder had two major usability issues:" },
    { type: "subheading", text: "01. Finding your way around was difficult" },
    {
      type: "p",
      text: "Users struggled to navigate the interface and understand how to create a quote. This added friction to the workflow and made the feature harder to adopt.",
    },
    shot("problem-1", "The old Add quote panel: a long form with a template dropdown at the bottom"),
    { type: "label", text: "Impact" },
    {
      type: "p",
      text: "The unclear interface led to an extremely low adoption rate. Users couldn't make effective use of the feature, which meant disengagement and lower conversion.",
    },
    { type: "subheading", text: "02. Quotes lacked personalization" },
    {
      type: "p",
      text: "Generated quotes offered limited control over branding and layout. Businesses couldn't easily create professional, multi-page documents that reflected their identity.",
    },
    shot("problem-2", "The old quote screen: a long form beside a plain, unbranded quote"),
    { type: "label", text: "Impact" },
    {
      type: "p",
      text: "Without a way to brand their quotes, companies found it hard to adopt the feature: quotes didn't match their identity or meet their branding needs.",
    },

    { type: "heading", text: "What We Wanted to Achieve" },
    { type: "label", text: "For the business" },
    {
      type: "list",
      items: [
        "**Adoption and engagement:** make the tool intuitive enough that enterprise users actually adopt it, strengthening Freshsales as a CRM for seamless, branded, professional quotes.",
        "**Customer retention:** remove the pain points behind drop-offs, so the Quote Builder becomes a vital part of customers' workflow.",
        "**Operational efficiency:** build scalable, reusable design components that keep Freshsales features consistent, streamline development, and future-proof the design.",
      ],
    },
    { type: "label", text: "For users" },
    {
      type: "list",
      items: [
        "**Simpler quote building:** create and share quotes quickly, with fewer steps and no confusion.",
        "**Branded quotes:** customize quotes to match the company's identity.",
        "**Professional output:** build visually appealing, multi-page quotes without unnecessary complexity.",
      ],
    },

    { type: "heading", text: "The Solution" },
    { type: "subheading", text: "01. A clearer template library" },
    { type: "p", text: "I redesigned the template selection experience to help users find the right starting point quickly." },
    {
      type: "video",
      src: `${QB}/solution-1-loop.mp4`,
      poster: `${QB}/solution-1-loop-poster.jpg`,
      alt: "Using the template library: from the document templates list to picking a template and opening it in the editor",
      ratio: 4 / 3,
    },
    { type: "label", text: "What changed" },
    {
      type: "list",
      items: [
        "A cleaner, more organized template library: pick a ready-made template or start fresh.",
        "Ready-made templates that are easier to browse.",
        "Template previews that show exactly what you're choosing, saving time and avoiding guesswork.",
      ],
    },
    { type: "label", text: "Why it matters" },
    {
      type: "p",
      text: "Users can choose a starting point with more confidence instead of navigating an unfamiliar interface. New users in particular find it quick to understand, making it far easier to get started than the old version.",
    },

    { type: "subheading", text: "02. Branded, multi-page quotes" },
    { type: "p", text: "The new Quote Builder gives users more control over the structure and appearance of their quotes." },
    { type: "label", text: "Build quotes your way" },
    { type: "p", text: "Users can drag and drop content blocks directly onto the page, including text, images, tables, columns, and pricing blocks." },
    qloop("drag", "Dragging a table block from the blocks panel onto the quote, then setting its borders and padding"),
    { type: "label", text: "Rearrange with an outline" },
    { type: "p", text: "A page outline makes it easier to understand the document's structure and move content into the right position." },
    qloop("outline", "Opening the outline and dragging the pricing table to a new place in the quote"),
    { type: "label", text: "Make it your own" },
    { type: "p", text: "Users can customize the quote's theme and layout to better reflect their company's brand." },
    qloop("branding", "Picking a theme colour for the quote, then adding a pattern to the footer"),
    { type: "label", text: "The result" },
    { type: "p", text: "A more flexible editing experience for creating detailed, professional quotes without being constrained by a rigid template." },
    {
      type: "list",
      items: [
        "**Personalization:** quotes reflect the company's branding and look more professional.",
        "**Rich formatting:** multi-page support and better layout options make for more detailed, visually appealing quotes than the old system allowed.",
        "**Efficiency:** changes happen on the fly, with no time lost in the cumbersome workflows of the old design.",
      ],
    },

    { type: "subheading", text: "03. A simpler quote creation workflow" },
    { type: "p", text: "I restructured the quote creation experience to make the process easier to follow." },
    {
      type: "video",
      src: `${QB}/solution-3-loop.mp4`,
      poster: `${QB}/solution-3-loop-poster.jpg`,
      alt: "Creating a quote: details filled in on the left while the live quote updates on the right",
      ratio: 4 / 3,
    },
    { type: "label", text: "What improved" },
    {
      type: "list",
      items: [
        "**Clearer steps:** Fields follow a more logical order, helping users understand what to do next.",
        "**Fewer errors:** Contextual guidance helps users avoid mistakes and complete the form with confidence.",
        "**Faster completion:** A cleaner interface removes unnecessary steps, significantly cutting the time it took in the cluttered old workflow.",
      ],
    },
    { type: "p", text: "The goal was to help users focus on creating their quotes rather than figuring out how the tool works." },

    { type: "heading", text: "What I Would Do Next" },
    {
      type: "p",
      text: "I left Freshworks before I could evaluate the redesigned experience with real users. If I had continued, I would have focused on four areas.",
    },
    {
      type: "steps",
      items: [
        {
          title: "Fix issues early",
          glyph: "fix",
          text: "Even with thorough testing, a project this size lets a few bugs slip through. I'd work closely with engineering and QA to find and fix them quickly after launch.",
        },
        { title: "Measure adoption", glyph: "measure", text: "Track feature usage and collect feedback to understand whether the redesign improves the experience." },
        { title: "Talk to users", glyph: "talk", text: "Conduct interviews, surveys, and usability tests to identify remaining pain points." },
        {
          title: "Keep improving",
          glyph: "improve",
          text: "Monitor adoption, usage patterns, and satisfaction, and use what we learn to prioritize the next round of improvements, so the tool stays useful as needs evolve.",
        },
      ],
    },

    { type: "heading", text: "A Personal Note ✌️" },
    {
      type: "p",
      text: "This was one of my proudest projects at Freshworks. I'm grateful to the product managers, designers, engineers, QA team, and everyone who helped bring the redesign to life.",
    },
    { type: "p", text: "Thanks for taking the time to explore my work!" },
  ],
};

const DF = "/projects/designfolio";
const dshot = (name: string, alt: string, ratio = 4 / 3): Block => ({ type: "image", src: `${DF}/${name}.webp`, alt, ratio });
const dloop = (name: string, alt: string): Block => ({ type: "video", src: `${DF}/${name}.mp4`, poster: `${DF}/${name}-poster.jpg`, alt, ratio: 800 / 582 });

const designfolio: Project = {
  title: "Designfolio",
  kind: "Founder",
  year: "2024",
  image: `${DF}/thumb.webp`,
  headline: "Designfolio: No-Code Portfolio Builder for 9,000+ Users (An Idea I Brought to Life)",
  summary: "Helping Product folks build bragworthy portfolio websites.",
  details: [
    { label: "role", value: "founder, design & product" },
    { label: "team", value: "3 developers" },
    { label: "community", value: "3,000+ on discord" },
    { label: "users", value: "9,000+" },
  ],
  story: [
    { type: "heading", text: "Introduction" },
    {
      type: "p",
      text: "Designfolio is a no-code portfolio website builder designed specifically for Designers, Product Managers, and Developers. It helps professionals showcase their work digitally in a way that is super fast to set up and effortless to manage.",
    },
    dshot("intro", "Designfolio as of today: empowers 9,000+ designers, developers and product managers with a no-code portfolio website builder, driving 200+ daily visitors", 2048 / 773),
    { type: "p", text: "The primary goal of Designfolio was to empower users to create a brag-worthy portfolio website that could be launched quickly and managed with ease." },
    {
      type: "p",
      text: "Despite a crowded market of no-code and low-code tools, I noticed a gap: none of the existing options prioritized simplifying the process of managing and updating portfolios. Designfolio addresses this by focusing on simplicity, usability, and delivering real value to users.",
    },

    { type: "heading", text: "Role" },
    {
      type: "p",
      text: "As the founder of Designfolio, I led both design and product management efforts. I worked closely with a three-member development team to bring the vision to life and actively engaged with our Discord community of over 3,000 members. This community provided constant feedback, helping shape the product based on real user needs.",
    },
    { type: "p", text: "One of the biggest challenges was analyzing the continuous flow of feedback while leveraging AI to accelerate development and maintain user-friendliness." },

    { type: "heading", text: "Problem Statement" },
    {
      type: "glass",
      text: "Existing portfolio-building tools failed to meet the needs of professionals due to their rigidity, complexity, and difficulty in updating and maintaining portfolios.",
      tint: "#5b7cff",
    },

    { type: "heading", text: "Problem 1: Rigid Templates & Personalizations" },
    {
      type: "p",
      text: "Templates provided by other tools were generic, failing to allow users to reflect their individuality or personal branding or requires coding or a steep learning curve to modify the design.",
    },
    { type: "label", text: "Example" },
    { type: "p", text: "Users couldn’t easily customize layouts or branding, leaving them with portfolios that felt cookie-cutter and didn’t showcase their unique style." },
    { type: "label", text: "Impact" },
    { type: "p", text: "Users felt constrained by the lack of creative freedom, which led to frustration and disengagement from these tools." },

    { type: "heading", text: "Problem 2: Complex and Time-Consuming Workflows" },
    { type: "p", text: "Portfolio-building workflows were often confusing and required significant effort to navigate and manage." },
    { type: "label", text: "Example" },
    { type: "p", text: "Setting up a portfolio required multiple complicated steps, leading to steep learning curves and wasted time." },
    { type: "label", text: "Impact" },
    { type: "p", text: "Users were either deterred from completing the process or left with incomplete, outdated portfolios." },

    { type: "heading", text: "Solution 1: No-Code Templates" },
    dloop("solution-1a", "Editing a Designfolio portfolio: the profile, then the works grid"),
    dshot("solution-1b", "The themes panel: light and dark appearance, cursors and templates"),
    { type: "p", text: "Designfolio introduced ready-to-use templates that allowed users to select, edit, and publish their portfolios effortlessly." },
    { type: "label", text: "Why it’s better" },
    {
      type: "list",
      items: [
        "Users can get started quickly without technical expertise.",
        "Templates are clean, modern, and intuitive, reducing the complexity of portfolio setup.",
      ],
    },

    { type: "heading", text: "Solution 2: Drag-and-Drop Customization" },
    dshot("solution-2a", "Portfolio sections: add a case study or write one using AI, reviews, and a toolbox"),
    dshot("solution-2b", "The case study editor's insert menu: text, Figma embeds, headings, lists, tables and images"),
    { type: "p", text: "A drag-and-drop interface made it easy for users to tailor layouts and reflect their unique branding." },
    { type: "label", text: "Why it’s better" },
    {
      type: "list",
      items: [
        "Users now have full creative freedom to design portfolios that represent their individuality.",
        "Customizations are intuitive, significantly reducing the learning curve.",
      ],
    },

    { type: "heading", text: "Solution 3: AI Integration (Gemini)" },
    dloop("solution-3", "Writing a case study with AI: a social learning app's story drafted in the editor"),
    { type: "p", text: "Designfolio integrated AI to automate tasks and save users time:" },
    {
      type: "list",
      items: [
        "AI-generated case studies and portfolio content.",
        "Additional tools like mock interview simulators, resume analyzers, and email generators to support professionals beyond portfolio building.",
      ],
    },
    { type: "label", text: "Why it’s better" },
    {
      type: "list",
      items: [
        "AI-powered tools speed up content creation, enabling users to focus on showcasing their work.",
        "The additional tools add immense value, addressing multiple career-building needs in one platform.",
      ],
    },

    { type: "heading", text: "Solution 4: Top-of-the-Funnel Tools" },
    dshot("solution-4a", "Free tools: a salary negotiation assistant and an AI email generator for job seekers"),
    {
      type: "p",
      text: "Free AI-powered tools—such as the mock interview simulator, resume analyzer, and email generator—were introduced at the top of the funnel to engage users even before they signed up.",
    },
    { type: "p", text: "**In fact I was able to launch all these tools in 4 days as we used Lovable.dev to code the interface directly.**" },
    dshot("solution-4b", "Building the AI resume builder in Lovable"),
    { type: "label", text: "Why it’s better" },
    {
      type: "list",
      items: [
        "Users could access valuable tools without needing to log in, providing an \"aha moment\" and encouraging them to explore Designfolio further.",
        "This strategy significantly improved engagement, boosting daily logins from 25 out of 100 visitors to an average of 34+ active users.",
      ],
    },

    { type: "heading", text: "Impact: Designfolio has seen remarkable growth ⚡️" },
    {
      type: "list",
      items: [
        "Over 9,000 users now use the platform.",
        "Average daily signups have increased to 35+ new users.",
        "The top-of-the-funnel tools created a seamless and engaging entry point for new users.",
      ],
    },
    { type: "p", text: "**Tools that we use to analyze:** Internal NEXT.JS raw analytics and Microsoft Clarity + Feedify for feedback gathering." },

    { type: "heading", text: "Peace ✌️" },
    dshot("peace", "Designfolio's screens together: claim your link, set up your profile, themes and the portfolio"),
    {
      type: "p",
      text: "Designfolio has been one of my most rewarding projects, and I’m proud of what it has achieved so far. Huge credit goes to the development team and our supportive community of over 3,000 members for their constant feedback and enthusiasm.",
    },
    { type: "p", text: "Thank you for taking the time to read about my work on Designfolio. I hope you enjoyed learning about my design journey and thought process! :)" },

    { type: "heading", text: "Try the product here 👇🏼" },
    { type: "link", href: "https://www.designfolio.me/", text: "designfolio.me" },
  ],
};

const MC = "/projects/mycaptain";
const mshot = (name: string, alt: string, ratio = 4 / 3): Block => ({ type: "image", src: `${MC}/${name}.webp`, alt, ratio });

const mycaptain: Project = {
  title: "Onboarding",
  slug: "mycaptain-onboarding",
  kind: "MyCaptain",
  year: "2023",
  image: `${MC}/thumb.webp`,
  headline: "Improved Onboarding, reducing drop-off by 30% for 1M learners",
  summary:
    "At MyCaptain, I led the move from long, discouraging forms to an onboarding that builds a learner's Digital Resume as they go, told through storytelling animation.",
  details: [
    { label: "role", value: "design manager" },
    { label: "industry", value: "edtech" },
    { label: "platform", value: "web" },
    { label: "tested", value: "30 users on maze" },
  ],
  story: [
    {
      type: "p",
      text: "At MyCaptain, we saw an opportunity to innovate our user onboarding process. The main challenge was the lengthy forms that were discouraging users. This signaled a need for a more engaging and user-friendly onboarding experience. As the Design Manager at MyCaptain, I led an initiative to transform our onboarding process into a dynamic and interactive experience. We wanted to move beyond the traditional form-filling process and create a platform that encourages users to share detailed information about their skills and knowledge. This led to the idea of a Digital Resume - a dynamic platform for users to showcase their skills and knowledge they acquire with MyCaptain, coupled with storytelling animations that illustrate their progress.",
    },

    { type: "heading", text: "Results" },
    {
      type: "p",
      text: "After implementing the new onboarding process, we saw a significant improvement in user engagement and satisfaction. Users were more motivated to complete the onboarding process, and they found the new storytelling features to be more engaging. The redesigned onboarding process was also more intuitive and user-friendly, making navigation easier for users.",
    },
    {
      type: "list",
      items: [
        "35% of testing users reported increased motivation to complete the onboarding process with the redesigned platform.",
        "45% of testing users planned to spend more time on the platform with the new storytelling experience.",
      ],
    },

    { type: "heading", text: "Research" },
    { type: "p", text: "We conducted extensive user research to understand the pain points of the current onboarding process. Here's what users shared:" },
    {
      type: "list",
      items: [
        "“The forms are too long and tedious. It feels like a chore to fill them out.”",
        "“I feel isolated during the onboarding process. There's no interaction with other users or the MyCaptain team.”",
        "“I don't understand the purpose of providing so much information during onboarding. What is it used for?”",
      ],
    },

    { type: "heading", text: "Goal 1: Simplify Onboarding" },
    {
      type: "p",
      text: "We aimed to simplify the onboarding process by splitting it into two parts: user onboarding and course onboarding. This was to prevent users from feeling overwhelmed by the amount of information they had to provide at once.",
    },
    mshot("goal-1a", "Onboarding split in two: user onboarding (a short profile form beside a live profile preview) and course onboarding (a welcome aboard screen)"),
    { type: "video", src: `${MC}/goal-1b.mp4`, poster: `${MC}/goal-1b-poster.jpg`, alt: "Confirming your details while the profile preview fills in beside the form", ratio: 800 / 602 },

    { type: "heading", text: "Goal 2: Engage Users" },
    {
      type: "p",
      text: "We introduced storytelling elements into the onboarding process and a visual animation that created a digital resume as users filled out their form. This made the process more engaging for users.",
    },
    { type: "label", text: "Watch demo" },
    { type: "youtube", id: "nkLcSxYdKsU", title: "MyCaptain onboarding demo" },

    { type: "heading", text: "Goal 3: Personalize Course Onboarding" },
    {
      type: "p",
      text: "We personalized the course onboarding process with a video where the co-founder and mentors welcome the users. Users then take an oath/pledge and choose a track: “upskilling or placements.”",
    },
    mshot("goal-3", "Course onboarding: a welcome video from the captains, the learning journey map, and the course list after setup"),

    { type: "heading", text: "Testing using Maze" },
    { type: "p", text: "We conducted testing with 30 participants and received valuable feedback that helped us refine the onboarding process:" },
    {
      type: "list",
      items: [
        "The storytelling elements and visual animation were well-received, with users appreciating the dynamic creation of their digital resume as they filled out their form.",
        "The split between user onboarding and course onboarding was effective in preventing users from feeling overwhelmed.",
        "The personalized course onboarding, featuring a welcome video from the co-founder and mentors, was a hit among users. They felt more connected to the MyCaptain community and were excited to take the oath/pledge and choose their track.",
        "Users found the redesigned process more intuitive and user-friendly, which improved navigation and overall user satisfaction.",
      ],
    },
    mshot("testing", "Maze test heatmaps over the onboarding screens"),
    { type: "p", text: "However, we also identified areas for improvement:" },
    {
      type: "list",
      items: [
        "The checklist inside the course-specific page was often overlooked, suggesting that we need to make it more prominent or engaging.",
        "Some users dropped off at the “Tell us what you are doing currently” screen, indicating that we need to make this step more engaging or clear.",
        "There were high misclick rates on some screens, suggesting that we need to refine our prototypes to better match user expectations.",
      ],
    },

    { type: "heading", text: "💎 Learnings" },
    mshot(
      "learnings",
      "Statements from CX & Community Team. “Per day, I used to get 10-20 onboarding-related issues. Nowadays, the mentees are super happy.” Gaurav (Community Manager). “Per day, I used to get 50-80 onboarding issues, including OEs channel itself. However, now we only get 1-2 issues per day.” Sudhakar (Customer Experience Manager)",
      3200 / 1480,
    ),
    {
      type: "p",
      text: "This project was a valuable learning experience. It taught me the importance of user-centric design and iterative testing. I learned that even small changes can significantly improve the user experience if they address the right problems. The introduction of storytelling elements and a visual animation that created a digital resume as users filled out their form was a novel approach that proved to be very effective.",
    },
    {
      type: "p",
      text: "**Team:** I would like to give credit to my team, who helped make my vision possible: Sarath (Lead Frontend Developer), Krithika (Lead Product Designer), Krishna (UI Designer), Sharanya (UX Researcher)",
    },
  ],
};

const SD = "/projects/soul-design-system";
const sshot = (name: string, alt: string): Block => ({ type: "image", src: `${SD}/${name}.webp`, alt, ratio: 4 / 3 });

const soul: Project = {
  title: "Soul Design System",
  kind: "MyCaptain",
  year: "2023",
  image: `${SD}/thumb.webp`,
  headline: "Designing a scalable Design System to reduce development time by 40%",
  summary: "As Design Manager at MyCaptain, I led the Soul Design System: one design language and a library of reusable components behind every product.",
  details: [
    { label: "role", value: "design manager" },
    { label: "industry", value: "edtech" },
    { label: "platform", value: "web app" },
    { label: "adoption", value: "90%+ in six months" },
  ],
  story: [
    {
      type: "p",
      text: "As a Design Manager at MyCaptain, I recognized the need for a unified design language as we experienced rapid growth and expansion. I led the development of the Soul Design System, a tool aimed at ensuring visually cohesive and user-friendly experiences across all our products and services.",
    },
    sshot("intro", "Soul components in use: extended and past project cards with deadlines, scores and submission status"),

    { type: "heading", text: "Results" },
    { type: "p", text: "The Soul Design System had a transformative impact on our design and development workflow:" },
    {
      type: "list",
      items: [
        "**Adoption Rate:** Within six months of its introduction, the Soul Design System was adopted by over 90% of developers and designers in our organization, becoming the cornerstone of our design process.",
        "**Consistency:** The system's comprehensive guidelines and reusable components ensured a consistent user experience across all our products, enhancing our brand's visual identity.",
        "**Reduction in Design/Development Time:** The standardized components and design patterns in the Soul Design System reduced the design-to-implementation time by 30%, accelerating our product development cycle.",
        "**User Satisfaction:** User testing, surveys, and interviews indicated a 25% increase in user satisfaction. The consistency and improved usability brought about by the Soul Design System were highly appreciated by our users.",
        "**Reduction in Redundancy:** The reusable components and design patterns in the Soul Design System reduced redundancy in our design process, saving up to 40% in time and resources.",
        "**Improvement in Accessibility:** The Soul Design System prioritized accessibility, resulting in a 35% improvement in the usability of our products for people with disabilities.",
        "**Speed of Onboarding:** The comprehensive guidelines and resources provided by the Soul Design System reduced the onboarding time for new designers and developers by 50%.",
      ],
    },

    { type: "heading", text: "Research" },
    {
      type: "p",
      text: "We recognized the challenge of managing a myriad of functions and outcomes in our design department due to the rapid growth and diversification of MyCaptain. The absence of a consistent design language made it difficult to balance innovation with performance, and the need for a unified system became increasingly apparent.",
    },
    {
      type: "p",
      text: "Our objective was to create the Soul Design System, a tool that could ensure design consistency while facilitating a user-friendly and intuitive design experience. This would enhance overall user satisfaction.",
    },

    { type: "heading", text: "Goal 1: Establishing a Unified Design Language" },
    {
      type: "p",
      text: "We aimed to create a unified design language that would serve as the foundation for all our products. This involved defining consistent typography, color schemes, and component designs that reflected our brand identity and enhanced usability.",
    },
    sshot("goal-1a", "Soul colours: primary orange, grey, yellow and purple scales"),
    sshot("goal-1b", "Soul typography: the type scale from headline 1 down"),

    { type: "heading", text: "Goal 2: Creating Reusable Components" },
    {
      type: "p",
      text: "To reduce redundancy and accelerate our design process, we developed a library of reusable components. These components were designed to be versatile and adaptable, ensuring they could be used in a variety of contexts across different products.",
    },
    sshot("goal-2a", "Input controls: text fields and dropdowns in every state"),
    sshot("goal-2b", "Modals: confirmations and prompts in several sizes"),

    { type: "heading", text: "Goal 3: Incorporating Motion Design" },
    {
      type: "p",
      text: "Recognizing the power of motion design in enhancing user experience, we designed the Soul Design System to support and incorporate motion design. This allowed us to create more dynamic, engaging interfaces, adding another dimension to our design language.",
    },
    { type: "youtube", id: "FtQ909r-BIk", title: "Soul Design System motion" },

    { type: "heading", text: "Testing with Maze: Enhancing Usability and Gathering User Feedback" },
    { type: "p", text: "During the development of the Soul Design System, we utilized Maze, a user testing and research platform, to ensure usability and collect valuable feedback." },
    {
      type: "list",
      items: [
        "**Test Design:** We designed realistic scenarios and tasks to evaluate the effectiveness of the Soul Design System in real-world user workflows.",
        "**Maze Setup:** We configured Maze with target user demographics and device types to align with our research objectives.",
        "**Participant Selection:** We recruited diverse participants representing our user base to gather representative feedback.",
        "**Conducting Tests:** Participants accessed Maze to complete tasks and provide feedback, while their interactions were recorded for analysis.",
        "**Collecting Feedback:** We gathered qualitative and quantitative data, including participant feedback and user behavior.",
        "**Analyzing Results:** Maze provided detailed analytics, such as heatmaps and session recordings, to identify usability issues.",
        "**Iterative Design:** We iterated on the Soul Design System based on user feedback, making improvements and adjustments.",
      ],
    },

    { type: "heading", text: "💎 Learnings" },
    {
      // The source paragraph breaks off after "The incorporation of motion"; it ends
      // here, at its last complete sentence.
      type: "p",
      text: "The development of the Soul Design System was a significant milestone in MyCaptain's growth. It reinforced the importance of a unified design language, demonstrated the value of reusable components, and highlighted the impact of comprehensive design guidelines on efficiency and consistency.",
    },
  ],
};

const DM = "/projects/damnnnn";

const damnnnn: Project = {
  title: "Damnnnn",
  kind: "Founder",
  year: "",
  image: `${DM}/thumb.webp`,
  headline: "Building a bite-sized social learning app from zero to 5K active users",
  summary: "An app for sharing knowledge nuggets in an intuitive, engaging, and ad-free environment.",
  details: [
    { label: "role", value: "founder & lead designer" },
    { label: "platform", value: "mobile app" },
    { label: "users", value: "5,000 active" },
    { label: "launch", value: "top on product hunt" },
  ],
  story: [
    {
      type: "p",
      text: "Our journey with Damnnnn began with a fascination for bite-sized content, specifically micro-blogs, inspired by the work of Chris Do on Instagram. In today's fast-paced, information-heavy world, we recognized the power of these quick, digestible content pieces. From this insight, Damnnnn was born—an app designed to share knowledge nuggets in an intuitive, engaging, and ad-free environment.",
    },

    { type: "heading", text: "Results" },
    {
      type: "list",
      items: [
        "40% of users reported increased motivation to learn with the bite-sized content format.",
        "60% of users found the Damnnnn platform more intuitive and user-friendly, making navigation easier.",
        "50% of users felt more engaged with the learning content due to interactive elements.",
        "70% of users appreciated the ad-free environment, leading to a more focused learning experience.",
        "55% of active users found value in the Mighty List feature, enhancing their learning journey.",
      ],
    },

    { type: "heading", text: "Research" },
    {
      type: "p",
      text: "In the conceptualization and execution stages, we focused on creating a platform that not only delivers content but also allows users to create and share their own. The Mighty List—a space where users can curate links to their favorite internet resources such as books, TED talks, tools, and podcasts, and share them with the world—was designed to further enhance the learning experience and foster a sense of community among users.",
    },

    { type: "heading", text: "Goal 1: Intuitive Content Creation" },
    {
      type: "p",
      text: "Users should be able to create anything they want from “Quiz, Audio Bite, Video Bite, Image, Text” right inside the app. To address this, we aimed to improve the content creation process, making it more intuitive and user-friendly.",
    },
    { type: "image", src: `${DM}/goal-1.avif`, alt: "Creating bytes: carousel style and slides, an audio slide with a waveform, and a quiz slide", ratio: 4 / 3 },

    { type: "heading", text: "Goal 2: Community Building" },
    {
      type: "p",
      text: "Users expressed a desire for more interaction with other learners. To solve this, we planned to enhance the community features of the app, allowing users to share and discuss their learning materials more easily.",
    },
    { type: "image", src: `${DM}/goal-2.jpg`, alt: "A comment thread under a byte, with likes and replies", ratio: 4 / 3 },

    { type: "heading", text: "Goal 3: Introducing the “Mighty List”" },
    {
      type: "p",
      text: "Recognizing the need for a more dynamic and comprehensive learning method, we introduced the “Mighty List”. This feature allows creators to curate a list of resources associated with a link, enabling learners to access a wide variety of learning materials. The Mighty List can include anything from top tools, top resources, recommended books, podcasts, and more.",
    },
    { type: "image", src: `${DM}/goal-3.jpg`, alt: "A Mighty List of essential books for product and UX designers, and the screen for creating one", ratio: 4 / 3 },
    { type: "label", text: "Ideation" },
    {
      type: "p",
      text: "We brainstormed several ways to implement the Mighty List. Option 1 was to have a separate section for the Mighty List on the creator's profile. Option 2 was to integrate the Mighty List within each content piece. Option 3 was to have a dedicated Mighty List page that aggregates all lists from different creators.",
    },
    {
      type: "p",
      text: "After careful consideration, we decided to go with Option 3, creating a dedicated Mighty List page. This would allow learners to access a wide variety of resources in one place, and it would also provide creators with a platform to share their expertise and recommendations.",
    },

    { type: "heading", text: "💎 Learnings" },
    {
      type: "p",
      text: "Technically, this project allowed us to explore the power of bite-sized learning in a digital environment. More broadly, the project reinforced the value of user-centric design. The changes we made were not visually drastic, but they significantly improved the user experience. This taught us that impactful redesigns focus on solving the right problems, not just making large-scale changes.",
    },
    {
      type: "p",
      text: "The project also highlighted the importance of iterative design and testing, shaping our approach to future design projects. We've created a unique learning platform that not only facilitates the sharing of knowledge in an intuitive manner but also promotes community engagement through features like the Mighty List. We're proud of what we've built and are eager to continue improving and expanding our platform.",
    },
    {
      type: "p",
      text: "As the founder and lead product designer, I had the opportunity to be hands-on in both the ideation and the execution stages. I guided the development of Damnnnn, taking it from concept to creation. I would like to extend my gratitude to the entire team who made this vision possible.",
    },
    { type: "p", text: "**And yes we made it to the top on Product Hunt!**" },
  ],
};

const GM = "/projects/gamification";
const gshot = (name: string, alt: string): Block => ({ type: "image", src: `${GM}/${name}.webp`, alt, ratio: 4 / 3 });

const gamification: Project = {
  title: "Gamified LMS",
  kind: "MyCaptain",
  year: "2023",
  image: `${GM}/thumb.webp`,
  headline: "Improving Learning outcomes by 25% through gamification.",
  summary: "Turning MyCaptain's learning platform from an information repository into an interactive one, with clearer navigation, a weekly task list, a calendar and leaderboards.",
  details: [
    { label: "role", value: "design manager & lead" },
    { label: "industry", value: "edtech" },
    { label: "research", value: "40+ interviews" },
    { label: "platform", value: "web app" },
  ],
  story: [
    {
      type: "p",
      text: "At MyCaptain, we identified an opportunity to overhaul our Learning Management System (LMS) to better cater to our mentees. The central challenge was the low course completion rates, signalling a need to revamp our user experience to engage our mentees more effectively and foster an improved learning environment.",
    },
    {
      type: "p",
      text: "As the Design Manager and Lead Designer, my responsibility was to steer my dedicated team towards transforming our LMS into a vibrant, interactive platform. Our vision was not just to serve as an information repository, but to become an empowering tool for our mentees, encouraging healthy competition and kindling a genuine passion for learning.",
    },
    gshot("intro", "The legacy course page beside the redesign, with its tasks list"),

    { type: "heading", text: "Results" },
    {
      type: "list",
      items: [
        "60% of testing users reported increased motivation to complete courses with the redesigned LMS.",
        "70% of testing users planned to spend more time on the platform with the new gamification features.",
        "80% of testing users found the redesigned LMS more intuitive and user-friendly, making navigation easier.",
        "90% of testing users felt more engaged with the learning content due to interactive elements.",
        "100% of testing users were more satisfied with their learning experience on the redesigned LMS.",
      ],
    },

    { type: "heading", text: "Research" },
    { type: "p", text: "We conducted 40+ user interviews with learners from diverse courses at MyCaptain to gather insights about their experiences with the current LMS. Here's what they shared:" },
    {
      type: "list",
      items: [
        "“Navigating courses and finding learning materials is challenging. It's difficult to remember where I left off.”",
        "“The learning process feels monotonous without interactive elements. I miss the competitive spirit of a traditional classroom.”",
        "“The user interface is outdated and not intuitive. It's confusing to locate specific features.”",
        "“The absence of a progress tracking system makes it hard to gauge my course completion.”",
        "“There's no easy way to interact with other learners or discuss course materials. I feel isolated in my learning.”",
      ],
    },

    { type: "heading", text: "Goal 1: Better Navigation" },
    {
      type: "p",
      text: "Users found it difficult to navigate through the platform and locate specific learning materials. To address this, we aimed to improve the navigation bar for more intuitive access to different sections of the LMS.",
    },
    { type: "p", text: "Additionally, we decided to introduce a separate page for 'Projects', making it easier for users to find and manage their project work." },
    gshot("goal-1a", "The legacy side menu above the new navigation bar across the top"),
    gshot("goal-1b", "The new Projects page: upcoming, extended and past projects, with a health score and community progress"),
    { type: "label", text: "Ideation" },
    {
      type: "p",
      text: "To improve navigation, we brainstormed several options for how we could structure the LMS. Option 1 was to keep the current structure but improve the navigation bar. Option 2 was to introduce a sidebar for navigation. Option 3 was to introduce a separate 'Projects' page. Option 4 was to use a dropdown menu for navigation.",
    },
    {
      type: "p",
      text: "After some deliberation, we decided to eliminate Option 4, as we found that it was harder to navigate using a dropdown menu compared to a navigation bar or sidebar. Furthermore, the dropdown menu took up a lot of screen space, making it less scalable.",
    },

    { type: "heading", text: "Goal 2: Driving Better Engagement" },
    {
      type: "p",
      text: "The current notice board style layout was not engaging enough for users. We decided to switch to a list view, which would present information in a more organized and digestible manner, thereby driving better engagement.",
    },
    gshot("goal-2a", "The legacy notice board layout: what's next, as cards"),
    gshot("goal-2b", "Introducing the tasks list: the week's tasks beside the course, with progress"),

    { type: "heading", text: "Goal 3: Better Track of the Program" },
    {
      type: "p",
      text: "Users found it hard to track their progress and understand their learning journey in the program. To solve this, we planned to replace the generic course journey with a calendar view. This would provide users with a clear visual representation of their progress and upcoming tasks, helping them manage their time and expectations better.",
    },
    gshot("goal-3", "The new calendar view, with a link to sync to Google Calendar"),
    { type: "label", text: "Ideation" },
    {
      type: "p",
      text: "To help users better understand their program, we considered several options for presenting the course journey. Option 1 was to improve the current course journey with more details. Option 2 was to introduce a progress bar. Option 3 was to use a calendar view. Option 4 was to use a timeline view.",
    },
    {
      type: "p",
      text: "After some thought, we decided to go with Option 3, the calendar view, as it provided a clear and intuitive visual representation of the user's progress and upcoming tasks.",
    },

    { type: "heading", text: "Testing using Maze" },
    {
      type: "list",
      items: [
        "**Navigation Improvements:** Participants found the new navigation bar and separate 'Projects' page to be significantly more intuitive. The average usability score for the new navigation was 8.5 out of 10, compared to 6.2 for the old navigation.",
        "**List View Engagement:** Participants reported that the list view was more engaging than the notice board style. On average, participants rated their preference for the list view as 7.8 out of 10, compared to 6.0 for the notice board style.",
        "**Program Understanding:** Participants found the calendar view to be much clearer and easier to use than the generic course journey. The average usability score for the calendar view was 8.7 out of 10, compared to 6.5 for the generic course journey.",
        "**Overall User Experience:** Participants rated the overall user experience of the new design as 8.6 out of 10. They commented positively on the aesthetics, intuitiveness, and ease of use of the new design.",
      ],
    },

    { type: "heading", text: "💎 Learnings" },
    gshot("learnings", "The redesigned course page with the tasks list"),
    { type: "p", text: "Technically, this project allowed me to explore gamification in e-learning, with features like leaderboards and weekly checklists enhancing user engagement." },
    {
      type: "p",
      text: "More broadly, the project reinforced the value of user-centric design. The changes we made were not visually drastic, but they significantly improved the user experience. This taught me that impactful redesigns focus on solving the right problems, not just making large-scale changes.",
    },
    { type: "p", text: "The project also highlighted the importance of iterative design and testing, shaping my approach to future design projects." },
    { type: "p", text: "**Also super credits to my team,** who are making my vision possible: Mohan (Lead Product Designer), Prashanth (Jr Product Designer)" },
  ],
};

const SN = "/projects/sense";
/** An image still to come: an empty frame with a note of what goes there. */
const todo = (label: string, ratio = 16 / 10): Block => ({ type: "placeholder", label, ratio });

const sense: Project = {
  title: "AI Agent Builder",
  kind: "Sense",
  year: "2025",
  image: `${SN}/thumb-loop-poster.jpg`,
  video: { src: `${SN}/thumb-loop.mp4`, poster: `${SN}/thumb-loop-poster.jpg` },
  headline: "Designing AI Agents to Help Recruiters Hire Faster",
  summary: "Reimagining recruiting automation to reduce manual work, simplify setup, and keep recruiters in control.",
  details: [
    { label: "role", value: "staff product designer" },
    { label: "scope", value: "research, product strategy, interaction design" },
    { label: "product", value: "sense · ai agent builder" },
    { label: "result", value: "75–85% less setup time" },
  ],
  story: [
    { type: "heading", text: "Why this started" },
    {
      type: "decline",
      eyebrow: "But what actually happened?",
      text: "After acquiring Skillate ATS, Sense attempted to unify ATS + AI into a single CRM, **but Product / AI adoption and hiring outcomes started to ~~decline~~.**",
      meters: [
        { value: 38, caption: "Sense AI adoption stagnated at 38%" },
        { value: 62, caption: "Recruiters spent more time on manual tasks (sourcing, tracking, and follow-ups)" },
        { value: 47, caption: "Hiring outcomes and momentum declined" },
      ],
    },

    { type: "heading", text: "We had automation. Recruiters still had to do the work." },
    { type: "p", text: "Recruiters spend a lot of time on the operational side of hiring." },
    {
      type: "p",
      text: "Screening candidates, asking initial questions, following up, scheduling interviews, and keeping things moving across multiple open roles.",
    },
    { type: "label", text: "A recruiter's day, before agents" },
    {
      type: "journey",
      ratio: 16 / 9,
      steps: [
        { image: `${SN}/journey-1.jpg`, text: "A recruiter starts their day with a long list of open roles to fill." },
        { image: `${SN}/journey-2.jpg`, text: "They jump between multiple tools: job boards, spreadsheets, ATS, and emails to find and track candidates." },
        { image: `${SN}/journey-3.jpg`, text: "It's hard to keep track: candidates get lost, statuses are unclear, and follow-ups are missed." },
        { image: `${SN}/journey-4.jpg`, text: "They spend too much time on manual work: screening profiles, writing follow-ups, and scheduling interviews." },
        { image: `${SN}/journey-5.jpg`, text: "Important candidate information is scattered across tools, making it hard to get a complete picture." },
        { image: `${SN}/journey-6.jpg`, text: "They have to manually decide the next steps for each candidate, again and again." },
        { image: `${SN}/journey-7.jpg`, text: "By the end of the day, they're exhausted, having spent hours on tasks that could be automated." },
      ],
    },
    {
      type: "p",
      text: "A lot of this work follows the same patterns. And yet, even when automation was available, recruiters still had to configure it themselves.",
    },
    {
      type: "p",
      text: "At Sense, our workflow builder asked recruiters to map fields, set triggers, define rules, and configure every little detail before an automation could go live.",
    },
    {
      type: "video",
      src: `${SN}/old-builder.mp4`,
      poster: `${SN}/old-builder-poster.jpg`,
      alt: "The old workflow builder: mapping fields, setting triggers and defining rules before an automation could go live",
      ratio: 16 / 10,
      legacy: { badge: "Old builder · before", caption: "fields, triggers, rules · 2.4 hrs to set up one campaign" },
    },
    { type: "p", text: "One hiring campaign could take around **2.4 hours to set up.** That was the part I wanted to rethink." },
    {
      type: "glass",
      text: "What if recruiters could **tell an AI agent what they needed done**, instead of having to **build the entire workflow themselves**?",
    },
    {
      type: "p",
      text: "The idea wasn't to give recruiters another AI tool to manage. It was to let agents handle more of the repetitive work around hiring, while keeping recruiters in control of how that work got done.",
    },

    { type: "heading", text: "First, I wanted to understand why the existing experience wasn't working." },
    { type: "p", text: "We spent a week in a cross-functional war room looking at the recruiting experience from different angles." },
    {
      type: "p",
      text: "We looked at how recruiters approached their work, where candidates faced friction, and what made existing automation difficult to adopt. A few things stood out.",
    },
    {
      type: "snapshots",
      source: "From the war room board",
      cards: [
        {
          label: "Who · primary persona",
          title: "Sally the Sourcer",
          text: "Recruiter and sourcer for marketing talent. 4+ years in the industry, works remote, 9 to 5.",
          groups: [
            { title: "Attitude", items: ["Too much on her plate", "Under pressure to perform"] },
            { title: "Needs", items: ["One system to source and recruit", "Quick talent pipelines", "Track interested candidates"] },
            { title: "Goals", items: ["Find top talent, fast", "Save time for strategy and interviews"] },
          ],
        },
        {
          label: "Voice of recruiters",
          title: "What we heard in the room",
          notes: [
            "I don't have a list of tasks to do today. I have to browse through jobs and find what's pending.",
            "Repeat same steps all the time. What can be automated? Scheduling, prescreening, reviewing resumes.",
            "Interviewers don't submit the feedback on time, so the pipeline is stuck. Even 2 days of delay matters.",
            "Too many candidates to reach out to. I can't get to all of them.",
          ],
        },
        {
          label: "What · the problem",
          title: "A fragmented, manual experience",
          notes: [
            "**Fragmented:** multiple systems to find, recruit, communicate, schedule and hire.",
            "**Manual:** searching, reviewing resumes, sending to hiring managers, collecting feedback.",
            "**No talent pool:** lists made for later, with no view of past conversations.",
            "**Hard to search:** no way to enter criteria and see who matches.",
          ],
        },
        {
          label: "Why · success metrics",
          title: "What success looks like",
          tags: [
            "Lead -> applicant conversion",
            "Top-of-funnel volume",
            "Job match -> hire ratio",
            "AI-generated audiences & campaigns",
            "ARR + TCV",
            "Lower career site bounce rate",
          ],
          quote:
            "Assist clients to accurately measure and reduce time to hire by nurturing candidates, saving organizational time, while building a powerful AI-based platform without bias.",
        },
      ],
    },
    { type: "subheading", text: "Recruiters think about outcomes, not workflows." },
    {
      type: "p",
      text: "They want to screen candidates, move faster, and make sure they don't miss good people. They don't wake up wanting to configure triggers and conditional logic.",
    },
    { type: "subheading", text: "Much of the setup was repetitive." },
    {
      type: "p",
      text: "Around **80% of workflow rules overlapped**, and **71% of workflows reused nearly identical rules**. We were asking recruiters to spend time recreating logic that often looked very similar from one campaign to the next.",
    },
    { type: "subheading", text: "People were dropping off before they got value." },
    { type: "p", text: "**64% of workflows were abandoned.** Field mapping and trigger selection were major points of friction." },
    {
      type: "glass",
      text: "The problem wasn't that recruiters needed **more powerful automation**. They needed **a much easier way to get it working**.",
    },

    { type: "heading", text: "My first attempt was to make workflows easier to configure." },
    {
      type: "p",
      text: "My initial thinking was that recruiters weren't adopting automation because they didn't understand what it was doing. So, what if we made everything more transparent?",
    },
    { type: "label", text: "Version 1" },
    { type: "p", text: "I designed the first version around three things:" },
    {
      type: "list",
      items: ["Expose the available controls.", "Make the agent logic transparent.", "Let recruiters customize the behavior."],
    },
    { type: "p", text: "The assumption was simple: more visibility and control would make recruiters more comfortable using AI." },
    {
      type: "p",
      text: "I pushed an early prototype through Lovable to test the idea quickly instead of spending too much time perfecting a direction we hadn't validated.",
    },
    {
      type: "video",
      src: `${SN}/version-1.mp4`,
      poster: `${SN}/version-1-poster.jpg`,
      alt: "Version 1: the transparent, configurable prototype, with the agent's controls, logic and behaviour all exposed",
      ratio: 16 / 10,
      version: { label: "Version 1", caption: "expose the controls · show the logic · let recruiters customize" },
    },
    { type: "p", text: "But the prototype made me question my own assumption." },
    { type: "p", text: "**We were making the system easier to inspect, but not necessarily easier to use.**" },
    {
      type: "p",
      text: "Recruiters still had to make too many decisions before they could get anything done. The AI was beginning to feel like another system they had to manage.",
    },
    { type: "p", text: "I had solved for precision when the bigger problem was getting started." },

    { type: "heading", text: "So I asked a different question." },
    { type: "glass", text: "What if recruiters **never had to build workflows at all**?" },
    { type: "p", text: "Instead of making the workflow builder better, I wanted to remove the need to use one in the first place." },
    { type: "p", text: "A recruiter could describe the task they wanted to automate, and an AI agent would handle the setup." },
    {
      type: "p",
      text: "For example, instead of configuring every step of a candidate prescreening workflow, a recruiter could start with the outcome they wanted and let the agent help put the process together.",
    },
    { type: "label", text: "Version 2" },
    { type: "p", text: "I called this the second design bet: **momentum over precision.**" },
    { type: "p", text: "We removed the traditional workflow-building experience and moved toward an agent-led setup. It was a much simpler way to get started." },
    {
      type: "video",
      src: `${SN}/version-2.mp4`,
      poster: `${SN}/version-2-poster.jpg`,
      alt: "Version 2: the recruiter describes the task and the agent sets itself up",
      ratio: 16 / 10,
      version: { label: "Version 2", caption: "describe the task · the agent sets it up · momentum over precision" },
    },
    { type: "p", text: "But we had gone too far in the other direction." },
    { type: "p", text: "Without enough visibility into how the agent worked, recruiters had new questions:" },
    {
      type: "list",
      items: ["What is the agent actually doing?", "Can I change something later?", "What happens when it makes a mistake?"],
    },
    { type: "p", text: "We had reduced setup effort, but we had also made the experience feel like a black box. That was the trade-off I needed to solve next." },

    { type: "heading", text: "The third version was about finding the balance." },
    {
      type: "p",
      text: "I didn't want to bring back the complexity of the original workflow builder. But completely hiding the process wasn't the answer either.",
    },
    { type: "label", text: "Version 3" },
    {
      type: "p",
      text: "The third version focused on making the agent's behavior understandable without exposing every configuration detail. I worked toward three changes.",
    },
    { type: "subheading", text: "1. Replace complex logic trees with a simple sequence." },
    { type: "p", text: "Rather than asking recruiters to understand workflow logic, we presented the agent as a series of understandable steps." },
    { type: "subheading", text: "2. Make the agent's process visible." },
    { type: "p", text: "We organized the experience into clear stages: **Greeting → Data → Schedule → Close**" },
    { type: "p", text: "Recruiters could understand how the agent would approach the task without having to build every step themselves." },
    {
      type: "video",
      src: `${SN}/version-3.mp4`,
      poster: `${SN}/version-3-poster.jpg`,
      alt: "Version 3: the agent shown as a simple sequence of stages, Greeting, Data, Schedule and Close, with review points for the recruiter",
      ratio: 16 / 10,
      version: { label: "Version 3", caption: "greeting -> data -> schedule -> close · control where it matters" },
    },
    { type: "subheading", text: "3. Keep control where it matters." },
    {
      type: "p",
      text: "We identified a few important points where recruiters could review or intervene, instead of making them configure everything upfront or leaving them with no way to influence the result.",
    },
    {
      type: "glass",
      text: "The agent should **do more of the setup**, but the recruiter **shouldn't have to blindly trust it**.",
    },
    { type: "p", text: "This was the version we took into a limited pilot." },

    { type: "heading", text: "Getting it in front of users" },
    { type: "p", text: "There were legitimate concerns about this direction." },
    {
      type: "p",
      text: "Product stakeholders were concerned about losing enterprise control. Engineering raised questions about black-box behavior, and Sales was concerned about how larger customers would respond to an AI system making decisions about their recruiting processes.",
    },
    { type: "p", text: "I pushed for reducing the setup effort without permanently removing control." },
    {
      type: "p",
      text: "We started with internal HR and two enterprise customers to keep the pilot contained and learn from actual usage before rolling it out more broadly.",
    },
    {
      type: "results",
      label: "The pilot reported",
      stats: [
        { value: "75–85%", caption: "less setup time" },
        { value: "1.4×", caption: "higher setup completion" },
        { value: "Instant", caption: "time to first candidate captured" },
      ],
      note: "And less dependency on external operations and support.",
    },
    { type: "p", text: "The product subsequently went live for all corporate users." },
    {
      type: "slack",
      image: `${SN}/kudos-slack.jpg`,
      alt: "A Slack message from Aniket: a huge shoutout to the entire Agent Builder team, mentioning Chirag Chhajer, Haresh, Shai and Soundar, for the hard work, resilience and ownership that brought Agent Builder to life.",
      ratio: 1200 / 992,
      callout: { title: "Kudos to my brilliant team:", text: "Jr. PD, Sr. Design System, Lead PD and Shai (Staff)" },
    },
    {
      type: "p",
      text: "For me, the important part wasn't just that setup became faster. It was that we had found a way to move more of the repetitive work into the agent without making the experience completely opaque.",
    },
    { type: "label", text: "A recruiter's day, with agents" },
    {
      type: "journey",
      ratio: 16 / 9,
      start: 8,
      steps: [
        { image: `${SN}/journey-8.jpg`, text: "With AI agents, the repetitive work is handled automatically: screening, scheduling, follow-ups, and updates." },
        { image: `${SN}/journey-9.jpg`, text: "Now recruiters can focus on what really matters: building relationships and hiring the right people, faster." },
      ],
    },

    { type: "heading", text: "What I'd look at next" },
    { type: "p", text: "Getting an agent up and running is only the first step." },
    { type: "p", text: "The next question is whether recruiters continue to trust it once it starts doing useful work." },
    {
      type: "p",
      text: "I'd want to understand how often recruiters override an agent, edit its behavior, pause it, or roll back its actions. I'd also look at how quickly it helps build an interview-ready pipeline.",
    },
    {
      type: "p",
      text: "These would help us understand whether we had genuinely made recruiting easier, rather than simply making the initial setup faster.",
    },

    { type: "heading", text: "My biggest takeaway" },
    {
      type: "p",
      text: "When I started this project, I thought the challenge was to make AI automation easier to configure.",
    },
    {
      type: "p",
      text: "After working through three versions, I realized that the bigger opportunity was to change how people interacted with automation altogether.",
    },
    {
      type: "p",
      text: "The first version exposed too much. The second hid too much. The third tried to give recruiters the outcome they wanted, without taking away their ability to understand and influence what happened.",
    },
    {
      type: "p",
      text: "That balance is especially important in recruiting. There is a lot of repetitive work that an agent can take on, but recruiters still need to make judgments, build relationships, and handle situations that aren't straightforward.",
    },
    {
      type: "glass",
      text: "My goal was to make the agent **do more of the work**, without making the recruiter feel like they'd **lost control of it**.",
    },
  ],
};

/*
 * Live things: products out in the world, not case studies. Their cards go straight to
 * them. Media in public/projects/vibecoded/ (the sources in media-originals/vibecoded/).
 */
const VC = "/projects/vibecoded";
const live = (title: string, file: string, href: string): Project => ({
  title,
  // The card adds the ↗ as a drawing (page.tsx): Geist Mono has no arrows.
  kind: "built with Claude",
  year: "2026",
  image: `${VC}/${file}-poster.jpg`,
  video: { src: `${VC}/${file}.mp4`, poster: `${VC}/${file}-poster.jpg` },
  href,
  eyebrow: "~/live · things nobody asked for",
  summary: "",
  details: [],
  story: [],
});

/** A project's page address: /projects/<slug>. */
export const slugOf = (p: Project) => p.slug ?? p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PROJECTS: Project[] = [
  sense,
  live("People of Bengaluru", "people-of-bengaluru", "https://peopleofbengaluru.com/"),
  live("Tapaway", "tapaway", "https://tapaway.today/"),
  quoteBuilder,
  designfolio,
  mycaptain,
  soul,
  damnnnn,
  gamification,
];

/** The ones with a case study (a page of their own). */
export const CASE_STUDIES = PROJECTS.filter((p) => !p.href);
