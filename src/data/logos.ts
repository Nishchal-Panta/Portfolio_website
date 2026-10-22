/**
 * The specimen board: every skill on the LinkedIn list, grouped into five
 * plates, with the mark each one carries.
 *
 * Two rules govern this file, and both are enforced by tools/verify-logos
 * rather than trusted to memory:
 *
 *   1. Every item here exists in src/content/skills.json, and every item in
 *      that file appears here. Nothing was added, and nothing was quietly
 *      dropped because it had no logo.
 *   2. Every mark points at a file in public/logos/ that has a row in
 *      public/logos/CREDITS.md.
 *
 * Context lines are facts with a source, not descriptions. `context` names
 * where the thing was actually used or learned, taken from a chapter in The
 * work or a credential in the ledger. `link` is only set where the item
 * genuinely belongs to a chapter. Where there is no verified context there is
 * no field at all, and the tile shows its name and nothing else.
 */

export interface Mark {
  /** file stem in public/logos, without the extension */
  file: string;
  /** which project reproduced the vendor's mark */
  source: 'Simple Icons' | 'Devicon';
  /** the direct URL the file was downloaded from */
  fileUrl: string;
  /** licence of the icon file itself */
  licence: string;
  /** the brand colour, used only where it is legible on the theme's surface */
  brand: string;
  /**
   * Which themes may show the brand colour on hover. Set by measuring the
   * brand colour against each theme's plate surface at 3:1, the WCAG 1.4.11
   * threshold for a graphical object. GitHub's near-black and pandas' navy
   * disappear on the dark plate; Hugging Face's yellow and the AWS orange
   * disappear on the light one.
   */
  brandOn: 'both' | 'light' | 'dark';
  /** brand-usage note that applies on top of the file licence */
  note: string;
}

export interface Item {
  name: string;
  mark?: Mark;
  /** one sourced line, shown on hover or focus. Absent where there is none. */
  context?: string;
  /** in-page anchor, only where the item belongs to a chapter */
  link?: string;
  /**
   * A second destination on the same tile, for the one item that has both a
   * chapter behind it and documents proving it. It is a small link of its own
   * rather than a redirect of `link`, because the name's line still has to say
   * what the context line says: AWS is in The work, and the certificates are
   * in Proof. Only one item uses this.
   */
  extra?: { href: string; label: string };
}

export interface Plate {
  id: string;
  name: string;
  blurb: string;
  items: Item[];
}

const SI = 'Simple Icons';
const DV = 'Devicon';
const SI_LICENCE = 'CC0 1.0 (icon file)';
const DV_LICENCE = 'MIT (icon file)';
/* The icon file's licence says nothing about the mark inside it. Every one of
   these is a trademark of its owner, used here only to identify the tool the
   name refers to. That is the plain-identification reading of nominative fair
   use, and it is why the marks are shown monochrome, undistorted, and never
   next to a claim of endorsement. */
const TRADEMARK =
  'Trademark of the owner; icon file licence does not licence the mark. Reproduced undistorted and monochrome to identify the tool.';

