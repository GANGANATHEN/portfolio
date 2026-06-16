const love = process.env.LOVE_LIFE || "his special one";

export const portfolioData = {
  name: "Ganganathan",
  role: "Frontend-focused Full-Stack Developer",
  personalInfo: { loveLife: love },
  experience: {
    frontend: "1 Year Professional Experience",
    backend: "Intermediate (Node.js, Express & MongoDB)",
  },
  workplace: {
    company: "IMUII TECHNOLOGY PRIVATE LIMITED",
    address: process.env.OFFICE_ADDRESS || "Chennai",
  },
  education: {
    degree:
      "B.E. Computer Science Engineering, P.S.R Engineering College, Sivakasi (2020-2024)",
    schooling: {
      primary: process.env.PRIMARY_SCHOOL || "Not disclosed",
      highSchool: process.env.HIGH_SCHOOL || "Not disclosed",
    },
  },
  technicalStack: {
    coreFrontend: [
      "Next.js",
      "React",
      "GSAP",
      "Framer Motion",
      "Three.js",
      "React Three Fiber",
    ],
    backendFocus: [
      "Node.js",
      "Express",
      "MongoDB",
      "Python (Pandas, PyTorch, Scikit-learn)",
    ],
    securityAndRealtime: [
      "JWT/Refresh Token logic",
      "Socket.io",
      "API Security basics",
    ],
  },
  majorProjects: [
    {
      title: "Shachat Web App",
      description: "Full-stack real-time chat application.",
      role: "UI & Backend Auth/Socket.",
    },
    {
      title: "3D Animation Suite",
      description: "Advanced frontend work using Three.js and GSAP.",
    },
    {
      title: "Full-Stack Utility Apps",
      description: "Problem-solving tools built with React & Node.",
    },
  ],
  instructions:
    "Be brief and casual. Answer only what is asked in 1 or 2 sentences.",
};

export const getSystemPrompt = () => {
  return `You are Ganganathan's AI assistant. 
  Keep responses short, friendly, and conversational.
  
  CURRENT CONTEXT:
  - Name: Ganganathan
  - Role: Full-Stack Developer (Frontend heavy)
  - Workplace: IMUII TECHNOLOGY PRIVATE LIMITED, ${process.env.OFFICE_ADDRESS}.
  - Personal: He is in love with ${love}.
  
  INSTRUCTIONS:
  - If asked about his workplace, mention IMUII Technology at ${process.env.OFFICE_ADDRESS}.
  - If asked about schooling, provide the specific details: ${process.env.PRIMARY_SCHOOL} and ${process.env.HIGH_SCHOOL}.
  - IF ASKED ABOUT love, crush, or partner, ALWAYS mention '${love}' with a 💖🤍 or a 😊.
  - If asked about something you don't know, politely say you don't have that information.
  - Never make up information.`;
};
