export interface SystemCategory {
  id: string;
  name: string;
  label: string;
  description?: string;
}

/**
 * The 14 canonical system-defined categories matching the backend database seed and 00-SYSTEM_CONTEXT.md.
 * Categories are locked after community creation (confirmed v1 architectural decision).
 */
export const SYSTEM_CATEGORIES: SystemCategory[] = [
  {
    id: "ccec8541-95da-4bb4-aadb-199e5fe633d8",
    name: "technology",
    label: "Technology",
    description: "Coding, hardware, AI, web dev, gadgets, and tech discussions.",
  },
  {
    id: "acc7a2e3-c005-4bd9-9258-0926b9842d75",
    name: "gaming",
    label: "Gaming",
    description: "PC, console, esports, tabletop, and game development.",
  },
  {
    id: "dea55590-5148-4723-9063-008edbe3adf7",
    name: "anime_manga",
    label: "Anime & Manga",
    description: "Anime series, manga, cosplay, conventions, and discussions.",
  },
  {
    id: "13615218-a8d8-4f55-89ee-093048b61ee2",
    name: "movies_tv",
    label: "Movies & TV",
    description: "Film critique, television shows, cinema, and screenwriting.",
  },
  {
    id: "78373e34-693b-4c7b-8feb-f90bca7bf0cf",
    name: "arts_creativity",
    label: "Arts & Creativity",
    description: "Visual arts, digital illustration, crafts, photography, and design.",
  },
  {
    id: "f144d4ed-837e-4697-bd18-4d6bed5c1658",
    name: "education_study_groups",
    label: "Education & Study Groups",
    description: "Academic subjects, language learning, study circles, and tutoring.",
  },
  {
    id: "3820344b-4b67-497b-8048-703419198629",
    name: "books_writing",
    label: "Books & Writing",
    description: "Literature, creative writing, poetry, reading clubs, and publishing.",
  },
  {
    id: "7579faeb-5385-436a-b2a7-24a087233220",
    name: "music_entertainment",
    label: "Music & Entertainment",
    description: "Musicians, production, concerts, playlists, and audio gear.",
  },
  {
    id: "5362e75a-a594-4818-b791-1138d380284e",
    name: "health_fitness",
    label: "Health & Fitness",
    description: "Workout routines, wellness, nutrition, yoga, and healthy living.",
  },
  {
    id: "1a55efee-d85e-4dab-b299-8984d9841ebf",
    name: "outdoor_adventure",
    label: "Outdoor & Adventure",
    description: "Hiking, camping, climbing, trail running, and nature exploring.",
  },
  {
    id: "868a9d88-bee0-44bb-889a-d12b4d8c1d71",
    name: "sports",
    label: "Sports",
    description: "Football, basketball, athletics, leagues, and recreational games.",
  },
  {
    id: "5b07025d-c09a-43ad-af8c-75b11601bd48",
    name: "social_lifestyle",
    label: "Social & Lifestyle",
    description: "Local hangouts, food & dining, casual meetups, and hobbies.",
  },
  {
    id: "c4e7d532-7709-4e18-b6ae-cee521298e65",
    name: "culture_language",
    label: "Culture & Language",
    description: "Cultural exchange, tradition, travel, and language practice.",
  },
  {
    id: "3eb224da-e96f-44ad-a231-0d449e3ac69e",
    name: "other",
    label: "Other",
    description: "Specialized niches and all other community interests.",
  },
];

export function getCategoryById(id?: string | null): SystemCategory | undefined {
  if (!id) return undefined;
  return SYSTEM_CATEGORIES.find((cat) => cat.id === id);
}

export function getCategoryByName(name?: string | null): SystemCategory | undefined {
  if (!name) return undefined;
  return SYSTEM_CATEGORIES.find((cat) => cat.name.toLowerCase() === name.toLowerCase());
}
