import { z } from "zod";

export const contactSchema = z.object({
  type: z.enum(["Support", "Feedback"]),
  name: z.string().trim().min(1).max(100),
  accountEmail: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(120).refine(value => !/[\r\n]/.test(value)),
  message: z.string().trim().min(1).max(5000),
  device: z.enum(["Fire TV", "Browser"]),
  submissionId: z.string().uuid(),
  website: z.string().max(0),
});