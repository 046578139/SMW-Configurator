/**
 * The active instrument profile.
 *
 * Everything the page knows about a particular instrument - its catalog,
 * the rules that go beyond an option's own requirements, the derived
 * capabilities, the drawings, the starting points, the storage keys - is
 * one object, the profile, that a page activates once at boot. The engine,
 * the interface helpers, the stores and the readers reach it through
 * `inst()` at call time and never import an instrument themselves, which
 * is what lets a second instrument be another profile rather than another
 * copy of the page.
 *
 * A profile is data and hooks (see assets/js/smw200a/index.js for the
 * shape). Nothing here is read at module load: a core module that needs the
 * profile asks for it inside the function that needs it.
 */

let active = null;

/** Makes `profile` the instrument every core module works on from now. */
export function useInstrument (profile) {
  if (!profile || !profile.OPTIONS || !profile.BY_ID) throw new Error('an instrument profile needs a catalog');
  active = profile;
}

/** The active profile; throws when no page has activated one. */
export function inst () {
  if (!active) throw new Error('no instrument profile is active - call useInstrument() first');
  return active;
}
