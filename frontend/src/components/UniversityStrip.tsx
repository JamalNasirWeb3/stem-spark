import Image, { type StaticImageData } from "next/image";
import aiou from "@/assets/universities/aiou.jpg";
import awkum from "@/assets/universities/awkum.jpg";
import buetKhuzdar from "@/assets/universities/buet-khuzdar.jpg";
import ustBannu from "@/assets/universities/ust-bannu.jpg";

const UNIVERSITIES: { name: string; photo: StaticImageData; alt: string }[] = [
  {
    name: "Allama Iqbal Open University",
    photo: aiou,
    alt: "Allama Iqbal Open University entrance sign",
  },
  {
    name: "Abdul Wali Khan University Mardan",
    photo: awkum,
    alt: "Abdul Wali Khan University Mardan main building with AWKUM letters on the lawn",
  },
  {
    name: "University of Science & Technology Bannu",
    photo: ustBannu,
    alt: "University of Science & Technology Bannu main gate",
  },
  {
    name: "Balochistan University of Engineering & Technology Khuzdar",
    photo: buetKhuzdar,
    alt: "Balochistan University of Engineering & Technology Khuzdar campus",
  },
];

export default function UniversityStrip() {
  return (
    <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {UNIVERSITIES.map((u) => (
        <li key={u.name} className="overflow-hidden rounded-xl border border-line bg-card">
          <Image
            src={u.photo}
            alt={u.alt}
            placeholder="blur"
            sizes="(max-width: 640px) 50vw, 220px"
            className="aspect-video w-full object-cover"
          />
          <p className="px-3 py-2 text-xs leading-snug text-muted sm:text-sm">{u.name}</p>
        </li>
      ))}
    </ul>
  );
}
