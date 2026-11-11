import {
  Literata_400Regular,
  Literata_400Regular_Italic,
  Literata_500Medium,
  Literata_600SemiBold,
  useFonts,
} from '@expo-google-fonts/literata';

/** Loads the editorial serif. Returns true when ready (or when loading failed — system serif fallback). */
export function useFaithFonts(): boolean {
  const [loaded, error] = useFonts({
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_500Medium,
    Literata_600SemiBold,
  });
  return loaded || error !== null;
}
