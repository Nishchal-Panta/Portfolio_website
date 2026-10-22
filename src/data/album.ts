import type { ImageMetadata } from 'astro';

/**
 * The album.
 *
 * Every photograph in `assets/Carousel_photos`, not the eight that used to be
 * referenced: the folder is the collection, and the album claims to show it.
 *
 * Static imports rather than import.meta.glob: globbing raw image files makes
 * Astro emit every untouched original into the output as well as the
 * derivatives, which added ~40 MB of dead weight. Nothing here is ever served
 * raw - the largest original is 6150x4100 and 29 MB, and only resized
 * derivatives of it reach the browser.
 *
 * `alt` describes what is actually in the frame and names nobody: several
 * photographs contain other people, and their names are not mine to write.
 * `caption` is optional and empty by default, so it renders no element at all;
 * it is there for the day a photograph has something worth saying underneath
 * it. Text that is printed inside a photograph - a badge, a banner, a cheque -
 * is described rather than transcribed.
 */
import p0 from '@assets/album/1790495164487.jpg';
import p1 from '@assets/album/1790495164622.jpg';
import p2 from '@assets/album/1790495164677.jpg';
import p3 from '@assets/album/1790495164806.jpg';
import p4 from '@assets/album/1790495165040.jpg';
import p5 from '@assets/album/1790495165221.jpg';
import p6 from '@assets/album/FB_IMG_1767083928498.jpg';
import p7 from '@assets/album/FB_IMG_1767083934972.jpg';
import p8 from '@assets/album/FB_IMG_1767083943425.jpg';
import p9 from '@assets/album/FB_IMG_1769050313046.jpg';
import p10 from '@assets/album/IMG-20260727-WA0183.jpg';
import p11 from '@assets/album/IMG-20260728-WA0003.jpg';
import p12 from '@assets/album/IMG-20260728-WA0004.jpg';

export interface Photo {
  src: ImageMetadata;
  alt: string;
  caption: string;
}

export const album: Photo[] = [
  {
    src: p0,
    alt: 'A person standing with hands folded in front of a hackathon backdrop covered in sponsor logos.',
    caption: '',
  },
  {
    src: p1,
    alt: 'A person standing inside a red photo-frame prop at a college stall, with white and blue balloons above it.',
    caption: '',
  },
  {
    src: p2,
    alt: 'A person with a backpack holding a large ceremonial cheque from a hackathon prize giving.',
    caption: '',
  },
  {
    src: p3,
    alt: 'A close-up of an event badge on a lanyard, showing a QR code and the organiser’s branding.',
    caption: '',
  },
  {
    src: p4,
    alt: 'Three people at a commencement ceremony: the graduate in the centre, wearing a maroon stole, is handed a certificate.',
    caption: '',
  },
  {
    src: p5,
    alt: 'Three people holding a trophy and a winner’s cheque in front of a yellow event banner.',
    caption: '',
  },
  {
    src: p6,
    alt: 'A video still of a group on stage at a hackathon prize distribution, with the player’s caption bar and progress bar across the frame.',
    caption: '',
  },
  {
    src: p7,
    alt: 'Two people on a stage, one handing a certificate to the other, in front of a green presentation screen.',
    caption: '',
  },
  {
    src: p8,
    alt: 'A large group of participants posing together in a room, in front of a projection screen.',
    caption: '',
  },
  {
    src: p9,
    alt: 'Two people shaking hands and holding a certificate in front of a college backdrop.',
    caption: '',
  },
  {
    src: p10,
    alt: 'A line-up of participants outside a hackathon backdrop, with confetti in the air.',
    caption: '',
  },
  {
    src: p11,
    alt: 'Three people at a desk with laptops during a hackathon, one of them holding up a phone.',
    caption: '',
  },
  {
    src: p12,
    alt: 'Two people standing side by side in front of a hackathon backdrop.',
    caption: '',
  },
];
