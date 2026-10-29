// Assets import-a unga folder structure-ku etha mathiri correct-ah kuduthu irukkinga
import {
  react,
  node,
  mongo,
  web,
  javascript,
  typescript,
  html,
  css,
  reactjs,
  redux,
  tailwind,
  nodejs,
  mongodb,
  git,
  java,
  python,
  ibm,
  aws,
  cisco,
  redhat,
  uomcodl,
  devtown,
  eminent,
  threejs,
  appleimg,
  calci,
  ganganathan,
  sociallink,
  qrcode,
  scoreboard,
  grade,
} from "../../public/assets";

export const navLinks = [
  { id: "about", title: "About" },
  { id: "work", title: "Work" },
  { id: "contact", title: "Contact" },
];

export const services = [
  { title: "Full-Stack Web Developer", icon: web },
  { title: "Frontend (Next.js & TS)", icon: react },
  { title: "Backend (Node & Express)", icon: node },
  { title: "Database (MongoDB)", icon: mongo },
];

export const technologies = [
  { name: "HTML 5", icon: html },
  { name: "CSS 3", icon: css },
  { name: "JavaScript", icon: javascript },
  { name: "TypeScript", icon: typescript },
  { name: "React JS", icon: reactjs },
  { name: "Redux Toolkit", icon: redux },
  { name: "Tailwind CSS", icon: tailwind },
  { name: "Node JS", icon: nodejs },
  { name: "MongoDB", icon: mongodb },
  { name: "Three JS", icon: threejs },
  { name: "Git", icon: git },
  { name: "Java", icon: java },
  { name: "Python", icon: python },
];

export const experiences = [
  {
    title: "B.E. Computer Science & Engineering",
    company_name: "P.S.R Engineering College, Sivakasi",
    icon: uomcodl,
    iconBg: "#F0F8FF",
    date: "2020 - 2024",
    score: "9.1 CGPA",
  },
  {
    title: "Web Design for Beginners",
    company_name: "University of Moratuwa",
    icon: uomcodl,
    iconBg: "#F0F8FF",
    date: "Web Design Course",
    score: "Certified",
  },
  {
    title: "JavaScript Essentials 1",
    company_name: "Cisco Networking Academy",
    icon: cisco,
    iconBg: "#F0F8FF",
    date: "CISCO JS Course",
    score: "Certified",
  },
  {
    title: "Front End Web Development",
    company_name: "devtown",
    icon: devtown,
    iconBg: "#F0F8FF",
    date: "Bootcamp",
    score: "Graduate",
  },
  {
    title: "Web Development",
    company_name: "Eminent",
    icon: eminent,
    iconBg: "#F0F8FF",
    date: "Internship Training",
    score: "Completed",
  },
  {
    title: "Data Science Certificate",
    company_name: "Coursera (IBM)",
    icon: ibm,
    iconBg: "#F0F8FF",
    date: "Data Science",
    score: "IBM Credential",
  },
  {
    title: "Cloud Architecting",
    company_name: "AWS Academy",
    icon: aws,
    iconBg: "#F0F8FF",
    date: "Cloud Architecting",
    score: "AWS Certified",
  },
  {
    title: "RedHat Training",
    company_name: "RedHat",
    icon: redhat,
    iconBg: "#F0F8FF",
    date: "RedHat",
    score: "Certified",
  },
];

export const testimonials = [
  {
    id: 1,
    name: "Alex Rivera",
    testimonial:
      "Ganganathan is an exceptional frontend developer. His 3D integrations and attention to responsive micro-interactions are top tier.",
    created_at: "2024-06-12T10:00:00Z",
  },
  {
    id: 2,
    name: "Priya Sharma",
    testimonial:
      "The performance and smooth animations across mobile and desktop are stunning. Highly recommended full-stack engineer!",
    created_at: "2024-06-14T14:30:00Z",
  },
  {
    id: 3,
    name: "Michael Chen",
    testimonial:
      "Working with Ganganathan on complex React and Three.js components was a seamless experience. Fast turnaround and clean code.",
    created_at: "2024-06-16T09:15:00Z",
  },
];