export const PLATES: Plate[] = [
  {
    id: 'machine-learning',
    name: 'Machine learning',
    blurb: 'The thread I keep pulling on.',
    items: [
      {
        name: 'Machine Learning',
        context: 'The intrusion detection work in The work.',
        link: '#work',
      },
      {
        name: 'Deep Learning',
        context: 'The first intrusion detection system in The work.',
        link: '#work',
      },
      /* These three are certificate names verbatim, so the tile and the ledger
         row are the same fact stated twice: the link joins them rather than
         leaving a certificate stranded from the row that proves it. */
      {
        name: 'Supervised Learning with scikit-learn',
        /* Date and hours, because the tile already carries the course title
           and an issuer alone would be filler under it. */
        context: 'DataCamp, completed 17 Jan 2026, 4 hours.',
        link: '#cred-datacamp-supervised',
      },
      {
        name: 'Unsupervised Learning in Python',
        context: 'DataCamp, completed 30 Jan 2026, 4 hours.',
        link: '#cred-datacamp-unsupervised',
      },
      {
        name: 'Introduction to Deep Learning with PyTorch',
        /* Date and hours rather than the course name again: the PyTorch tile
           below already names this course, and two tiles repeating one line
           would read as a copy-paste rather than two facts. */
        context: 'DataCamp, completed 10 Nov 2025, 4 hours.',
        link: '#cred-datacamp-dl-pytorch',
      },
      { name: 'Data Mining' },
      { name: 'Transformer Models' },
      { name: 'Large Language Models (LLM)' },
      {
        name: 'PyTorch',
        context: 'DataCamp, Introduction to Deep Learning with PyTorch.',
        /* The context is a credential, so the link goes to that credential's
           row in the ledger rather than to a project that does not use it. */
        link: '#cred-datacamp-dl-pytorch',
        mark: {
          file: 'pytorch',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/pytorch.svg',
          licence: SI_LICENCE,
          brand: '#EE4C2C',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      {
        name: 'Hugging Face',
        context: 'DataCamp, completed 4 Jun 2026, 2 hours.',
        link: '#cred-datacamp-huggingface',
        mark: {
          file: 'huggingface',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/huggingface.svg',
          licence: SI_LICENCE,
          brand: '#FFD21E',
          brandOn: 'dark',
          note: TRADEMARK,
        },
      },
    ],
  },
  {
    id: 'backend-data',
    name: 'Backend & data',
    blurb: 'Enough to be dangerous in each.',
    items: [
      {
        name: 'Python (Programming Language)',
        /* The ledger calls this one "Introduction to Python" - the certificate
           is for the course, not for the language, so the context names the
           course rather than claiming a certificate in Python itself. */
        context: 'DataCamp, Introduction to Python.',
        link: '#cred-datacamp-python',
        mark: {
          file: 'python',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/python.svg',
          licence: SI_LICENCE,
          brand: '#3776AB',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      {
        name: 'Intermediate Python',
        context: 'DataCamp, Intermediate Python.',
        link: '#cred-datacamp-intermediate-python',
      },
      {
        name: 'Java',
        mark: {
          file: 'java',
          source: DV,
          fileUrl: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/java/java-plain.svg',
          licence: DV_LICENCE,
          brand: '#EA2D2E',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      {
        name: 'MySQL',
        mark: {
          file: 'mysql',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/mysql.svg',
          licence: SI_LICENCE,
          brand: '#4479A1',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      {
        name: 'pandas',
        context: 'DataCamp, Data Manipulation with pandas.',
        link: '#cred-datacamp-pandas',
        mark: {
          file: 'pandas',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/pandas.svg',
          licence: SI_LICENCE,
          brand: '#150458',
          brandOn: 'light',
          note: TRADEMARK,
        },
      },
    ],
  },
  {
    id: 'web-interface',
    name: 'Web & interface',
    blurb: 'Things with users on the other end.',
    items: [
      {
        name: 'HTML',
        mark: {
          file: 'html5',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/html5.svg',
          licence: SI_LICENCE,
          brand: '#E34F26',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      {
        name: 'Cascading Style Sheets (CSS)',
        mark: {
          file: 'css3',
          source: DV,
          fileUrl: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/css3/css3-plain.svg',
          licence: DV_LICENCE,
          brand: '#1572B6',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      { name: 'Web Development' },
      {
        name: 'Web Development (Laravel)',
        /* The certificate this skill was earned with, not the project: the
           Laravel tile below already points at the chapter in The work. */
        context: "IIMS College with Taylor's University, 65 hours.",
        link: '#cred-laravel-training',
      },
      {
        name: 'Laravel',
        context: 'A production Laravel platform, in The work.',
        link: '#work',
        mark: {
          file: 'laravel',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/laravel.svg',
          licence: SI_LICENCE,
          brand: '#FF2D20',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      { name: 'Full-Stack Development' },
      { name: 'Desktop Application Development' },
      /* JavaFX has no mark of its own. Oracle licenses the Java brand and
         ships JavaFX without a logo, and no vendor press kit publishes one, so
         the tile is text-only rather than borrowing Java's mark: standing in
         for another product is exactly the substitution the brief rules out. */
      { name: 'JavaFX' },
    ],
  },
  {
    id: 'cloud-platform',
    name: 'Cloud & platform',
    blurb: 'The three-month detour that turned into a direction.',
    items: [
      {
        name: 'Amazon Web Services (AWS)',
        context: 'Both AWS builds are in The work.',
        link: '#work',
        /* The name goes to The work because that is what the context line says.
           The documents are a separate destination, so they get their own link
           rather than being smuggled into one that claims to point at the work.
           The target is the first of the three AWS badges in Proof. */
        extra: { href: '#cred-aws-cloud-practitioner', label: '3 certificates' },
        mark: {
          file: 'aws',
          source: DV,
          fileUrl:
            'https://raw.githubusercontent.com/devicons/devicon/master/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg',
          licence: DV_LICENCE,
          brand: '#FF9900',
          brandOn: 'dark',
          /* The AWS Architecture Icons are distributed under Amazon's own terms
             and are handed out against acceptance of that agreement, so they
             are not copied into this repo. This is the AWS wordmark instead,
             reproduced by Devicon. No specific AWS service is named by this
             skill, so a service icon would not have been the right mark. */
          note: `${TRADEMARK} AWS Architecture Icons were not used: they ship under Amazon's own terms, not a free licence.`,
        },
      },
      { name: 'Cloud Computing' },
      { name: 'Solution Architecture' },
      {
        name: 'Git',
        mark: {
          file: 'git',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/git.svg',
          licence: SI_LICENCE,
          brand: '#F03C2E',
          brandOn: 'both',
          note: TRADEMARK,
        },
      },
      {
        name: 'GitHub',
        context: 'Every chapter in The work links to its repository.',
        link: '#work',
        mark: {
          file: 'github',
          source: SI,
          fileUrl: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/github.svg',
          licence: SI_LICENCE,
          brand: '#181717',
          brandOn: 'light',
          note: TRADEMARK,
        },
      },
    ],
  },
  {
    id: 'practice',
    name: 'Practice',
    blurb: 'The part no repository records.',
    /* Nothing in this plate has a mark, and that is the point: a practice is
       not a product, and drawing one a logo would be inventing a brand. */
    items: [
      { name: 'Object-Oriented Programming (OOP)' },
      { name: 'Leadership' },
      { name: 'Communication' },
      { name: 'Presentation Skills' },
    ],
  },
];

/** Every item flattened, in plate order. Used by the build checks. */
export const ALL_ITEMS: Item[] = PLATES.flatMap((p) => p.items);

/** Items that carry no mark, so the report can name them. */
export const TEXT_ONLY: string[] = ALL_ITEMS.filter((i) => !i.mark).map((i) => i.name);

/** Items with no verified context, so the report can name those too. */
export const NO_CONTEXT: string[] = ALL_ITEMS.filter((i) => !i.context).map((i) => i.name);

/** The source line, kept verbatim from the file it came from. */
export const SKILLS_SOURCE =
  'As listed on my LinkedIn Skills page. No proficiency scores, because self-assessed percentages are not evidence.';
