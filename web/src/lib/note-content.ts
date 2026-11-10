import { z } from "zod";
import { levels } from "./models";

export const noteContentSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  level: z.enum(levels),
  no: z.string(),
  filename: z.string().min(1),
  minutes: z.number().int().positive(),
  excerpt: z.string(),
  quizId: z.string().optional(),
  markdown: z.string(),
});

export const notesPayloadSchema = z.object({
  notes: z.array(noteContentSchema),
});

export type NoteContent = z.infer<typeof noteContentSchema>;
export type NotesPayload = z.infer<typeof notesPayloadSchema>;