export const projects = [
  {
    name: "iPhone 15 Pro",
    description:
      "Interactive 3D Apple iPhone 15 Pro showcase website featuring realistic Three.js models, GSAP animations, and dynamic color styling.",
    tags: [
      {
        name: "React",
        color: "blue-text-gradient",
      },
      {
        name: "ThreeJs",
        color: "orange-text-gradient",
      },
      {
        name: "Tailwind",
        color: "pink-text-gradient",
      },
      {
        name: "sentry",
        color: "green-text-gradient",
      },
    ],
    image: appleimg,
    source_code_link: "https://github.com/GANGANATHEN/Project_React",
    url: "https://ganganathan-pple.netlify.app",
  },
  {
    name: "Calculator",
    description:
      "Responsive web calculator with smooth mathematical expression evaluation, clean UI, and keyboard navigation.",
    tags: [
      {
        name: "HTML",
        color: "blue-text-gradient",
      },
      {
        name: "CSS",
        color: "green-text-gradient",
      },
      {
        name: "JavaScript",
        color: "pink-text-gradient",
      },
    ],
    image: calci,
    source_code_link: "https://github.com/GANGANATHEN/normalcalc",
    url: "https://ganganathan-calculator.netlify.app",
  },
  {
    name: "Portfolio",
    description:
      "Interactive personal 3D developer portfolio showcasing full-stack skills, dynamic models, and responsive modern layouts.",
    tags: [
      {
        name: "React",
        color: "blue-text-gradient",
      },
      {
        name: "ThreeJs",
        color: "green-text-gradient",
      },
      {
        name: "Tailwind",
        color: "pink-text-gradient",
      },
    ],
    image: ganganathan,
    source_code_link: "https://github.com/GANGANATHEN/portfolio",
    url: "https://ganganathan.vercel.app",
  },
  {
    name: "Social Link",
    description:
      "Sleek social links aggregator profile page featuring responsive layout design and hover animations.",
    tags: [
      {
        name: "React",
        color: "blue-text-gradient",
      },
      {
        name: "Tailwind",
        color: "pink-text-gradient",
      },
    ],
    image: sociallink,
    source_code_link:
      "https://github.com/GANGANATHEN/social-links-profile-main",
    url: "https://ganganathan-social-links-profile-man.netlify.app",
  },
  {
    name: "Qr code",
    description:
      "Clean QR code scanning & generator component with adaptive mobile layout and SVG rendering.",
    tags: [
      {
        name: "Reactjs",
        color: "blue-text-gradient",
      },
      {
        name: "Tailwind",
        color: "pink-text-gradient",
      },
    ],
    image: qrcode,
    source_code_link: "https://github.com/GANGANATHEN/qr-code-component-main",
    url: "https://ganganathan-qr-code-componant.netlify.app/",
  },
  {
    name: "score board",
    description:
      "Live cricket match score board tracker with real-time run tallying, wickets tracking, and over-by-over analysis.",
    tags: [
      {
        name: "HTML",
        color: "blue-text-gradient",
      },
      {
        name: "CSS",
        color: "orange-text-gradient",
      },
      {
        name: "JavaScript",
        color: "pink-text-gradient",
      },
    ],
    image: scoreboard,
    source_code_link: "https://github.com/GANGANATHEN/Score-board",
    url: "https://ganganathancricketscoreboard.netlify.app",
  },
  {
    name: "Grade Calculator",
    description:
      "Academic GPA and semester grade calculation application with instant score weighting and breakdown.",
    tags: [
      {
        name: "HTML",
        color: "blue-text-gradient",
      },
      {
        name: "CSS",
        color: "orange-text-gradient",
      },
      {
        name: "JavaScript",
        color: "pink-text-gradient",
      },
    ],
    image: grade,
    source_code_link: "https://github.com/GANGANATHEN/Grade-Calculator",
    url: "https://ganganathangradecal.netlify.app",
  },
  {
    name: "ShaChat",
    description:
      "Academic GPA and semester grade calculation application with instant score weighting and breakdown.",
    tags: [
      {
        name: "HTML",
        color: "blue-text-gradient",
      },
      {
        name: "CSS",
        color: "orange-text-gradient",
      },
      {
        name: "JavaScript",
        color: "pink-text-gradient",
      },
    ],
    image: grade,
    source_code_link: null,
    url: "https://ganganathangradecal.netlify.app",
  },
];
