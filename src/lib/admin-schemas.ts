import { z } from 'zod';
import { optionalId, optionalText, slug, text, wholeNumber } from '../core/forms';

/** The section form. */
export const sectionForm = z.object({
  name: text(60, 'Name the section.'),
  slug,
  description: optionalText(300),
  parentId: optionalId,
  sort: wholeNumber(0, 999),
});
